begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

-- Counts
select is((select count(*)::int from public.profiles), 6, '6 profiles');
select is((select count(*)::int from public.places), 14, '14 places');
select is((select count(*)::int from public.dishes), 17, '17 dishes');
select is((select count(*)::int from public.picks), 28, '28 picks');

-- Saves match the saved_pick activity
select is(
  (select count(*)::int from public.saves s join public.dishes d on d.id = s.dish_id
    where s.user_id = '00000000-0000-4000-8000-000000000002' and d.name = 'Pork Gyro'),
  1,
  'mike has saved josie''s Pork Gyro dish, matching his saved_pick activity'
);

-- Josie's picks
select is(
  (select array_agg(slot order by slot) from public.picks
    where user_id = '00000000-0000-4000-8000-000000000001' and tier = 'final'),
  array[1, 2, 3, 4]::smallint[],
  'josie has 4 finals in slots 1-4'
);
select is(
  (select count(*)::int from public.picks
    where user_id = '00000000-0000-4000-8000-000000000001' and tier = 'honorable'),
  13,
  'josie has 13 honorables'
);
select is(
  (select count(distinct d.place_id)::int
    from public.picks p join public.dishes d on d.id = p.dish_id
    where p.user_id = '00000000-0000-4000-8000-000000000001'),
  14,
  'josie''s 17 picks are at 14 distinct places'
);
select is(
  (select d.name from public.picks p join public.dishes d on d.id = p.dish_id
    where p.user_id = '00000000-0000-4000-8000-000000000001' and p.slot = 1),
  'Pork Gyro',
  'josie''s number one is Pork Gyro'
);

-- Tags
select is((select count(*)::int from public.tags where kind = 'food_type' and owner_id is null),
  27, '27 global food_type tags');
select is((select count(*)::int from public.tags where kind = 'dietary' and owner_id is null),
  8, '8 global dietary tags');
select is((select count(*)::int from public.tags where kind = 'food_type' and is_featured),
  12, '12 featured food_type tags');
select is((select count(*)::int from public.tags where kind = 'dietary' and is_featured),
  7, '7 featured dietary tags (all but Kosher)');
select is((select slug from public.tags where name = 'Korean BBQ'), 'korean-bbq',
  'slug is the lower-case name with dashes');
select is(
  (select count(*)::int from public.tags
    where kind = 'personal' and owner_id = '00000000-0000-4000-8000-000000000001'),
  4,
  'josie has 4 personal tags'
);
select is(
  (select count(*)::int from public.pick_tags pt join public.picks p on p.id = pt.pick_id
    where p.user_id = '00000000-0000-4000-8000-000000000001'),
  35,
  'josie''s picks carry 35 tags'
);

-- Social
select is((select count(*)::int from public.follows where status = 'active'), 8, '8 active follows');
select is((select count(*)::int from public.shared_lists), 2, '2 shared lists');
select is(
  (select filter->'cities' from public.shared_lists where slug = 'josies-vancouver'),
  '["Vancouver"]'::jsonb,
  'josies-vancouver filters on Vancouver'
);
select is(
  (select filter->'food_type_tag_ids'->>0 from public.shared_lists where slug = 'josies-sushi'),
  (select id::text from public.tags where kind = 'food_type' and slug = 'sushi'),
  'josies-sushi filters on the Sushi tag id'
);
select is((select count(*)::int from public.activities), 4, '4 activities');
select is(
  (select count(*)::int from public.notifications
    where user_id = '00000000-0000-4000-8000-000000000001'),
  3,
  '3 notifications for josie'
);
select is(
  (select other_pick_id is not null from public.activities where type = 'dethroned'),
  true,
  'the dethroned activity names the pick that was displaced'
);

-- People
select is((select trust_level::text from public.profiles where username = 'samokafor'), 'new',
  'sam is a new user');
select is((select count(*)::int from public.profiles where trust_level = 'trusted'), 5,
  'the other five are trusted');

select * from finish();
rollback;
