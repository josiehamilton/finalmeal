begin;
create extension if not exists pgtap with schema extensions;

select plan(80);

-- The Following and Nearby feeds, pick detail and place_pickers. Uses the dev seed, read as
-- Josie (...0001), who follows Mike, Ari and Dev (all trusted and public) and has asked to follow
-- Priya (private). Nothing here commits: the seed is untouched afterwards.
--
-- Seed activity times (minutes ago) of the people Josie follows, newest first:
--   2   Ari dethroned Tacos Al Pastor with Smash Burger (its added_final is hidden)
--   120 Ari Pork Gyro (final)            170 Dev Tonkotsu Ramen (final)
--   180 Ari Chicken Karaage (honorable)  300 Mike Wagyu Beef Don (final)
--   600 Dev Pad See Ew (final)           2000 Dev Khao Soi (honorable)
--   2900 Mike Spicy Tuna Roll            4300 Mike Smash Burger (final)
--   5000 Ari Tacos Al Pastor (added_final, dethroned later)

create function public.test_login(p_uid uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create function public.test_user(p_username text)
returns uuid
language sql
security definer
as $$
  select id from public.profiles where username = p_username;
$$;

create function public.test_pick(p_username text, p_dish text)
returns uuid
language sql
security definer
as $$
  select k.id from public.picks k
  join public.profiles u on u.id = k.user_id
  join public.dishes d on d.id = k.dish_id
  where u.username = p_username and d.name = p_dish;
$$;

create function public.test_dish(p_name text)
returns uuid
language sql
security definer
as $$
  select id from public.dishes where name = p_name;
$$;

create function public.test_place(p_name text)
returns uuid
language sql
security definer
as $$
  select id from public.places where name = p_name;
$$;

-- "username:dish" of every row, in order.
create function public.test_following(p_limit integer default 50)
returns text[]
language sql
as $$
  select coalesce(array_agg(f.kind || ':' || f.actor_username || ':' || f.dish_name order by f.ordinality), '{}')
  from public.following_feed(null, null, p_limit) with ordinality as f;
$$;

create function public.test_nearby()
returns text[]
language sql
as $$
  select coalesce(array_agg(f.actor_username || ':' || f.dish_name order by f.ordinality), '{}')
  from public.nearby_feed(0, 50) with ordinality as f;
$$;

-- ---------------------------------------------------------------- structure
select has_function('public', 'following_feed', array['timestamp with time zone', 'text', 'integer'],
  'following_feed exists');
select has_function('public', 'nearby_feed', array['integer', 'integer'], 'nearby_feed exists');
select has_function('public', 'get_pick_detail', array['uuid'], 'get_pick_detail exists');
select has_function('public', 'place_pickers', array['uuid', 'integer'], 'place_pickers exists');
select ok(not has_function_privilege('anon', 'public.following_feed(timestamptz,text,integer)', 'execute'),
  'anon cannot read the Following feed');
select ok(not has_function_privilege('anon', 'public.nearby_feed(integer,integer)', 'execute'),
  'anon cannot read Nearby');
select ok(not has_function_privilege('anon', 'public.get_pick_detail(uuid)', 'execute'),
  'anon cannot read pick detail');
select ok(has_function_privilege('authenticated', 'public.place_pickers(uuid,integer)', 'execute'),
  'authenticated can run place_pickers');

-- Extra fixtures (superuser): a brand-new account with a Vancouver pick (Sam), and a personal
-- tag plus a global tag on Ari's Pork Gyro.
insert into public.picks (user_id, dish_id, tier, slot, original_dish_name, created_at)
values (public.test_user('samokafor'), public.test_dish('Pork Gyro'), 'honorable', null, 'Pork Gyro',
        now() - interval '10 minutes');
insert into public.tags (kind, name, slug, owner_id)
values ('personal', 'Secret shame', 'secret-shame', public.test_user('arimitchell'));
insert into public.pick_tags (pick_id, tag_id)
select public.test_pick('arimitchell', 'Pork Gyro'), t.id
from public.tags t
where (t.kind = 'personal' and t.slug = 'secret-shame') or (t.owner_id is null and t.slug = 'greek');

set local role authenticated;
select public.test_login(public.test_user('josiehamilton'));

-- ---------------------------------------------------------------- Following feed
select is(
  public.test_following(),
  array['dethroned:arimitchell:Smash Burger', 'added_final:arimitchell:Pork Gyro',
        'added_final:devpatel:Tonkotsu Ramen', 'added_honorable:arimitchell:Chicken Karaage',
        'added_final:mikebrennan:Wagyu Beef Don', 'added_final:devpatel:Pad See Ew',
        'added_honorable:devpatel:Khao Soi', 'added_honorable:mikebrennan:Spicy Tuna Roll',
        'added_final:mikebrennan:Smash Burger', 'added_final:arimitchell:Tacos Al Pastor'],
  'Following: Ari''s swap first, then Ari, Dev, Ari, Mike ... newest first, ten cards');
select is(
  (select f.other_dish_name from public.following_feed() as f limit 1), 'Tacos Al Pastor',
  'the dethroned card names the dish it replaced');
select ok(
  not exists (select 1 from public.following_feed() as f
              where f.kind = 'added_final' and f.actor_username = 'arimitchell' and f.dish_name = 'Smash Burger'),
  'the swap shows once: Ari''s added_final for the same pick is hidden');
select ok(
  not exists (select 1 from public.following_feed() as f
              where f.actor_username in ('josiehamilton', 'allimercer', 'samokafor', 'priyashah')),
  'never Josie''s own, or people she does not actively follow (Alli, Sam, Priya)');
select is((select f.tier::text || ':' || f.slot::text from public.following_feed() as f limit 1), 'final:2',
  'tier and slot are the pick''s current values');
select is(
  (select f.list_count from public.following_feed() as f where f.dish_name = 'Wagyu Beef Don'),
  (select s.list_count from public.dish_stats s where s.dish_id = public.test_dish('Wagyu Beef Don')),
  'list_count comes from dish_stats');
select is(
  (select f.saved_by_me from public.following_feed() as f where f.dish_name = 'Pad See Ew'), true,
  'saved_by_me is true for a dish Josie saved');
select is(
  (select f.saved_by_me from public.following_feed() as f where f.dish_name = 'Wagyu Beef Don'), false,
  'and false for one she did not');
select is(
  (select (f.place).name from public.following_feed() as f where f.dish_name = 'Pad See Ew'), 'Kin Kao',
  'each card carries its place');
select is(
  (select f.actor_display_name from public.following_feed() as f limit 1), 'Ari Mitchell',
  'and the actor''s display name');

-- Paging by (created_at, id)
select is(
  (select count(*)::int from public.following_feed(null, null, 3)), 3, 'a page of three');
select is(
  (with p1 as (select * from public.following_feed(null, null, 3)),
        last as (select at, item_key from p1 order by at, item_key limit 1),
        p2 as (select f.* from last, public.following_feed(last.at, last.item_key, 3) as f)
   select array_agg(item_key order by at desc, item_key desc)
   from (select item_key, at from p1 union all select item_key, at from p2) both_pages),
  (select array_agg(item_key order by at desc, item_key desc) from public.following_feed(null, null, 6)),
  'the second page continues from the last key with no overlap and no gap');
select is(
  (with p1 as (select * from public.following_feed(null, null, 3)),
        last as (select at, item_key from p1 order by at, item_key limit 1)
   select count(*)::int from last, public.following_feed(last.at, last.item_key, 50) as f),
  7, 'the rest after three is seven');
select is(
  (select count(*)::int from public.following_feed(null, null, 500)), 10, 'the limit is capped at 50 and there are ten');
select is((select count(*)::int from public.following_feed(null, null, 0)), 0, 'a limit of zero returns nothing');

-- Tags: global only
select is(
  (select f.tags from public.following_feed() as f where f.dish_name = 'Pork Gyro' and f.actor_username = 'arimitchell'),
  (select jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'name', t.name, 'slug', t.slug,
                                       'is_featured', t.is_featured))
   from public.tags t where t.owner_id is null and t.slug = 'greek'),
  'Ari''s Pork Gyro shows only its global tag (Greek)');
