begin;
create extension if not exists pgtap with schema extensions;

select plan(73);

-- Foursquare rows (a real extract may be loaded by the dev seed) would collide with the
-- fixtures below; this is rolled back with the transaction, and no pick refers to an fsq place.
delete from public.places where source = 'fsq';

-- Uses the dev seed: the 14 canvas places (custom, created_by null), the Vancouver and Tokyo
-- cities, and Josie (...0001) and Mike (...0002) with profiles.

-- ---------------------------------------------------------------- structure
select has_column('public', 'places', 'address', 'places.address exists');
select has_column('public', 'places', 'postcode', 'places.postcode exists');
select col_default_is('public', 'places', 'category_labels', '{}', 'category_labels defaults to empty');
select has_column('public', 'places', 'closed_at', 'places.closed_at exists');
select has_function('public', 'search_places', array['text', 'double precision', 'double precision', 'integer'],
  'search_places exists');
select has_function('public', 'create_custom_place', array['text', 'uuid', 'text', 'boolean'],
  'create_custom_place exists');
select has_column('public', 'places', 'no_fixed_address', 'places.no_fixed_address exists');
select col_default_is('public', 'places', 'no_fixed_address', 'false', 'no_fixed_address defaults to false');
select has_function('public', 'get_place', array['uuid'], 'get_place exists');

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

-- ---------------------------------------------------------------- real-world collisions
-- With a Foursquare extract loaded, the canvas places share names and words with real ones.
-- These rows are added after the checks above, so those checks ran on the canvas places alone.
reset role;
insert into public.places (source, source_id, name, city, region, country, location, address) values
  ('fsq', 'collide-1', 'Marutama Ramen', 'Vancouver', 'BC', 'CA',
   extensions.st_setsrid(extensions.st_makepoint(-123.1385, 49.2915), 4326)::extensions.geography, '1 Collide St'),
  ('fsq', 'collide-2', 'Marutama Ra-men Annex', 'Burnaby', 'BC', 'CA',
   extensions.st_setsrid(extensions.st_makepoint(-123.0, 49.25), 4326)::extensions.geography, null),
  ('fsq', 'collide-3', 'Sushi Mori', 'Tokyo', 'Tokyo', 'JP',
   extensions.st_setsrid(extensions.st_makepoint(139.71, 35.67), 4326)::extensions.geography, null),
  ('fsq', 'collide-4', 'Sushi Garden', 'Vancouver', 'BC', 'CA',
   extensions.st_setsrid(extensions.st_makepoint(-123.13, 49.28), 4326)::extensions.geography, null),
  ('fsq', 'collide-5', 'Kaoru Ramen', 'Vancouver', 'BC', 'CA',
   extensions.st_setsrid(extensions.st_makepoint(-123.10, 49.26), 4326)::extensions.geography, null),
  ('fsq', 'collide-6', 'Kao Thai Kitchen', 'Vancouver', 'BC', 'CA',
   extensions.st_setsrid(extensions.st_makepoint(-123.11, 49.27), 4326)::extensions.geography, null);
set local role anon;

select ok(
  'Marutama' in (select (place).name from public.search_places('maru', 49.28, -123.12) limit 3),
  'the canvas Marutama stays in the top 3 for maru, beside Foursquare lookalikes');
select is(
  (select (place).name from public.search_places('maru', 49.2905, -123.1366) limit 1),
  'Marutama', 'and it is first when the point is next to it');
select is(
  (select count(*)::int from public.search_places('maru', 49.28, -123.12)), 3,
  'all three Marutama places are found, and the closed and merged ones still are not');
select is(
  (select (place).name from public.search_places('sushi', 35.66, 139.70) limit 1),
  'Sushi Itto', 'Sushi Itto is still first for sushi from Tokyo');
select is(
  (select (place).city from (select place, row_number() over () as ord
    from public.search_places('sushi', 35.66, 139.70)) s order by ord desc limit 1),
  'Vancouver', 'and the Vancouver sushi places still come last');
