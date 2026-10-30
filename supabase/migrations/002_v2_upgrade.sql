-- AgroGear v2 upgrade. Run AFTER supabase/schema.sql, in Supabase -> SQL Editor.
-- Safe to re-run.
--
-- Adds: verified profiles, ID verification, richer listings, a server-enforced rental
-- lifecycle (request -> approve -> pay -> dispatch -> deliver -> active countdown -> return
-- -> complete), reviews, notifications and an availability view.

------------------------------------------------------------------------------
-- 1. Profiles + verification
------------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text not null default '',
  phone               text not null default '',
  state               text not null default '',
  address             text not null default '',
  bio                 text not null default '',
  farm_name           text not null default '',
  role_pref           text not null default 'both' check (role_pref in ('renter','owner','both')),
  verification_status text not null default 'unverified'
                        check (verification_status in ('unverified','pending','verified','rejected')),
  id_type             text check (id_type in ('nin','voters_card','drivers_licence','passport','cac')),
  id_number_last4     text,
  id_doc_path         text,
  rejection_reason    text,
  verified_at         timestamptz,
  is_admin            boolean not null default false,
  notify_email        boolean not null default true,
  notify_sms          boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- Profiles are publicly readable ONLY through the safe view below; the table itself is private.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());

drop policy if exists "admins read profiles" on public.profiles;
create policy "admins read profiles" on public.profiles for select to authenticated
  using (public.is_admin());

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert to authenticated
  with check (id = auth.uid() and verification_status = 'unverified' and is_admin = false);

-- Users may edit contact/settings fields only. Verification and admin columns are locked
-- (they can only change through the security-definer functions further down).
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
     or new.verified_at is distinct from old.verified_at then
    raise exception 'Verification fields cannot be edited directly.';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg before update on public.profiles
  for each row execute function public.profiles_guard();

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Public, non-sensitive view used by marketplace cards and owner pages.
create or replace view public.public_profiles as
  select id, full_name, state, farm_name, bio,
         (verification_status = 'verified') as is_verified,
         verified_at, created_at
  from public.profiles;
grant select on public.public_profiles to anon, authenticated;

-- Auto-create a profile whenever someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Back-fill profiles for users who signed up before this migration.
insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

-- Private bucket for ID documents. Path convention: <user_id>/<filename>
insert into storage.buckets (id, name, public) values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

drop policy if exists "upload own verification doc" on storage.objects;
create policy "upload own verification doc" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "read own verification doc" on storage.objects;
create policy "read own verification doc" on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or public.is_admin()));

