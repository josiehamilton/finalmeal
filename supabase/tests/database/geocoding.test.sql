begin;
create extension if not exists pgtap with schema extensions;

select plan(59);

-- Uses the dev seed: Vancouver (BC), Josie (...0001) with a profile, and the 14 canvas places.

-- ---------------------------------------------------------------- structure
select has_column('public', 'places', 'location_precision', 'places.location_precision exists');
select has_column('public', 'places', 'geocode_status', 'places.geocode_status exists');
select has_column('public', 'places', 'geocode_attempts', 'places.geocode_attempts exists');
select has_column('public', 'places', 'geocode_claimed_at', 'places.geocode_claimed_at exists');
select has_column('public', 'places', 'geocoded_at', 'places.geocoded_at exists');
select has_column('public', 'places', 'geocoder', 'places.geocoder exists');
select has_function('public', 'claim_geocode_batch', array['integer'], 'claim_geocode_batch exists');
select has_function('public', 'finish_geocode',
  array['uuid', 'text', 'double precision', 'double precision', 'text'], 'finish_geocode exists');
select has_index('public', 'places', 'places_geocode_queue', 'the pending queue has its partial index');

-- ---------------------------------------------------------------- seed places stay exact
select is(
  (select count(*)::int from public.places
   where source = 'custom' and (location_precision <> 'exact' or geocode_status <> 'not_needed')),
  0, 'every seed place is exact and needs no geocoding');

-- ---------------------------------------------------------------- creating custom spots
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);

select is(
  (select (p).location_precision || '|' || (p).geocode_status
   from public.create_custom_place('Ember Dogs',
     (select id from public.cities where name = 'Vancouver' and region_code = 'BC'), '1820 Commercial Dr') p),
  'city|pending', 'a spot with an address starts at its city and waits to be geocoded');
select is(
  (select (p).location_precision || '|' || (p).geocode_status
   from public.create_custom_place('Ember Truck',
     (select id from public.cities where name = 'Vancouver' and region_code = 'BC'), null, true) p),
  'city|not_needed', 'a spot with no fixed address is never geocoded');

-- ---------------------------------------------------------------- what clients can read
select lives_ok($$select location_precision from public.places limit 1$$,
  'clients can read location_precision');
select throws_ok($$select geocode_status from public.places limit 1$$, '42501', null,
  'clients cannot read geocode_status');
select throws_ok($$select geocode_attempts from public.places limit 1$$, '42501', null,
  'clients cannot read geocode_attempts');
select throws_ok($$select geocoder from public.places limit 1$$, '42501', null,
  'clients cannot read geocoder');
select is(
  (select (p).geocode_status is null and (p).geocode_attempts is null and (p).geocoder is null
   from public.get_place((select id from public.places where name = 'Ember Dogs')) p),
  true, 'get_place leaves the geocoding bookkeeping out');
select is(
  (select (p).location_precision from public.get_place((select id from public.places where name = 'Ember Dogs')) p),
  'city', 'get_place still says the spot is only at city precision');

select throws_ok($$select * from public.claim_geocode_batch()$$, '42501', null,
  'authenticated cannot claim a geocode batch');
select throws_ok($$select public.finish_geocode(gen_random_uuid(), 'not_found')$$, '42501', null,
  'authenticated cannot finish a geocode');

-- ---------------------------------------------------------------- the queue (service role)
reset role;
set local role service_role;

select is(
  (select count(*)::int from public.claim_geocode_batch()
   where name = 'Ember Dogs' and address = '1820 Commercial Dr' and city = 'Vancouver' and region = 'BC'
     and country = 'CA'
     and abs(city_lat - 49.24966) < 0.0001 and abs(city_lng + 123.11934) < 0.0001),
  1, 'claim returns the pending spot with its city''s point');
select is(
  (select geocode_status || '|' || geocode_attempts::text || '|' || (geocode_claimed_at is not null)::text
   from public.places where name = 'Ember Dogs'),
  'geocoding|1|true', 'a claimed spot is geocoding, with one attempt and a claim time');
select is(
  (select count(*)::int from public.claim_geocode_batch() where name = 'Ember Dogs'),
  0, 'a second claim returns nothing');
select is(
  (select count(*)::int from public.places where name = 'Ember Truck' and geocode_status = 'not_needed'),
  1, 'the no-fixed-address spot was never queued');

update public.places set geocode_claimed_at = now() - interval '11 minutes' where name = 'Ember Dogs';
select is(
  (select count(*)::int from public.claim_geocode_batch() where name = 'Ember Dogs'),
  1, 'a claim older than 10 minutes (a dispatch that died) is claimed again');
