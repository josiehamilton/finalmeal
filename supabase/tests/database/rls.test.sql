begin;
create extension if not exists pgtap with schema extensions;

select plan(85);

-- Fixtures (inserted as the superuser, so RLS does not apply yet).
-- Users: A = ...0a, B = ...0b, C = ...0c.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'user_a', 'Alice'),
  ('00000000-0000-0000-0000-00000000000b', 'user_b', 'Bob'),
  ('00000000-0000-0000-0000-00000000000c', 'user_c', 'Carol');
insert into public.places (id, source, name, city, country, location) values
  ('10000000-0000-0000-0000-000000000001', 'custom', 'Marutama', 'Vancouver', 'CA',
   'SRID=4326;POINT(-123.1 49.28)');
insert into public.dishes (id, place_id, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Ramen 1'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Ramen 2');
insert into public.picks (id, user_id, dish_id, tier, note, original_dish_name) values
  ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a',
   '20000000-0000-0000-0000-000000000001', 'honorable', 'original note', 'Ramen 1'),
  ('30000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b',
   '20000000-0000-0000-0000-000000000002', 'honorable', 'bob note', 'Ramen 2');
insert into public.tags (id, kind, name, slug, owner_id) values
  ('40000000-0000-0000-0000-000000000001', 'food_type', 'Ramen', 'ramen', null),
  ('40000000-0000-0000-0000-00000000000a', 'personal', 'Alice spot', 'alice-spot',
   '00000000-0000-0000-0000-00000000000a'),
  ('40000000-0000-0000-0000-00000000000b', 'personal', 'Bob spot', 'bob-spot',
   '00000000-0000-0000-0000-00000000000b');
insert into public.pick_tags (pick_id, tag_id) values
  ('30000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000a');
insert into public.follows (follower_id, followee_id) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c');
insert into public.saves (user_id, dish_id) values
  ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001');
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c');
insert into public.push_tokens (user_id, expo_token) values
  ('00000000-0000-0000-0000-00000000000a', 'ExponentPushToken[a]');
insert into public.device_attestations (user_id, platform, result) values
  ('00000000-0000-0000-0000-00000000000a', 'ios', 'passed');
insert into public.shared_lists (id, owner_id, slug, title, is_active) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
   'a-active', 'Active list', true),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a',
   'a-inactive', 'Inactive list', false);
insert into public.activities (id, actor_id, type, pick_id) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
   'added_honorable', '30000000-0000-0000-0000-00000000000a');
insert into public.notifications (id, user_id, activity_id) values
  ('70000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a',
   '60000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b',
   '60000000-0000-0000-0000-000000000001');
insert into public.reports (reporter_id, target_type, target_id, reason) values
  ('00000000-0000-0000-0000-00000000000c', 'pick', '30000000-0000-0000-0000-00000000000a', 'seed report');

-- ===== Signed out (anon) =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from public.places), 1, 'anon can read places');
select is((select count(*)::int from public.dishes), 2, 'anon can read dishes');
select is((select count(*)::int from public.profiles), 3, 'anon can read profiles');
select is((select count(*)::int from public.picks), 2, 'anon can read picks');
select throws_ok($$
  insert into public.picks (user_id, dish_id, tier, original_dish_name)
  values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000002', 'honorable', 'x')
$$, '42501', null, 'anon cannot insert a pick');
select throws_ok($$
  insert into public.places (source, name, city, country, location)
  values ('custom', 'Nope', 'Vancouver', 'CA', 'SRID=4326;POINT(-123.1 49.28)')
$$, '42501', null, 'anon cannot insert a place');
select is((select count(*)::int from public.tags where id = '40000000-0000-0000-0000-00000000000a'),
  0, 'anon cannot see A''s personal tag');
select is((select count(*)::int from public.tags where id = '40000000-0000-0000-0000-000000000001'),
  1, 'anon can see a global tag');
select is((select count(*)::int from public.pick_tags where tag_id = '40000000-0000-0000-0000-00000000000a'),
  0, 'anon cannot see the pick_tags row for A''s personal tag');
