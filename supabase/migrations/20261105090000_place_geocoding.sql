-- Phase 5, Task 1: map positions for custom spots.
--
-- A custom spot is created on its city's point (create_custom_place has no address lookup). This
-- migration lets a server-side geocoder move it to its real address:
--
-- 1. places.location_precision ('exact' | 'city') says whether the point is the real place or
--    only its city's centre. Clients may read it; the map never pins a 'city' spot.
-- 2. The rest of the bookkeeping (geocode_status, geocode_attempts, geocode_claimed_at,
--    geocoded_at, geocoder) stays server-side: no client select, and mask_place nulls it in
--    everything the API returns.
-- 3. Backfill: custom places someone created are 'city' / 'pending' (or 'not_needed' when they
--    have no fixed address). Seed places (created_by null, hand-placed) stay 'exact'.
-- 4. create_custom_place (same signature, grants restated) starts new spots as 'city'.
-- 5. claim_geocode_batch / finish_geocode: the queue the geocode-places Edge Function works.
--    service_role only. An answer more than 50 km from the spot's city is refused, so a wrong
--    match never lands on the other side of the world.

-- ---------------------------------------------------------------- columns
alter table public.places
  add column location_precision text not null default 'exact'
    check (location_precision in ('exact', 'city')),
  add column geocode_status text not null default 'not_needed'
    check (geocode_status in ('not_needed', 'pending', 'geocoding', 'done', 'not_found', 'failed')),
  add column geocode_attempts smallint not null default 0,
  add column geocode_claimed_at timestamptz,
  add column geocoded_at timestamptz,
  add column geocoder text;

create index places_geocode_queue on public.places (created_at) where geocode_status = 'pending';

-- Clients read the precision only; the other geocoding columns stay server-side.
grant select (location_precision) on public.places to anon, authenticated;

update public.places
set location_precision = 'city',
    geocode_status = case when no_fixed_address then 'not_needed' else 'pending' end
where source = 'custom' and created_by is not null;

-- ---------------------------------------------------------------- masking
-- Same as before (created_by null) plus the geocoding bookkeeping, which is nulled so that
-- search_places, get_place and the other masked reads do not reveal it.
create or replace function public.mask_place(p public.places)
returns public.places
language plpgsql
stable
set search_path = ''
as $$
declare
  r public.places := p;
begin
  r.created_by := null;
  r.geocode_status := null;
  r.geocode_attempts := null;
  r.geocode_claimed_at := null;
  r.geocoded_at := null;
  r.geocoder := null;
  return r;
end;
$$;
revoke all on function public.mask_place(public.places) from public, anon, authenticated;

-- ---------------------------------------------------------------- create_custom_place
-- The previous body (20261103090100_review_hardening.sql) with the geocoding columns added to
-- the insert; the signature, security and grants are unchanged.
create or replace function public.create_custom_place(
  p_name text,
  p_city_id uuid,
  p_address text default null,
  p_no_fixed_address boolean default false
)
returns public.places
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
  v_no_fixed boolean := coalesce(p_no_fixed_address, false);
  v_city public.cities;
  v_place public.places;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 80 or char_length(coalesce(v_address, '')) > 200 then
    raise exception 'invalid_place_name';
  end if;
  -- A public business has a street address, unless it has no fixed one (a food truck, a
  -- pop-up); then it must not give one.
  if v_no_fixed <> (v_address is null) then
    raise exception 'address_required';
  end if;
  select * into v_city from public.cities where id = p_city_id;
  if not found then
    raise exception 'city_not_found';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_not_found';
  end if;

  -- One call at a time per person, so two at once cannot both slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended('create_custom_place:' || v_uid::text, 0));
  if (select count(*) from public.places
      where created_by = v_uid and source = 'custom' and created_at > now() - interval '1 day') >= 20 then
    raise exception 'custom_place_limit';
  end if;

  -- The spot starts on its city's point (precision 'city'); the geocoder moves it later. A spot
  -- with no fixed address never gets a pin of its own.
  insert into public.places (source, name, city, region, country, location, address,
                             no_fixed_address, created_by, location_precision, geocode_status)
  values ('custom', v_name, v_city.name, coalesce(v_city.region_code, v_city.region_name),
          v_city.country, v_city.location, v_address, v_no_fixed, v_uid, 'city',
          case when v_no_fixed then 'not_needed' else 'pending' end)
  returning * into v_place;
  return v_place;
end;
$$;

revoke all on function public.create_custom_place(text, uuid, text, boolean) from public, anon;
grant execute on function public.create_custom_place(text, uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------- the queue
-- Only service_role (the geocode-places Edge Function) runs these.
create function public.claim_geocode_batch(p_limit integer default 20)
returns table (
  place_id uuid,
  name text,
  address text,
  postcode text,
  city text,
  region text,
  country text,
  city_lat double precision,
  city_lng double precision
)
language sql
security definer
set search_path = ''
as $$
  update public.places pl
  set geocode_status = 'geocoding',
      geocode_claimed_at = now(),
      geocode_attempts = pl.geocode_attempts + 1
  where pl.id in (
    select q.id from public.places q
    where q.geocode_status = 'pending'
       or (q.geocode_status = 'geocoding' and q.geocode_claimed_at < now() - interval '10 minutes')
    order by q.created_at, q.id
    limit least(greatest(coalesce(p_limit, 20), 0), 20)
    for update skip locked
  )
  returning pl.id, pl.name, pl.address, pl.postcode, pl.city, pl.region, pl.country,
            extensions.st_y(pl.location::extensions.geometry),
            extensions.st_x(pl.location::extensions.geometry);
$$;

create function public.finish_geocode(
  p_place_id uuid,
  p_result text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_geocoder text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_place public.places;
  v_status text;
begin
  if p_result is null or p_result not in ('found', 'not_found', 'retry') then
    raise exception 'invalid_geocode_result';
  end if;
  select * into v_place from public.places where id = p_place_id for update;
  if not found then
    return null;
  end if;
  -- Only a spot a dispatch has claimed can be finished; anything else is left alone.
  if v_place.geocode_status <> 'geocoding' then
    return v_place.geocode_status;
  end if;

  if p_result = 'retry' then
    v_status := case when v_place.geocode_attempts >= 3 then 'failed' else 'pending' end;
    update public.places set geocode_status = v_status, geocode_claimed_at = null
    where id = p_place_id;
    return v_status;
  end if;

  if p_result = 'found'
     and p_lat between -90 and 90 and p_lng between -180 and 180
     and extensions.st_distance(
           v_place.location,
           extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
         ) <= 50000 then
    update public.places
    set location = extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
        location_precision = 'exact',
        geocode_status = 'done',
        geocode_claimed_at = null,
        geocoder = p_geocoder,
        geocoded_at = now()
    where id = p_place_id;
    return 'done';
  end if;

  -- not_found, or a found answer that is invalid or too far from the spot's city.
  update public.places set geocode_status = 'not_found', geocode_claimed_at = null
  where id = p_place_id;
  return 'not_found';
end;
$$;

revoke all on function public.claim_geocode_batch(integer) from public, anon, authenticated;
revoke all on function public.finish_geocode(uuid, text, double precision, double precision, text)
  from public, anon, authenticated;
grant execute on function public.claim_geocode_batch(integer) to service_role;
grant execute on function public.finish_geocode(uuid, text, double precision, double precision, text)
  to service_role;