select ok(
  not exists (select 1 from public.following_feed() as f, jsonb_array_elements(f.tags) as t
              where t ->> 'kind' = 'personal'),
  'no personal tag ever appears in the Following feed');
select is((select f.tags from public.following_feed() as f where f.dish_name = 'Pad See Ew'), '[]'::jsonb,
  'a pick with no tags has an empty list');

-- Block: either direction hides the person
reset role;
insert into public.blocks (blocker_id, blocked_id) values (public.test_user('devpatel'), public.test_user('josiehamilton'));
set local role authenticated;
select public.test_login(public.test_user('josiehamilton'));
select ok(not exists (select 1 from public.following_feed() as f where f.actor_username = 'devpatel'),
  'a block hides Dev from the Following feed');
select is((select count(*)::int from public.get_pick_detail(public.test_pick('devpatel', 'ramen_does_not_exist'))), 0,
  'detail of an unknown pick is empty');
select is((select count(*)::int from public.get_pick_detail(public.test_pick('devpatel', 'Tonkotsu Ramen'))), 0,
  'and so is Dev''s pick across the block');
select ok(not exists (select 1 from public.nearby_feed(0, 50) as f where f.actor_username = 'devpatel'),
  'Dev is gone from Nearby too');
select is((select p.other_count from public.place_pickers(public.test_place('Marutama'), 3) as p), 1,
  'place_pickers leaves a blocked person out of the count (Ari remains)');
