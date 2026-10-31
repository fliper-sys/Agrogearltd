-- AgroGear v3.1: richer reviews, public profile stats, contact support, chat read receipts, walkthrough flag.
-- Run AFTER 003_merge_features.sql. Safe to re-run.

------------------------------------------------------------------------------
-- 1. Reviews: owner replies, edits, and owner-rates-renter
------------------------------------------------------------------------------
alter table public.reviews add column if not exists owner_reply    text check (char_length(owner_reply) <= 600);
alter table public.reviews add column if not exists owner_reply_at timestamptz;
alter table public.reviews add column if not exists edited_at      timestamptz;

-- Replace v2's submit_review to also notify the owner.
create or replace function public.submit_review(p_booking bigint, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings; eq public.equipment;
begin
  select * into b from public.bookings where id = p_booking;
  if b.id is null or b.renter_id <> auth.uid() then raise exception 'Not your booking.'; end if;
  if b.status <> 'completed' then raise exception 'You can review a rental once it is completed.'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Choose a rating from 1 to 5 stars.'; end if;
  insert into public.reviews (booking_id, equipment_id, reviewer_id, rating, comment)
  values (b.id, b.equipment_id, auth.uid(), p_rating, left(coalesce(trim(p_comment), ''), 600));
  select * into eq from public.equipment where id = b.equipment_id;
  perform public.notify(eq.owner_id, 'review', 'New review: ' || p_rating || '★',
    coalesce(nullif(left(trim(coalesce(p_comment,'')), 120), ''), 'A renter rated ' || eq.name || '.'), b.id);
end $$;

-- Renters can edit their review within 14 days.
create or replace function public.update_review(p_booking bigint, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reviews;
begin
  select * into r from public.reviews where booking_id = p_booking and reviewer_id = auth.uid();
  if r.id is null then raise exception 'Review not found.'; end if;
  if r.created_at < now() - interval '14 days' then raise exception 'Reviews can be edited for 14 days.'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'Choose a rating from 1 to 5 stars.'; end if;
  update public.reviews set rating = p_rating, comment = left(coalesce(trim(p_comment), ''), 600), edited_at = now()
   where id = r.id;
end $$;

-- Owner replies publicly to a review of their equipment.
create or replace function public.reply_to_review(p_review bigint, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reviews; eq public.equipment;
begin
  select * into r from public.reviews where id = p_review;
  if r.id is null then raise exception 'Review not found.'; end if;
  select * into eq from public.equipment where id = r.equipment_id;
  if eq.owner_id is distinct from auth.uid() then raise exception 'Only the equipment owner can reply.'; end if;
  if char_length(trim(coalesce(p_reply, ''))) < 2 then raise exception 'Write a short reply.'; end if;
  update public.reviews set owner_reply = left(trim(p_reply), 600), owner_reply_at = now() where id = r.id;
  perform public.notify(r.reviewer_id, 'review', 'The owner replied to your review', left(trim(p_reply), 120), r.booking_id);
end $$;

-- Owner rates the renter after a completed rental (shown on the renter's public profile).
create table if not exists public.renter_reviews (
  id          bigint generated always as identity primary key,
  booking_id  bigint not null unique references public.bookings(id) on delete cascade,
  renter_id   uuid not null references auth.users(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text not null default '' check (char_length(comment) <= 600),
  created_at  timestamptz not null default now()
);
alter table public.renter_reviews enable row level security;
drop policy if exists "renter reviews are public" on public.renter_reviews;
create policy "renter reviews are public" on public.renter_reviews for select using (true);

create or replace function public.rate_renter(p_booking bigint, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings; eq public.equipment;
begin
  select * into b from public.bookings where id = p_booking;
  if b.id is null then raise exception 'Booking not found.'; end if;
  select * into eq from public.equipment where id = b.equipment_id;
  if eq.owner_id is distinct from auth.uid() then raise exception 'Only the owner can rate the renter.'; end if;
  if b.status <> 'completed' then raise exception 'You can rate a renter once the rental is completed.'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'Choose a rating from 1 to 5 stars.'; end if;
  insert into public.renter_reviews (booking_id, renter_id, owner_id, rating, comment)
  values (b.id, b.renter_id, auth.uid(), p_rating, left(coalesce(trim(p_comment), ''), 600));
  perform public.notify(b.renter_id, 'review', 'The owner rated you ' || p_rating || '★',
    coalesce(nullif(left(trim(coalesce(p_comment,'')), 120), ''), 'Thanks for renting ' || eq.name || '.'), b.id);
end $$;

-- Public review feed (reviewer identity from the public view only).
drop view if exists public.reviews_feed;
create view public.reviews_feed as
select r.id, r.booking_id, r.equipment_id, r.reviewer_id, r.rating, r.comment, r.created_at, r.edited_at,
       r.owner_reply, r.owner_reply_at,
       e.name as equipment_name, e.emoji as equipment_emoji, e.owner_id,
       coalesce(p.full_name, 'AgroGear user') as reviewer_name, p.avatar_url as reviewer_avatar,
       coalesce(p.is_verified, false) as reviewer_verified
from public.reviews r
join public.equipment e on e.id = r.equipment_id
left join public.public_profiles p on p.id = r.reviewer_id;
grant select on public.reviews_feed to anon, authenticated;

drop view if exists public.renter_reviews_feed;
create view public.renter_reviews_feed as
select rr.id, rr.booking_id, rr.renter_id, rr.owner_id, rr.rating, rr.comment, rr.created_at,
       coalesce(p.full_name, 'AgroGear user') as owner_name, p.avatar_url as owner_avatar
from public.renter_reviews rr
left join public.public_profiles p on p.id = rr.owner_id;
grant select on public.renter_reviews_feed to anon, authenticated;

-- Which of my completed rentals (as owner) already have a renter rating
create or replace function public.my_rated_renters() returns setof bigint
language sql stable security definer set search_path = public as $$
  select booking_id from public.renter_reviews where owner_id = auth.uid()
$$;
grant execute on function public.my_rated_renters() to authenticated;

------------------------------------------------------------------------------
-- 2. Public profile stats
------------------------------------------------------------------------------
create or replace function public.profile_stats(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'listings',        (select count(*) from public.equipment where owner_id = p_user and is_active),
    'owner_rating',    coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r join public.equipment e on e.id = r.equipment_id where e.owner_id = p_user), 0),
    'owner_reviews',   (select count(*) from public.reviews r join public.equipment e on e.id = r.equipment_id where e.owner_id = p_user),
    'renter_rating',   coalesce((select round(avg(rating)::numeric, 1) from public.renter_reviews where renter_id = p_user), 0),
    'renter_reviews',  (select count(*) from public.renter_reviews where renter_id = p_user),
    'completed_as_owner',  (select count(*) from public.bookings b join public.equipment e on e.id = b.equipment_id where e.owner_id = p_user and b.status = 'completed'),
    'completed_as_renter', (select count(*) from public.bookings where renter_id = p_user and status = 'completed')
  )
$$;
grant execute on function public.profile_stats(uuid) to anon, authenticated;

------------------------------------------------------------------------------
-- 3. Walkthrough flag
------------------------------------------------------------------------------
alter table public.profiles add column if not exists tour_done boolean not null default false;

------------------------------------------------------------------------------
-- 4. Chat: read receipts
------------------------------------------------------------------------------
alter table public.messages add column if not exists read_at timestamptz;

create or replace function public.mark_conversation_read(p_conversation bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.in_conversation(p_conversation) then raise exception 'Not your conversation.'; end if;
  update public.messages set read_at = now()
   where conversation_id = p_conversation and sender_id <> auth.uid() and read_at is null;
end $$;
grant execute on function public.mark_conversation_read(bigint) to authenticated;

-- Unread message count per conversation for the signed-in user.
create or replace function public.unread_counts() returns table (conversation_id bigint, unread bigint)
language sql stable security definer set search_path = public as $$
  select m.conversation_id, count(*)
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
   where auth.uid() in (c.renter_id, c.owner_id) and m.sender_id <> auth.uid() and m.read_at is null and m.kind = 'text'
   group by m.conversation_id
$$;
grant execute on function public.unread_counts() to authenticated;

------------------------------------------------------------------------------
-- 5. Contact support
------------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  category   text not null default 'other'
               check (category in ('booking','payment','account','listing','safety','bug','other')),
  subject    text not null check (char_length(subject) between 3 and 140),
  booking_id bigint references public.bookings(id) on delete set null,
  status     text not null default 'open' check (status in ('open','answered','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.support_messages (
  id         bigint generated always as identity primary key,
  ticket_id  bigint not null references public.support_tickets(id) on delete cascade,
  sender_id  uuid not null references auth.users(id) on delete cascade,
  is_staff   boolean not null default false,
  body       text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on public.support_tickets(user_id, updated_at desc);
create index if not exists support_messages_ticket_idx on public.support_messages(ticket_id, created_at);

alter table public.support_tickets  enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "own tickets read" on public.support_tickets;
create policy "own tickets read" on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "own tickets create" on public.support_tickets;
create policy "own tickets create" on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid() and status = 'open');
drop policy if exists "admins update tickets" on public.support_tickets;
create policy "admins update tickets" on public.support_tickets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ticket messages read" on public.support_messages;
create policy "ticket messages read" on public.support_messages for select to authenticated
  using (public.is_admin() or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));

-- All writes to ticket messages go through this function so staff flag and status stay correct.
create or replace function public.support_post(p_ticket bigint, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare t public.support_tickets; staff boolean := public.is_admin();
begin
  select * into t from public.support_tickets where id = p_ticket;
  if t.id is null or (t.user_id <> auth.uid() and not staff) then raise exception 'Ticket not found.'; end if;
  if char_length(trim(coalesce(p_body, ''))) < 1 then raise exception 'Write a message.'; end if;
  insert into public.support_messages (ticket_id, sender_id, is_staff, body)
  values (p_ticket, auth.uid(), staff and t.user_id <> auth.uid(), left(trim(p_body), 3000));
  update public.support_tickets
     set status = case when staff and t.user_id <> auth.uid() then 'answered' else 'open' end, updated_at = now()
   where id = p_ticket;
  if staff and t.user_id <> auth.uid() then
    perform public.notify(t.user_id, 'support', 'AgroGear support replied', left(trim(p_body), 120));
  end if;
end $$;
grant execute on function public.support_post(bigint, text) to authenticated;

create or replace function public.support_set_status(p_ticket bigint, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_status not in ('open','answered','closed') then raise exception 'Invalid status.'; end if;
  update public.support_tickets set status = p_status, updated_at = now() where id = p_ticket;
end $$;
grant execute on function public.support_set_status(bigint, text) to authenticated;

-- Admin inbox with the requester's name and email.
create or replace function public.admin_support_inbox()
returns table (id bigint, user_id uuid, user_name text, user_email text, category text, subject text,
               status text, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return query
  select t.id, t.user_id, p.full_name, u.email::text, t.category, t.subject, t.status, t.created_at, t.updated_at
    from public.support_tickets t
    left join public.profiles p on p.id = t.user_id
    left join auth.users u on u.id = t.user_id
   order by (t.status = 'closed'), t.updated_at desc
   limit 300;
end $$;
grant execute on function public.admin_support_inbox() to authenticated;

do $$ begin alter publication supabase_realtime add table public.support_messages; exception when duplicate_object then null; end $$;
-- Realtime UPDATE events (read receipts) need the full row on messages.
alter table public.messages replica identity full;

-- Extend admin_stats with open support tickets.
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
    'conversations',   (select count(*) from public.conversations),
    'open_tickets',    (select count(*) from public.support_tickets where status = 'open'),
    'reviews',         (select count(*) from public.reviews)
  );
end $$;
