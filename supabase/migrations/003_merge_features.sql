-- AgroGear v3: community features on top of the v2 upgrade.
-- Run AFTER schema.sql and 002_v2_upgrade.sql. Safe to re-run.
--
-- Adds: profile avatars, account suspension, listing coordinates, Agro stores (nearest-store
-- finder), messaging between users, live machine-location sharing, and admin tooling.
-- Uses v2's profiles / is_admin / is_active (listing) design; nothing here replaces v2 tables.

------------------------------------------------------------------------------
-- 0. Hotfix: renting a showcase listing (no owner) failed with
--    'null value in column "user_id" of relation "notifications"'.
--    notify() now skips missing recipients.
------------------------------------------------------------------------------
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_booking bigint default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, kind, title, body, booking_id) values (p_user, p_kind, p_title, p_body, p_booking);
end $$;

------------------------------------------------------------------------------
-- 1. Profiles: avatar + suspension
------------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url       text;
alter table public.profiles add column if not exists account_status   text not null default 'active'
  check (account_status in ('active','suspended'));
alter table public.profiles add column if not exists suspended_reason text;

-- Active account? (admins are always treated as active)
create or replace function public.account_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select account_status = 'active' or is_admin from public.profiles where id = auth.uid()), false)
$$;
grant execute on function public.account_active() to anon, authenticated;

-- Extend the v2 guard: users cannot change their own suspension fields.
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if current_setting('agrogear.bypass_guard', true) = 'on' or auth.uid() is null then
    new.updated_at := now();
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.is_admin is distinct from old.is_admin
     or new.id_type is distinct from old.id_type
     or new.id_number_last4 is distinct from old.id_number_last4
     or new.id_doc_path is distinct from old.id_doc_path
     or new.rejection_reason is distinct from old.rejection_reason
     or new.verified_at is distinct from old.verified_at
     or new.account_status is distinct from old.account_status
     or new.suspended_reason is distinct from old.suspended_reason then
    raise exception 'Protected profile fields cannot be edited directly.';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert to authenticated
  with check (id = auth.uid() and verification_status = 'unverified' and is_admin = false and account_status = 'active');

-- Public view now also exposes the avatar (still no phone, address or ID data).
drop view if exists public.equipment_feed;
create or replace view public.public_profiles as
  select id, full_name, state, farm_name, bio,
         (verification_status = 'verified') as is_verified,
         verified_at, created_at, avatar_url
  from public.profiles;
grant select on public.public_profiles to anon, authenticated;