reset role;
delete from public.blocks;
set local role authenticated;
select public.test_login(public.test_user('josiehamilton'));

-- Private accounts: Priya
select is((select count(*)::int from public.get_pick_detail(public.test_pick('priyashah', 'Xiao Long Bao'))), 0,
  'before approval Josie cannot open Priya''s pick');
select public.test_login(public.test_user('priyashah'));
select public.respond_follow_request(public.test_user('josiehamilton'), true);
select public.test_login(public.test_user('josiehamilton'));
select is((select count(*)::int from public.following_feed(null, null, 50)), 12,
  'after Priya approves Josie, her two activities join the feed');
select is(
  (select array_agg(f.actor_username || ':' || f.dish_name order by f.ordinality)
   from public.following_feed(null, null, 50) with ordinality as f where f.actor_username = 'priyashah'),
  array['priyashah:Xiao Long Bao', 'priyashah:Cardamom Bun'], 'Priya''s Xiao Long Bao and Cardamom Bun');
select is((select count(*)::int from public.get_pick_detail(public.test_pick('priyashah', 'Xiao Long Bao'))), 1,
  'after approval Josie can open Priya''s pick');
select public.test_login(public.test_user('allimercer'));
select is((select count(*)::int from public.get_pick_detail(public.test_pick('priyashah', 'Xiao Long Bao'))), 0,
  'a stranger (Alli) still cannot');
select public.test_login(public.test_user('josiehamilton'));
select public.unfollow_user(public.test_user('priyashah'));
select is((select count(*)::int from public.following_feed(null, null, 50)), 10,
  'unfollowing Priya takes her out of the feed again');
select is((select count(*)::int from public.get_pick_detail(public.test_pick('priyashah', 'Xiao Long Bao'))), 0,
  'and out of pick detail');

-- ---------------------------------------------------------------- Nearby
select is(
  public.test_nearby(),
  array['arimitchell:Pork Gyro', 'devpatel:Tonkotsu Ramen', 'allimercer:Khao Soi',
        'arimitchell:Chicken Karaage', 'devpatel:Pad See Ew', 'devpatel:Khao Soi'],
  'Nearby: Vancouver-area picks by Ari, Alli and Dev, ranked by recency plus how many people have the dish');
select is(
  (select array_agg(f.kind order by f.ordinality) from public.nearby_feed(0, 50) with ordinality as f),
  array['added_final', 'added_final', 'added_final', 'added_honorable', 'added_final', 'added_honorable'],
  'kind comes from the pick''s current tier');
select ok(
  not exists (select 1 from public.nearby_feed(0, 50) as f
              where f.actor_username in ('josiehamilton', 'mikebrennan', 'samokafor', 'priyashah')),
  'never Josie, Mike (no Vancouver picks), Sam (new) or Priya (private)');
select ok(
  not exists (select 1 from public.nearby_feed(0, 50) as f
              where (f.place).city in ('Tokyo', 'Saskatoon', 'New York', 'Mexico City')),
  'nothing from Tokyo, Saskatoon, New York or Mexico City');
select is(
  (select f.item_key from public.nearby_feed(0, 1) as f),
  public.test_pick('arimitchell', 'Pork Gyro')::text, 'item_key is the pick id');