select is((select geocode_attempts::int from public.places where name = 'Ember Dogs'), 2,
  'and counts as another attempt');

-- ---------------------------------------------------------------- finish_geocode
select is(
  public.finish_geocode((select id from public.places where name = 'Ember Dogs'),
    'found', 49.269, -123.069, 'mock'),
  'done', 'a found answer near the city is accepted');
select is(
  (select location_precision || '|' || geocode_status || '|' || geocoder || '|' || (geocoded_at is not null)::text
     || '|' || round(extensions.st_y(location::extensions.geometry)::numeric, 3)::text
     || '|' || round(extensions.st_x(location::extensions.geometry)::numeric, 3)::text
   from public.places where name = 'Ember Dogs'),
  'exact|done|mock|true|49.269|-123.069', 'the point moved and the spot is exact');
select is(
  public.finish_geocode((select id from public.places where name = 'Ember Dogs'), 'not_found'),
  'done', 'a finished spot is left alone');

reset role;
-- A second spot for the refusals and retries.
insert into public.places (source, name, city, region, country, location, address, created_by,
  location_precision, geocode_status)
values ('custom', 'Far Away Cafe', 'Vancouver', 'BC', 'CA', 'SRID=4326;POINT(-123.11934 49.24966)',
  '9 Far St', '00000000-0000-4000-8000-000000000001', 'city', 'pending');
set local role service_role;
select is((select count(*)::int from public.claim_geocode_batch() where name = 'Far Away Cafe'), 1,
  'the second spot is claimed');
select is(
  public.finish_geocode((select id from public.places where name = 'Far Away Cafe'),
    'found', 48.4284, -123.3656, 'mock'),
  'not_found', 'an answer about 95 km from the city is refused');
select is(
  (select location_precision || '|' || round(extensions.st_y(location::extensions.geometry)::numeric, 3)::text
   from public.places where name = 'Far Away Cafe'),
  'city|49.250', 'a refused answer leaves the point at the city');

reset role;
update public.places set geocode_status = 'pending', geocode_attempts = 0 where name = 'Far Away Cafe';
set local role service_role;
-- Each retry needs a fresh claim; the third attempt ends the spot as failed.
select is((select count(*)::int from public.claim_geocode_batch() where name = 'Far Away Cafe'), 1,
  'retry round 1: the spot is claimed');
select is(public.finish_geocode((select id from public.places where name = 'Far Away Cafe'), 'retry'),
  'pending', 'retry round 1 ends pending');
select is((select count(*)::int from public.claim_geocode_batch() where name = 'Far Away Cafe'), 1,
  'retry round 2: the spot is claimed');
select is(public.finish_geocode((select id from public.places where name = 'Far Away Cafe'), 'retry'),
  'pending', 'retry round 2 ends pending');
select is((select count(*)::int from public.claim_geocode_batch() where name = 'Far Away Cafe'), 1,
  'retry round 3: the spot is claimed');
select is(public.finish_geocode((select id from public.places where name = 'Far Away Cafe'), 'retry'),
  'failed', 'retry round 3 ends failed');

-- ---------------------------------------------------------------- the follow-up fixes
-- (migration 20261105110000_geocode_queue_fixes.sql)
reset role;

-- The claim must be able to use the queue index (the real table holds the whole place extract).
-- This is the claim's candidate query, word for word; keep it in sync with the function.
create function public.test_claim_plan() returns text
language plpgsql as $$
declare
  r record;
  plan text := '';
begin
  for r in execute $q$explain
    select q.id from public.places q
    where q.geocode_status in ('pending', 'geocoding')
      and (q.geocode_status = 'pending'
           or (q.geocode_claimed_at < now() - interval '10 minutes' and q.geocode_attempts < 3))
      and q.address is not null and not q.no_fixed_address
    order by q.created_at, q.id
    limit 20
    for update skip locked$q$
  loop
    plan := plan || r."QUERY PLAN" || E'\n';
  end loop;
  return plan;
end;
$$;
set local enable_seqscan = off;
select matches(public.test_claim_plan(), 'Index.*places_geocode_queue',
  'the claim query uses the places_geocode_queue index');
reset enable_seqscan;

-- Fixtures for the queue rules. The queue is emptied first so counts are exact.
update public.places set geocode_status = 'not_needed' where geocode_status in ('pending', 'geocoding');
insert into public.places (source, name, city, region, country, location, address, created_by,
  location_precision, geocode_status, created_at)