-- Submit ID for review. Only the last 4 characters of the ID number are ever stored.
create or replace function public.submit_verification(p_id_type text, p_id_number text, p_doc_path text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Profile not found.'; end if;
  if me.verification_status = 'verified' then raise exception 'You are already verified.'; end if;
  if char_length(trim(me.full_name)) < 3 or char_length(trim(me.phone)) < 7 or char_length(trim(me.state)) < 2 then
    raise exception 'Complete your name, phone number and state before requesting verification.';
  end if;
  if p_id_type not in ('nin','voters_card','drivers_licence','passport','cac') then
    raise exception 'Choose a valid ID type.';
  end if;
  if char_length(coalesce(p_id_number,'')) < 6 then raise exception 'Enter your full ID number.'; end if;
  if coalesce(p_doc_path,'') = '' or split_part(p_doc_path, '/', 1) <> auth.uid()::text then
    raise exception 'Upload a photo of your ID document.';
  end if;

  perform set_config('agrogear.bypass_guard', 'on', true);
  update public.profiles
     set verification_status = 'pending', id_type = p_id_type,
         id_number_last4 = right(p_id_number, 4), id_doc_path = p_doc_path, rejection_reason = null
   where id = auth.uid();
end $$;

-- Admin approves / rejects.
create or replace function public.review_verification(p_user uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  perform set_config('agrogear.bypass_guard', 'on', true);
  update public.profiles
     set verification_status = case when p_approve then 'verified' else 'rejected' end,
         verified_at = case when p_approve then now() else null end,
         rejection_reason = case when p_approve then null else coalesce(nullif(p_reason,''), 'Document could not be verified.') end
   where id = p_user and verification_status = 'pending';
  insert into public.notifications (user_id, kind, title, body)
  values (p_user, 'verification',
          case when p_approve then 'You are verified ✓' else 'Verification needs attention' end,
          case when p_approve then 'Your AgroGear identity has been verified. A verified badge now shows on your listings.'
               else coalesce(nullif(p_reason,''), 'Document could not be verified. Please upload a clearer photo and resubmit.') end);
end $$;

------------------------------------------------------------------------------
-- 2. Richer listings
------------------------------------------------------------------------------
alter table public.equipment add column if not exists state            text not null default '';
alter table public.equipment add column if not exists condition        text not null default 'Good'
  check (condition in ('New','Excellent','Good','Fair'));
alter table public.equipment add column if not exists year_made        int  check (year_made between 1950 and 2100);
alter table public.equipment add column if not exists specs            text not null default '';
alter table public.equipment add column if not exists deposit          numeric(12,2) not null default 0 check (deposit >= 0);
alter table public.equipment add column if not exists min_days         int  not null default 1 check (min_days >= 1);
alter table public.equipment add column if not exists pickup_available boolean not null default true;
alter table public.equipment add column if not exists delivery_available boolean not null default false;
alter table public.equipment add column if not exists delivery_fee     numeric(12,2) not null default 0 check (delivery_fee >= 0);
alter table public.equipment add column if not exists with_operator    boolean not null default false;
alter table public.equipment add column if not exists images           text[] not null default '{}';
alter table public.equipment add column if not exists is_active        boolean not null default true;

-- Back-fill state from "City, State" style locations.
update public.equipment set state = trim(split_part(location, ',', 2)) where state = '' and position(',' in location) > 0;

create index if not exists equipment_state_idx    on public.equipment(state);
create index if not exists equipment_category_idx on public.equipment(category);
create index if not exists equipment_price_idx    on public.equipment(price_per_day);

-- Public bucket for listing photos. Path: <owner_id>/<filename>
insert into storage.buckets (id, name, public) values ('equipment-images', 'equipment-images', true)
on conflict (id) do nothing;

drop policy if exists "owners upload listing images" on storage.objects;
create policy "owners upload listing images" on storage.objects for insert to authenticated
  with check (bucket_id = 'equipment-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owners delete listing images" on storage.objects;
create policy "owners delete listing images" on storage.objects for delete to authenticated
  using (bucket_id = 'equipment-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "listing images are public" on storage.objects;
create policy "listing images are public" on storage.objects for select using (bucket_id = 'equipment-images');

------------------------------------------------------------------------------
-- 3. Bookings: full rental lifecycle
------------------------------------------------------------------------------
update public.bookings set status = 'approved' where status = 'confirmed';  -- old v1 status
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (status in (
  'pending',     -- renter requested, waiting for owner
  'approved',    -- owner accepted, waiting for payment
  'paid',        -- payment held in escrow, waiting for dispatch
  'dispatched',  -- owner sent / is handing over the machine
  'active',      -- renter confirmed receipt: usage countdown running
  'returned',    -- machine back with owner, awaiting owner inspection
  'completed',   -- owner confirmed condition, deposit released
  'declined','cancelled','disputed'));

alter table public.bookings add column if not exists rental_total      numeric(14,2) not null default 0;
alter table public.bookings add column if not exists delivery_fee      numeric(12,2) not null default 0;
alter table public.bookings add column if not exists deposit           numeric(12,2) not null default 0;
alter table public.bookings add column if not exists service_fee       numeric(12,2) not null default 0;
alter table public.bookings add column if not exists grand_total       numeric(14,2) not null default 0;
alter table public.bookings add column if not exists fulfilment        text not null default 'pickup' check (fulfilment in ('pickup','delivery'));
alter table public.bookings add column if not exists delivery_address  text;
alter table public.bookings add column if not exists payment_status    text not null default 'unpaid'
  check (payment_status in ('unpaid','held','released','refunded'));
alter table public.bookings add column if not exists payment_provider  text;
alter table public.bookings add column if not exists payment_reference text;
alter table public.bookings add column if not exists paid_at           timestamptz;
alter table public.bookings add column if not exists approved_at       timestamptz;
alter table public.bookings add column if not exists dispatched_at     timestamptz;
alter table public.bookings add column if not exists delivered_at      timestamptz;
alter table public.bookings add column if not exists rental_ends_at    timestamptz;
alter table public.bookings add column if not exists returned_at       timestamptz;
alter table public.bookings add column if not exists completed_at      timestamptz;
alter table public.bookings add column if not exists cancel_reason     text;
alter table public.bookings add column if not exists dispute_reason    text;
alter table public.bookings add column if not exists handover_note     text;
alter table public.bookings add column if not exists return_note       text;
alter table public.bookings add column if not exists updated_at        timestamptz not null default now();

-- Clients no longer write to bookings directly: every change goes through the functions below,
-- which compute prices on the server, block double-booking and enforce who may do what.
drop policy if exists "renters create bookings"        on public.bookings;
drop policy if exists "owners update booking status"   on public.bookings;
drop policy if exists "renters cancel own bookings"    on public.bookings;

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'info',
  title      text not null,
  body       text not null default '',
  booking_id bigint references public.bookings(id) on delete cascade,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "own notifications read" on public.notifications;
create policy "own notifications read" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "own notifications update" on public.notifications;
create policy "own notifications update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Platform fee, as a fraction of the rental total. 0 = no fee. Keep in sync with lib/pricing.ts.
create or replace function public.service_fee_rate() returns numeric language sql immutable as $$ select 0.00::numeric $$;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_booking bigint default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, booking_id) values (p_user, p_kind, p_title, p_body, p_booking);
$$;

-- Public availability: dates only, no personal data.
create or replace view public.booked_ranges as
  select equipment_id, start_date, end_date
  from public.bookings
  where status in ('approved','paid','dispatched','active','returned');
grant select on public.booked_ranges to anon, authenticated;

-- 3a. Create a booking request (price computed server-side).
create or replace function public.create_booking(
  p_equipment bigint, p_start date, p_end date, p_name text, p_phone text,
  p_note text, p_fulfilment text, p_address text
) returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  eq public.equipment; me public.profiles; d int; rt numeric; df numeric; fee numeric; b public.bookings;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into eq from public.equipment where id = p_equipment and is_active;
  if eq.id is null then raise exception 'This listing is no longer available.'; end if;
  if eq.owner_id = auth.uid() then raise exception 'You cannot rent your own equipment.'; end if;
  if p_start < current_date then raise exception 'Start date cannot be in the past.'; end if;
  if p_end < p_start then raise exception 'End date must be on or after the start date.'; end if;
  d := (p_end - p_start) + 1;
  if d < eq.min_days then raise exception 'Minimum rental for this machine is % day(s).', eq.min_days; end if;
  if d > 90 then raise exception 'Rentals are limited to 90 days. Contact the owner for longer terms.'; end if;
  if char_length(trim(coalesce(p_name,''))) < 2 or char_length(trim(coalesce(p_phone,''))) < 7 then
    raise exception 'Enter your name and a valid phone number.';
  end if;
  if p_fulfilment = 'delivery' then
    if not eq.delivery_available then raise exception 'The owner does not offer delivery for this machine.'; end if;
    if char_length(trim(coalesce(p_address,''))) < 5 then raise exception 'Enter a delivery address.'; end if;
  elsif p_fulfilment = 'pickup' then
    if not eq.pickup_available then raise exception 'The owner does not offer pickup for this machine.'; end if;
  else
    raise exception 'Choose pickup or delivery.';
  end if;
  if exists (select 1 from public.bookings x where x.equipment_id = p_equipment
             and x.status in ('approved','paid','dispatched','active','returned')
             and daterange(x.start_date, x.end_date, '[]') && daterange(p_start, p_end, '[]')) then
    raise exception 'Those dates are already booked. Pick different dates.';
  end if;
  if exists (select 1 from public.bookings x where x.equipment_id = p_equipment and x.renter_id = auth.uid()
             and x.status = 'pending' and daterange(x.start_date, x.end_date, '[]') && daterange(p_start, p_end, '[]')) then
    raise exception 'You already have a pending request for these dates.';
  end if;

  rt  := d * eq.price_per_day;
  df  := case when p_fulfilment = 'delivery' then eq.delivery_fee else 0 end;
  fee := round(rt * public.service_fee_rate(), 2);

  insert into public.bookings (equipment_id, renter_id, renter_name, renter_phone, start_date, end_date, days,
                               estimated_total, rental_total, delivery_fee, deposit, service_fee, grand_total,
                               note, fulfilment, delivery_address, status)
  values (p_equipment, auth.uid(), trim(p_name), trim(p_phone), p_start, p_end, d,
          rt, rt, df, eq.deposit, fee, rt + df + fee + eq.deposit,
          nullif(trim(coalesce(p_note,'')),''), p_fulfilment,
          case when p_fulfilment = 'delivery' then trim(p_address) end, 'pending')
  returning * into b;

  perform public.notify(eq.owner_id, 'booking', 'New rental request',
    trim(p_name) || ' wants ' || eq.name || ' for ' || d || ' day(s).', b.id);
  return b;
end $$;

-- 3b. Advance the lifecycle. One function, strict rules.
create or replace function public.advance_booking(p_booking bigint, p_action text, p_note text default null)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  b public.bookings; eq public.equipment; uid uuid := auth.uid();
  is_owner boolean; is_renter boolean; nm text;
begin
  if uid is null then raise exception 'Sign in first.'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null then raise exception 'Booking not found.'; end if;
  select * into eq from public.equipment where id = b.equipment_id;
  is_owner  := (eq.owner_id = uid);
  is_renter := (b.renter_id = uid);
  if not (is_owner or is_renter) then raise exception 'Not your booking.'; end if;
  nm := eq.name;

  if p_action = 'approve' then
    if not is_owner or b.status <> 'pending' then raise exception 'Only the owner can approve a pending request.'; end if;
    if exists (select 1 from public.bookings x where x.equipment_id = b.equipment_id and x.id <> b.id
               and x.status in ('approved','paid','dispatched','active','returned')
               and daterange(x.start_date, x.end_date, '[]') && daterange(b.start_date, b.end_date, '[]')) then
      raise exception 'These dates overlap another confirmed booking.';
    end if;
    update public.bookings set status='approved', approved_at=now(), updated_at=now() where id=b.id returning * into b;
    perform public.notify(b.renter_id,'booking','Request approved — pay to confirm', nm || ' is approved. Pay now to secure your dates.', b.id);

  elsif p_action = 'decline' then
    if not is_owner or b.status <> 'pending' then raise exception 'Only the owner can decline a pending request.'; end if;
    update public.bookings set status='declined', cancel_reason=nullif(p_note,''), updated_at=now() where id=b.id returning * into b;
    perform public.notify(b.renter_id,'booking','Request declined', nm || ' is not available for your request.', b.id);

  elsif p_action = 'cancel' then
    if b.status not in ('pending','approved','paid') then raise exception 'This booking can no longer be cancelled here. Open a dispute instead.'; end if;
    if not (is_renter or (is_owner and b.status in ('approved','paid'))) then raise exception 'Not allowed.'; end if;
    update public.bookings
       set status='cancelled', cancel_reason=nullif(p_note,''), updated_at=now(),
           payment_status = case when payment_status='held' then 'refunded' else payment_status end
     where id=b.id returning * into b;
    perform public.notify(case when is_renter then eq.owner_id else b.renter_id end,'booking','Booking cancelled', nm || ' booking was cancelled.', b.id);

  elsif p_action = 'dispatch' then
    if not is_owner or b.status <> 'paid' then raise exception 'You can dispatch only after payment is held.'; end if;
    update public.bookings set status='dispatched', dispatched_at=now(), handover_note=nullif(p_note,''), updated_at=now() where id=b.id returning * into b;
    perform public.notify(b.renter_id,'delivery', case when b.fulfilment='delivery' then 'Your machine is on the way' else 'Ready for pickup' end,
      nm || case when b.fulfilment='delivery' then ' has been dispatched.' else ' is ready for you to collect.' end, b.id);

  elsif p_action = 'confirm_received' then
    -- Renter confirms they have the machine: THIS starts the usage countdown.
    if not is_renter or b.status <> 'dispatched' then raise exception 'Confirm receipt after the owner dispatches the machine.'; end if;
    update public.bookings
       set status='active', delivered_at=now(), rental_ends_at = now() + (b.days || ' days')::interval, updated_at=now()
     where id=b.id returning * into b;
    perform public.notify(eq.owner_id,'delivery','Machine received — rental started', nm || ' is now with the renter. Countdown running.', b.id);

  elsif p_action = 'return' then
    if not is_renter or b.status <> 'active' then raise exception 'Only the renter can mark an active rental as returned.'; end if;
    update public.bookings set status='returned', returned_at=now(), return_note=nullif(p_note,''), updated_at=now() where id=b.id returning * into b;
    perform public.notify(eq.owner_id,'delivery','Machine returned — please inspect', nm || ' has been returned. Confirm its condition to release the deposit.', b.id);

  elsif p_action = 'complete' then
    if not is_owner or b.status <> 'returned' then raise exception 'Only the owner can complete a returned rental.'; end if;
    update public.bookings set status='completed', completed_at=now(), payment_status='released', updated_at=now() where id=b.id returning * into b;
    perform public.notify(b.renter_id,'booking','Rental complete', 'Thanks for renting ' || nm || '. Leave a review for the owner.', b.id);

  elsif p_action = 'dispute' then
    if b.status not in ('dispatched','active','returned') then raise exception 'A dispute can be opened once the machine has been dispatched.'; end if;
    if char_length(trim(coalesce(p_note,''))) < 10 then raise exception 'Describe the problem (at least 10 characters).'; end if;
    update public.bookings set status='disputed', dispute_reason=trim(p_note), updated_at=now() where id=b.id returning * into b;
    perform public.notify(case when is_renter then eq.owner_id else b.renter_id end,'dispute','Dispute opened', 'A dispute was opened on ' || nm || '. Our team will review it.', b.id);

  else
    raise exception 'Unknown action.';
  end if;
  return b;
end $$;

-- 3b2. Owner contact details are revealed to the renter only after approval.
create or replace function public.owner_contact(p_booking bigint)
returns table (owner_name text, owner_phone text) language plpgsql security definer set search_path = public as $$
begin
  return query
  select p.full_name, p.phone
    from public.bookings b
    join public.equipment e on e.id = b.equipment_id
    join public.profiles p on p.id = e.owner_id
   where b.id = p_booking and b.renter_id = auth.uid()
     and b.status in ('approved','paid','dispatched','active','returned','completed');
end $$;
grant execute on function public.owner_contact(bigint) to authenticated;

-- 3c. Record a payment. In production ONLY the verify-payment edge function (service role) calls this
-- after confirming the charge with the payment provider. It is not executable by clients.
create or replace function public.record_payment(p_booking bigint, p_provider text, p_reference text, p_amount numeric)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare b public.bookings; eq public.equipment;
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null then raise exception 'Booking not found.'; end if;
  if b.status <> 'approved' then raise exception 'Booking is not awaiting payment.'; end if;
  if p_amount < b.grand_total then raise exception 'Amount paid is less than the amount due.'; end if;
  select * into eq from public.equipment where id = b.equipment_id;
  update public.bookings
     set status='paid', payment_status='held', payment_provider=p_provider, payment_reference=p_reference,
         paid_at=now(), updated_at=now()
   where id=b.id returning * into b;
  perform public.notify(eq.owner_id,'payment','Payment received', 'Payment for ' || eq.name || ' is held securely. Dispatch the machine.', b.id);
  perform public.notify(b.renter_id,'payment','Payment confirmed', 'Your payment for ' || eq.name || ' is held securely until the rental is complete.', b.id);
  return b;
end $$;
revoke all on function public.record_payment(bigint, text, text, numeric) from public, anon, authenticated;

------------------------------------------------------------------------------
-- 4. Reviews
------------------------------------------------------------------------------
create table if not exists public.reviews (
  id           bigint generated always as identity primary key,
  booking_id   bigint not null unique references public.bookings(id) on delete cascade,
  equipment_id bigint not null references public.equipment(id) on delete cascade,
  reviewer_id  uuid not null references auth.users(id) on delete cascade,
  rating       int not null check (rating between 1 and 5),
  comment      text not null default '' check (char_length(comment) <= 600),
  created_at   timestamptz not null default now()
);
alter table public.reviews enable row level security;
drop policy if exists "reviews are public" on public.reviews;
create policy "reviews are public" on public.reviews for select using (true);

create or replace function public.submit_review(p_booking bigint, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking;
  if b.id is null or b.renter_id <> auth.uid() then raise exception 'Not your booking.'; end if;
  if b.status <> 'completed' then raise exception 'You can review a rental once it is completed.'; end if;
  insert into public.reviews (booking_id, equipment_id, reviewer_id, rating, comment)
  values (b.id, b.equipment_id, auth.uid(), p_rating, coalesce(trim(p_comment),''));
end $$;

-- Listing feed used by the marketplace: listing + owner trust data + rating.
create or replace view public.equipment_feed as
select e.*,
       coalesce(p.full_name, '')       as owner_name,
       coalesce(p.is_verified, false)  as owner_verified,
       coalesce(r.avg_rating, 0)       as avg_rating,
       coalesce(r.review_count, 0)     as review_count
from public.equipment e
left join public.public_profiles p on p.id = e.owner_id
left join (select equipment_id, round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as review_count
           from public.reviews group by equipment_id) r on r.equipment_id = e.id
where e.is_active;
grant select on public.equipment_feed to anon, authenticated;

------------------------------------------------------------------------------
-- 5. Function permissions
------------------------------------------------------------------------------
grant execute on function public.create_booking(bigint, date, date, text, text, text, text, text) to authenticated;
grant execute on function public.advance_booking(bigint, text, text) to authenticated;
grant execute on function public.submit_review(bigint, int, text) to authenticated;
grant execute on function public.submit_verification(text, text, text) to authenticated;
grant execute on function public.review_verification(uuid, boolean, text) to authenticated;
revoke all on function public.notify(uuid, text, text, text, bigint) from public, anon, authenticated;

-- To make yourself an admin (run once, with your own user id):
--   update public.profiles set is_admin = true where id = '<your-auth-user-uuid>';