select is(
  (select f.at from public.nearby_feed(0, 1) as f),
  (select k.created_at from public.picks k where k.id = public.test_pick('arimitchell', 'Pork Gyro')),
  'and at is the pick''s time');
select is(
  (select array_agg(f.dish_name order by f.ordinality) from public.nearby_feed(2, 2) with ordinality as f),
  array['Khao Soi', 'Chicken Karaage'], 'offset paging');
select is((select count(*)::int from public.nearby_feed(100, 20)), 0, 'past the end is empty');
select ok(
  not exists (select 1 from public.nearby_feed(0, 50) as f, jsonb_array_elements(f.tags) as t
              where t ->> 'kind' = 'personal'),
  'no personal tag in Nearby');
select ok(
  exists (select 1 from public.nearby_feed(0, 50) as f, jsonb_array_elements(f.tags) as t
          where f.dish_name = 'Pork Gyro' and t ->> 'slug' = 'greek'),
  'but the global tag is there');
select is(
  (select f.list_count from public.nearby_feed(0, 50) as f where f.dish_name = 'Pork Gyro'), 2,
  'list_count counts trusted people only (Josie and Ari, not Sam)');

-- Private accounts leave Nearby
reset role;
update public.profiles set visibility = 'private' where username = 'arimitchell';
set local role authenticated;
select public.test_login(public.test_user('josiehamilton'));
select ok(not exists (select 1 from public.nearby_feed(0, 50) as f where f.actor_username = 'arimitchell'),
  'with Ari private, Ari leaves Nearby');
select ok(exists (select 1 from public.following_feed() as f where f.actor_username = 'arimitchell'),
  'but Josie still follows Ari, so Ari stays in her Following feed');
select public.test_login(public.test_user('allimercer'));
select is((select count(*)::int from public.get_pick_detail(public.test_pick('arimitchell', 'Pork Gyro'))), 0,
  'and a stranger cannot open Ari''s pick');
reset role;
update public.profiles set visibility = 'public' where username = 'arimitchell';
set local role authenticated;

-- A caller with no home city
select public.test_login(public.test_user('josiehamilton'));
select public.set_my_home_city(null);
select is((select count(*)::int from public.nearby_feed(0, 50)), 0, 'with no home city Nearby is empty');
select public.set_my_home_city((select id from public.cities where geoname_id = 6173331));
select is((select count(*)::int from public.nearby_feed(0, 50)), 6, 'and comes back with a home city');

-- At most 200 rows in total
reset role;
insert into public.dishes (place_id, name)
select public.test_place('Skewers'), 'Bulk Dish ' || g from generate_series(1, 230) g;
insert into public.picks (user_id, dish_id, tier, original_dish_name, created_at)
select public.test_user('arimitchell'), d.id, 'honorable', d.name, now() - interval '3 days'
from public.dishes d where d.name like 'Bulk Dish %';
set local role authenticated;
select public.test_login(public.test_user('josiehamilton'));
select is((select count(*)::int from public.nearby_feed(0, 500)), 50, 'a page is capped at 50');
select is((select count(*)::int from public.nearby_feed(150, 50)), 50, 'the last full page (rows 151 to 200)');
select is((select count(*)::int from public.nearby_feed(190, 50)), 10, 'a page that crosses 200 is cut at 200');
select is((select count(*)::int from public.nearby_feed(200, 50)), 0, 'nothing beyond 200');

-- ---------------------------------------------------------------- get_pick_detail
select public.test_login(public.test_user('josiehamilton'));
select is(
  (select d.is_mine from public.get_pick_detail(public.test_pick('mikebrennan', 'Wagyu Beef Don')) as d), false,
  'Mike''s Wagyu Beef Don is not Josie''s');
select is(
  (select d.final_count from public.get_pick_detail(public.test_pick('mikebrennan', 'Wagyu Beef Don')) as d),
  (select s.final_count from public.dish_stats s where s.dish_id = public.test_dish('Wagyu Beef Don')),
  'final_count matches dish_stats');
select is(
  (select d.owner_username || ':' || d.dish_name || ':' || d.tier::text || ':' || d.slot::text
   from public.get_pick_detail(public.test_pick('mikebrennan', 'Wagyu Beef Don')) as d),
  'mikebrennan:Wagyu Beef Don:final:2', 'the owner, dish, tier and slot');
select is(
  (select d.note from public.get_pick_detail(public.test_pick('mikebrennan', 'Wagyu Beef Don')) as d),
  'God tier. I still dream about it.', 'and the note');