select is(
  (select count(*)::int from public.search_places('sushi', 35.66, 139.70)), 5,
  'only 3 sushi places are near Tokyo (fewer than 5), so all 5 in the world are found');
select is(
  (select array_agg(n order by ord) from (select (place).name n, row_number() over () ord
    from public.search_places('kao', 49.27, -123.11) limit 2) s),
  array['Kao Thai Kitchen', 'Kaoru Ramen'], 'names starting with kao come before names with a word kao');
select ok(
  'Kin Kao' in (select (place).name from public.search_places('kao', 49.27, -123.11)),
  'Kin Kao is still found by its second word');

-- ---------------------------------------------------------------- create_custom_place
select throws_ok($$select public.create_custom_place('Anon Spot',
  (select id from public.cities where name = 'Vancouver' and country = 'CA'), '1 Anon St')$$,
  '42501', null, 'anon cannot create a custom place');

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  (select (p).name || '|' || (p).address || '|' || (p).source::text || '|' || (p).city || '|'
     || (p).region || '|' || (p).country || '|' || ((p).created_by is not null)::text
     || '|' || (p).no_fixed_address::text
   from public.create_custom_place('Grandma’s Kitchen',
     (select id from public.cities where name = 'Vancouver' and country = 'CA'), '  123 Main St ') p),
  'Grandma’s Kitchen|123 Main St|custom|Vancouver|BC|CA|true|false',
  'a custom place takes the name, trimmed address and the city''s names');
reset role;
select is(
  (select created_by from public.places where name = 'Grandma’s Kitchen'),
  '00000000-0000-4000-8000-000000000001'::uuid, 'created_by is the caller');
set local role authenticated;
select cmp_ok(
  (select extensions.st_distance(p.location, c.location) from public.places p, public.cities c
   where p.name = 'Grandma’s Kitchen' and c.name = 'Vancouver' and c.country = 'CA'),
  '<', 1::double precision, 'the location is the city point');
select is(
  (select (place).name from public.search_places('grandma', 49.25, -123.12) limit 1),
  'Grandma’s Kitchen', 'the new place is searchable');

-- ---------------------------------------------------------------- the address rule
select throws_ok($$select public.create_custom_place('No Address Spot',
  (select id from public.cities where name = 'Tokyo'))$$,
  'P0001', 'address_required', 'no address and no flag raises address_required');
select throws_ok($$select public.create_custom_place('Blank Address Spot',
  (select id from public.cities where name = 'Tokyo'), '   ')$$,
  'P0001', 'address_required', 'a blank address counts as none');
select throws_ok($$select public.create_custom_place('Both Spot',
  (select id from public.cities where name = 'Tokyo'), '1 Both St', true)$$,
  'P0001', 'address_required', 'an address together with no_fixed_address raises address_required');
select is(
  (select (p).address is null and (p).no_fixed_address and (p).city = 'Tokyo' and (p).region = 'Tokyo'
   from public.create_custom_place('  Ramen   Pop-up ',
     (select id from public.cities where name = 'Tokyo'), null, true) p),
  true, 'a spot with no fixed address is stored with the flag; a city with no region code uses its region name');
select is(
  (select name from public.places where name like 'Ramen%Pop-up'), 'Ramen Pop-up',
  'inner whitespace in the name is collapsed');
select is(
  (select no_fixed_address from public.places where name = 'Café Zürich Test'), false,
  'Foursquare places are not flagged');

-- ---------------------------------------------------------------- what everyone can read
-- Custom places are public businesses: the address is public. created_by is not.
select is(
  (select (place).address from public.search_places('grandma', 49.25, -123.12) limit 1),
  '123 Main St', 'search shows the address of a custom place');
select is(
  (select (place).created_by from public.search_places('grandma', 49.25, -123.12) limit 1),
  null::uuid, 'search never returns created_by, even to the creator');
