-- Privacy-safe public Room Service provider card and customer discovery view.
create table if not exists public.room_service_public_profiles (
 owner_id uuid primary key references public.room_service_profiles(owner_id) on delete cascade,
 business_name text not null,
 provider_type text not null check(provider_type in ('hotel','private_owner')),
 status text not null check(status in ('pending','approved','rejected','suspended'))
);
alter table public.room_service_public_profiles enable row level security;
create policy "Public reads approved room provider cards" on public.room_service_public_profiles
 for select to anon,authenticated using(status='approved');
grant select on public.room_service_public_profiles to anon,authenticated;
revoke insert,update,delete on public.room_service_public_profiles from anon,authenticated;

create or replace function public.sync_room_service_public_profile()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.room_service_public_profiles(owner_id,business_name,provider_type,status)
 values(new.owner_id,new.business_name,new.provider_type,new.status)
 on conflict(owner_id) do update set business_name=excluded.business_name,provider_type=excluded.provider_type,status=excluded.status;
 return new;
end;
$$;
revoke all on function public.sync_room_service_public_profile() from public,anon,authenticated;
create trigger room_service_public_profile_sync
 after insert or update of business_name,provider_type,status on public.room_service_profiles
 for each row execute function public.sync_room_service_public_profile();

create policy "Public reads approved rooms" on public.room_listings for select to anon,authenticated using(
 status='approved' and is_available=true and exists(
  select 1 from public.room_service_public_profiles p where p.owner_id=room_listings.owner_id and p.status='approved'
 )
);
create or replace view public.approved_room_listings with(security_invoker=true) as
select l.id,l.owner_id,p.business_name,p.provider_type,l.title,l.property_type,l.description,l.city,l.area,
 l.price_per_night_etb,l.max_guests,l.bedrooms,l.bathrooms,l.amenities,l.photo_urls,l.cover_image_url,l.created_at
from public.room_listings l join public.room_service_public_profiles p on p.owner_id=l.owner_id
where l.status='approved' and l.is_available=true and p.status='approved';
grant select on public.approved_room_listings to anon,authenticated;

-- Booking requests are inserted only by the validated create_room_booking RPC.
revoke insert,update on public.room_bookings from authenticated;
grant update(status,updated_at) on public.room_bookings to authenticated;
