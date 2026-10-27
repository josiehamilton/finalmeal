begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

-- Uses the dev seed: the 14 canvas places (custom, created_by null), the Vancouver and Tokyo
-- cities, and Josie (...0001) and Mike (...0002) with profiles.

-- ---------------------------------------------------------------- structure
select has_column('public', 'places', 'address', 'places.address exists');
select has_column('public', 'places', 'postcode', 'places.postcode exists');
select col_default_is('public', 'places', 'category_labels', '{}', 'category_labels defaults to empty');
select has_column('public', 'places', 'closed_at', 'places.closed_at exists');
select has_function('public', 'search_places', array['text', 'double precision', 'double precision', 'integer'],
  'search_places exists');
select has_function('public', 'create_custom_place', array['text', 'uuid', 'text'],
  'create_custom_place exists');

-- ---------------------------------------------------------------- fixtures (as the table owner)
-- A closed place and a merged place that would otherwise match "maru".
insert into public.places (source, name, city, region, country, location, closed_at) values
  ('custom', 'Maru Closed Test', 'Vancouver', 'BC', 'CA',
   extensions.st_setsrid(extensions.st_makepoint(-123.12, 49.28), 4326)::extensions.geography, '2026-01-01');
insert into public.places (source, name, city, region, country, location, merged_into_id)
select 'custom', 'Maru Merged Test', 'Vancouver', 'BC', 'CA',
  extensions.st_setsrid(extensions.st_makepoint(-123.12, 49.28), 4326)::extensions.geography, id
from public.places where name = 'Marutama';
-- Five Vancouver places and one Tokyo place that all start with "Zed".
insert into public.places (source, name, city, region, country, location)
select 'custom', 'Zed Cafe ' || g, 'Vancouver', 'BC', 'CA',
  extensions.st_setsrid(extensions.st_makepoint(-123.12 + g * 0.001, 49.28), 4326)::extensions.geography
from generate_series(1, 5) g;
insert into public.places (source, name, city, region, country, location) values
  ('custom', 'Zed Cafe Tokyo', 'Tokyo', 'Tokyo', 'JP',
   extensions.st_setsrid(extensions.st_makepoint(139.70, 35.66), 4326)::extensions.geography);
-- A Vancouver sushi place, to rank against Sushi Itto from Tokyo.
insert into public.places (source, name, city, region, country, location) values
  ('custom', 'Sushi Vancouver Test', 'Vancouver', 'BC', 'CA',
   extensions.st_setsrid(extensions.st_makepoint(-123.12, 49.28), 4326)::extensions.geography);
-- A Foursquare place with every new column filled.
insert into public.places (source, source_id, name, city, region, country, location, address, postcode,
  category_ids, category_labels)
values ('fsq', 'fsq-test-1', 'Café Zürich Test', 'Vancouver', 'BC', 'CA',
  extensions.st_setsrid(extensions.st_makepoint(-123.10, 49.27), 4326)::extensions.geography,
  '1 Test St', 'V6A 1A1', array['cat-1'], array['Café']);

-- ---------------------------------------------------------------- search_places (anon can search)
set local role anon;

select is(
  (select (place).name from public.search_places('maru', 49.28, -123.12) limit 1),
  'Marutama', 'maru near Vancouver finds Marutama first');
select is(
  (select array_agg((place).name order by (place).name) from public.search_places('maru', 49.28, -123.12)),
  array['Marutama'], 'a closed place and a merged place never appear');
select is(
  (select (place).name from public.search_places('MARU', 49.28, -123.12) limit 1),
  'Marutama', 'matching ignores case');
select is(
  (select (place).name from public.search_places('marutma', 49.28, -123.12) limit 1),
  'Marutama', 'a typo still finds it (trigram)');
select is(
  (select (place).name from public.search_places('el callejon') limit 1),
  'El Callejón', 'matching ignores accents in the place name');
select is(
  (select (place).name from public.search_places('cafe zurich') limit 1),
  'Café Zürich Test', 'accents in the stored name and in the query both fold');
select is(
  (select (place).name from public.search_places('kin') limit 1),
  'Kin Kao', 'with no coordinates a prefix match works');
select is(
  (select (place).name from public.search_places('kao') limit 1),
  'Kin Kao', 'the start of any word in the name matches');
select is(
  (select array_agg((place).name order by (place).name) from public.search_places('lotus')),
  array['Lotus Noodle Bar'], 'a query matching one place returns only it');
select is(
  (select distance_m from public.search_places('kin kao') limit 1), null::double precision,
  'distance_m is null without coordinates');
select cmp_ok(
  (select distance_m from public.search_places('marutama', 49.2905, -123.1366) limit 1),
  '<', 5::double precision, 'distance_m is the metres from the point');
select is(
  (select (place).name from public.search_places('sushi', 35.66, 139.70) limit 1),
  'Sushi Itto', 'sushi from Tokyo ranks Sushi Itto first');
