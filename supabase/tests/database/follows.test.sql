begin;
create extension if not exists pgtap with schema extensions;

select plan(51);

-- Follows are written only through functions. Fixtures are inserted as the superuser; the dev
-- seed is deleted first and comes back when this transaction rolls back.
-- Users: A = ...0a (public), B = ...0b (public), C = ...0c (private), D = ...0d (private),
--        E = ...0e (public), F = ...0f (no profile).
delete from auth.users;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000d'),
  ('00000000-0000-0000-0000-00000000000e'),
  ('00000000-0000-0000-0000-00000000000f');
insert into public.profiles (id, username, display_name, visibility) values
  ('00000000-0000-0000-0000-00000000000a', 'user_a', 'Alice', 'public'),
  ('00000000-0000-0000-0000-00000000000b', 'user_b', 'Bob', 'public'),
  ('00000000-0000-0000-0000-00000000000c', 'user_c', 'Carol', 'private'),
  ('00000000-0000-0000-0000-00000000000d', 'user_d', 'Dave', 'private'),
  ('00000000-0000-0000-0000-00000000000e', 'user_e', 'Erin', 'public');

create function public.test_login(p_uid uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------- structure
select has_function('public', 'follow_user', array['uuid'], 'follow_user exists');
select has_function('public', 'unfollow_user', array['uuid'], 'unfollow_user exists');
select has_function('public', 'respond_follow_request', array['uuid', 'boolean'], 'respond_follow_request exists');
select has_trigger('public', 'profiles', 'profiles_approve_requests_on_public',
  'the approve-on-public trigger exists');
select ok(not has_function_privilege('anon', 'public.follow_user(uuid)', 'execute'),
  'anon cannot run follow_user');
select ok(not has_function_privilege('anon', 'public.unfollow_user(uuid)', 'execute'),
  'anon cannot run unfollow_user');
select ok(not has_function_privilege('anon', 'public.respond_follow_request(uuid, boolean)', 'execute'),
  'anon cannot run respond_follow_request');

-- ================================================================ A follows a public user
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');

select is(public.follow_user('00000000-0000-0000-0000-00000000000b'), 'active'::public.follow_status,
  'following a public user gives active');
select is(public.follow_user('00000000-0000-0000-0000-00000000000b'), 'active'::public.follow_status,
  'following again returns active');
select is((select count(*)::int from public.follows
   where follower_id = '00000000-0000-0000-0000-00000000000a' and followee_id = '00000000-0000-0000-0000-00000000000b'),
  1, 'still one follow row after the repeat');
select is((select count(*)::int from public.activities
   where actor_id = '00000000-0000-0000-0000-00000000000a' and type = 'followed'
     and target_user_id = '00000000-0000-0000-0000-00000000000b'),
  1, 'one followed activity, even after the repeat');

-- ================================================================ A follows a private user
select is(public.follow_user('00000000-0000-0000-0000-00000000000c'), 'requested'::public.follow_status,
  'following a private user gives requested');
select is((select count(*)::int from public.activities
   where actor_id = '00000000-0000-0000-0000-00000000000a' and type = 'follow_requested'
     and target_user_id = '00000000-0000-0000-0000-00000000000c'),
  1, 'one follow_requested activity');
select is(public.follow_user('00000000-0000-0000-0000-00000000000c'), 'requested'::public.follow_status,
  'asking again returns requested');
select is((select count(*)::int from public.activities where type = 'follow_requested'), 1,
  'asking again writes no second activity');

-- ================================================================ errors
select throws_ok($$select public.follow_user('00000000-0000-0000-0000-00000000000a')$$,
  'P0001', 'cannot_follow_self', 'following yourself raises cannot_follow_self');
select throws_ok($$select public.follow_user('00000000-0000-0000-0000-0000000000ff')$$,
  'P0001', 'profile_unavailable', 'following someone who does not exist raises profile_unavailable');
select throws_ok($$select public.respond_follow_request('00000000-0000-0000-0000-00000000000b', true)$$,
  'P0001', 'request_not_found', 'answering a request that is not there raises request_not_found');

-- ================================================================ C answers
select public.test_login('00000000-0000-0000-0000-00000000000c');
select throws_ok($$select public.respond_follow_request('00000000-0000-0000-0000-00000000000e', true)$$,
  'P0001', 'request_not_found', 'no request from E raises request_not_found');
select lives_ok($$select public.respond_follow_request('00000000-0000-0000-0000-00000000000a', true)$$,
  'C accepts A''s request');
select is((select status::text from public.follows
   where follower_id = '00000000-0000-0000-0000-00000000000a' and followee_id = '00000000-0000-0000-0000-00000000000c'),
  'active', 'the follow is now active');
select is((select count(*)::int from public.activities
   where actor_id = '00000000-0000-0000-0000-00000000000c' and type = 'follow_accepted'),
  1, 'a follow_accepted activity from C');
select throws_ok($$select public.respond_follow_request('00000000-0000-0000-0000-00000000000a', true)$$,
  'P0001', 'request_not_found', 'accepting twice raises request_not_found (the row is no longer requested)');

-- Decline: A asks D, D declines
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.follow_user('00000000-0000-0000-0000-00000000000d');
select public.test_login('00000000-0000-0000-0000-00000000000d');
select lives_ok($$select public.respond_follow_request('00000000-0000-0000-0000-00000000000a', false)$$,
  'D declines A''s request');
select is((select count(*)::int from public.follows where followee_id = '00000000-0000-0000-0000-00000000000d'),
  0, 'declining deletes the row');
select is((select count(*)::int from public.activities
   where type = 'follow_requested' and target_user_id = '00000000-0000-0000-0000-00000000000d'),
  0, 'declining deletes its follow_requested activity');

-- ================================================================ unfollow
select public.test_login('00000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.unfollow_user('00000000-0000-0000-0000-00000000000b')$$, 'A unfollows B');
select is((select count(*)::int from public.follows where followee_id = '00000000-0000-0000-0000-00000000000b'),
  0, 'the follow row is gone');
select is((select count(*)::int from public.activities
   where type = 'followed' and target_user_id = '00000000-0000-0000-0000-00000000000b'),
  0, 'the followed activity is gone');
select lives_ok($$select public.unfollow_user('00000000-0000-0000-0000-00000000000b')$$,
  'unfollowing again is a no-op');

-- Cancelling a pending request: the row and its follow_requested activity go.
select public.follow_user('00000000-0000-0000-0000-00000000000d');
select lives_ok($$select public.unfollow_user('00000000-0000-0000-0000-00000000000d')$$,
  'A cancels a pending request');
select is((select count(*)::int from public.follows where followee_id = '00000000-0000-0000-0000-00000000000d')
   + (select count(*)::int from public.activities
      where type = 'follow_requested' and target_user_id = '00000000-0000-0000-0000-00000000000d'),
  0, 'cancelling removes the requested row and its follow_requested activity');

-- Unfollowing after an accepted request also removes the owner's follow_accepted activity.
select public.test_login('00000000-0000-0000-0000-00000000000e');
select public.follow_user('00000000-0000-0000-0000-00000000000d');
select public.test_login('00000000-0000-0000-0000-00000000000d');
select public.respond_follow_request('00000000-0000-0000-0000-00000000000e', true);
select public.test_login('00000000-0000-0000-0000-00000000000e');
select public.unfollow_user('00000000-0000-0000-0000-00000000000d');
-- The activity is D's, so count it as the superuser (E cannot read it).
reset role;
select is((select count(*)::int from public.activities
   where type = 'follow_accepted' and target_user_id = '00000000-0000-0000-0000-00000000000e'),
  0, 'unfollowing removes the follow_accepted activity about that follow');
set local role authenticated;

-- ================================================================ blocks, either way
reset role;
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000e'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.follow_user('00000000-0000-0000-0000-00000000000e')$$,
  'P0001', 'profile_unavailable', 'A blocked E, so A cannot follow E');
select throws_ok($$select public.follow_user('00000000-0000-0000-0000-00000000000b')$$,
  'P0001', 'profile_unavailable', 'B blocked A, so A cannot follow B');
select public.test_login('00000000-0000-0000-0000-00000000000e');
select throws_ok($$select public.follow_user('00000000-0000-0000-0000-00000000000a')$$,
  'P0001', 'profile_unavailable', 'A blocked E, so E cannot follow A');

-- Accepting across a block is refused (declining still cleans up).
reset role;
insert into public.follows (follower_id, followee_id, status) values
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000d', 'requested');
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000e');
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000d');
select throws_ok($$select public.respond_follow_request('00000000-0000-0000-0000-00000000000e', true)$$,
  'P0001', 'profile_unavailable', 'accepting a request from someone D blocked raises profile_unavailable');
select is((select status::text from public.follows
   where follower_id = '00000000-0000-0000-0000-00000000000e' and followee_id = '00000000-0000-0000-0000-00000000000d'),
  'requested', 'and the request is still requested');
select lives_ok($$select public.respond_follow_request('00000000-0000-0000-0000-00000000000e', false)$$,
  'D can still decline it');

-- ================================================================ no profile / signed out
select public.test_login('00000000-0000-0000-0000-00000000000f');
select throws_ok($$select public.follow_user('00000000-0000-0000-0000-00000000000b')$$,
  'P0001', 'profile_not_found', 'someone without a profile cannot follow');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.follow_user('00000000-0000-0000-0000-00000000000b')$$,
  '42501', 'not_authenticated', 'no user id in the token raises not_authenticated');