select is(
  (select d.pickers -> 0 ->> 'username' from public.get_pick_detail(public.test_pick('mikebrennan', 'Wagyu Beef Don')) as d),
  'mikebrennan', 'the owner comes first among the pickers');
select is(
  (select jsonb_array_length(d.pickers) from public.get_pick_detail(public.test_pick('mikebrennan', 'Wagyu Beef Don')) as d),
  2, 'with Josie second (two people have it as a Final Meal)');
select is(
  (select d.saved_by_me from public.get_pick_detail(public.test_pick('devpatel', 'Pad See Ew')) as d), true,
  'saved_by_me on a saved dish');
select is(
  (select d.is_mine from public.get_pick_detail(public.test_pick('josiehamilton', 'Pork Gyro')) as d), true,
  'Josie''s own pick is_mine');
select ok(
  exists (select 1 from public.get_pick_detail(public.test_pick('josiehamilton', 'Pork Gyro')) as d,
          jsonb_array_elements(d.tags) as t where t ->> 'kind' = 'personal'),
  'her own personal tags show on her own pick');
select ok(
  not exists (select 1 from public.get_pick_detail(public.test_pick('arimitchell', 'Pork Gyro')) as d,
              jsonb_array_elements(d.tags) as t where t ->> 'kind' = 'personal'),
  'Ari''s personal tag does not show to Josie');
select public.test_login(public.test_user('arimitchell'));
select ok(
  exists (select 1 from public.get_pick_detail(public.test_pick('arimitchell', 'Pork Gyro')) as d,
          jsonb_array_elements(d.tags) as t where t ->> 'slug' = 'secret-shame'),
  'but Ari sees it on his own pick');

-- A removed pick: gone from detail, feeds and notifications
select public.test_login(public.test_user('josiehamilton'));
reset role;
create temp table karaage as select public.test_pick('arimitchell', 'Chicken Karaage') as id;
grant select on karaage to authenticated;
select is(
  (select count(*)::int from public.notifications n join public.activities a on a.id = n.activity_id
   where a.pick_id = (select id from karaage)),
  1, 'before: Ari has a notification about Josie saving the Chicken Karaage');
set local role authenticated;
select public.test_login(public.test_user('arimitchell'));
select public.remove_pick((select id from karaage));
select public.test_login(public.test_user('josiehamilton'));
select is((select count(*)::int from public.get_pick_detail((select id from karaage))), 0,
  'a removed pick gives no detail row');
select ok(not exists (select 1 from public.following_feed() as f where f.dish_name = 'Chicken Karaage'),
  'and is gone from the Following feed');
select ok(not exists (select 1 from public.nearby_feed(0, 50) as f where f.dish_name = 'Chicken Karaage'),
  'and from Nearby');
reset role;
select is(
  (select count(*)::int from public.notifications n join public.activities a on a.id = n.activity_id
   where a.pick_id = (select id from karaage) or a.other_pick_id = (select id from karaage)),
  0, 'and its notification rows are gone');
set local role authenticated;
select public.test_login(public.test_user('josiehamilton'));

-- ---------------------------------------------------------------- place_pickers
select is(
  (select p.other_count from public.place_pickers(public.test_place('Skewers'), 3) as p), 1,
  'Skewers as Josie: one other person (Ari), not Josie');
select is(
  (select p.people -> 0 ->> 'username' from public.place_pickers(public.test_place('Skewers'), 3) as p),
  'arimitchell', 'and it is Ari');
select is(
  (select p.other_count from public.place_pickers(public.test_place('Lotus Noodle Bar'), 3) as p), 1,
  'Lotus Noodle Bar as Josie: Priya (private) counts');
select is(
  (select jsonb_array_length(p.people) from public.place_pickers(public.test_place('Lotus Noodle Bar'), 3) as p), 0,
  'but is not named, because she is private');
select is(
  (select p.other_count from public.place_pickers(public.test_place('Sushi Dai'), 3) as p), 0,
  'a brand-new account (Sam) is not counted');
select is(
  (select p.other_count || ':' || jsonb_array_length(p.people)
   from public.place_pickers(public.test_place('Marutama'), 1) as p),
  '1:1', 'Marutama as Josie: Dev, and the people list obeys the limit');

select * from finish();
rollback;
