-- Keep exact street address private. Public customers receive only the approved card columns.
revoke select on public.room_listings from anon, authenticated;
grant select(id,owner_id,title,property_type,description,city,area,price_per_night_etb,max_guests,bedrooms,bathrooms,amenities,photo_urls,cover_image_url,created_at,is_available,status)
on public.room_listings to anon,authenticated;

create or replace function public.get_my_room_listings()
returns setof public.room_listings language sql stable security definer set search_path=''
as $$ select l.* from public.room_listings l where l.owner_id=(select auth.uid()) order by l.created_at desc; $$;
revoke all on function public.get_my_room_listings() from public,anon;
grant execute on function public.get_my_room_listings() to authenticated;

create or replace function public.get_admin_room_listings()
returns setof public.room_listings language plpgsql stable security definer set search_path=''
as $$
begin
 if not public.is_meetconnect_admin() then raise exception 'Administrator access required.'; end if;
 return query select l.* from public.room_listings l order by l.created_at desc;
end;
$$;
revoke all on function public.get_admin_room_listings() from public,anon;
grant execute on function public.get_admin_room_listings() to authenticated;

create or replace function public.current_user_owns_room_listing(p_listing_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.room_listings l where l.id=p_listing_id and l.owner_id=(select auth.uid())); $$;
revoke all on function public.current_user_owns_room_listing(uuid) from public,anon;
grant execute on function public.current_user_owns_room_listing(uuid) to authenticated;

drop policy if exists "Room providers read bookings for own listings" on public.room_bookings;
create policy "Room providers read bookings for own listings" on public.room_bookings for select to authenticated
using(public.current_user_owns_room_listing(listing_id));
drop policy if exists "Room providers update booking decisions" on public.room_bookings;
create policy "Room providers update booking decisions" on public.room_bookings for update to authenticated
using(public.current_user_owns_room_listing(listing_id))
with check(public.current_user_owns_room_listing(listing_id) and status in ('confirmed','rejected','completed'));
