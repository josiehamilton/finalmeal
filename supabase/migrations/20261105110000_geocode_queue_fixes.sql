-- Task 1 review fixes for the geocoding queue.
--
-- 1. The queue index could never serve the claim: it covered 'pending' only, but the claim also
--    wants stale 'geocoding' rows, so Postgres scanned the whole of places on every call (and
--    production will hold the whole place extract). One partial index on (created_at, id) for
--    both live states replaces it, and the claim repeats `geocode_status in (...)` so the
--    planner can prove the index applies.
-- 2. A claim that is never finished (the function died) is reclaimed after 10 minutes, but only
--    while the spot has attempts left; a spot that has used all 3 is marked 'failed' instead, so a
--    spot that always kills the function stops being retried.
-- 3. The claim only returns spots that have an address and are not flagged no_fixed_address, so
--    "no-fixed-address spots never get a pin" holds by construction.
-- 4. finish_geocode accepts 'release' (the function gives back spots it claimed but did not get to
--    when a batch aborts): back to 'pending', and the unused attempt is refunded.
--
-- Signatures, security and grants are unchanged.

drop index public.places_geocode_queue;
create index places_geocode_queue on public.places (created_at, id)
  where geocode_status in ('pending', 'geocoding');

create or replace function public.claim_geocode_batch(p_limit integer default 20)
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
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- Stale claims that have used every attempt stop here.
  update public.places pl
  set geocode_status = 'failed', geocode_claimed_at = null
  where pl.geocode_status = 'geocoding'
    and pl.geocode_claimed_at < now() - interval '10 minutes'
    and pl.geocode_attempts >= 3;

  -- Keep this candidate query in step with test_claim_plan() in geocoding.test.sql, which checks
  -- that it uses the places_geocode_queue index.
  return query
  update public.places pl
  set geocode_status = 'geocoding',
      geocode_claimed_at = now(),
      geocode_attempts = pl.geocode_attempts + 1
  where pl.id in (
    select q.id from public.places q
    where q.geocode_status in ('pending', 'geocoding')
      and (q.geocode_status = 'pending'
           or (q.geocode_claimed_at < now() - interval '10 minutes' and q.geocode_attempts < 3))
      and q.address is not null and not q.no_fixed_address
    order by q.created_at, q.id
    limit least(greatest(coalesce(p_limit, 20), 0), 20)
    for update skip locked
  )
  returning pl.id, pl.name, pl.address, pl.postcode, pl.city, pl.region, pl.country::text,
            extensions.st_y(pl.location::extensions.geometry),
            extensions.st_x(pl.location::extensions.geometry);
end;
$$;

create or replace function public.finish_geocode(
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
  if p_result is null or p_result not in ('found', 'not_found', 'retry', 'release') then
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

  if p_result = 'release' then
    update public.places
    set geocode_status = 'pending', geocode_claimed_at = null,
        geocode_attempts = greatest(geocode_attempts - 1, 0)
    where id = p_place_id;
    return 'pending';
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
