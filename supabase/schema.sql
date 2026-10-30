-- AgroGear schema. Run this once in Supabase → SQL Editor.

create table if not exists public.equipment (
  id            bigint generated always as identity primary key,
  owner_id      uuid references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 2 and 120),
  category      text not null check (category in ('Tractors','Harvesters','Planting','Tillage','Transport','Irrigation')),
  price_per_day numeric(12,2) not null check (price_per_day > 0),
  location      text not null check (char_length(location) between 2 and 120),
  description   text not null default '',
  emoji         text not null default '🚜',
  badge         text not null default 'New listing',
  color         text not null default '#dcecdf',
  featured      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.favourites (
  user_id      uuid not null references auth.users(id) on delete cascade,
  equipment_id bigint not null references public.equipment(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, equipment_id)
);

create table if not exists public.bookings (
  id              bigint generated always as identity primary key,
  equipment_id    bigint not null references public.equipment(id) on delete cascade,
  renter_id       uuid not null references auth.users(id) on delete cascade,
  renter_name     text not null,
  renter_phone    text not null,
  start_date      date not null,
  end_date        date not null,
  days            int  not null check (days >= 1),
  estimated_total numeric(14,2) not null,
  note            text,
  status          text not null default 'pending' check (status in ('pending','confirmed','declined','cancelled')),
  created_at      timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists equipment_owner_idx on public.equipment(owner_id);
create index if not exists bookings_equipment_idx on public.bookings(equipment_id);
create index if not exists bookings_renter_idx on public.bookings(renter_id);

alter table public.equipment  enable row level security;
alter table public.favourites enable row level security;
alter table public.bookings   enable row level security;

-- Equipment: anyone can browse; signed-in owners manage their own listings.
drop policy if exists "equipment is public" on public.equipment;
create policy "equipment is public" on public.equipment for select using (true);

drop policy if exists "owners insert equipment" on public.equipment;
create policy "owners insert equipment" on public.equipment for insert to authenticated
  with check (owner_id = auth.uid() and featured = false);

drop policy if exists "owners update equipment" on public.equipment;
create policy "owners update equipment" on public.equipment for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and featured = false);

drop policy if exists "owners delete equipment" on public.equipment;
create policy "owners delete equipment" on public.equipment for delete to authenticated
  using (owner_id = auth.uid());

-- Favourites: private to each user.
drop policy if exists "own favourites" on public.favourites;
create policy "own favourites" on public.favourites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Bookings: renters see and create their own; equipment owners see requests for their machines.
drop policy if exists "renters read own bookings" on public.bookings;
create policy "renters read own bookings" on public.bookings for select to authenticated
  using (renter_id = auth.uid());

drop policy if exists "owners read bookings for their equipment" on public.bookings;
create policy "owners read bookings for their equipment" on public.bookings for select to authenticated
  using (exists (select 1 from public.equipment e where e.id = equipment_id and e.owner_id = auth.uid()));

drop policy if exists "renters create bookings" on public.bookings;
create policy "renters create bookings" on public.bookings for insert to authenticated
  with check (renter_id = auth.uid() and status = 'pending');

drop policy if exists "owners update booking status" on public.bookings;
create policy "owners update booking status" on public.bookings for update to authenticated
  using (exists (select 1 from public.equipment e where e.id = equipment_id and e.owner_id = auth.uid()));

drop policy if exists "renters cancel own bookings" on public.bookings;
create policy "renters cancel own bookings" on public.bookings for update to authenticated
  using (renter_id = auth.uid()) with check (renter_id = auth.uid() and status = 'cancelled');

-- Showcase listings (only inserted into an empty table).
insert into public.equipment (name, category, price_per_day, location, description, emoji, badge, color, featured)
select * from (values
  ('John Deere 5050D','Tractors',85000,'Abuja, FCT','Versatile utility tractor for ploughing, cultivation, and general farm operations. Ask the owner about implements and delivery.','🚜','Popular','#e7eedf',true),
  ('Combine Harvester','Harvesters',220000,'Kaduna, Kaduna','A harvesting solution designed to help reduce harvesting time. Confirm crop compatibility, capacity, and operator availability with the owner.','🌾','High capacity','#f2ead7',true),
  ('Heavy Duty Plough','Tillage',28000,'Kano, Kano','Tillage implement for soil preparation. Check tractor compatibility and transport arrangements before booking.','⚙️','Great value','#e9e9df',true),
  ('Precision Planter','Planting',45000,'Jos, Plateau','Planting equipment intended to help create more consistent spacing. Confirm seed type, row configuration, and tractor requirements.','🌱','Season ready','#deeee0',true),
  ('Water Pump System','Irrigation',18000,'Minna, Niger','A portable water-pumping option for farm irrigation. Verify flow rate, power source, hose connections, and water-lifting requirements.','💧','Water smart','#e0edf0',true),
  ('Farm Utility Trailer','Transport',25000,'Ibadan, Oyo','Utility trailer for moving farm inputs and harvested produce. Confirm load capacity, hitch type, and safe road use.','🚛','Farm essential','#eee5d9',true),
  ('Power Tiller','Tillage',32000,'Enugu, Enugu','Compact tillage equipment for suitable small and medium farm plots. Ask about soil suitability and operator support.','🛠️','Small farms','#e4eadb',true),
  ('Seed Drill Machine','Planting',39000,'Makurdi, Benue','Seed placement equipment for more organised planting. Confirm calibration and crop suitability before use.','🌾','Precision planting','#f1ead8',true)
) as v(name, category, price_per_day, location, description, emoji, badge, color, featured)
where not exists (select 1 from public.equipment);