-- ================================================================ private -> public approves requests
reset role;
insert into public.follows (follower_id, followee_id, status) values
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 'requested'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000c', 'requested');
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000c');
update public.profiles set visibility = 'public' where id = '00000000-0000-0000-0000-00000000000c';
select is((select count(*)::int from public.follows
   where followee_id = '00000000-0000-0000-0000-00000000000c' and status = 'requested'),
  0, 'going public approves every pending request');
select is((select count(*)::int from public.follows
   where followee_id = '00000000-0000-0000-0000-00000000000c' and status = 'active'),
  3, 'and they are now active (A, B and E)');
select is((select count(*)::int from public.activities where type = 'follow_accepted'), 1,
  'approving by going public writes no activities (only the earlier accept remains)');
update public.profiles set visibility = 'private' where id = '00000000-0000-0000-0000-00000000000c';
select is((select count(*)::int from public.follows
   where followee_id = '00000000-0000-0000-0000-00000000000c' and status = 'active'),
  3, 'going private leaves existing followers active');

-- ================================================================ direct writes are closed
select public.test_login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$
  insert into public.follows (follower_id, followee_id)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000e')
$$, '42501', null, 'a direct insert into follows is refused');
select throws_ok($$update public.follows set status = 'active' where follower_id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'a direct update of follows is refused');
select throws_ok($$delete from public.follows where follower_id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'a direct delete from follows is refused');

-- ================================================================ who can read what
select is((select count(*)::int from public.follows
   where follower_id = '00000000-0000-0000-0000-00000000000b' and followee_id = '00000000-0000-0000-0000-00000000000c'),
  0, 'a third person cannot see a follow row between two others');
select is((select count(*)::int from public.follows), 1,
  'A sees only the follow rows they are part of (A follows C)');
select is((select count(*)::int from public.activities where actor_id <> '00000000-0000-0000-0000-00000000000a'), 0,
  'select * from activities returns only A''s own');

select * from finish();
rollback;
