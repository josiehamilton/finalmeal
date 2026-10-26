begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

-- All 15 tables exist
select has_table('public', t, t || ' exists')
from unnest(array[
  'profiles','places','dishes','picks','tags','pick_tags','follows','saves',
  'blocks','shared_lists','activities','notifications','push_tokens',
  'device_attestations','reports'
]) as t;

-- Row-level security is on for every table
select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public' and not rowsecurity),
  0,
  'row-level security is enabled on every public table'
);

-- Fixtures: two users, a place, dishes
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'josiehamilton', 'Josie'),
  ('00000000-0000-0000-0000-00000000000b', 'mike', 'Mike');
insert into public.places (id, source, name, city, country, location) values
  ('10000000-0000-0000-0000-000000000001', 'custom', 'Marutama', 'Vancouver', 'CA',
   'SRID=4326;POINT(-123.1 49.28)');
insert into public.dishes (id, place_id, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Ramen 1'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Ramen 2'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Ramen 3'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Ramen 4'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Ramen 5'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Ramen 6'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Ramen 7');

-- Picks: slots 1-5 are allowed
select lives_ok($$
  insert into public.picks (user_id, dish_id, tier, slot, original_dish_name)
  select '00000000-0000-0000-0000-00000000000a',
         ('20000000-0000-0000-0000-00000000000' || n)::uuid, 'final', n, 'Ramen ' || n
  from generate_series(1, 5) as n
$$, 'a user can hold finals in slots 1 to 5');

select throws_ok($$
  insert into public.picks (user_id, dish_id, tier, slot, original_dish_name)
  values ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000006', 'final', 6, 'Ramen 6')
$$, '23514', null, 'a final in slot 6 fails the check');

select throws_ok($$
  insert into public.picks (user_id, dish_id, tier, slot, original_dish_name)
  values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000006', 'final', 3, 'Ramen 6')
$$, '23505', null, 'a second final in an occupied slot fails the unique index');

select throws_ok($$
  insert into public.picks (user_id, dish_id, tier, slot, original_dish_name)
  values ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000006', 'final', null, 'Ramen 6')
$$, '23514', null, 'a final with no slot fails the check');

select throws_ok($$
  insert into public.picks (user_id, dish_id, tier, slot, original_dish_name)
  values ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000006', 'honorable', 2, 'Ramen 6')
$$, '23514', null, 'an honorable with a slot fails the check');

select lives_ok($$
  insert into public.picks (id, user_id, dish_id, tier, original_dish_name)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b',
          '20000000-0000-0000-0000-000000000006', 'honorable', 'Ramen 6')
$$, 'an honorable with no slot is fine');

-- Dish duplicates are caught after normalisation
insert into public.dishes (place_id, name) values ('10000000-0000-0000-0000-000000000001', 'Bánh Mì');
select throws_ok($$
  insert into public.dishes (place_id, name) values ('10000000-0000-0000-0000-000000000001', 'Banh Mi')
$$, '23505', null, 'Banh Mi duplicates Bánh Mì at the same place');

select is(
  (select name_key from public.dishes where name = 'Bánh Mì'),
  'banh mi',
  'name_key is set by trigger'
);

-- Usernames are case-insensitive unique and pattern-checked
select throws_ok($$
  insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000c');
  insert into public.profiles (id, username, display_name)
  values ('00000000-0000-0000-0000-00000000000c', 'JosieHamilton', 'Other')
$$, '23505', null, 'JosieHamilton duplicates josiehamilton');

select throws_ok($$
  insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000d');
  insert into public.profiles (id, username, display_name)
  values ('00000000-0000-0000-0000-00000000000d', 'ab', 'Short')
$$, '23514', null, 'a 2-character username fails the check');

-- Tags
select throws_ok($$
  insert into public.tags (kind, name, slug) values ('personal', 'Date night', 'date-night')
$$, '23514', null, 'a personal tag without an owner fails the check');

insert into public.tags (id, kind, name, slug, owner_id) values
  ('40000000-0000-0000-0000-00000000000b', 'personal', 'Mikes spot', 'mikes-spot',
   '00000000-0000-0000-0000-00000000000b');
insert into public.picks (id, user_id, dish_id, tier, original_dish_name)
  values ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a',
          '20000000-0000-0000-0000-000000000007', 'honorable', 'Ramen 7');

select throws_ok($$
  insert into public.pick_tags (pick_id, tag_id)
  values ('30000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000b')
$$, 'P0001', 'personal_tag_not_owned', 'user B''s personal tag cannot go on user A''s pick');

select lives_ok($$
  insert into public.pick_tags (pick_id, tag_id)
  values ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-00000000000b')
$$, 'a personal tag can go on its owner''s pick');

-- Follows
select throws_ok($$
  insert into public.follows (follower_id, followee_id)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a')
$$, '23514', null, 'a self-follow fails the check');

-- Unicode round trip
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, username, display_name)
  values ('00000000-0000-0000-0000-00000000000e', 'unicode_user', 'Crème Brûlée 🍮');
insert into public.dishes (id, place_id, name)
  values ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-000000000001', 'ラーメン');
insert into public.picks (user_id, dish_id, tier, note, original_dish_name)
  values ('00000000-0000-0000-0000-00000000000e', '20000000-0000-0000-0000-0000000000f1',
          'honorable', 'ラーメン最高 🍜', 'ラーメン');

select is(
  (select display_name from public.profiles where username = 'unicode_user'),
  'Crème Brûlée 🍮', 'display name round-trips unchanged');
select is(
  (select note from public.picks where user_id = '00000000-0000-0000-0000-00000000000e'),
  'ラーメン最高 🍜', 'pick note round-trips unchanged');
select is(
  (select name from public.dishes where id = '20000000-0000-0000-0000-0000000000f1'),
  'ラーメン', 'dish name round-trips unchanged');

select * from finish();
rollback;
