-- MeetConnect Room Service tables and booking workflow. Requires the existing MeetConnect shared schema.
create table if not exists public.room_service_username_registry (
 username text primary key check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.room_service_username_registry enable row level security;

create table if not exists public.room_service_profiles (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 provider_type text not null check (provider_type in ('hotel','private_owner')),
 business_name text not null check (char_length(trim(business_name)) between 2 and 100),
 contact_name text not null check (char_length(trim(contact_name)) between 2 and 80),
 contact_phone text not null, description text not null default '',
 city text not null default 'Addis Ababa', address text not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
 review_note text, reviewed_at timestamptz, reviewed_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.room_service_profiles enable row level security;

create table if not exists public.room_listings (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.room_service_profiles(owner_id) on delete cascade,
 title text not null check (char_length(trim(title)) between 3 and 120),
 property_type text not null check (property_type in ('hotel_room','private_room')),
 description text not null default '', city text not null default 'Addis Ababa',
 area text not null, address text not null,
 price_per_night_etb numeric(12,2) not null check (price_per_night_etb > 0),
 max_guests integer not null default 2 check (max_guests between 1 and 20),
 bedrooms integer not null default 1 check (bedrooms between 0 and 20),
 bathrooms numeric(3,1) not null default 1 check (bathrooms between 0 and 20),
 amenities text[] not null default '{}', photo_urls text[] not null default '{}',
 cover_image_url text, is_available boolean not null default true,
 status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
 review_note text, reviewed_at timestamptz, reviewed_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.room_listings enable row level security;
create index if not exists room_listings_public_search_idx on public.room_listings(status,city,area,price_per_night_etb) where is_available=true;
create index if not exists room_listings_owner_idx on public.room_listings(owner_id,created_at desc);

create table if not exists public.room_bookings (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.room_listings(id) on delete restrict,
 customer_id uuid not null references auth.users(id) on delete restrict,
 check_in date not null, check_out date not null,
 guests integer not null check (guests between 1 and 20),
 total_nights integer not null check (total_nights between 1 and 90),
 nightly_rate_etb numeric(12,2) not null check (nightly_rate_etb > 0),
 total_amount_etb numeric(12,2) not null check (total_amount_etb > 0),
 status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled','completed')),
 payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','failed','refunded')),
 chapa_tx_ref text unique, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint room_booking_dates_valid check (check_out > check_in)
);
alter table public.room_bookings enable row level security;
create index if not exists room_bookings_customer_idx on public.room_bookings(customer_id,created_at desc);
create index if not exists room_bookings_listing_dates_idx on public.room_bookings(listing_id,check_in,check_out);

create policy "Room provider reads own profile" on public.room_service_profiles for select to authenticated using (owner_id=(select auth.uid()));
create policy "Room provider creates own profile" on public.room_service_profiles for insert to authenticated with check (owner_id=(select auth.uid()) and status='pending');
create policy "Room provider updates own profile" on public.room_service_profiles for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()) and status='pending');
create policy "MeetConnect admins manage room providers" on public.room_service_profiles for all to authenticated using (public.is_meetconnect_admin()) with check (public.is_meetconnect_admin());

create policy "Room provider reads own listings" on public.room_listings for select to authenticated using (owner_id=(select auth.uid()));
create policy "Room provider creates own pending listings" on public.room_listings for insert to authenticated with check (
 owner_id=(select auth.uid()) and status='pending' and exists(select 1 from public.room_service_profiles p where p.owner_id=(select auth.uid()) and p.status='approved')
);
create policy "Room provider edits own listings for re-review" on public.room_listings for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()) and status='pending');
create policy "MeetConnect admins manage room listings" on public.room_listings for all to authenticated using (public.is_meetconnect_admin()) with check (public.is_meetconnect_admin());

create policy "Customers read own room bookings" on public.room_bookings for select to authenticated using (customer_id=(select auth.uid()));
create policy "Room providers read bookings for own listings" on public.room_bookings for select to authenticated using (
 exists(select 1 from public.room_listings l where l.id=listing_id and l.owner_id=(select auth.uid()))
);
create policy "Room providers update booking decisions" on public.room_bookings for update to authenticated using (
 exists(select 1 from public.room_listings l where l.id=listing_id and l.owner_id=(select auth.uid()))
) with check (
 exists(select 1 from public.room_listings l where l.id=listing_id and l.owner_id=(select auth.uid()))
 and status in ('confirmed','rejected','completed')
);
create policy "MeetConnect admins manage room bookings" on public.room_bookings for all to authenticated using (public.is_meetconnect_admin()) with check (public.is_meetconnect_admin());

create or replace function public.create_room_booking(p_listing_id uuid,p_check_in date,p_check_out date,p_guests integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=(select auth.uid()); v_listing public.room_listings%rowtype; v_nights integer; v_booking public.room_bookings%rowtype;
begin
 if v_uid is null then raise exception 'Please sign in before booking a room.'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_uid and p.role='customer' and p.is_adult=true) then
  raise exception 'Only registered adult MeetConnect customers can book rooms.';
 end if;
 if p_check_in is null or p_check_out is null or p_check_out<=p_check_in then raise exception 'Choose valid check-in and check-out dates.'; end if;
 v_nights:=p_check_out-p_check_in;
 if v_nights>90 then raise exception 'A booking cannot exceed 90 nights.'; end if;
 select l.* into v_listing from public.room_listings l
 join public.room_service_profiles p on p.owner_id=l.owner_id
 where l.id=p_listing_id and l.status='approved' and l.is_available=true and p.status='approved'
 for update of l;
 if not found then raise exception 'This room is not currently available.'; end if;
 if p_guests is null or p_guests<1 or p_guests>v_listing.max_guests then raise exception 'Choose a valid number of guests for this room.'; end if;
 if exists(select 1 from public.room_bookings b where b.listing_id=p_listing_id and b.status in ('pending','confirmed') and b.check_in<p_check_out and b.check_out>p_check_in) then
  raise exception 'These dates are already reserved or awaiting confirmation. Please choose other dates.';
 end if;
 insert into public.room_bookings(listing_id,customer_id,check_in,check_out,guests,total_nights,nightly_rate_etb,total_amount_etb)
 values(p_listing_id,v_uid,p_check_in,p_check_out,p_guests,v_nights,v_listing.price_per_night_etb,v_nights*v_listing.price_per_night_etb)
 returning * into v_booking;
 return jsonb_build_object('id',v_booking.id,'total_nights',v_nights,'nightly_rate_etb',v_booking.nightly_rate_etb,'total_amount_etb',v_booking.total_amount_etb,'status',v_booking.status);
end;
$$;
revoke all on function public.create_room_booking(uuid,date,date,integer) from public,anon;
grant execute on function public.create_room_booking(uuid,date,date,integer) to authenticated;

grant select,insert,update on public.room_service_profiles to authenticated;
grant select,insert,update on public.room_listings to authenticated;
grant select on public.room_bookings to authenticated;
grant update(status,updated_at) on public.room_bookings to authenticated;
grant select on public.room_listings to anon;
grant usage on schema public to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('room-service-media','room-service-media',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy "Room providers upload their room photos" on storage.objects for insert to authenticated with check (
 bucket_id='room-service-media' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.room_service_profiles p where p.owner_id=(select auth.uid()))
);
create policy "Room providers update their room photos" on storage.objects for update to authenticated using (
 bucket_id='room-service-media' and (storage.foldername(name))[1]=(select auth.uid())::text
) with check (bucket_id='room-service-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Room providers delete their room photos" on storage.objects for delete to authenticated using (
 bucket_id='room-service-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