select is(
  (select (public.get_place(id)).address from public.places where name = 'Grandma’s Kitchen'),
  '123 Main St', 'get_place shows the address');
select is(
  (select (public.get_place(id)).created_by from public.places where name = 'Grandma’s Kitchen'),
  null::uuid, 'get_place never returns created_by');
select is(
  (select (place).address from public.search_places('cafe zurich') limit 1),
  '1 Test St', 'Foursquare addresses are visible');
select throws_ok($$select created_by from public.places$$, '42501', null,
  'a signed-in person cannot select places.created_by directly');
select throws_ok($$select * from public.places$$, '42501', null,
  'select * on places is refused (name the columns, or use search_places / get_place)');
select lives_ok($$select id, name, address, city, region, country, location, category_labels,
  closed_at, no_fixed_address from public.places$$, 'every other column can be selected, address included');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(
  (select (place).address from public.search_places('grandma', 49.25, -123.12) limit 1),
  '123 Main St', 'another person sees the address too');
select is(
  (select (public.get_place(id)).address from public.places where name = 'Grandma’s Kitchen'),
  '123 Main St', 'get_place shows another person the address');
select is((public.get_place('00000000-0000-4000-8000-0000000000ee')).id, null::uuid,
  'get_place of an unknown id is null');

set local role anon;
select is(
  (select (place).address from public.search_places('grandma', 49.25, -123.12) limit 1),
  '123 Main St', 'signed out, the address is visible');
select is(
  (select address from public.places where name = 'Grandma’s Kitchen'), '123 Main St',
  'anon can select places.address');
select throws_ok($$select created_by from public.places$$, '42501', null,
  'anon cannot select places.created_by directly');
select is(
  (select (public.get_place((select (place).id from public.search_places('cafe zurich') limit 1))).address),
  '1 Test St', 'anon can get a Foursquare place with its address');
select is(
  (select (public.get_place((select (place).id from public.search_places('cafe zurich') limit 1))).created_by),
  null::uuid, 'get_place never returns created_by to anon either');
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- ---------------------------------------------------------------- name and city rules
select throws_ok($$select public.create_custom_place('   ',
  (select id from public.cities where name = 'Tokyo'), '1 Name St')$$,
  'P0001', 'invalid_place_name', 'a blank name raises invalid_place_name');
select throws_ok(format($$select public.create_custom_place(%L,
  (select id from public.cities where name = 'Tokyo'), '1 Name St')$$, repeat('x', 81)),
  'P0001', 'invalid_place_name', 'an 81-character name raises invalid_place_name');
select throws_ok(format($$select public.create_custom_place('Long Address',
  (select id from public.cities where name = 'Tokyo'), %L)$$, repeat('x', 201)),
  'P0001', 'invalid_place_name', 'a 201-character address raises invalid_place_name');
select throws_ok($$select public.create_custom_place('Nowhere Spot',
  '00000000-0000-4000-8000-0000000000ff', '1 Nowhere St')$$, 'P0001', 'city_not_found',
  'an unknown city raises city_not_found');

-- The 20-a-day limit: Josie has made 2 so far, so 18 more are fine and the 21st is refused.
select is(
  (select count(*)::int from (
    select public.create_custom_place('Limit Spot ' || g,
      (select id from public.cities where name = 'Tokyo'), g || ' Limit St') from generate_series(1, 18) g) s),
  18, '20 custom places in a day are fine');
select throws_ok($$select public.create_custom_place('Limit Spot 21',
  (select id from public.cities where name = 'Tokyo'), '21 Limit St')$$, 'P0001', 'rate_limited',
  'the 21st raises rate_limited');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok($$select public.create_custom_place('Mike Spot',
  (select id from public.cities where name = 'Tokyo'), '1 Mike St')$$, 'the limit is per person');

select * from finish();
rollback;
