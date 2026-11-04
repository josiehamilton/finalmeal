begin;
create extension if not exists pgtap with schema extensions;

select plan(63);

-- Saves ("save to try"): written only through save_dish / unsave_dish, read through
-- get_my_saves. Uses the dev seed: Josie has four saves (Chicken Karaage via Ari, Pad See Ew via
-- Dev, Butter Chicken via Alli, Spicy Tuna Roll via Mike, newest first) and Mike has saved Josie's
-- Pork Gyro through her pick. The fan-out to notifications is a deferred trigger, so each action
-- that should notify is followed by `set constraints all immediate; set constraints all
-- deferred;`. Everything rolls back with the transaction.

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

create function public.test_dish(p_name text)
returns uuid
language sql
security definer
as $$
  select id from public.dishes where name = p_name;
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

-- Counts that see past row-level security (security definer).
create function public.test_saved_pick_acts(p_actor text, p_pick uuid)
returns integer
language sql
security definer
as $$
  select count(*)::int from public.activities a
  where a.actor_id = public.test_user(p_actor) and a.type = 'saved_pick' and a.pick_id = p_pick;
$$;

create function public.test_saved_pick_pushes(p_owner text, p_actor text, p_pick uuid)
returns integer
language sql
security definer
as $$
  select count(*)::int from public.push_outbox o
  join public.activities a on a.id = o.activity_id
  where o.user_id = public.test_user(p_owner) and a.actor_id = public.test_user(p_actor)
    and a.type = 'saved_pick' and a.pick_id = p_pick;
$$;

create function public.test_saved_pick_notes(p_owner text, p_actor text, p_pick uuid)
returns integer
language sql
security definer
as $$
  select count(*)::int from public.notifications n
  join public.activities a on a.id = n.activity_id
  where n.user_id = public.test_user(p_owner) and a.actor_id = public.test_user(p_actor)
    and a.type = 'saved_pick' and a.pick_id = p_pick;
$$;

-- ---------------------------------------------------------------- structure
select has_function('public', 'save_dish', array['uuid', 'uuid'], 'save_dish exists');
select has_function('public', 'unsave_dish', array['uuid'], 'unsave_dish exists');
select has_function('public', 'get_my_saves', 'get_my_saves exists');
select has_column('public', 'saves', 'via_pick_id', 'saves has via_pick_id');
select has_column('public', 'saves', 'via_user_id', 'saves has via_user_id');
select ok(not has_function_privilege('anon', 'public.save_dish(uuid,uuid)', 'execute'),
  'anon cannot run save_dish');
select ok(has_function_privilege('authenticated', 'public.save_dish(uuid,uuid)', 'execute'),
  'authenticated can run save_dish');
select ok(not has_function_privilege('anon', 'public.get_my_saves()', 'execute'),
  'anon cannot run get_my_saves');
select ok(not has_table_privilege('authenticated', 'public.saves', 'insert')
  and not has_table_privilege('authenticated', 'public.saves', 'update')
  and not has_table_privilege('authenticated', 'public.saves', 'delete'),
  'clients hold no write privileges on saves');

set local role authenticated;
select public.test_login(public.test_user('josiehamilton'));

-- ---------------------------------------------------------------- direct writes are closed
select throws_ok($$
  insert into public.saves (user_id, dish_id)
  values (public.test_user('josiehamilton'), public.test_dish('Banh Mi'))
$$, '42501', null, 'a direct insert into saves is refused');
select throws_ok($$
  update public.saves set via_pick_id = null where user_id = public.test_user('josiehamilton')
$$, '42501', null, 'a direct update of saves is refused');
select throws_ok($$
  delete from public.saves where user_id = public.test_user('josiehamilton')
$$, '42501', null, 'a direct delete from saves is refused');
select is((select count(*)::int from public.saves), 4,
  'select-own: Josie reads only her own four saves (Mike''s is hidden)');

-- ---------------------------------------------------------------- get_my_saves
select is(
  (select array_agg(t.dish_name order by t.ordinality) from public.get_my_saves() with ordinality as t),
  array['Chicken Karaage', 'Pad See Ew', 'Butter Chicken', 'Spicy Tuna Roll'],
  'Josie''s four seeded saves, newest first');