select is(
  (select (place).name from (select place, row_number() over () as ord
    from public.search_places('sushi', 35.66, 139.70)) s order by ord desc limit 1),
  'Sushi Vancouver Test', 'the Vancouver sushi place comes after the Tokyo ones');
select is(
  (select count(*)::int from public.search_places('sushi', 35.66, 139.70)), 3,
  'fewer than 5 hits within 50 km widens to the whole world');
select is(
  (select count(*)::int from public.search_places('zed', 49.28, -123.12)), 5,
  '5 or more hits within 50 km stay local (Tokyo is left out)');
select is(
  (select count(*)::int from public.search_places('zed', 35.66, 139.70)), 6,
  'from Tokyo, the single local hit widens to the world');
select is(
  (select (place).name from public.search_places('zed', 35.66, 139.70) limit 1),
  'Zed Cafe Tokyo', 'and the Tokyo one ranks first');
select is(
  (select count(*)::int from public.search_places('zed cafe', 49.28, -123.12, 2)), 2,
  'p_lim limits the rows');
select is(
  (select count(*)::int from public.search_places('', 49.28, -123.12)), 12,
  'an empty query with coordinates returns the nearest 12');
select is(
  (select (place).city from public.search_places('', 35.66, 139.70) limit 1), 'Tokyo',
  'the nearest come first');
select is(
  (select count(*)::int from public.search_places('   ')), 0,
  'a blank query with no coordinates returns nothing');
select throws_ok($$select * from public.search_places('x', 91, 0)$$, 'P0001', 'invalid_coordinates',
  'out-of-range coordinates are refused');

-- ---------------------------------------------------------------- create_custom_place
select throws_ok($$select public.create_custom_place('Anon Spot',
  (select id from public.cities where name = 'Vancouver' and country = 'CA'))$$,
  '42501', null, 'anon cannot create a custom place');

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  (select (p).name || '|' || (p).address || '|' || (p).source::text || '|' || (p).city || '|'
     || (p).region || '|' || (p).country || '|' || ((p).created_by is not null)::text
   from public.create_custom_place('Grandma’s Kitchen',
     (select id from public.cities where name = 'Vancouver' and country = 'CA'), '  123 Main St ') p),
  'Grandma’s Kitchen|123 Main St|custom|Vancouver|BC|CA|true',
  'a custom place takes the name, trimmed address and the city''s names');
select is(
  (select created_by from public.places where name = 'Grandma’s Kitchen'),
  '00000000-0000-4000-8000-000000000001'::uuid, 'created_by is the caller');
select cmp_ok(
  (select extensions.st_distance(p.location, c.location) from public.places p, public.cities c
   where p.name = 'Grandma’s Kitchen' and c.name = 'Vancouver' and c.country = 'CA'),
  '<', 1::double precision, 'the location is the city point');
select is(
  (select (place).name from public.search_places('grandma', 49.25, -123.12) limit 1),
  'Grandma’s Kitchen', 'the new place is searchable');
select is(
  (select (p).address is null and (p).city = 'Tokyo' and (p).region = 'Tokyo'
   from public.create_custom_place('  Ramen   Pop-up ',
     (select id from public.cities where name = 'Tokyo')) p),
  true, 'the address is optional; a city with no region code uses its region name');
select is(
  (select name from public.places where name like 'Ramen%Pop-up'), 'Ramen Pop-up',
  'inner whitespace in the name is collapsed');
select throws_ok($$select public.create_custom_place('   ',
  (select id from public.cities where name = 'Tokyo'))$$,
  'P0001', 'invalid_place_name', 'a blank name raises invalid_place_name');
select throws_ok(format($$select public.create_custom_place(%L,
  (select id from public.cities where name = 'Tokyo'))$$, repeat('x', 81)),
  'P0001', 'invalid_place_name', 'an 81-character name raises invalid_place_name');
select throws_ok(format($$select public.create_custom_place('Long Address',
  (select id from public.cities where name = 'Tokyo'), %L)$$, repeat('x', 201)),
  'P0001', 'invalid_place_name', 'a 201-character address raises invalid_place_name');
select throws_ok($$select public.create_custom_place('Nowhere Spot',
  '00000000-0000-4000-8000-0000000000ff')$$, 'P0001', 'city_not_found',
  'an unknown city raises city_not_found');

-- The 20-a-day limit: Josie has made 2 so far, so 18 more are fine and the 21st is refused.
select is(
  (select count(*)::int from (
    select public.create_custom_place('Limit Spot ' || g,
      (select id from public.cities where name = 'Tokyo')) from generate_series(1, 18) g) s),
  18, '20 custom places in a day are fine');
select throws_ok($$select public.create_custom_place('Limit Spot 21',
  (select id from public.cities where name = 'Tokyo'))$$, 'P0001', 'rate_limited',
  'the 21st raises rate_limited');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok($$select public.create_custom_place('Mike Spot',
  (select id from public.cities where name = 'Tokyo'))$$, 'the limit is per person');

select * from finish();
rollback;
