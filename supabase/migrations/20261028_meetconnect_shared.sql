-- MeetConnect shared data model (apply in Supabase SQL Editor).
-- Employee-defined prices; fixed 10% platform commission.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null, phone text,
 gender text not null check (gender in ('female','male')),
 role text not null default 'customer' check (role in ('customer','employee','admin')),
 is_adult boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.employee_profiles (
 id uuid primary key references public.profiles(id) on delete cascade,
 bio text not null default '', service_area text not null default 'Addis Ababa',
 short_price_etb integer not null default 500 check (short_price_etb > 0),
 long_price_etb integer not null default 2000 check (long_price_etb > 0),
 status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
 avatar_url text, updated_at timestamptz not null default now()
);
create table if not exists public.connection_requests (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles(id) on delete cascade,
 employee_id uuid not null references public.employee_profiles(id) on delete cascade,
 session_type text not null check (session_type in ('short','long')),
 agreed_price_etb integer not null check (agreed_price_etb > 0),
 status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')),
 created_at timestamptz not null default now()
);
create table if not exists public.service_payments (
 id uuid primary key default gen_random_uuid(),
 connection_request_id uuid not null unique references public.connection_requests(id) on delete restrict,
 gross_amount_etb integer not null check (gross_amount_etb > 0),
 platform_commission_rate numeric(4,3) not null default 0.100 check (platform_commission_rate = 0.100),
 platform_commission_etb integer generated always as (round(gross_amount_etb * platform_commission_rate)::integer) stored,
 employee_payout_etb integer generated always as (gross_amount_etb - round(gross_amount_etb * platform_commission_rate)::integer) stored,
 payment_provider text not null default 'chapa', provider_reference text unique,
 status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.connection_requests enable row level security;
alter table public.service_payments enable row level security;
drop policy if exists "approved employee cards are readable" on public.employee_profiles;
create policy "approved employee cards are readable" on public.employee_profiles for select using (status = 'approved');
drop policy if exists "profile owner can read" on public.profiles;
create policy "profile owner can read" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profile owner can insert" on public.profiles;
create policy "profile owner can insert" on public.profiles for insert with check (auth.uid() = id and role <> 'admin');
drop policy if exists "profile owner can update" on public.profiles;
create policy "profile owner can update" on public.profiles for update using (auth.uid() = id and role <> 'admin') with check (auth.uid() = id and role <> 'admin');
drop policy if exists "employee can manage own listing" on public.employee_profiles;
create policy "employee can manage own listing" on public.employee_profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "participants read requests" on public.connection_requests;
create policy "participants read requests" on public.connection_requests for select using (auth.uid() = customer_id or auth.uid() = employee_id);
drop policy if exists "customers create requests" on public.connection_requests;
create policy "customers create requests" on public.connection_requests for insert with check (auth.uid() = customer_id);
drop policy if exists "participants update requests" on public.connection_requests;
create policy "participants update requests" on public.connection_requests for update using (auth.uid() = customer_id or auth.uid() = employee_id) with check (auth.uid() = customer_id or auth.uid() = employee_id);
drop policy if exists "payment participants can read own payments" on public.service_payments;
create policy "payment participants can read own payments" on public.service_payments for select using (exists (select 1 from public.connection_requests r where r.id = connection_request_id and (r.customer_id = auth.uid() or r.employee_id = auth.uid())));
-- No browser insert/update policy for payments: trusted server/webhook only.


-- Safe public discovery surface: exposes only fields intended for employee cards.
-- The underlying profiles table keeps phone numbers private.
create or replace view public.approved_employee_cards as
 select ep.id, p.display_name, p.gender, ep.bio, ep.service_area,
        ep.short_price_etb, ep.long_price_etb, ep.avatar_url
 from public.employee_profiles ep
 join public.profiles p on p.id = ep.id
 where ep.status = 'approved' and p.role = 'employee' and p.is_adult = true;
grant select on public.approved_employee_cards to anon, authenticated;