select is((select count(*)::int from public.pick_tags where tag_id = '40000000-0000-0000-0000-000000000001'),
  1, 'anon can see the pick_tags row for a global tag');
select is((select count(*)::int from public.shared_lists where slug = 'a-inactive'),
  0, 'anon cannot see an inactive shared list');
select is((select count(*)::int from public.shared_lists where slug = 'a-active'),
  1, 'anon can see an active shared list');
select is((select count(*)::int from public.follows), 0, 'anon cannot see follows');
select is((select count(*)::int from public.activities), 0, 'anon cannot see activities');
select is((select count(*)::int from public.notifications), 0, 'anon cannot see notifications');
select is((select count(*)::int from public.saves), 0, 'anon cannot see saves');
select is((select count(*)::int from public.reports), 0, 'anon cannot see reports');

-- ===== Signed in as B =====
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

-- Reads
select is((select count(*)::int from public.tags where id = '40000000-0000-0000-0000-00000000000a'),
  0, 'B cannot see A''s personal tag');
select is((select count(*)::int from public.tags where id = '40000000-0000-0000-0000-00000000000b'),
  1, 'B can see B''s own personal tag');
select is((select count(*)::int from public.pick_tags where tag_id = '40000000-0000-0000-0000-00000000000a'),
  0, 'B cannot see the pick_tags row for A''s personal tag');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-00000000000a'),
  0, 'B sees 0 of A''s notifications');
select is((select count(*)::int from public.notifications), 1, 'B sees only B''s own notification');
select is((select count(*)::int from public.shared_lists where slug = 'a-inactive'),
  0, 'B cannot see A''s inactive shared list');
select is((select count(*)::int from public.shared_lists where slug = 'a-active'),
  1, 'B can see A''s active shared list');
select is((select count(*)::int from public.activities), 1, 'a signed-in user can read activities');
select is((select count(*)::int from public.follows), 2, 'a signed-in user can read follows');
select is((select count(*)::int from public.saves), 0, 'B cannot see A''s saves');
select is((select count(*)::int from public.blocks), 0, 'B cannot see A''s blocks');
select is((select count(*)::int from public.push_tokens), 0, 'B cannot see A''s push tokens');
select is((select count(*)::int from public.device_attestations), 0, 'B cannot see A''s attestations');
select is((select count(*)::int from public.reports), 0, 'B cannot read reports');

-- Writes against A's rows touch nothing (checked from A's side further down)
select lives_ok($$update public.picks set note = 'hijacked' where id = '30000000-0000-0000-0000-00000000000a'$$,
  'B''s update of A''s pick runs without error (and affects 0 rows)');
select lives_ok($$delete from public.picks where id = '30000000-0000-0000-0000-00000000000a'$$,
  'B''s delete of A''s pick runs without error (and affects 0 rows)');
select lives_ok($$update public.shared_lists set title = 'hijacked' where id = '50000000-0000-0000-0000-000000000001'$$,
  'B''s update of A''s list runs without error (and affects 0 rows)');
select lives_ok($$update public.profiles set display_name = 'hijacked' where id = '00000000-0000-0000-0000-00000000000a'$$,
  'B''s update of A''s profile runs without error (and affects 0 rows)');
select lives_ok($$delete from public.follows where follower_id = '00000000-0000-0000-0000-00000000000a' and followee_id = '00000000-0000-0000-0000-00000000000c'$$,
  'B''s delete of a follow between A and C runs without error (and affects 0 rows)');

