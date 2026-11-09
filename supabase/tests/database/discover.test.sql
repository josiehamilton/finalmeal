begin;
create extension if not exists pgtap with schema extensions;

select plan(100);

-- Runs on top of the dev seed (Vancouver box -123.3, 49.1, -122.9, 49.4 holds six places:
-- Skewers, Marutama, Kin Kao, Miku, Lotus Noodle Bar and Hearth Bakery), plus the fixtures
-- below. Rolled back at the end.
--   Josie ...0001 (follows Mike, Ari, Dev)   Mike ...0002 (follows Josie)   Ari ...0003
--   Alli ...0004   Dev ...0005   Sam ...0006 (new account)   Priya ...0007 (private, trusted)
-- Seed picks used here: Skewers Pork Gyro (Josie, Ari final); Marutama Tonkotsu Ramen (Dev final,
-- Josie honorable), Pork Gyoza (Josie), Chicken Karaage (Ari); Kin Kao Khao Soi (Alli final, Dev
-- and Josie honorable), Crispy Rice Salad (Josie), Pad See Ew (Dev final); Miku (Josie); Lotus
-- Dan Dan Noodles (Josie) and Xiao Long Bao (Priya, final, private); Hearth Cardamom Bun (Josie,
-- Priya); Sushi Dai Omakase (Josie honorable, Sam honorable).
create function public.test_login(p_uid uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids as
select
  (select id from public.tags where kind = 'food_type' and slug = 'noodles' and owner_id is null) as noodles,
  (select id from public.tags where kind = 'food_type' and slug = 'sushi' and owner_id is null) as sushi,
  (select id from public.tags where kind = 'dietary' and slug = 'vegan' and owner_id is null) as vegan,
  (select id from public.tags where kind = 'personal' and slug = 'spicy'
     and owner_id = '00000000-0000-4000-8000-000000000001') as personal_spicy,
  (select id from public.places where name = 'Kin Kao') as kin_kao,
  (select id from public.places where name = 'Lotus Noodle Bar') as lotus,
  (select id from public.places where name = 'J. Grill') as j_grill;
grant select on ids to anon, authenticated;

-- ---------------------------------------------------------------- structure
select has_function('public', 'picks_in_view',
  array['double precision', 'double precision', 'double precision', 'double precision',
        'pick_tier', 'boolean', 'uuid[]', 'uuid[]', 'double precision', 'double precision',
        'integer', 'integer'], 'picks_in_view exists');
select has_function('public', 'dishes_in_view',
  array['double precision', 'double precision', 'double precision', 'double precision',
        'pick_tier', 'boolean', 'uuid[]', 'uuid[]', 'double precision', 'double precision',
        'integer', 'uuid', 'integer'], 'dishes_in_view exists');
select has_index('public', 'places', 'places_location_geom', 'places has the geometry GiST index');
select ok(not has_function_privilege('anon',
  'public.picks_in_view(double precision, double precision, double precision, double precision, public.pick_tier, boolean, uuid[], uuid[], double precision, double precision, integer, integer)',
  'execute'), 'anon cannot run picks_in_view');
select ok(not has_function_privilege('anon',
  'public.dishes_in_view(double precision, double precision, double precision, double precision, public.pick_tier, boolean, uuid[], uuid[], double precision, double precision, integer, uuid, integer)',
  'execute'), 'anon cannot run dishes_in_view');
select ok(not has_function_privilege('authenticated',
  'public._discover_picks(uuid, double precision, double precision, double precision, double precision, public.pick_tier, boolean, uuid[], uuid[], double precision, double precision, integer, uuid, uuid[])',
  'execute'), 'clients cannot run _discover_picks');
select ok(not has_function_privilege('authenticated',
  'public._discover_dishes(uuid, double precision, double precision, double precision, double precision, public.pick_tier, boolean, uuid[], uuid[], double precision, double precision, integer, uuid, uuid[], boolean)',
  'execute'), 'clients cannot run _discover_dishes');

-- ---------------------------------------------------------------- the Vancouver map, as Mike
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000002');

select is(
  (select string_agg(name, ',' order by name) from public.picks_in_view(-123.3, 49.1, -122.9, 49.4)),
  'Hearth Bakery,Kin Kao,Lotus Noodle Bar,Marutama,Miku,Skewers',
  'Mike sees six places in the Vancouver box');
select is(
  (select string_agg(name || ':' || best_tier, ',' order by name)
   from public.picks_in_view(-123.3, 49.1, -122.9, 49.4)),
  'Hearth Bakery:honorable,Kin Kao:final,Lotus Noodle Bar:final,Marutama:final,Miku:honorable,Skewers:final',
  'best_tier is final when any pick there is a Final Meal (Lotus through Priya''s private pick)');
select is(
  (select pick_count from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Skewers'),
  2, 'Skewers has two picks (Josie and Ari)');
select is(
  (select list_count from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Lotus Noodle Bar'),
  2, 'Priya''s private pick counts toward Lotus Noodle Bar''s lists');
select is(
  (select top_dish_name from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Marutama'),
  'Tonkotsu Ramen', 'top_dish_name is the most-listed dish at the place');
select is(
  (select array_agg(name order by ordinality)
   from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) with ordinality t
   where ordinality in (1, 2, 5, 6)),
  array['Kin Kao', 'Marutama', 'Hearth Bakery', 'Miku'],
  'ordered by lists: Kin Kao 5, Marutama 4, then the 2-list places (Hearth, the honorable-only one, last), Miku 1');
select is(
  (select round(lat::numeric, 4)::text || '|' || round(lng::numeric, 4)::text
   from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Kin Kao'),
  '49.2620|-123.1010', 'lat and lng come back as numbers');

-- ---------------------------------------------------------------- Mike on Lotus Noodle Bar
select is(
  (select count(*)::int from public.dishes_in_view(p_place_id => (select lotus from ids))),
  2, 'dishes_in_view for a place ignores the box (Dan Dan Noodles and Xiao Long Bao)');
select is(
  (select pick_id is null from public.dishes_in_view(p_place_id => (select lotus from ids))
   where dish_name = 'Xiao Long Bao'),
  true, 'Priya''s dish has no pick Mike may open');
select is(
  (select people from public.dishes_in_view(p_place_id => (select lotus from ids))
   where dish_name = 'Xiao Long Bao'),
  '[]'::jsonb, 'and names nobody (the only pick is private)');
select is(
  (select count(*)::int from public.dishes_in_view(-123.3, 49.1, -122.9, 49.4) d
   where d.people::text ~* 'priya'),
  0, 'no dish in the Vancouver box names Priya');
select is(
  (select final_count || '|' || list_count from public.dishes_in_view(p_place_id => (select lotus from ids))
   where dish_name = 'Xiao Long Bao'),
  '1|1', 'the counts still include her trusted private pick');
select is(
  (select pick_id is not null from public.dishes_in_view(p_place_id => (select lotus from ids))
   where dish_name = 'Vegan Dan Dan Noodles'),
  true, 'Josie''s public pick opens');
select is(
  (select people -> 0 ->> 'username' from public.dishes_in_view(p_place_id => (select lotus from ids))
   where dish_name = 'Vegan Dan Dan Noodles'),
  'josiehamilton', 'and names Josie');

-- Mike asks to follow Priya and she approves.
select is(public.follow_user('00000000-0000-4000-8000-000000000007'), 'requested'::public.follow_status,
  'Mike asks to follow Priya');
select public.test_login('00000000-0000-4000-8000-000000000007');
select lives_ok($$select public.respond_follow_request('00000000-0000-4000-8000-000000000002', true)$$,
  'Priya approves');
select public.test_login('00000000-0000-4000-8000-000000000002');
select is(
  (select pick_id = (select k.id from public.picks k join public.dishes d on d.id = k.dish_id
                     where k.user_id = '00000000-0000-4000-8000-000000000007' and d.name = 'Xiao Long Bao')
   from public.dishes_in_view(p_place_id => (select lotus from ids)) where dish_name = 'Xiao Long Bao'),
  true, 'now Mike can open Priya''s pick');
select is(
  (select people from public.dishes_in_view(p_place_id => (select lotus from ids))
   where dish_name = 'Xiao Long Bao'),
  '[]'::jsonb, 'but a private account is still never named, even to a follower');
select is(
  (select count(*)::int from public.dishes_in_view(-123.3, 49.1, -122.9, 49.4) d
   where d.people::text ~* 'priya'),
  0, 'and never named anywhere on the map');

-- ---------------------------------------------------------------- brand-new accounts
select is(
  (select pick_count from public.picks_in_view(139.6, 35.5, 139.9, 35.8) where name = 'Sushi Dai'),
  1, 'Mike: Sushi Dai has one pick (Sam is a new account Mike does not follow)');
select public.test_login('00000000-0000-4000-8000-000000000006');
select is(
  (select pick_count from public.picks_in_view(139.6, 35.5, 139.9, 35.8) where name = 'Sushi Dai'),
  2, 'Sam: his own pick counts for him');
select is(
  (select list_count from public.picks_in_view(139.6, 35.5, 139.9, 35.8) where name = 'Sushi Dai'),
  1, 'but not toward the lists');
select public.test_login('00000000-0000-4000-8000-000000000001');
select is(
  (select pick_count from public.picks_in_view(139.6, 35.5, 139.9, 35.8) where name = 'Sushi Dai'),
  1, 'Josie does not see Sam''s pick either');

-- ---------------------------------------------------------------- filters, as Josie
select is(
  (select count(*)::int from public.picks_in_view(-123.3, 49.1, -122.9, 49.4, p_tier => 'honorable')
   where name = 'Skewers'),
  0, 'the honorable filter leaves out Skewers (only Finals there)');
select is(
  (select string_agg(name, ',' order by name)
   from public.picks_in_view(-123.3, 49.1, -122.9, 49.4, p_tier => 'final')),
  'Kin Kao,Lotus Noodle Bar,Marutama,Skewers',
  'the Final Meals filter keeps the four Final places');
select is(
  (select string_agg(name, ',' order by name)
   from public.picks_in_view(-123.3, 49.1, -122.9, 49.4, p_following_only => true)),
  'Kin Kao,Marutama,Skewers', 'Following: only places with picks by Mike, Ari or Dev (not her own)');
select is(
  (select pick_count from public.picks_in_view(-123.3, 49.1, -122.9, 49.4, p_following_only => true)
   where name = 'Skewers'),
  1, 'and only their picks are counted (Ari''s, not Josie''s)');

select public.test_login('00000000-0000-4000-8000-000000000002');
select is(
  (select string_agg(name || ':' || best_tier, ',' order by name)
   from public.picks_in_view(-123.3, 49.1, -122.9, 49.4, p_food_type_ids => array[(select noodles from ids)])),
  'Kin Kao:honorable,Lotus Noodle Bar:honorable,Marutama:honorable',
  'Noodles: Kin Kao, Marutama and Lotus; Dev''s untagged Final at Marutama does not match');
select is(
  (select string_agg(name, ',' order by name)
   from public.picks_in_view(-123.3, 49.1, -122.9, 49.4,
     p_food_type_ids => array[(select noodles from ids)], p_dietary_ids => array[(select vegan from ids)])),
  'Lotus Noodle Bar', 'Noodles and Vegan (all of across kinds): Lotus only');
select is(
  (select string_agg(name, ',' order by name)
   from public.picks_in_view(-123.3, 49.1, -122.9, 49.4,
     p_food_type_ids => array[(select noodles from ids), (select sushi from ids)])),
  'Kin Kao,Lotus Noodle Bar,Marutama,Miku', 'Noodles or Sushi (any of within a kind) also finds Miku');
select is(
  (select string_agg(name, ',' order by name)
   from public.picks_in_view(-123.3, 49.1, -122.9, 49.4,
     p_food_type_ids => array[(select noodles from ids), (select sushi from ids)],
     p_dietary_ids => array[(select vegan from ids)])),
  'Lotus Noodle Bar', 'Noodles or Sushi, and Vegan: Lotus only');
select is(
  (select count(*)::int from public.picks_in_view(-123.3, 49.1, -122.9, 49.4,
     p_food_type_ids => array[(select personal_spicy from ids)])),
  0, 'a personal tag is never a filter on Discover');
select is(
  (select count(*)::int from public.picks_in_view(-123.3, 49.1, -122.9, 49.4,
     p_food_type_ids => '{}', p_dietary_ids => '{}')),
  6, 'empty tag lists mean no filter');
select is(
  (select string_agg(d.dish_name, ',' order by d.dish_name)
   from public.dishes_in_view(-123.3, 49.1, -122.9, 49.4,
     p_food_type_ids => array[(select noodles from ids)]) d),
  'Khao Soi,Tonkotsu Ramen,Vegan Dan Dan Noodles', 'dishes_in_view takes the same tag filter');

select is(
  (select string_agg(name, ',' order by name)
   from public.picks_in_view(-123.3, 49.1, -122.9, 49.4,
     p_center_lat => 49.2620, p_center_lng => -123.1010, p_radius_m => 1000)),
  'Hearth Bakery,Kin Kao', 'a 1 km circle round Kin Kao holds Kin Kao and Hearth Bakery');
select is(
  (select string_agg(name, ',' order by name)
   from public.picks_in_view(-123.3, 49.1, -122.9, 49.4,
     p_center_lat => 49.2620, p_center_lng => -123.1010, p_radius_m => 10)),
  'Hearth Bakery,Kin Kao', 'a radius under 1 km is raised to 1 km');
select is(
  (select count(*)::int from public.picks_in_view(-123.3, 49.1, -122.9, 49.4, p_radius_m => 1000)),
  6, 'a radius without a centre is ignored');
select is(
  (select count(*)::int from public.picks_in_view(-123.3, 49.1, -122.9, 49.4,
     p_center_lat => 49.2620, p_center_lng => -123.1010)),
  6, 'a centre without a radius only measures distance');
select is(
  (select count(*)::int from public.picks_in_view(-123.3, 49.1, -122.9, 49.4,
     p_center_lat => 49.2620, p_center_lng => -123.1010, p_radius_m => 1000000)),
  6, 'a huge radius is capped at 100 km (all six are within it)');
select is(
  (select round(d.distance_m)::int from public.dishes_in_view(p_place_id => (select kin_kao from ids),
     p_center_lat => 49.2620, p_center_lng => -123.1010) d where d.dish_name = 'Khao Soi'),
  0, 'distance_m is measured from the centre');
select is(
  (select distance_m is null from public.dishes_in_view(p_place_id => (select kin_kao from ids)) limit 1),
  true, 'and is null without a centre');

-- ---------------------------------------------------------------- bad coordinates
select throws_ok($$select * from public.picks_in_view(-123.3, 49.1, -122.9, 95)$$,
  'P0001', 'invalid_coordinates', 'a latitude above 90 is refused');
select throws_ok($$select * from public.picks_in_view(-190, 49.1, -122.9, 49.4)$$,
  'P0001', 'invalid_coordinates', 'a longitude below -180 is refused');
select throws_ok($$select * from public.picks_in_view(-123.3, 49.1, -122.9, null)$$,
  'P0001', 'invalid_coordinates', 'a missing bound is refused');
select throws_ok($$select * from public.picks_in_view(-123.3, 49.4, -122.9, 49.1)$$,
  'P0001', 'invalid_coordinates', 'south above north is refused');
select throws_ok($$select * from public.dishes_in_view(-123.3, 49.1, -122.9, 49.4, p_center_lat => 49.2)$$,
  'P0001', 'invalid_coordinates', 'a centre with only a latitude is refused');
select throws_ok($$select * from public.dishes_in_view(-123.3, 49.1, -122.9, 49.4, p_center_lat => 91, p_center_lng => 0)$$,
  'P0001', 'invalid_coordinates', 'a centre out of range is refused');
select throws_ok($$select * from public.dishes_in_view()$$,
  'P0001', 'invalid_coordinates', 'dishes_in_view with neither a box nor a place is refused');

-- ---------------------------------------------------------------- who people are
-- On Khao Soi, Josie sees Dev (she follows him) before Alli, though Alli picked more recently.
select public.test_login('00000000-0000-4000-8000-000000000001');
select is(
  (select people -> 0 ->> 'username' || ',' || (people -> 1 ->> 'username') || ',' || jsonb_array_length(people)
   from public.dishes_in_view(p_place_id => (select kin_kao from ids)) where dish_name = 'Khao Soi'),
  'devpatel,allimercer,2', 'people: followed first, never the viewer');
select is(
  (select (people -> 0) ?& array['id', 'username', 'display_name', 'avatar_path']
   from public.dishes_in_view(p_place_id => (select kin_kao from ids)) where dish_name = 'Khao Soi'),
  true, 'each person has id, username, display_name and avatar_path');
select is(
  (select pick_id = (select k.id from public.picks k join public.dishes d on d.id = k.dish_id
                     where k.user_id = '00000000-0000-4000-8000-000000000001' and d.name = 'Khao Soi')
   from public.dishes_in_view(p_place_id => (select kin_kao from ids)) where dish_name = 'Khao Soi'),
  true, 'a card opens the viewer''s own pick first');
select is(
  (select pick_id = (select k.id from public.picks k join public.dishes d on d.id = k.dish_id
                     where k.user_id = '00000000-0000-4000-8000-000000000005' and d.name = 'Pad See Ew')
   from public.dishes_in_view(p_place_id => (select kin_kao from ids)) where dish_name = 'Pad See Ew'),
  true, 'otherwise a pick of someone she follows');

-- Four public people have Smash Burger at J. Grill (Josie, Mike, Ari, and a fixture pick by Dev):
-- Alli sees three of them.
reset role;
insert into public.picks (user_id, dish_id, tier, original_dish_name)
select '00000000-0000-4000-8000-000000000005', d.id, 'honorable', d.name
from public.dishes d where d.name = 'Smash Burger';
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000004');
select is(
  (select jsonb_array_length(people) from public.dishes_in_view(p_place_id => (select j_grill from ids))
   where dish_name = 'Smash Burger'),
  3, 'at most three people are named');

-- ---------------------------------------------------------------- custom spots
reset role;
insert into public.places (id, source, name, city, region, country, location, address, created_by,
                           location_precision, geocode_status)
values
  ('c0000000-0000-4000-8000-000000000001', 'custom', 'Geo Test Cafe', 'Vancouver', 'BC', 'CA',
   'SRID=4326;POINT(-123.11934 49.24966)', '1 Test St', '00000000-0000-4000-8000-000000000001',
   'city', 'geocoding');
insert into public.places (id, source, name, city, region, country, location, created_by,
                           no_fixed_address, location_precision, geocode_status)
values
  ('c0000000-0000-4000-8000-000000000002', 'custom', 'Geo Test Truck', 'Vancouver', 'BC', 'CA',
   'SRID=4326;POINT(-123.05 49.30)', '00000000-0000-4000-8000-000000000001', true, 'exact', 'not_needed');
insert into public.dishes (id, place_id, name) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Geo Test Dish'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Geo Truck Dish');
insert into public.picks (user_id, dish_id, tier, original_dish_name) values
  ('00000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'honorable', 'Geo Test Dish'),
  ('00000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'honorable', 'Geo Truck Dish');

set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000001');
select is(
  (select count(*)::int from public.picks_in_view(-123.3, 49.1, -122.9, 49.4)
   where name in ('Geo Test Cafe', 'Geo Test Truck')),
  0, 'a spot at city precision has no pin, and neither has one with no fixed address');
select is(
  (select count(*)::int from public.dishes_in_view(-123.3, 49.1, -122.9, 49.4)
   where dish_name in ('Geo Test Dish', 'Geo Truck Dish')),
  0, 'and no dish card');
select is(
  (select count(*)::int from public.dishes_in_view(p_place_id => 'c0000000-0000-4000-8000-000000000001')),
  0, 'not even when asked for by place');

reset role;
set local role service_role;
select is(public.finish_geocode('c0000000-0000-4000-8000-000000000001', 'found', 49.27, -123.08, 'mock'),
  'done', 'the geocoder finds the cafe');
reset role;
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000001');
select is(
  (select round(lat::numeric, 2)::text || '|' || round(lng::numeric, 2)::text
   from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Geo Test Cafe'),
  '49.27|-123.08', 'after it is geocoded the cafe has a pin at its real point');
select is(
  (select count(*)::int from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Geo Test Truck'),
  0, 'the truck still has none');

-- ---------------------------------------------------------------- the antimeridian
reset role;
insert into public.places (id, source, name, city, region, country, location) values
  ('c0000000-0000-4000-8000-0000000000e1', 'custom', 'Fiji Test East', 'Taveuni', null, 'FJ',
   'SRID=4326;POINT(179.5 -16.8)'),
  ('c0000000-0000-4000-8000-0000000000e2', 'custom', 'Fiji Test West', 'Rabi', null, 'FJ',
   'SRID=4326;POINT(-179.5 -16.5)');
insert into public.dishes (place_id, name) values
  ('c0000000-0000-4000-8000-0000000000e1', 'East Roll'),
  ('c0000000-0000-4000-8000-0000000000e2', 'West Roll');
insert into public.picks (user_id, dish_id, tier, original_dish_name)
select '00000000-0000-4000-8000-000000000001', d.id, 'honorable', d.name
from public.dishes d where d.name in ('East Roll', 'West Roll');
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000001');
select is(
  (select string_agg(name, ',' order by name) from public.picks_in_view(170, -20, -170, -10)),
  'Fiji Test East,Fiji Test West', 'a box with west 170 and east -170 finds places on both sides of the line');
select is(
  (select string_agg(name, ',' order by name) from public.picks_in_view(170, -20, 179.9, -10)),
  'Fiji Test East', 'an ordinary box only finds its own side');
select is(
  (select count(*)::int from public.picks_in_view(-170, -20, 170, -10)), 0,
  'and the box the other way round (west -170, east 170) finds neither');
select is(
  (select string_agg(dish_name, ',' order by dish_name) from public.dishes_in_view(170, -20, -170, -10)),
  'East Roll,West Roll', 'dishes_in_view handles the antimeridian too');

-- ---------------------------------------------------------------- blocks, both ways
-- A place with two dishes: Top A is picked by Ari, Alli and Mike (3 lists); Top B by Josie, Dev and
-- Priya (3 lists). A ties and wins by name until Josie blocks Ari.
reset role;
insert into public.places (id, source, name, city, region, country, location) values
  ('c0000000-0000-4000-8000-0000000000b1', 'custom', 'Top Dish Test', 'Vancouver', 'BC', 'CA',
   'SRID=4326;POINT(-123.0 49.35)');
insert into public.dishes (id, place_id, name) values
  ('d0000000-0000-4000-8000-0000000000b1', 'c0000000-0000-4000-8000-0000000000b1', 'Top A'),
  ('d0000000-0000-4000-8000-0000000000b2', 'c0000000-0000-4000-8000-0000000000b1', 'Top B');
insert into public.picks (user_id, dish_id, tier, original_dish_name) values
  ('00000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-0000000000b1', 'honorable', 'Top A'),
  ('00000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-0000000000b1', 'honorable', 'Top A'),
  ('00000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-0000000000b1', 'honorable', 'Top A'),
  ('00000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000b2', 'honorable', 'Top B'),
  ('00000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-0000000000b2', 'honorable', 'Top B'),
  ('00000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-0000000000b2', 'honorable', 'Top B');
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000001');
select is(
  (select top_dish_name from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Top Dish Test'),
  'Top A', 'before any block, Top A (3 lists, first by name) is the top dish');
reset role;
insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003');
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000001');
select is(
  (select pick_count from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Skewers'),
  1, 'Josie blocks Ari: Skewers drops to Josie''s own pick');
select is(
  (select count(*)::int from public.dishes_in_view(-123.3, 49.1, -122.9, 49.4) d
   where d.people::text ~* 'arimitchell'),
  0, 'and Ari is named nowhere');
select is(
  (select count(*)::int from public.picks_in_view(-123.3, 49.1, -122.9, 49.4, p_following_only => true)
   where name = 'Skewers'),
  0, 'and the Following filter leaves out a blocked person''s picks');
select is(
  (select list_count from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Skewers'),
  1, 'the Skewers pin counts one list');
select is(
  (select list_count || '|' || final_count || '|' || honorable_count
   from public.dishes_in_view(-123.3, 49.1, -122.9, 49.4) where dish_name = 'Pork Gyro'),
  '1|1|0', 'and the Pork Gyro card agrees (Ari left out of its counts too)');
select is(
  (select top_dish_name from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Top Dish Test'),
  'Top B', 'the top dish ranking leaves the blocked person out as well (Top A drops to 2 lists)');
select is(
  (select count(*)::int from public.search_dishes('karaage')),
  0, 'dish search does not find a dish only the blocked person picked');
select public.test_login('00000000-0000-4000-8000-000000000003');
select is(
  (select pick_count from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Skewers'),
  1, 'Ari: Josie''s picks are gone from his map too (Skewers is only his own)');
select is(
  (select count(*)::int from public.dishes_in_view(-123.3, 49.1, -122.9, 49.4) d
   where d.people::text ~* 'josiehamilton'),
  0, 'and Josie is named nowhere for him');
select is(
  (select count(*)::int from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Kin Kao'),
  1, 'he still sees other people (Kin Kao via Alli and Dev)');

-- ---------------------------------------------------------------- new accounts you follow
-- Sam (public, new): once Mike follows him, his Sushi Dai pick appears for Mike. Quill is a
-- private new account; Mike's pending request shows nothing, an accepted one does.
reset role;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000b9');
insert into public.profiles (id, username, display_name, visibility, trust_level)
values ('00000000-0000-0000-0000-0000000000b9', 'quill_q', 'Quill Quade', 'private', 'new');
insert into public.picks (user_id, dish_id, tier, original_dish_name)
select '00000000-0000-0000-0000-0000000000b9', d.id, 'honorable', d.name
from public.dishes d where d.name = 'Cardamom Bun';
insert into public.follows (follower_id, followee_id, status)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-0000000000b9', 'requested');
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000002');
select is(
  (select pick_count from public.picks_in_view(139.6, 35.5, 139.9, 35.8) where name = 'Sushi Dai'),
  1, 'Mike does not see Sam''s pick before following');
select is(public.follow_user('00000000-0000-4000-8000-000000000006'), 'active'::public.follow_status,
  'Mike follows Sam (a public account, so at once)');
select is(
  (select pick_count || '|' || list_count from public.picks_in_view(139.6, 35.5, 139.9, 35.8) where name = 'Sushi Dai'),
  '2|1', 'now Sam''s pick appears and counts as a pick, but not as a trusted list');
select is(
  (select pick_count from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Hearth Bakery'),
  2, 'a pending request to a private new account shows nothing');
reset role;
update public.follows set status = 'active'
where follower_id = '00000000-0000-4000-8000-000000000002' and followee_id = '00000000-0000-0000-0000-0000000000b9';
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000002');
select is(
  (select pick_count from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Hearth Bakery'),
  3, 'once accepted, the private new account''s pick appears');
select is(
  (select count(*)::int from public.dishes_in_view(p_place_id => (select id from public.places where name = 'Hearth Bakery')) d
   where d.people::text ~* 'quill'),
  0, 'but it is not named');

-- ---------------------------------------------------------------- flagged accounts
-- Dev is followed by Josie. Flagged, his picks stop counting for her and stop showing; his own
-- map still shows his picks to him.
reset role;
update public.profiles set trust_level = 'flagged' where id = '00000000-0000-4000-8000-000000000005';
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000001');
select is(
  (select pick_count from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Kin Kao'),
  3, 'a followed flagged account''s picks do not count (Kin Kao: Josie 2, Alli 1)');
select is(
  (select count(*)::int from public.dishes_in_view(p_place_id => (select kin_kao from ids)) where dish_name = 'Pad See Ew'),
  0, 'and a dish only he picked has no card');
select public.test_login('00000000-0000-4000-8000-000000000005');
select is(
  (select pick_count from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Kin Kao'),
  5, 'but he still sees his own picks');

-- ---------------------------------------------------------------- closed and merged
reset role;
insert into public.places (id, source, name, city, region, country, location, closed_at, merged_into_id) values
  ('c0000000-0000-4000-8000-0000000000c1', 'custom', 'Closed Test', 'Vancouver', 'BC', 'CA',
   'SRID=4326;POINT(-123.05 49.31)', '2026-01-01', null),
  ('c0000000-0000-4000-8000-0000000000c2', 'custom', 'Merged Test', 'Vancouver', 'BC', 'CA',
   'SRID=4326;POINT(-123.06 49.31)', null, (select kin_kao from ids));
insert into public.dishes (id, place_id, name, merged_into_id) values
  ('d0000000-0000-4000-8000-0000000000c1', 'c0000000-0000-4000-8000-0000000000c1', 'Closed Dish', null),
  ('d0000000-0000-4000-8000-0000000000c2', 'c0000000-0000-4000-8000-0000000000c2', 'Merged Place Dish', null);
insert into public.dishes (id, place_id, name, merged_into_id)
select 'd0000000-0000-4000-8000-0000000000c3', p.id, 'Merged Dish Copy', d.id
from public.places p, public.dishes d where p.name = 'Skewers' and d.name = 'Pork Gyro';
insert into public.picks (user_id, dish_id, tier, original_dish_name)
select '00000000-0000-4000-8000-000000000001', d.id, 'honorable', d.name
from public.dishes d where d.id in ('d0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000000c2',
                                    'd0000000-0000-4000-8000-0000000000c3');
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000002');
select is(
  (select count(*)::int from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name in ('Closed Test', 'Merged Test')),
  0, 'a closed place and a merged place have no pin');
select is(
  (select count(*)::int from public.dishes_in_view(-123.3, 49.1, -122.9, 49.4)
   where dish_name in ('Closed Dish', 'Merged Place Dish', 'Merged Dish Copy')),
  0, 'and no cards, and a merged dish at an open place has none either');
select is(
  (select count(*)::int from public.search_dishes('closed') ) + (select count(*)::int from public.search_dishes('merged')),
  0, 'dish search skips them too');
select is(
  (select pick_count from public.picks_in_view(-123.3, 49.1, -122.9, 49.4) where name = 'Skewers'),
  2, 'and a pick on a merged dish adds nothing to its place');

-- ---------------------------------------------------------------- limits and anon
reset role;
-- 305 places with one Josie pick each, spread inside a box away from everything else.
insert into public.places (source, name, city, region, country, location)
select 'custom', 'Limit Test ' || g, 'Testville', null, 'CA',
       extensions.st_setsrid(extensions.st_makepoint(-100 + g * 0.0001, 50), 4326)::extensions.geography
from generate_series(1, 305) g;
insert into public.dishes (place_id, name)
select id, 'Limit Dish ' || substr(name, 12) from public.places where name like 'Limit Test %';
insert into public.picks (user_id, dish_id, tier, original_dish_name)
select '00000000-0000-4000-8000-000000000001', d.id, 'honorable', d.name
from public.dishes d where d.name like 'Limit Dish %';
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.picks_in_view(-101, 49, -99, 51, p_limit => 1000)), 300,
  'picks_in_view returns at most 300 places');
select is((select count(*)::int from public.picks_in_view(-101, 49, -99, 51, p_limit => 5)), 5,
  'and honours a smaller limit');
select is((select count(*)::int from public.picks_in_view(-101, 49, -99, 51, p_limit => 0)), 0,
  'a limit of 0 returns nothing');
select is((select count(*)::int from public.dishes_in_view(-101, 49, -99, 51, p_limit => 1000)), 50,
  'dishes_in_view returns at most 50 dishes');

reset role;
set local role anon;
select throws_ok($$select * from public.picks_in_view(-123.3, 49.1, -122.9, 49.4)$$,
  '42501', null, 'anon cannot run picks_in_view');
select throws_ok($$select * from public.dishes_in_view(-123.3, 49.1, -122.9, 49.4)$$,
  '42501', null, 'anon cannot run dishes_in_view');

select * from finish();
rollback;
