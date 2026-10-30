-- AgroGear v2: profiles, admin roles, Agro stores, messaging, live location, avatars.
-- Run AFTER schema.sql, once, in Supabase → SQL Editor.

-- ───────────────────────── Profiles ─────────────────────────
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text not null default '',
  city             text,
  bio              text,
  avatar_url       text,
  role             text not null default 'user'   check (role in ('user','admin')),
  status           text not null default 'active' check (status in ('active','suspended')),
  suspended_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Emails live in a separate table so only the owner and admins can read them.
create table if not exists public.profile_private (
  id    uuid primary key references auth.users(id) on delete cascade,
  email text
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

grant execute on function public.is_admin(), public.is_active() to anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1), ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  ) on conflict (id) do nothing;
  insert into public.profile_private (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill accounts created before this migration.
insert into public.profiles (id, full_name)
  select id, coalesce(raw_user_meta_data->>'full_name', split_part(coalesce(email, ''), '@', 1), '') from auth.users
  on conflict (id) do nothing;
insert into public.profile_private (id, email) select id, email from auth.users on conflict (id) do nothing;

-- Only admins can change role / status. Direct SQL (no JWT) is allowed, which is how the first admin is created.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.suspended_reason := old.suspended_reason;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns before update on public.profiles
  for each row execute function public.protect_profile();

alter table public.profiles        enable row level security;
alter table public.profile_private enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists "private email own or admin" on public.profile_private;
create policy "private email own or admin" on public.profile_private for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- ───────────────────────── Equipment: location, moderation, admin ─────────────────────────
alter table public.equipment add column if not exists latitude  double precision;
alter table public.equipment add column if not exists longitude double precision;
alter table public.equipment add column if not exists hidden    boolean not null default false;

update public.equipment set latitude = v.lat, longitude = v.lng
from (values
  ('Abuja, FCT', 9.0765, 7.3986), ('Kaduna, Kaduna', 10.5105, 7.4165), ('Kano, Kano', 12.0022, 8.5919),
  ('Jos, Plateau', 9.8965, 8.8583), ('Minna, Niger', 9.6139, 6.5569), ('Ibadan, Oyo', 7.3775, 3.9470),
  ('Enugu, Enugu', 6.4584, 7.5464), ('Makurdi, Benue', 7.7337, 8.5214)
) as v(loc, lat, lng)
where equipment.location = v.loc and equipment.owner_id is null and equipment.latitude is null;

drop policy if exists "equipment is public" on public.equipment;
create policy "equipment is public" on public.equipment for select
  using (not hidden or owner_id = auth.uid() or public.is_admin());

drop policy if exists "owners insert equipment" on public.equipment;
create policy "owners insert equipment" on public.equipment for insert to authenticated
  with check (owner_id = auth.uid() and featured = false and hidden = false and public.is_active());

drop policy if exists "owners update equipment" on public.equipment;
create policy "owners update equipment" on public.equipment for update to authenticated
  using (owner_id = auth.uid() and public.is_active())
  with check (owner_id = auth.uid() and featured = false and hidden = false);

drop policy if exists "admins manage equipment" on public.equipment;
create policy "admins manage equipment" on public.equipment for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Suspended users cannot create bookings; admins can see and manage every booking.
drop policy if exists "renters create bookings" on public.bookings;
create policy "renters create bookings" on public.bookings for insert to authenticated
  with check (renter_id = auth.uid() and status = 'pending' and public.is_active());

drop policy if exists "admins manage bookings" on public.bookings;
create policy "admins manage bookings" on public.bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────── Agro stores ─────────────────────────
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
  with check (created_by = auth.uid() and verified = false and public.is_active());
drop policy if exists "creators edit unverified stores" on public.stores;
create policy "creators edit unverified stores" on public.stores for update to authenticated
  using (created_by = auth.uid() and not verified and public.is_active())
  with check (created_by = auth.uid() and verified = false);
drop policy if exists "creators delete unverified stores" on public.stores;
create policy "creators delete unverified stores" on public.stores for delete to authenticated
  using (created_by = auth.uid() and not verified);
drop policy if exists "admins manage stores" on public.stores;
create policy "admins manage stores" on public.stores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ───────────────────────── Messaging ─────────────────────────
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
  update public.conversations set last_message = left(new.body, 120), last_message_at = new.created_at where id = new.conversation_id;
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
    renter_id = auth.uid() and public.is_active()
    and exists (select 1 from public.equipment e where e.id = equipment_id and e.owner_id = conversations.owner_id)
  );

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages for select to authenticated
  using (public.in_conversation(conversation_id));
drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.in_conversation(conversation_id) and public.is_active());

drop policy if exists "participants read live shares" on public.live_shares;
create policy "participants read live shares" on public.live_shares for select to authenticated
  using (public.in_conversation(conversation_id));
drop policy if exists "users write own live share" on public.live_shares;
create policy "users write own live share" on public.live_shares for insert to authenticated
  with check (user_id = auth.uid() and public.in_conversation(conversation_id) and public.is_active());
drop policy if exists "users update own live share" on public.live_shares;
create policy "users update own live share" on public.live_shares for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.in_conversation(conversation_id));
drop policy if exists "users delete own live share" on public.live_shares;
create policy "users delete own live share" on public.live_shares for delete to authenticated
  using (user_id = auth.uid());

-- Realtime (ignore "already member" errors if you re-run this file).
do $$ begin alter publication supabase_realtime add table public.messages;    exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.live_shares; exception when duplicate_object then null; end $$;

-- ───────────────────────── Avatar storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

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

-- ───────────────────────── Make yourself the first admin ─────────────────────────
-- Replace the email, then run this line once:
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR-EMAIL-HERE');