-- Rejected writes
select throws_ok($$
  insert into public.picks (user_id, dish_id, tier, original_dish_name)
  values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000002', 'honorable', 'x')
$$, '42501', null, 'B cannot insert a pick for A');
select throws_ok($$
  insert into public.pick_tags (pick_id, tag_id)
  values ('30000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000001')
$$, '42501', null, 'B cannot tag A''s pick');
select throws_ok($$
  insert into public.profiles (id, username, display_name)
  values ('00000000-0000-0000-0000-0000000000dd', 'user_d', 'Dave')
$$, '42501', null, 'B cannot create a profile for someone else');
select throws_ok($$
  insert into public.follows (follower_id, followee_id)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')
$$, '42501', null, 'B cannot make A follow B');
select throws_ok($$
  insert into public.activities (actor_id, type)
  values ('00000000-0000-0000-0000-00000000000b', 'followed')
$$, '42501', null, 'activities have no direct writes');
select throws_ok($$
  insert into public.dishes (place_id, name)
  values ('10000000-0000-0000-0000-000000000001', 'Nope')
$$, '42501', null, 'dishes have no direct writes');
select throws_ok($$
  update public.notifications set user_id = '00000000-0000-0000-0000-00000000000a'
  where id = '70000000-0000-0000-0000-00000000000b'
$$, '42501', null, 'B cannot hand B''s notification to A');
select lives_ok($$update public.notifications set read_at = now() where id = '70000000-0000-0000-0000-00000000000b'$$,
  'B can mark B''s own notification read');

-- Follows: either party may delete
select lives_ok($$delete from public.follows where followee_id = '00000000-0000-0000-0000-00000000000b'$$,
  'B can delete a follow where B is the followee');

-- ===== Back to the superuser, before A acts: what B's attempts really did =====
reset role;

select is((select note from public.picks where id = '30000000-0000-0000-0000-00000000000a'),
  'original note', 'B''s update of A''s pick changed nothing');
select is((select count(*)::int from public.picks where id = '30000000-0000-0000-0000-00000000000a'),
  1, 'B''s delete of A''s pick removed nothing');
select is((select title from public.shared_lists where id = '50000000-0000-0000-0000-000000000001'),
  'Active list', 'B''s update of A''s list changed nothing');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Alice', 'B''s update of A''s profile changed nothing');
select is((select count(*)::int from public.follows
   where follower_id = '00000000-0000-0000-0000-00000000000a' and followee_id = '00000000-0000-0000-0000-00000000000c'),
  1, 'B''s delete of the follow between A and C removed nothing');
select is((select count(*)::int from public.follows
   where follower_id = '00000000-0000-0000-0000-00000000000a' and followee_id = '00000000-0000-0000-0000-00000000000b'),
  0, 'B removed the follow where B is the followee');
select isnt((select read_at from public.notifications where id = '70000000-0000-0000-0000-00000000000b'),
  null, 'B''s read_at update landed');

-- ===== Signed in as A =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- Reads
select is((select count(*)::int from public.tags where id = '40000000-0000-0000-0000-00000000000a'),
  1, 'A can see A''s personal tag');
select is((select count(*)::int from public.tags where id = '40000000-0000-0000-0000-00000000000b'),
  0, 'A cannot see B''s personal tag');
select is((select count(*)::int from public.pick_tags where tag_id = '40000000-0000-0000-0000-00000000000a'),
  1, 'A can see the pick_tags row for A''s personal tag');
select is((select count(*)::int from public.notifications), 1, 'A sees only A''s notification');
select is((select count(*)::int from public.shared_lists where slug = 'a-inactive'),
  1, 'A can see A''s inactive shared list');
select is((select count(*)::int from public.saves), 1, 'A sees A''s saves');
select is((select count(*)::int from public.blocks), 1, 'A sees A''s blocks');
select is((select count(*)::int from public.push_tokens), 1, 'A sees A''s push tokens');
select is((select count(*)::int from public.device_attestations), 1, 'A sees A''s attestations');

-- Reports are write-only
select lives_ok($$
  insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('00000000-0000-0000-0000-00000000000a', 'pick', '30000000-0000-0000-0000-00000000000b', 'spam')
$$, 'A can file a report');
select is((select count(*)::int from public.reports), 0, 'A cannot read reports back, even their own');
select throws_ok($$
  insert into public.reports (reporter_id, target_type, target_id, reason)
  values ('00000000-0000-0000-0000-00000000000b', 'pick', '30000000-0000-0000-0000-00000000000b', 'spam')
$$, '42501', null, 'A cannot file a report as B');