-- ---- Admin: manage users ---------------------------------------------------
create or replace function public.admin_list_users()
returns table (id uuid, email text, full_name text, phone text, state text, avatar_url text,
               verification_status text, is_admin boolean, account_status text,
               suspended_reason text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return query
  select p.id, u.email::text, p.full_name, p.phone, p.state, p.avatar_url,
         p.verification_status, p.is_admin, p.account_status, p.suspended_reason,
         p.created_at, u.last_sign_in_at
    from public.profiles p
    left join auth.users u on u.id = p.id
   order by p.created_at desc;
end $$;
grant execute on function public.admin_list_users() to authenticated;

-- Edit a user's details / suspend / promote. Pass only what should change.
create or replace function public.admin_update_user(
  p_user uuid,
  p_full_name text default null, p_phone text default null, p_state text default null,
  p_status text default null, p_reason text default null, p_is_admin boolean default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_status is not null and p_status not in ('active','suspended') then raise exception 'Invalid status.'; end if;
  if p_user = auth.uid() and (p_status = 'suspended' or p_is_admin = false) then
    raise exception 'You cannot suspend or demote yourself.';
  end if;
  perform set_config('agrogear.bypass_guard', 'on', true);
  update public.profiles set
    full_name        = coalesce(p_full_name, full_name),
    phone            = coalesce(p_phone, phone),
    state            = coalesce(p_state, state),
    account_status   = coalesce(p_status, account_status),
    suspended_reason = case when p_status = 'active' then null
                            when p_status = 'suspended' then nullif(trim(coalesce(p_reason,'')), '')
                            else suspended_reason end,
    is_admin         = coalesce(p_is_admin, is_admin)
  where id = p_user;
  if p_status = 'suspended' then
    perform public.notify(p_user, 'account', 'Account suspended',
      coalesce(nullif(trim(coalesce(p_reason,'')), ''), 'Your account has been suspended by an administrator.'));
  elsif p_status = 'active' then
    perform public.notify(p_user, 'account', 'Account restored', 'Your account is active again.');
  end if;
end $$;
grant execute on function public.admin_update_user(uuid, text, text, text, text, text, boolean) to authenticated;

-- ---- Admin: dashboard stats ------------------------------------------------
create or replace function public.admin_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return jsonb_build_object(
    'users',           (select count(*) from public.profiles),
    'suspended',       (select count(*) from public.profiles where account_status = 'suspended'),
    'pending_verifications', (select count(*) from public.profiles where verification_status = 'pending'),
    'listings',        (select count(*) from public.equipment where owner_id is not null),
    'hidden_listings', (select count(*) from public.equipment where owner_id is not null and not is_active),
    'bookings',        (select count(*) from public.bookings),
    'open_bookings',   (select count(*) from public.bookings where status in ('pending','approved','paid','dispatched','active','returned')),
    'disputes',        (select count(*) from public.bookings where status = 'disputed'),
    'gmv',             (select coalesce(sum(grand_total), 0) from public.bookings where status in ('paid','dispatched','active','returned','completed')),
    'stores',          (select count(*) from public.stores),
    'unverified_stores', (select count(*) from public.stores where not verified),
    'conversations',   (select count(*) from public.conversations)
  );
end $$;
grant execute on function public.admin_stats() to authenticated;

------------------------------------------------------------------------------
-- 2. Listings: coordinates, moderation, suspension
------------------------------------------------------------------------------
alter table public.equipment add column if not exists latitude  double precision;
alter table public.equipment add column if not exists longitude double precision;

update public.equipment set latitude = v.lat, longitude = v.lng
from (values
  ('Abuja, FCT', 9.0765, 7.3986), ('Kaduna, Kaduna', 10.5105, 7.4165), ('Kano, Kano', 12.0022, 8.5919),
  ('Jos, Plateau', 9.8965, 8.8583), ('Minna, Niger', 9.6139, 6.5569), ('Ibadan, Oyo', 7.3775, 3.9470),
  ('Enugu, Enugu', 6.4584, 7.5464), ('Makurdi, Benue', 7.7337, 8.5214)
) as v(loc, lat, lng)
where equipment.location = v.loc and equipment.owner_id is null and equipment.latitude is null;

-- Moderation uses v2's is_active flag. Owners may not re-enable a listing an admin hid
-- (admin-hidden listings are tracked in moderated_by_admin).
alter table public.equipment add column if not exists moderated boolean not null default false;

create or replace function public.equipment_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'UPDATE' then
      new.moderated := old.moderated;
      if old.moderated then new.is_active := old.is_active; end if;
    else
      new.moderated := false;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists equipment_guard_trg on public.equipment;
create trigger equipment_guard_trg before insert or update on public.equipment
  for each row execute function public.equipment_guard();

drop policy if exists "admins manage equipment" on public.equipment;
create policy "admins manage equipment" on public.equipment for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Admin: hide / restore a listing.
create or replace function public.admin_set_listing(p_equipment bigint, p_visible boolean)
returns void language plpgsql security definer set search_path = public as $$
declare eq public.equipment;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.equipment set is_active = p_visible, moderated = not p_visible
   where id = p_equipment returning * into eq;
  if eq.owner_id is not null then
    perform public.notify(eq.owner_id, 'listing',
      case when p_visible then 'Listing restored' else 'Listing hidden by moderators' end,
      eq.name || case when p_visible then ' is visible again.' else ' was hidden because it did not meet marketplace rules.' end);
  end if;
end $$;
grant execute on function public.admin_set_listing(bigint, boolean) to authenticated;

-- Suspended accounts cannot publish listings.
drop policy if exists "owners insert equipment" on public.equipment;
create policy "owners insert equipment" on public.equipment for insert to authenticated
  with check (owner_id = auth.uid() and featured = false and public.account_active());

-- Suspended accounts cannot request rentals (create_booking is security definer, so check inside).
do $$
declare def text;
begin
  select pg_get_functiondef('public.create_booking(bigint,date,date,text,text,text,text,text)'::regprocedure) into def;
  if def not like '%account_active%' then
    def := replace(def,
      'if auth.uid() is null then raise exception ''Sign in first.''; end if;',
      'if auth.uid() is null then raise exception ''Sign in first.''; end if;' || E'\n' ||
      '  if not public.account_active() then raise exception ''Your account is suspended.''; end if;');
    execute def;
  end if;
end $$;

-- Rebuild the feed view (dropped above) with avatar + coordinates (e.* picks up the new columns).
create view public.equipment_feed as
select e.*,
       coalesce(p.full_name, '')       as owner_name,
       coalesce(p.is_verified, false)  as owner_verified,
       p.avatar_url                    as owner_avatar,
       coalesce(r.avg_rating, 0)       as avg_rating,
       coalesce(r.review_count, 0)     as review_count
from public.equipment e
left join public.public_profiles p on p.id = e.owner_id
left join (select equipment_id, round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as review_count
           from public.reviews group by equipment_id) r on r.equipment_id = e.id
where e.is_active;
grant select on public.equipment_feed to anon, authenticated;

-- ---- Admin: read every booking ---------------------------------------------
drop policy if exists "admins read bookings" on public.bookings;
create policy "admins read bookings" on public.bookings for select to authenticated
  using (public.is_admin());

------------------------------------------------------------------------------
-- 3. Agro stores (community-added, admin-verified)
------------------------------------------------------------------------------
create table if not exists public.stores (
  id         bigint generated always as identity primary key,
  created_by uuid references auth.users(id) on delete set null,
  name       text not null check (char_length(name) between 2 and 120),
  address    text,
  city       text,
  phone      text,
  latitude   double precision not null check (latitude between -90 and 90),
  longitude  double precision not null check (longitude between -180 and 180),
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.stores enable row level security;

drop policy if exists "stores are public" on public.stores;
create policy "stores are public" on public.stores for select using (true);
drop policy if exists "users add stores" on public.stores;
create policy "users add stores" on public.stores for insert to authenticated
  with check (created_by = auth.uid() and verified = false and public.account_active());
drop policy if exists "creators edit unverified stores" on public.stores;
create policy "creators edit unverified stores" on public.stores for update to authenticated
  using (created_by = auth.uid() and not verified and public.account_active())
  with check (created_by = auth.uid() and verified = false);
drop policy if exists "creators delete unverified stores" on public.stores;
create policy "creators delete unverified stores" on public.stores for delete to authenticated
  using (created_by = auth.uid() and not verified);
drop policy if exists "admins manage stores" on public.stores;
create policy "admins manage stores" on public.stores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

------------------------------------------------------------------------------
-- 4. Messaging + live machine location
------------------------------------------------------------------------------
create table if not exists public.conversations (
  id              bigint generated always as identity primary key,
  equipment_id    bigint references public.equipment(id) on delete set null,
  renter_id       uuid not null references auth.users(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  last_message    text,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (equipment_id, renter_id),
  check (renter_id <> owner_id)
);

create table if not exists public.messages (
  id              bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  kind            text not null default 'text' check (kind in ('text','system')),
  body            text not null check (char_length(body) between 1 and 2000),
  created_at      timestamptz not null default now()
);

create table if not exists public.live_shares (
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  user_id         uuid   not null references auth.users(id) on delete cascade,
  latitude        double precision not null,
  longitude       double precision not null,
  accuracy        real,
  heading         real,
  speed           real,
  active          boolean not null default true,
  started_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists conversations_renter_idx on public.conversations(renter_id);
create index if not exists conversations_owner_idx on public.conversations(owner_id);

create or replace function public.in_conversation(cid bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations c where c.id = cid and auth.uid() in (c.renter_id, c.owner_id));
$$;
grant execute on function public.in_conversation(bigint) to authenticated;

create or replace function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message = left(new.body, 120), last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation after insert on public.messages
  for each row execute function public.touch_conversation();

alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.live_shares   enable row level security;

drop policy if exists "participants read conversations" on public.conversations;
create policy "participants read conversations" on public.conversations for select to authenticated
  using (auth.uid() in (renter_id, owner_id));
drop policy if exists "renters start conversations" on public.conversations;
create policy "renters start conversations" on public.conversations for insert to authenticated
  with check (
    renter_id = auth.uid() and public.account_active()
    and exists (select 1 from public.equipment e where e.id = equipment_id and e.owner_id = conversations.owner_id)
  );

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages for select to authenticated
  using (public.in_conversation(conversation_id));
drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.in_conversation(conversation_id) and public.account_active());

drop policy if exists "participants read live shares" on public.live_shares;
create policy "participants read live shares" on public.live_shares for select to authenticated
  using (public.in_conversation(conversation_id));
drop policy if exists "users write own live share" on public.live_shares;
create policy "users write own live share" on public.live_shares for insert to authenticated
  with check (user_id = auth.uid() and public.in_conversation(conversation_id) and public.account_active());
drop policy if exists "users update own live share" on public.live_shares;
create policy "users update own live share" on public.live_shares for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.in_conversation(conversation_id));
drop policy if exists "users delete own live share" on public.live_shares;
create policy "users delete own live share" on public.live_shares for delete to authenticated
  using (user_id = auth.uid());

do $$ begin alter publication supabase_realtime add table public.messages;    exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.live_shares; exception when duplicate_object then null; end $$;

------------------------------------------------------------------------------
-- 5. Avatar storage
------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars are public" on storage.objects;
create policy "avatars are public" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- First admin (run once, replace the email):
-- update public.profiles set is_admin = true where id = (select id from auth.users where email = 'YOUR-EMAIL-HERE');