select is(
  (select array_agg(t.via_username order by t.ordinality) from public.get_my_saves() with ordinality as t),
  array['arimitchell', 'devpatel', 'allimercer', 'mikebrennan'],
  'each save says whose pick it came through');
select is(
  (select array_agg(t.via_tier::text order by t.ordinality) from public.get_my_saves() with ordinality as t),
  array['honorable', 'final', 'honorable', 'honorable'],
  'via_tier is the pick''s current tier');
select is(
  (select array_agg(t.via_user_id order by t.ordinality) from public.get_my_saves() with ordinality as t),
  array[public.test_user('arimitchell'), public.test_user('devpatel'),
        public.test_user('allimercer'), public.test_user('mikebrennan')],
  'via_user_id is the pick''s owner');
select is(
  (select array_agg(t.via_pick_id order by t.ordinality) from public.get_my_saves() with ordinality as t),
  array[public.test_pick('arimitchell', 'Chicken Karaage'), public.test_pick('devpatel', 'Pad See Ew'),
        public.test_pick('allimercer', 'Butter Chicken'), public.test_pick('mikebrennan', 'Spicy Tuna Roll')],
  'via_pick_id is the pick the save came through');
select is((select (t.place).name from public.get_my_saves() as t limit 1), 'Marutama',
  'the place comes with the save');
select ok((select bool_and((t.place).created_by is null) from public.get_my_saves() as t),
  'places are masked (created_by null)');
select ok(
  (select t.distance_m between 4000 and 5500 from public.get_my_saves() as t where t.dish_name = 'Chicken Karaage'),
  'distance is measured from the home city (Marutama is about 4.7 km from Vancouver''s point)');
select ok(
  (select t.distance_m > 500000 from public.get_my_saves() as t where t.dish_name = 'Butter Chicken'),
  'Butter Chicken at Spicy Time (Saskatoon) is a long way from Vancouver');

reset role;
update public.picks set photo_path = '00000000-0000-4000-8000-000000000003/pick-1.jpg'
where id = public.test_pick('arimitchell', 'Chicken Karaage');
set local role authenticated;
select public.test_login(public.test_user('josiehamilton'));
select is((select t.photo_path from public.get_my_saves() as t where t.dish_name = 'Chicken Karaage'),
  '00000000-0000-4000-8000-000000000003/pick-1.jpg', 'photo_path is the via pick''s photo');
select is((select t.photo_path from public.get_my_saves() as t where t.dish_name = 'Pad See Ew'),
  null, 'no photo is null');

-- No home city: distance is null
select public.set_my_home_city(null);
select is((select count(*)::int from public.get_my_saves() where distance_m is not null), 0,
  'without a home city every distance is null');

-- Mike's save goes through Josie's pick
select public.test_login(public.test_user('mikebrennan'));
select is(
  (select t.via_username || ':' || (t.via_pick_id = public.test_pick('josiehamilton', 'Pork Gyro'))::text
   from public.get_my_saves() as t),
  'josiehamilton:true', 'Mike''s seeded save of the Pork Gyro came through Josie''s pick');

-- ---------------------------------------------------------------- save_dish
select public.test_login(public.test_user('allimercer'));
select lives_ok($$
  select public.save_dish(public.test_dish('Pork Gyro'), public.test_pick('arimitchell', 'Pork Gyro'))
$$, 'Alli saves the Pork Gyro through Ari''s pick');
select lives_ok($$
  select public.save_dish(public.test_dish('Pork Gyro'), public.test_pick('arimitchell', 'Pork Gyro'))
$$, 'saving it again is fine');
set constraints all immediate;
set constraints all deferred;
select is((select count(*)::int from public.saves where dish_id = public.test_dish('Pork Gyro')), 1,
  'saving twice leaves one row');
select is(public.test_saved_pick_acts('allimercer', public.test_pick('arimitchell', 'Pork Gyro')), 1,
  'and one saved_pick activity');
select is(public.test_saved_pick_notes('arimitchell', 'allimercer', public.test_pick('arimitchell', 'Pork Gyro')), 1,
  'Ari is notified once');