-- Ownership cannot be transferred
select throws_ok($$update public.picks set user_id = '00000000-0000-0000-0000-00000000000b' where id = '30000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A cannot move a pick to B');
select throws_ok($$update public.tags set owner_id = '00000000-0000-0000-0000-00000000000b' where id = '40000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A cannot move a personal tag to B');
select throws_ok($$update public.shared_lists set owner_id = '00000000-0000-0000-0000-00000000000b' where id = '50000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'A cannot move a shared list to B');
select throws_ok($$update public.profiles set id = '00000000-0000-0000-0000-00000000000b' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A cannot repoint a profile at B');
select throws_ok($$update public.saves set user_id = '00000000-0000-0000-0000-00000000000b' where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A cannot move a save to B');

-- Tags: only own personal tags are writable
select throws_ok($$insert into public.tags (kind, name, slug) values ('food_type', 'Pizza', 'pizza')$$,
  '42501', null, 'A cannot create a global tag');
select throws_ok($$
  insert into public.tags (kind, name, slug, owner_id)
  values ('personal', 'Sneaky', 'sneaky', '00000000-0000-0000-0000-00000000000b')
$$, '42501', null, 'A cannot create a personal tag owned by B');
select lives_ok($$
  insert into public.tags (kind, name, slug, owner_id)
  values ('personal', 'Date night', 'date-night', '00000000-0000-0000-0000-00000000000a')
$$, 'A can create their own personal tag');
select lives_ok($$update public.tags set is_featured = true where id = '40000000-0000-0000-0000-000000000001'$$,
  'A''s update of a global tag runs without error (and affects 0 rows)');

-- pick_tags on own picks
select lives_ok($$
  insert into public.pick_tags (pick_id, tag_id)
  select '30000000-0000-0000-0000-00000000000a', id from public.tags where slug = 'date-night'
$$, 'A can tag A''s own pick');
select lives_ok($$
  delete from public.pick_tags where tag_id = '40000000-0000-0000-0000-00000000000a'
$$, 'A can untag A''s own pick');

-- Own picks, lists, follows
select lives_ok($$update public.picks set note = 'edited by A' where id = '30000000-0000-0000-0000-00000000000a'$$,
  'A can edit A''s own pick');
select lives_ok($$update public.shared_lists set title = 'Renamed' where id = '50000000-0000-0000-0000-000000000001'$$,
  'A can edit A''s own list');
select lives_ok($$
  insert into public.follows (follower_id, followee_id)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')
$$, 'A can follow B');
select lives_ok($$delete from public.follows where follower_id = '00000000-0000-0000-0000-00000000000a' and followee_id = '00000000-0000-0000-0000-00000000000c'$$,
  'A can delete a follow where A is the follower');
select throws_ok($$
  insert into public.device_attestations (user_id, platform, result)
  values ('00000000-0000-0000-0000-00000000000a', 'ios', 'passed')
$$, '42501', null, 'users cannot write their own attestations');

-- ===== Back to the superuser, after A acts =====
reset role;

select is((select note from public.picks where id = '30000000-0000-0000-0000-00000000000a'),
  'edited by A', 'A''s edit of A''s pick landed');
select is((select title from public.shared_lists where id = '50000000-0000-0000-0000-000000000001'),
  'Renamed', 'A''s rename of A''s list landed');
select is((select is_featured from public.tags where id = '40000000-0000-0000-0000-000000000001'),
  false, 'A''s update of a global tag changed nothing');
select is((select count(*)::int from public.follows where followee_id = '00000000-0000-0000-0000-00000000000b'
   and follower_id = '00000000-0000-0000-0000-00000000000a'), 1,
  'A''s follow of B exists (re-added after B removed the old one)');
select is((select count(*)::int from public.follows where followee_id = '00000000-0000-0000-0000-00000000000c'), 0,
  'A removed the follow of C');

select * from finish();
rollback;
