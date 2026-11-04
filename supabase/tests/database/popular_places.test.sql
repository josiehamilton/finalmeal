begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- Uses the dev seed: the Vancouver and Tokyo cities, and the canvas places with their picks.
-- Seed picks per place (trusted accounts): Kin Kao 5, Marutama 4, then Skewers, Hearth Bakery and
-- Lotus Noodle Bar 2 each (the nearest to the city's point, Hearth Bakery, ranks third), Miku 1;
-- Tokyo has Sushi Itto 3 and Sushi Dai 2. A real Foursquare extract (0 picks) may also
-- be loaded, so the fixtures below are rolled back with the transaction and fsq rows are cleared.
delete from public.places where source = 'fsq';

select has_function('public', 'popular_places', array['uuid', 'integer'], 'popular_places exists');

insert into public.places (source, name, city, region, country, location) values
  ('custom', 'Zero Picks Vancouver', 'Vancouver', 'BC', 'CA',
   extensions.st_setsrid(extensions.st_makepoint(-123.1207, 49.2827), 4326)::extensions.geography),
  ('custom', 'Closed Popular Test', 'Vancouver', 'BC', 'CA',
   extensions.st_setsrid(extensions.st_makepoint(-123.12, 49.28), 4326)::extensions.geography),
  -- Surrey is about 35 km from Vancouver's point: outside 25 km.
  ('custom', 'Far Surrey Test', 'Surrey', 'BC', 'CA',
   extensions.st_setsrid(extensions.st_makepoint(-122.65, 49.19), 4326)::extensions.geography),
  -- Burnaby is within 25 km but its city text differs: the radius, not the text, decides.
  ('custom', 'Burnaby Zero Test', 'Burnaby', 'BC', 'CA',
   extensions.st_setsrid(extensions.st_makepoint(-122.95, 49.25), 4326)::extensions.geography);
update public.places set closed_at = '2026-01-01' where name = 'Closed Popular Test';

-- Six brand-new (untrusted) accounts all pick a dish at the 0-pick spot: that is more picks than
-- Kin Kao's 5, so if they counted the spot would jump to the top. They must not move anything.
insert into auth.users (id)
select ('00000000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid from generate_series(1, 6) g;
insert into public.profiles (id, username, display_name, trust_level)
select ('00000000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid,
  'untrusted_' || g, 'Untrusted ' || g, 'new'
from generate_series(1, 6) g;
insert into public.dishes (id, place_id, name)
select '20000000-0000-0000-0000-0000000000f1', id, 'Spam Special' from public.places where name = 'Zero Picks Vancouver';
insert into public.picks (user_id, dish_id, tier, original_dish_name)
select ('00000000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid,
  '20000000-0000-0000-0000-0000000000f1', 'honorable', 'Spam Special'
from generate_series(1, 6) g;

create temp table vancouver as select id from public.cities where name = 'Vancouver' limit 1;
create temp table tokyo as select id from public.cities where name = 'Tokyo' limit 1;
grant select on vancouver, tokyo to anon, authenticated;

set local role anon;

select is(
  (select array_agg((t.place).name order by t.ordinality)
   from public.popular_places((select id from vancouver), 3) with ordinality as t),
  array['Kin Kao', 'Marutama', 'Hearth Bakery'],
  'Vancouver: the most-picked first (Kin Kao 5, Marutama 4, then a three-way tie at 2 broken by distance)');

select is(
  (select t.pick_count from public.popular_places((select id from vancouver), 12) as t where (t.place).name = 'Marutama'),
  4::bigint, 'pick_count counts the picks at the place');

select ok(
  (select t.ordinality from public.popular_places((select id from vancouver), 50) with ordinality as t
   where (t.place).name = 'Marutama')
  < (select t.ordinality from public.popular_places((select id from vancouver), 50) with ordinality as t
     where (t.place).name = 'Zero Picks Vancouver'),
  'Marutama (4 picks) ranks above a 0-pick spot');

select is(
  (select count(*) from public.popular_places((select id from vancouver), 50)
   where (place).country <> 'CA' or (place).city in ('Tokyo', 'Saskatoon', 'New York')),
  0::bigint, 'Vancouver has no Tokyo, Saskatoon or New York spots');

select ok(
  exists (select 1 from public.popular_places((select id from vancouver), 50) where (place).name = 'Burnaby Zero Test'),
  'a spot within 25 km counts as in the city even when its city text differs');
select ok(
  not exists (select 1 from public.popular_places((select id from vancouver), 50) where (place).name = 'Far Surrey Test'),
  'a spot beyond 25 km is not in the city');
select ok(
  not exists (select 1 from public.popular_places((select id from vancouver), 50) where (place).name = 'Closed Popular Test'),
  'closed places are left out');

select is(
  (select array_agg((t.place).name order by t.ordinality)
   from public.popular_places((select id from tokyo), 12) with ordinality as t),
  array['Sushi Itto', 'Sushi Dai'],
  'Tokyo: Sushi Itto (3) then Sushi Dai (2), and nothing from Vancouver');

select is(
  (select array_agg((t.place).name order by t.ordinality)
   from public.popular_places((select id from vancouver), 3) with ordinality as t),
  array['Kin Kao', 'Marutama', 'Hearth Bakery'],
  'picks by untrusted accounts do not move the ranking');
select is(
  (select t.pick_count from public.popular_places((select id from vancouver), 50) as t
   where (t.place).name = 'Zero Picks Vancouver'),
  0::bigint, 'untrusted picks are not counted in pick_count');

select is((select count(*) from public.popular_places((select id from vancouver), 2)), 2::bigint, 'the limit applies');
select is((select count(*) from public.popular_places((select id from vancouver), 500)),
  (select count(*) from public.popular_places((select id from vancouver), 50)), 'the limit is capped at 50');
select is((select count(*) from public.popular_places('00000000-0000-0000-0000-0000000000ff', 12)), 0::bigint,
  'an unknown city returns nothing');

select is(
  (select count(*) from public.popular_places((select id from vancouver), 50) where (place).created_by is not null),
  0::bigint, 'created_by is always masked');

reset role;
select ok(
  has_function_privilege('anon', 'public.popular_places(uuid, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.popular_places(uuid, integer)', 'execute'),
  'anon and authenticated can execute it');

select * from finish();
rollback;
