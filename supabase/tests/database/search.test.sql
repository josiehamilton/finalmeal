begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- Runs on top of the dev seed plus the fixtures below. Rolled back at the end.
--   Josie ...0001 (follows Mike, Ari, Dev)   Mike ...0002   Ari ...0003   Alli ...0004
--   Dev ...0005   Sam ...0006 (new account)   Priya ...0007 (private, trusted)
create function public.test_login(p_uid uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------- structure
select has_function('public', 'search_dishes', array['text', 'double precision', 'double precision', 'integer'],
  'search_dishes exists');
select ok(not has_function_privilege('anon',
  'public.search_dishes(text, double precision, double precision, integer)', 'execute'),
  'anon cannot run search_dishes');
select ok(has_function_privilege('authenticated',
  'public.search_dishes(text, double precision, double precision, integer)', 'execute'),
  'signed-in people can');
select ok(not has_function_privilege('anon', 'public.search_people(text, integer)', 'execute'),
  'anon cannot run search_people');
select ok(has_function_privilege('authenticated', 'public.search_people(text, integer)', 'execute'),
  'signed-in people can run search_people');

-- ---------------------------------------------------------------- search_dishes
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000001');

select is(
  (select dish_name || '|' || (place).name from public.search_dishes('ramen', 49.28, -123.12) limit 1),
  'Tonkotsu Ramen|Marutama', 'ramen as Josie starts with Tonkotsu Ramen at Marutama');
select is(
  (select distance_m is not null and distance_m < 5000 from public.search_dishes('ramen', 49.28, -123.12) limit 1),
  true, 'with a distance from the point');
select is(
  (select pick_id = (select k.id from public.picks k join public.dishes d on d.id = k.dish_id
                     where k.user_id = '00000000-0000-4000-8000-000000000001' and d.name = 'Tonkotsu Ramen')
   from public.search_dishes('ramen', 49.28, -123.12) limit 1),
  true, 'and Josie''s own pick opens');
select is(
  (select people from public.search_dishes('ramen', 49.28, -123.12) limit 1),
  '[]'::jsonb, 'people is always empty in search');
select is(
  (select list_count || '|' || final_count || '|' || honorable_count || '|' || best_tier
   from public.search_dishes('ramen') limit 1),
  '2|1|1|final', 'counts and best tier come from the trusted lists');
select is(
  (select distance_m is null from public.search_dishes('ramen') limit 1),
  true, 'without a point there is no distance');

select is(
  (select dish_name from public.search_dishes('tonkatsu ramen') limit 1),
  'Tonkotsu Ramen', 'a near spelling matches by trigram');
select is((select count(*)::int from public.search_dishes('')), 0, 'a blank query returns nothing');
select is((select count(*)::int from public.search_dishes('   ')), 0, 'a spaces-only query returns nothing');
select is((select count(*)::int from public.search_dishes(null)), 0, 'a null query returns nothing');
select throws_ok($$select * from public.search_dishes('ramen', 95, 0)$$, 'P0001', 'invalid_coordinates',
  'a latitude out of range is refused');

-- ---------------------------------------------------------------- what Mike may find
select public.test_login('00000000-0000-4000-8000-000000000002');
select is(
  (select pick_id is null from public.search_dishes('xiao') limit 1),
  true, 'xiao as Mike finds Xiao Long Bao (Priya is trusted) with no pick to open');
select is(
  (select dish_name from public.search_dishes('omakase') limit 1),
  'Omakase', 'omakase as Mike finds the dish through Josie''s pick');
select is((select count(*)::int from public.search_dishes('omakase')), 1, 'once');

reset role;
delete from public.picks k using public.dishes d
where d.id = k.dish_id and d.name = 'Omakase' and k.user_id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.search_dishes('omakase')), 0,
  'with only Sam''s pick left (a new account Mike does not follow) there is nothing');
select public.test_login('00000000-0000-4000-8000-000000000006');
select is((select count(*)::int from public.search_dishes('omakase')), 1,
  'but Sam finds his own');

-- ---------------------------------------------------------------- ordering
-- Match tier, then places within 50 km of the point first, then the most-listed.
reset role;
insert into public.dishes (id, place_id, name) values
  ('d0000000-0000-4000-8000-0000000000a1', (select id from public.places where name = 'Kin Kao'), 'Zeta Noodle'),
  ('d0000000-0000-4000-8000-0000000000a2', (select id from public.places where name = 'Sushi Dai'), 'Zeta Noodle'),
  ('d0000000-0000-4000-8000-0000000000a3', (select id from public.places where name = 'Hearth Bakery'), 'Ramen Bowl');
insert into public.picks (user_id, dish_id, tier, original_dish_name) values
  ('00000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000a1', 'honorable', 'Zeta Noodle'),
  ('00000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000a2', 'honorable', 'Zeta Noodle'),
  ('00000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-0000000000a2', 'honorable', 'Zeta Noodle'),
  ('00000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000a3', 'honorable', 'Ramen Bowl');
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000001');
select is(
  (select string_agg((place).name, ',' order by ordinality) from public.search_dishes('zeta') with ordinality),
  'Sushi Dai,Kin Kao', 'without a point the most-listed comes first (Tokyo 2 lists, Vancouver 1)');
select is(
  (select string_agg((place).name, ',' order by ordinality) from public.search_dishes('zeta', 49.28, -123.12) with ordinality),
  'Kin Kao,Sushi Dai', 'with a point, a place within 50 km comes first');
select is(
  (select string_agg(dish_name, ',' order by ordinality) from public.search_dishes('ramen') with ordinality),
  'Ramen Bowl,Tonkotsu Ramen', 'a name that starts with the query beats one with a later word');
select is((select count(*)::int from public.search_dishes('zeta', p_limit => 1)), 1, 'the limit is honoured');

-- ---------------------------------------------------------------- search_people
reset role;
insert into public.follows (follower_id, followee_id, status) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'active'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', 'active'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', 'requested');
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000001');
select is(
  (select username || '|' || followers_count from public.search_people('alli')),
  'allimercer|2', 'search_people returns the active follower count (a pending request is not counted)');

select * from finish();
rollback;
