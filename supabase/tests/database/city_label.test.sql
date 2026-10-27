begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- Dev-seed cities (GeoNames ids), see seed.sql. The label drops a region that repeats the city.
select is((select public.city_label(c) from public.cities c where geoname_id = 6173331), 'Vancouver, BC, Canada', 'Vancouver keeps its province code');
select is((select public.city_label(c) from public.cities c where geoname_id = 5746545), 'Portland, OR, United States', 'Portland keeps its state code');
select is((select public.city_label(c) from public.cities c where geoname_id = 1850147), 'Tokyo, Japan', 'Tokyo drops the repeated region');
select is((select public.city_label(c) from public.cities c where geoname_id = 1835848), 'Seoul, South Korea', 'Seoul drops the repeated region');
select is((select public.city_label(c) from public.cities c where geoname_id = 3530597), 'Mexico City, Mexico', 'Mexico City drops the repeated region');
select is((select public.city_label(c) from public.cities c where geoname_id = 1566083), 'Ho Chi Minh City, Vietnam', 'Ho Chi Minh City drops a region that starts with the city name');
select is((select public.city_label(c) from public.cities c where geoname_id = 2643743), 'London, England, United Kingdom', 'London keeps England');

-- Case-insensitive: a fixture whose region differs from the city only by case.
insert into public.cities (geoname_id, name, ascii_name, region_code, region_name, country, country_name, population, location)
values (-900, 'Osaka', 'Osaka', null, 'OSAKA', 'JP', 'Japan', 1,
  extensions.st_setsrid(extensions.st_makepoint(135.5, 34.69), 4326)::extensions.geography);
select is((select public.city_label(c) from public.cities c where geoname_id = -900), 'Osaka, Japan', 'the comparison ignores case');

-- Stored home_place_text always matches the label of the home city.
select is(
  (select count(*)::int from public.profiles p join public.cities c on c.id = p.home_city_id
    where p.home_place_text is distinct from public.city_label(c)),
  0,
  'every stored home_place_text equals city_label of its home city'
);

select * from finish();
rollback;
