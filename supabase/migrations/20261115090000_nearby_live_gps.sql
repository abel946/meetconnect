-- MeetConnect nearby live GPS foundation
-- Employee locations are private by default. Public discovery returns an
-- approximate marker only; exact coordinates are available only to the
-- customer/employee on an accepted connection.

create table if not exists public.employee_live_locations (
  employee_id uuid primary key references public.employee_profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  is_available boolean not null default false,
  sharing_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.employee_live_locations enable row level security;

revoke all on public.employee_live_locations from anon, authenticated;
grant select, insert, update on public.employee_live_locations to authenticated;

create policy "employees read own live location"
  on public.employee_live_locations
  for select to authenticated
  using (employee_id = (select auth.uid()));

drop policy if exists "employees manage own live location" on public.employee_live_locations;
create policy "employees insert own live location"
  on public.employee_live_locations
  for insert to authenticated
  with check (
    employee_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      join public.employee_profiles ep on ep.id = p.id
      where p.id = (select auth.uid())
        and p.role = 'employee'
        and p.is_adult = true
        and ep.status = 'approved'
    )
  );

create policy "employees update own live location"
  on public.employee_live_locations
  for update to authenticated
  using (employee_id = (select auth.uid()))
  with check (
    employee_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      join public.employee_profiles ep on ep.id = p.id
      where p.id = (select auth.uid())
        and p.role = 'employee'
        and p.is_adult = true
        and ep.status = 'approved'
    )
  );

create or replace function public.nearby_available_employees(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer default 5000
)
returns table (
  employee_id uuid,
  display_name text,
  gender text,
  avatar_url text,
  service_area text,
  short_price_etb numeric,
  long_price_etb numeric,
  latitude double precision,
  longitude double precision,
  distance_m integer,
  last_seen timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_gender text;
  v_radius integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180 then
    raise exception 'A valid location is required';
  end if;

  select p.gender into v_customer_gender
  from public.profiles p
  where p.id = auth.uid()
    and p.role = 'customer'
    and p.is_adult = true;

  if v_customer_gender is null then
    raise exception 'Approved adult customer account required';
  end if;

  v_radius := greatest(500, least(coalesce(p_radius_m, 5000), 20000));

  return query
  select
    ep.id,
    p.display_name,
    p.gender,
    ep.avatar_url,
    ep.service_area,
    ep.short_price_etb,
    ep.long_price_etb,
    round((loc.latitude::numeric), 3)::double precision,
    round((loc.longitude::numeric), 3)::double precision,
    floor(6371000 * 2 * asin(sqrt(
      power(sin(radians(loc.latitude - p_latitude) / 2), 2)
      + cos(radians(p_latitude)) * cos(radians(loc.latitude))
      * power(sin(radians(loc.longitude - p_longitude) / 2), 2)
    )))::integer,
    loc.updated_at
  from public.employee_live_locations loc
  join public.employee_profiles ep on ep.id = loc.employee_id
  join public.profiles p on p.id = ep.id
  where loc.is_available = true
    and loc.sharing_enabled = true
    and loc.updated_at >= now() - interval '45 seconds'
    and ep.status = 'approved'
    and p.role = 'employee'
    and p.is_adult = true
    and p.gender <> v_customer_gender
    and 6371000 * 2 * asin(sqrt(
      power(sin(radians(loc.latitude - p_latitude) / 2), 2)
      + cos(radians(p_latitude)) * cos(radians(loc.latitude))
      * power(sin(radians(loc.longitude - p_longitude) / 2), 2)
    )) <= v_radius
  order by 10 asc;
end;
$$;

create or replace function public.active_connection_employee_location(
  p_request_id uuid
)
returns table (
  employee_id uuid,
  latitude double precision,
  longitude double precision,
  last_seen timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select cr.employee_id into v_employee_id
  from public.connection_requests cr
  where cr.id = p_request_id
    and cr.status = 'accepted'
    and (cr.customer_id = auth.uid() or cr.employee_id = auth.uid());

  if v_employee_id is null then
    raise exception 'Accepted connection not found for this account';
  end if;

  return query
  select loc.employee_id, loc.latitude, loc.longitude, loc.updated_at
  from public.employee_live_locations loc
  where loc.employee_id = v_employee_id
    and loc.sharing_enabled = true
    and loc.is_available = true
    and loc.updated_at >= now() - interval '90 seconds';
end;
$$;

revoke all on function public.nearby_available_employees(double precision, double precision, integer) from public, anon;
grant execute on function public.nearby_available_employees(double precision, double precision, integer) to authenticated;
revoke all on function public.active_connection_employee_location(uuid) from public, anon;
grant execute on function public.active_connection_employee_location(uuid) to authenticated;

comment on table public.employee_live_locations is
  'Private employee GPS state. Direct client reads are blocked; use scoped RPC functions. Stale locations are hidden after 45 seconds.';