select is(
  (select via_pick_id::text || ':' || via_user_id::text from public.saves where dish_id = public.test_dish('Pork Gyro')),
  public.test_pick('arimitchell', 'Pork Gyro')::text || ':' || public.test_user('arimitchell')::text,
  'the row remembers the via pick and its owner');

select lives_ok($$ select public.unsave_dish(public.test_dish('Pork Gyro')) $$, 'Alli unsaves it');
select is((select count(*)::int from public.saves where dish_id = public.test_dish('Pork Gyro')), 0,
  'unsave removes the row');
select is(public.test_saved_pick_acts('allimercer', public.test_pick('arimitchell', 'Pork Gyro')), 0,
  'unsave removes the saved_pick activity');
select is(public.test_saved_pick_notes('arimitchell', 'allimercer', public.test_pick('arimitchell', 'Pork Gyro')), 0,
  'and Ari''s notification goes with it');
select lives_ok($$ select public.unsave_dish(public.test_dish('Pork Gyro')) $$,
  'unsaving what is not saved does nothing');

-- Save, unsave, save again: the owner is told in-app each time but pushed once per 24 hours per
-- pick (unsaving deletes the queued push with its activity, so the throttle has its own memory).
reset role;
insert into public.push_tokens (user_id, expo_token, platform)
values (public.test_user('arimitchell'), 'ExponentPushToken[ari-saves]', 'ios');
set local role authenticated;
select public.test_login(public.test_user('allimercer'));
select public.save_dish(public.test_dish('Pork Gyro'), public.test_pick('arimitchell', 'Pork Gyro'));
set constraints all immediate;
set constraints all deferred;
select is(public.test_saved_pick_pushes('arimitchell', 'allimercer', public.test_pick('arimitchell', 'Pork Gyro')), 1,
  'the first save queues a push to the pick''s owner');
select public.unsave_dish(public.test_dish('Pork Gyro'));
select public.save_dish(public.test_dish('Pork Gyro'), public.test_pick('arimitchell', 'Pork Gyro'));
set constraints all immediate;
set constraints all deferred;
select is(public.test_saved_pick_pushes('arimitchell', 'allimercer', public.test_pick('arimitchell', 'Pork Gyro')), 0,
  'saving again within 24 hours queues no second push');
select is(public.test_saved_pick_notes('arimitchell', 'allimercer', public.test_pick('arimitchell', 'Pork Gyro')), 1,
  'but the in-app notification is still there');
select public.unsave_dish(public.test_dish('Pork Gyro'));
select public.save_dish(public.test_dish('Smash Burger'), public.test_pick('arimitchell', 'Smash Burger'));
set constraints all immediate;
set constraints all deferred;
select is(public.test_saved_pick_pushes('arimitchell', 'allimercer', public.test_pick('arimitchell', 'Smash Burger')), 1,
  'a save of a different pick is not throttled');
select public.unsave_dish(public.test_dish('Smash Burger'));

-- A via pick that does not count is treated as no via pick
select public.save_dish(public.test_dish('Pork Gyro'), public.test_pick('allimercer', 'Khao Soi'));
select is((select via_pick_id from public.saves where dish_id = public.test_dish('Pork Gyro')), null,
  'a via pick of a different dish is dropped');
select public.unsave_dish(public.test_dish('Pork Gyro'));

select public.save_dish(public.test_dish('Xiao Long Bao'), public.test_pick('priyashah', 'Xiao Long Bao'));
set constraints all immediate;
set constraints all deferred;
select is((select via_pick_id from public.saves where dish_id = public.test_dish('Xiao Long Bao')), null,
  'a via pick Alli cannot see (a private account) is dropped');
select is(public.test_saved_pick_acts('allimercer', public.test_pick('priyashah', 'Xiao Long Bao')), 0,
  'and writes no activity');
select is(public.test_saved_pick_notes('priyashah', 'allimercer', public.test_pick('priyashah', 'Xiao Long Bao')), 0,
  'and Priya learns nothing');
select public.unsave_dish(public.test_dish('Xiao Long Bao'));