select 'custom', 'Queue Spot ' || g, 'Vancouver', 'BC', 'CA', 'SRID=4326;POINT(-123.11934 49.24966)',
  g || ' Queue St', '00000000-0000-4000-8000-000000000001', 'city', 'pending',
  now() - interval '1 hour' + g * interval '1 second'
from generate_series(1, 25) g;
-- Spots that must never be claimed: no address, and a flagged no-fixed-address spot.
insert into public.places (source, name, city, region, country, location, address, no_fixed_address,
  created_by, location_precision, geocode_status) values
  ('custom', 'Unaddressed Spot', 'Vancouver', 'BC', 'CA', 'SRID=4326;POINT(-123.11934 49.24966)', null, false,
   '00000000-0000-4000-8000-000000000001', 'city', 'pending'),
  ('custom', 'Truck Spot', 'Vancouver', 'BC', 'CA', 'SRID=4326;POINT(-123.11934 49.24966)', null, true,
   '00000000-0000-4000-8000-000000000001', 'city', 'pending');

set local role anon;
select throws_ok($$select * from public.claim_geocode_batch()$$, '42501', null,
  'anon cannot claim a geocode batch');
select throws_ok($$select public.finish_geocode(gen_random_uuid(), 'not_found')$$, '42501', null,
  'anon cannot finish a geocode');
reset role;
set local role service_role;

select is((select count(*)::int from public.claim_geocode_batch(100)), 20,
  'p_limit is capped at 20');
select is((select count(*)::int from public.claim_geocode_batch(0)), 0, 'p_limit 0 claims nothing');
select is((select count(*)::int from public.places where name in ('Unaddressed Spot', 'Truck Spot')
  and geocode_status = 'pending'), 2, 'spots without an address are never claimed');
select is((select min(name) from (select name from public.places where geocode_status = 'geocoding'
  order by created_at limit 1) o), 'Queue Spot 1', 'the oldest spots are claimed first');

-- Bad answers.
select throws_ok($$select public.finish_geocode(
  (select id from public.places where name = 'Queue Spot 1'), 'maybe')$$,
  'P0001', 'invalid_geocode_result', 'an unknown result raises invalid_geocode_result');
select is(public.finish_geocode((select id from public.places where name = 'Queue Spot 1'), 'found'),
  'not_found', 'found without coordinates is not found');
select is(public.finish_geocode((select id from public.places where name = 'Queue Spot 2'), 'found', 91, -123.1),
  'not_found', 'found with a latitude out of range is not found');
select is(public.finish_geocode((select id from public.places where name = 'Queue Spot 3'), 'found', 49.25, 181),
  'not_found', 'found with a longitude out of range is not found');
select is(public.finish_geocode(gen_random_uuid(), 'not_found'), null, 'an unknown id returns null');

-- A spot that is not geocoding is left alone, whatever the answer.
select is(public.finish_geocode((select id from public.places where name = 'Queue Spot 25'), 'not_found'),
  'pending', 'not_found on a pending spot is ignored');
select is(public.finish_geocode((select id from public.places where name = 'Queue Spot 25'), 'retry'),
  'pending', 'retry on a pending spot is ignored');
select is(public.finish_geocode((select id from public.places where name = 'Queue Spot 25'),
    'found', 49.25, -123.1, 'mock'),
  'pending', 'found on a pending spot is ignored');

-- release gives an unused claim back without charging the attempt.
select is(public.finish_geocode((select id from public.places where name = 'Queue Spot 4'), 'release'),
  'pending', 'release puts a claimed spot back to pending');
select is((select geocode_attempts::int from public.places where name = 'Queue Spot 4'), 0,
  'and refunds its attempt');
select is(public.finish_geocode((select id from public.places where name = 'Queue Spot 4'), 'release'),
  'pending', 'releasing a spot that is not claimed changes nothing');
select is((select geocode_attempts::int from public.places where name = 'Queue Spot 4'), 0,
  'and refunds nothing');

-- A stale claim that already used its attempts is failed, not claimed again.
reset role;
update public.places set geocode_status = 'geocoding', geocode_attempts = 3,
  geocode_claimed_at = now() - interval '11 minutes' where name = 'Queue Spot 10';
update public.places set geocode_status = 'geocoding', geocode_attempts = 2,
  geocode_claimed_at = now() - interval '11 minutes' where name = 'Queue Spot 11';
set local role service_role;
select is((select count(*)::int from public.claim_geocode_batch(20) where name in ('Queue Spot 10', 'Queue Spot 11')),
  1, 'a stale claim with attempts left is claimed again; one with none left is not');
select is((select geocode_status from public.places where name = 'Queue Spot 10'), 'failed',
  'a stale claim that used all 3 attempts is marked failed');

select * from finish();
rollback;
