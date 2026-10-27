begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- ---------------------------------------------------------------- structure
select has_table('public', 'cities', 'cities table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.cities'::regclass),
  true,
  'RLS is on for cities'
);
select has_function('public', 'search_cities', array['text', 'integer'], 'search_cities exists');
select has_function('public', 'nearest_city', array['double precision', 'double precision'], 'nearest_city exists');

-- ---------------------------------------------------------------- dev seed
-- (robust to a full import: `pnpm db:import-cities` upserts over these same 24 ids)
select is(
  (select count(*)::int from public.cities where geoname_id in (
    6173331, 5814616, 6174041, 6167865, 6077243, 6141256, 5128581, 4975802, 5746545, 5391959,
    5368361, 4887398, 3530597, 2643743, 2988507, 2950159, 1850147, 1853909, 1835848, 1609350,
    1566083, 1880252, 2147714, 2158177)),
  24,
  'the 24 dev cities are present'
);

-- ---------------------------------------------------------------- search_cities
select is(
  (select name || ', ' || region_code from public.search_cities('vanc') limit 1),
  'Vancouver, BC',
  'search "vanc": Vancouver BC first (larger population)'
);
select is(
  (select name || ', ' || region_code from (select * from public.search_cities('vanc') offset 1 limit 1) s),
  'Vancouver, WA',
  'search "vanc": Vancouver WA second'
);
select is(
  (select name from public.search_cities('montreal') limit 1),
  'Montréal',
  'search "montreal" finds Montréal (accent-insensitive)'
);
select is(
  (select name from public.search_cities('MONTRÉ') limit 1),
  'Montréal',
  'search "MONTRÉ" finds Montréal (case- and accent-insensitive)'
);
select is((select count(*)::int from public.search_cities('')), 0, 'empty query returns nothing');
select is((select count(*)::int from public.search_cities('   ')), 0, 'blank query returns nothing');
select is((select count(*)::int from public.search_cities('port', 1)), 1, 'lim is honoured');
select is(
  (select name from public.search_cities('portland') limit 1),
  'Portland',
  'search "portland" finds Portland'
);
select is(
  (select name from public.search_cities('portlnd') limit 1),
  'Portland',
  'search "portlnd" (typo) still finds Portland by trigram similarity'
);

-- ---------------------------------------------------------------- nearest_city
select is(
  (select name || ', ' || region_code from public.nearest_city(49.28, -123.12)),
  'Vancouver, BC',
  'nearest_city(49.28, -123.12) is Vancouver BC'
);

-- ---------------------------------------------------------------- seeded profiles
select is(
  (select c.name || ', ' || c.region_code from public.profiles p
     join public.cities c on c.id = p.home_city_id
    where p.id = '00000000-0000-4000-8000-000000000001'),
  'Vancouver, BC',
  'seeded Josie''s home_city_id is Vancouver BC'
);
select is(
  (select count(*)::int from public.profiles where home_city_id is null),
  0,
  'every seeded profile has a home city'
);

-- ---------------------------------------------------------------- privileges
set local role anon;
select cmp_ok((select count(*)::int from public.cities), '>=', 24, 'anon can select cities');
select throws_ok($$
  insert into public.cities (geoname_id, name, ascii_name, country, country_name, location)
  values (1, 'X', 'X', 'CA', 'Canada', 'SRID=4326;POINT(0 0)'::extensions.geography)
$$, '42501', null, 'anon cannot insert a city');

reset role;
set local role authenticated;
select throws_ok($$
  insert into public.cities (geoname_id, name, ascii_name, country, country_name, location)
  values (1, 'X', 'X', 'CA', 'Canada', 'SRID=4326;POINT(0 0)'::extensions.geography)
$$, '42501', null, 'authenticated cannot insert a city');

select * from finish();
rollback;