select public.test_login(public.test_user('josiehamilton'));
select public.save_dish(public.test_dish('Pork Gyro'), public.test_pick('josiehamilton', 'Pork Gyro'));
set constraints all immediate;
set constraints all deferred;
select is((select via_pick_id from public.saves where dish_id = public.test_dish('Pork Gyro')), null,
  'saving through your own pick stores a null via');
select is((select via_user_id from public.saves where dish_id = public.test_dish('Pork Gyro')), null,
  'and no via user');
select is(public.test_saved_pick_acts('josiehamilton', public.test_pick('josiehamilton', 'Pork Gyro')), 0,
  'and no saved_pick activity');
select public.unsave_dish(public.test_dish('Pork Gyro'));

select throws_ok($$ select public.save_dish('00000000-0000-4000-8000-0000000000ff') $$,
  'P0001', 'dish_not_found', 'an unknown dish raises dish_not_found');
reset role;
update public.dishes set merged_into_id = public.test_dish('Nigiri Set') where name = 'Omakase';
set local role authenticated;
select public.test_login(public.test_user('josiehamilton'));
select throws_ok($$ select public.save_dish(public.test_dish('Omakase')) $$,
  'P0001', 'dish_not_found', 'a merged dish raises dish_not_found');
select set_config('request.jwt.claims', '{}', true);
select throws_ok($$ select public.save_dish(public.test_dish('Banh Mi')) $$,
  '42501', 'not_authenticated', 'no signed-in person: not_authenticated');
select throws_ok($$ select public.unsave_dish(public.test_dish('Banh Mi')) $$,
  '42501', 'not_authenticated', 'unsave without a signed-in person: not_authenticated');

-- ---------------------------------------------------------------- when the pick goes away
select public.test_login(public.test_user('arimitchell'));
select public.remove_pick(public.test_pick('arimitchell', 'Chicken Karaage'));
select public.test_login(public.test_user('josiehamilton'));
select is((select count(*)::int from public.get_my_saves()), 4, 'the save outlives the removed pick');
select is((select t.via_username from public.get_my_saves() as t where t.dish_name = 'Chicken Karaage'), null,
  'but it loses its via line');
select is((select t.via_pick_id from public.get_my_saves() as t where t.dish_name = 'Chicken Karaage'), null,
  'and its via pick');
select is((select via_pick_id from public.saves where dish_id = public.test_dish('Chicken Karaage')), null,
  'the table row keeps no dangling pick id (set null)');
select lives_ok($$ select public.unsave_dish(public.test_dish('Chicken Karaage')) $$,
  'a save whose pick is gone can still be removed');
select is((select count(*)::int from public.get_my_saves()), 3, 'and is gone');

-- ---------------------------------------------------------------- when the via pick stops being visible
select public.test_login(public.test_user('allimercer'));
select public.save_dish(public.test_dish('Pad See Ew'), public.test_pick('devpatel', 'Pad See Ew'));
select is((select t.via_username from public.get_my_saves() as t where t.dish_name = 'Pad See Ew'),
  'devpatel', 'Alli''s save shows Dev while Dev is public');
reset role;
update public.profiles set visibility = 'private' where username = 'devpatel';
set local role authenticated;
select public.test_login(public.test_user('allimercer'));
select is((select t.via_username from public.get_my_saves() as t where t.dish_name = 'Pad See Ew'),
  null, 'Dev went private and Alli does not follow Dev: the via line is hidden');
select is((select count(*)::int from public.get_my_saves() where dish_name = 'Pad See Ew'), 1,
  'but the dish stays saved');
select public.test_login(public.test_user('josiehamilton'));
select is((select t.via_username from public.get_my_saves() as t where t.dish_name = 'Pad See Ew'),
  'devpatel', 'Josie follows Dev, so she still sees it');
reset role;
insert into public.blocks (blocker_id, blocked_id) values
  (public.test_user('allimercer'), public.test_user('josiehamilton'));
set local role authenticated;
select public.test_login(public.test_user('josiehamilton'));
select is((select t.via_username from public.get_my_saves() as t where t.dish_name = 'Butter Chicken'),
  null, 'a block hides the via line');

select * from finish();
rollback;
