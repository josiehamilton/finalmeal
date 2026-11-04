begin;
create extension if not exists pgtap with schema extensions;

select plan(173);

-- Activity fan-out, in-app notifications, preferences, push tokens and the push queue.
-- The fan-out is a deferred constraint trigger, so it runs at commit; in this transaction each
-- action is followed by `set constraints all immediate; set constraints all deferred;` to run
-- the queued triggers (deferred again afterwards, so a swap's two activities are both written
-- before the trigger looks at them, as in production). The dev seed is deleted first and comes
-- back when this transaction rolls back.
-- Users: A = ...0a Alice, B = ...0b Bob, C = ...0c Carol, D = ...0d Dave (all public),
--        E = ...0e Erin (private), F = ...0f Finn (public). Tokens: B, C and D (not A, E, F).
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
  ('00000000-0000-0000-0000-00000000000c', 'user_c', 'Carol', 'public'),
  ('00000000-0000-0000-0000-00000000000d', 'user_d', 'Dave', 'public'),
  ('00000000-0000-0000-0000-00000000000e', 'user_e', 'Erin', 'private'),
  ('00000000-0000-0000-0000-00000000000f', 'user_f', 'Finn', 'public');
insert into public.places (id, source, name, city, country, location) values
  ('10000000-0000-0000-0000-0000000000a1', 'custom', 'Fan Out Kitchen', 'Vancouver', 'CA',
   'SRID=4326;POINT(-123.1 49.28)');

create function public.test_login(p_uid uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create function public.test_pick(p_uid uuid, p_dish text)
returns uuid
language sql
as $$
  select k.id from public.picks k join public.dishes d on d.id = k.dish_id
  where k.user_id = p_uid and d.name = p_dish;
$$;

-- How many push_outbox rows / notifications a person has for activities of one type.
create function public.test_pushes(p_uid uuid, p_type public.activity_type)
returns integer
language sql
as $$
  select count(*)::int from public.push_outbox o join public.activities a on a.id = o.activity_id
  where o.user_id = p_uid and a.type = p_type;
$$;

create function public.test_notes(p_uid uuid, p_type public.activity_type)
returns integer
language sql
as $$
  select count(*)::int from public.notifications n join public.activities a on a.id = n.activity_id
  where n.user_id = p_uid and a.type = p_type;
$$;

-- ---------------------------------------------------------------- structure
select has_table('public', 'notification_preferences', 'notification_preferences exists');
select has_table('public', 'push_outbox', 'push_outbox exists');
select has_function('public', 'register_push_token', array['text', 'text'], 'register_push_token exists');
select has_function('public', 'unregister_push_token', array['text'], 'unregister_push_token exists');
select has_function('public', 'mark_notifications_read', array['uuid[]'], 'mark_notifications_read exists');
select has_function('public', 'unread_notification_count', 'unread_notification_count exists');
select has_function('public', 'get_my_notifications', array['timestamp with time zone', 'integer'],
  'get_my_notifications exists');
select has_function('public', 'claim_push_batch', array['integer'], 'claim_push_batch exists');
select has_function('public', 'finish_push_batch', array['uuid[]', 'text', 'text'], 'finish_push_batch exists');
select has_trigger('public', 'activities', 'activities_fan_out', 'the fan-out trigger exists');
select ok(exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'),
  'notifications is in the realtime publication');

-- ---------------------------------------------------------------- preferences
select is((select count(*)::int from public.notification_preferences), 6,
  'every new profile got a preferences row');
select is((select push_dethroned and push_new_followers and push_saves and push_friends_finals
    from public.notification_preferences where user_id = '00000000-0000-0000-0000-00000000000a'),
  true, 'the four push preferences default to on');

-- ---------------------------------------------------------------- push text
select is((select body from public._push_text('followed', 'Alice', null, null, null)),
  'Alice started following you.', 'followed text');
select is((select title from public._push_text('followed', 'Alice', null, null, null)),
  'Final Meal', 'the title is Final Meal');
select is((select body from public._push_text('follow_requested', 'Alice', null, null, null)),
  'Alice wants to follow you.', 'follow_requested text');
select is((select body from public._push_text('follow_accepted', 'Alice', null, null, null)),
  'Alice approved your follow request.', 'follow_accepted text');
select is((select body from public._push_text('saved_pick', 'Alice', 'Ramen', null, null)),
  'Alice saved your Ramen.', 'saved_pick text');
select is((select body from public._push_text('saved_from_list', 'Alice', null, null, 'Best Eats')),
  'Alice saved picks from your list Best Eats.', 'saved_from_list text');
select is((select body from public._push_text('saved_from_list', 'Alice', null, null, null)),
  'Alice saved picks from your list.', 'saved_from_list text without a title has no dangling space');
select is((select body from public._push_text('dethroned', 'Alice', 'New', 'Old', null)),
  'Alice dethroned Old with New on their Final Meal.', 'dethroned text');
select is((select body from public._push_text('added_final', 'Alice', 'Ramen', null, null)),
  'Alice added Ramen to their Final Meal.', 'added_final text');
select is((select body from public._push_text('promoted', 'Alice', 'Ramen', null, null)),
  'Alice promoted Ramen to their Final Meal.', 'promoted text');

-- ---------------------------------------------------------------- push tokens
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000b');
select lives_ok($$select public.register_push_token('ExponentPushToken[bbb]', 'ios')$$,
  'B registers a token');
select lives_ok($$select public.register_push_token('ExponentPushToken[bbb]', 'ios')$$,
  'B registers the same token again');
select lives_ok($$select public.register_push_token('ExpoPushToken[old-style]', 'android')$$,
  'the older ExpoPushToken spelling is accepted');
select is((select count(*)::int from public.push_tokens where expo_token = 'ExponentPushToken[bbb]'), 1,
  'registering twice leaves one row');
select is((select count(*)::int from public.push_tokens), 2, 'B sees only B''s own tokens');
select throws_ok($$select public.register_push_token('not-a-token', 'ios')$$,
  'P0001', 'invalid_push_token', 'a malformed token is refused');
select throws_ok($$select public.register_push_token('ExponentPushToken[]', 'ios')$$,
  'P0001', 'invalid_push_token', 'an empty token body is refused');
select throws_ok($$select public.register_push_token('ExponentPushToken[' || repeat('x', 600) || ']', 'ios')$$,
  'P0001', 'invalid_push_token', 'a token over 512 characters is refused');
select throws_ok($$select public.register_push_token('ExponentPushToken[x]', 'web')$$,
  'P0001', 'invalid_push_token', 'an unknown platform is refused');
select throws_ok($$insert into public.push_tokens (user_id, expo_token) values
    ('00000000-0000-0000-0000-00000000000b', 'ExponentPushToken[direct]')$$,
  '42501', null, 'tokens cannot be inserted directly');
select throws_ok($$update public.push_tokens set platform = 'ios'$$,
  '42501', null, 'tokens cannot be updated directly');
select throws_ok($$delete from public.push_tokens$$,
  '42501', null, 'tokens cannot be deleted directly');

-- The same phone, signed in as C: the token moves.
select public.test_login('00000000-0000-0000-0000-00000000000c');
select lives_ok($$select public.register_push_token('ExponentPushToken[bbb]', 'android')$$,
  'C signs in on the same phone');
select is((select count(*)::int from public.push_tokens where expo_token = 'ExponentPushToken[bbb]'), 1,
  'the shared token is still one row');
select is((select user_id from public.push_tokens where expo_token = 'ExponentPushToken[bbb]'),
  '00000000-0000-0000-0000-00000000000c'::uuid, 'the token moved to C');
select is((select platform from public.push_tokens where expo_token = 'ExponentPushToken[bbb]'),
  'android', 'and took the new platform');

select public.test_login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.push_tokens where expo_token = 'ExponentPushToken[bbb]'), 0,
  'B no longer sees the moved token');
select lives_ok($$select public.unregister_push_token('ExponentPushToken[bbb]')$$,
  'B unregistering a token that is now C''s does nothing');
select public.test_login('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.push_tokens where expo_token = 'ExponentPushToken[bbb]'), 1,
  'C still has it');
select lives_ok($$select public.unregister_push_token('ExponentPushToken[bbb]')$$, 'C unregisters it');
select is((select count(*)::int from public.push_tokens), 0, 'C has no tokens left');

-- Tokens for the people who will receive pushes: B, C and D.
select public.test_login('00000000-0000-0000-0000-00000000000b');
select public.unregister_push_token('ExpoPushToken[old-style]');
select public.register_push_token('ExponentPushToken[bbb]', 'ios');
select public.test_login('00000000-0000-0000-0000-00000000000c');
select public.register_push_token('ExponentPushToken[ccc]', 'ios');
select public.test_login('00000000-0000-0000-0000-00000000000d');
select public.register_push_token('ExponentPushToken[ddd]', 'android');
reset role;

-- ---------------------------------------------------------------- follows: notification + push
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.follow_user('00000000-0000-0000-0000-00000000000b');
select public.follow_user('00000000-0000-0000-0000-00000000000e');
reset role;
set constraints all immediate;
set constraints all deferred;

select is(public.test_notes('00000000-0000-0000-0000-00000000000b', 'followed'), 1,
  'A following B gives B one notification');
select is((select count(*)::int from public.notifications
    where user_id = '00000000-0000-0000-0000-00000000000b' and read_at is null), 1,
  'and it is unread');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000b', 'followed'), 1,
  'B has a token, so one push is queued');
select is((select body from public.push_outbox where user_id = '00000000-0000-0000-0000-00000000000b'),
  'Alice started following you.', 'the push text names Alice');
select is((select title from public.push_outbox where user_id = '00000000-0000-0000-0000-00000000000b'),
  'Final Meal', 'the push title is Final Meal');
select is((select status from public.push_outbox where user_id = '00000000-0000-0000-0000-00000000000b'),
  'pending', 'the push starts pending');
select is((select data from public.push_outbox where user_id = '00000000-0000-0000-0000-00000000000b'),
  '{"type": "followed", "userId": "00000000-0000-0000-0000-00000000000a"}'::jsonb,
  'the push data carries the type and the actor');
select is((select n.created_at = a.created_at from public.notifications n
    join public.activities a on a.id = n.activity_id
    where n.user_id = '00000000-0000-0000-0000-00000000000b'),
  true, 'the notification takes the activity''s time');
select is(public.test_notes('00000000-0000-0000-0000-00000000000e', 'follow_requested'), 1,
  'a follow request notifies the private account');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000e', 'follow_requested'), 0,
  'but E has no token, so nothing is queued');
select is(public.test_notes('00000000-0000-0000-0000-00000000000a', 'followed'), 0,
  'the actor is never notified');

-- A re-follow within 24 hours queues no second push
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.unfollow_user('00000000-0000-0000-0000-00000000000b');
reset role;
select is(public.test_notes('00000000-0000-0000-0000-00000000000b', 'followed'), 0,
  'unfollowing removes the notification');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000b', 'followed'), 0,
  'and the queued push');
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.follow_user('00000000-0000-0000-0000-00000000000b');
reset role;
set constraints all immediate;
set constraints all deferred;
select is(public.test_notes('00000000-0000-0000-0000-00000000000b', 'followed'), 1,
  'a re-follow notifies again');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000b', 'followed'), 0,
  'but within 24 hours it queues no second push');

-- After the 24 hours it does
update public.follow_push_log set last_pushed_at = now() - interval '25 hours';
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.unfollow_user('00000000-0000-0000-0000-00000000000b');
select public.follow_user('00000000-0000-0000-0000-00000000000b');
reset role;
set constraints all immediate;
set constraints all deferred;
select is(public.test_pushes('00000000-0000-0000-0000-00000000000b', 'followed'), 1,
  'a re-follow after 24 hours queues a push again');

-- With the preference off: notification yes, push no
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000b');
update public.notification_preferences set push_new_followers = false;
select public.test_login('00000000-0000-0000-0000-00000000000d');
select public.follow_user('00000000-0000-0000-0000-00000000000b');
reset role;
set constraints all immediate;
set constraints all deferred;
select is(public.test_notes('00000000-0000-0000-0000-00000000000b', 'followed'), 2,
  'with push_new_followers off, B still gets the notification');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000b', 'followed'), 1,
  'but no new push is queued');
update public.notification_preferences set push_new_followers = true
where user_id = '00000000-0000-0000-0000-00000000000b';

-- ---------------------------------------------------------------- preferences are the owner's
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.notification_preferences), 1,
  'B sees only B''s own preferences');
select lives_ok($$update public.notification_preferences set push_saves = false$$,
  'B can change a preference');
select is((select push_saves from public.notification_preferences), false, 'and it stuck');
select throws_ok($$update public.notification_preferences
    set user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'B cannot change whose preferences these are');
select throws_ok($$insert into public.notification_preferences (user_id)
    values ('00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'preferences cannot be inserted directly');
select throws_ok($$delete from public.notification_preferences$$,
  '42501', null, 'preferences cannot be deleted directly');
reset role;
select is((select push_saves from public.notification_preferences
    where user_id = '00000000-0000-0000-0000-00000000000a'),
  true, 'A''s preferences were not touched');
update public.notification_preferences set push_saves = true
where user_id = '00000000-0000-0000-0000-00000000000b';

-- ---------------------------------------------------------------- saves
-- B's pick (added through add_pick, which writes added_honorable: nobody is notified of that).
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000b');
select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Bob Ramen', 'honorable');
reset role;
set constraints all immediate;
set constraints all deferred;
select is((select count(*)::int from public.notifications n join public.activities a on a.id = n.activity_id
    where a.type = 'added_honorable'), 0, 'an added_honorable activity notifies nobody');

insert into public.activities (actor_id, type, pick_id) values
  ('00000000-0000-0000-0000-00000000000c', 'saved_pick',
   public.test_pick('00000000-0000-0000-0000-00000000000b', 'Bob Ramen')),
  ('00000000-0000-0000-0000-00000000000b', 'saved_pick',
   public.test_pick('00000000-0000-0000-0000-00000000000b', 'Bob Ramen'));
insert into public.shared_lists (id, owner_id, slug, title)
values ('50000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'bobs-eats', 'Bob''s Eats');
insert into public.activities (actor_id, type, list_id)
values ('00000000-0000-0000-0000-00000000000c', 'saved_from_list', '50000000-0000-0000-0000-0000000000b1');
set constraints all immediate;
set constraints all deferred;
select is(public.test_notes('00000000-0000-0000-0000-00000000000b', 'saved_pick'), 1,
  'a save notifies the pick''s owner once (not when the owner saves their own pick)');
select is((select body from public.push_outbox o join public.activities a on a.id = o.activity_id
    where a.type = 'saved_pick'), 'Carol saved your Bob Ramen.', 'the saved_pick push names the saver and the dish');
select is(public.test_notes('00000000-0000-0000-0000-00000000000c', 'saved_pick'), 0,
  'the saver is not notified');
select is(public.test_notes('00000000-0000-0000-0000-00000000000b', 'saved_from_list'), 1,
  'saving from a list notifies the list''s owner');
select is((select body from public.push_outbox o join public.activities a on a.id = o.activity_id
    where a.type = 'saved_from_list'),
  'Carol saved picks from your list Bob''s Eats.', 'the saved_from_list push names the list');

-- push_saves off: notification, no push
update public.notification_preferences set push_saves = false
where user_id = '00000000-0000-0000-0000-00000000000b';
insert into public.activities (actor_id, type, pick_id)
values ('00000000-0000-0000-0000-00000000000d', 'saved_pick',
        public.test_pick('00000000-0000-0000-0000-00000000000b', 'Bob Ramen'));
set constraints all immediate;
set constraints all deferred;
select is(public.test_notes('00000000-0000-0000-0000-00000000000b', 'saved_pick'), 2,
  'with push_saves off the notification is still written');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000b', 'saved_pick'), 1,
  'but no second push is queued');
update public.notification_preferences set push_saves = true
where user_id = '00000000-0000-0000-0000-00000000000b';

-- ---------------------------------------------------------------- finals, swaps, promotions
-- A fills five finals before anyone follows A, so those add no pushes.
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Dish ' || n, 'final')
from generate_series(1, 5) n;
reset role;
set constraints all immediate;
set constraints all deferred;
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000c');
select public.follow_user('00000000-0000-0000-0000-00000000000a');
select public.test_login('00000000-0000-0000-0000-00000000000d');
select public.follow_user('00000000-0000-0000-0000-00000000000a');
reset role;
set constraints all immediate;
set constraints all deferred;
select is(public.test_notes('00000000-0000-0000-0000-00000000000c', 'added_final'), 0,
  'before C followed, the five finals notified nobody');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000c', 'added_final'), 0,
  'and queued nothing for C');

-- A swap: added_final + dethroned in one transaction
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Dish New', 'final', null, '{}', '{}', null, 5);
reset role;
set constraints all immediate;
set constraints all deferred;
select is(public.test_notes('00000000-0000-0000-0000-00000000000c', 'dethroned'), 1,
  'a swap gives C one dethroned notification');
select is(public.test_notes('00000000-0000-0000-0000-00000000000c', 'added_final'), 0,
  'and no added_final notification');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000c', 'dethroned'), 1,
  'a swap queues one dethroned push for C');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000c', 'added_final'), 0,
  'and no added_final push (the swap shows once)');
select is((select body from public.push_outbox o join public.activities a on a.id = o.activity_id
    where a.type = 'dethroned' and o.user_id = '00000000-0000-0000-0000-00000000000c'),
  'Alice dethroned Dish 5 with Dish New on their Final Meal.', 'the dethroned push names both dishes');
select is((select data->>'pickId' from public.push_outbox o join public.activities a on a.id = o.activity_id
    where a.type = 'dethroned' and o.user_id = '00000000-0000-0000-0000-00000000000c'),
  public.test_pick('00000000-0000-0000-0000-00000000000a', 'Dish New')::text,
  'the push data names the new pick');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000d', 'dethroned'), 1,
  'D, also following A, gets the swap push too');

-- A plain added_final: no in-app row, one push
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.remove_pick(public.test_pick('00000000-0000-0000-0000-00000000000a', 'Dish 4'));
select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Plain Final', 'final');
reset role;
set constraints all immediate;
set constraints all deferred;
select is(public.test_notes('00000000-0000-0000-0000-00000000000c', 'added_final'), 0,
  'a plain added_final gives C no notification (the feed covers it)');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000c', 'added_final'), 1,
  'but one push');
select is((select body from public.push_outbox o join public.activities a on a.id = o.activity_id
    where a.type = 'added_final' and o.user_id = '00000000-0000-0000-0000-00000000000c'),
  'Alice added Plain Final to their Final Meal.', 'the added_final push text');

-- A promotion
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.demote_pick(public.test_pick('00000000-0000-0000-0000-00000000000a', 'Plain Final'));
select public.promote_pick(public.test_pick('00000000-0000-0000-0000-00000000000a', 'Plain Final'));
reset role;
set constraints all immediate;
set constraints all deferred;
select is(public.test_pushes('00000000-0000-0000-0000-00000000000c', 'promoted'), 1,
  'a plain promotion queues one push');
select is((select body from public.push_outbox o join public.activities a on a.id = o.activity_id
    where a.type = 'promoted' and o.user_id = '00000000-0000-0000-0000-00000000000c'),
  'Alice promoted Plain Final to their Final Meal.', 'the promoted push text');

-- push_friends_finals off for C
update public.notification_preferences set push_friends_finals = false
where user_id = '00000000-0000-0000-0000-00000000000c';
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.demote_pick(public.test_pick('00000000-0000-0000-0000-00000000000a', 'Plain Final'));
select public.promote_pick(public.test_pick('00000000-0000-0000-0000-00000000000a', 'Plain Final'));
reset role;
set constraints all immediate;
set constraints all deferred;
select is(public.test_pushes('00000000-0000-0000-0000-00000000000c', 'promoted'), 1,
  'with push_friends_finals off C gets no further promoted push');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000d', 'promoted'), 2,
  'D, with it on, got both');

-- ---------------------------------------------------------------- blocks
insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.demote_pick(public.test_pick('00000000-0000-0000-0000-00000000000a', 'Plain Final'));
select public.promote_pick(public.test_pick('00000000-0000-0000-0000-00000000000a', 'Plain Final'));
reset role;
set constraints all immediate;
set constraints all deferred;
select is(public.test_pushes('00000000-0000-0000-0000-00000000000d', 'promoted'), 2,
  'D blocked A, so D gets no further promoted push');
delete from public.blocks;

-- ---------------------------------------------------------------- reading notifications
-- C's list: the dethroned row has both dish names.
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.get_my_notifications()), 1, 'C has one notification');
select is((select type::text from public.get_my_notifications()), 'dethroned', 'and it is the swap');
select is((select dish_name from public.get_my_notifications()), 'Dish New', 'dish_name is the new dish');
select is((select other_dish_name from public.get_my_notifications()), 'Dish 5',
  'other_dish_name is the replaced dish');
select is((select actor_username from public.get_my_notifications()), 'user_a', 'the actor''s username');
select is((select actor_display_name from public.get_my_notifications()), 'Alice', 'the actor''s name');
select is((select viewer_follow from public.get_my_notifications()), 'active', 'C follows A');
select is((select request_pending from public.get_my_notifications()), false, 'a swap is not a pending request');

-- E's pending request, then approved
select public.test_login('00000000-0000-0000-0000-00000000000e');
select is((select type::text from public.get_my_notifications()), 'follow_requested',
  'E has A''s request');
select is((select request_pending from public.get_my_notifications()), true,
  'and it is still pending');
select public.respond_follow_request('00000000-0000-0000-0000-00000000000a', true);
select is((select request_pending from public.get_my_notifications()), false,
  'after approval it is not pending');
reset role;
set constraints all immediate;
set constraints all deferred;
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.get_my_notifications() where type = 'follow_accepted'), 1,
  'A is told E approved');

-- Paging and limits
select public.test_login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.get_my_notifications(null, 1)), 1, 'p_limit 1 returns one row');
select is((select count(*)::int from public.get_my_notifications(null, 500)), 5,
  'a big p_limit is capped, here by the 5 rows B has');
select is((select count(*)::int from public.get_my_notifications(now() - interval '1 day', 20)), 0,
  'p_before filters to older rows');

-- Mark read
select is(public.unread_notification_count(), 5, 'B has 5 unread');
select lives_ok($$select public.mark_notifications_read(array[(select id from public.get_my_notifications(null, 1))])$$,
  'B marks one read');
select is(public.unread_notification_count(), 4, 'now 4 unread');
select lives_ok($$select public.mark_notifications_read(null)$$, 'B marks all read');
select is(public.unread_notification_count(), 0, 'the unread count is 0');
select is((select count(*)::int from public.notifications where read_at is null), 0,
  'every read_at is set');

-- A cannot mark B's rows
select public.test_login('00000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.mark_notifications_read(null)$$, 'A marking read touches only A''s rows');
reset role;
select is((select count(*)::int from public.notifications
    where user_id = '00000000-0000-0000-0000-00000000000b' and read_at is not null), 5,
  'B''s rows keep their read_at');

-- Direct updates are closed
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$update public.notifications set activity_id = '60000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'activity_id cannot be updated directly');
select throws_ok($$update public.notifications set read_at = null$$,
  '42501', null, 'read_at cannot be updated directly either');
select throws_ok($$delete from public.notifications$$, '42501', null, 'notifications cannot be deleted directly');

-- A block hides the actor's notifications and the count
reset role;
update public.notifications set read_at = null where user_id = '00000000-0000-0000-0000-00000000000b';
insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.get_my_notifications() where actor_username = 'user_a'), 0,
  'a blocked actor''s notifications are left out');
select is(public.unread_notification_count(), 4, 'and left out of the unread count');
reset role;
delete from public.blocks;

-- ---------------------------------------------------------------- swaps by promote_pick
-- A has five finals and an honorable (Dish 5); promoting it into slot 3 writes promoted +
-- dethroned for the same pick, so followers get the dethroned only.
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.promote_pick(public.test_pick('00000000-0000-0000-0000-00000000000a', 'Dish 5'), 3);
reset role;
set constraints all immediate;
set constraints all deferred;
select is(public.test_notes('00000000-0000-0000-0000-00000000000c', 'dethroned'), 2, 'a promote_pick swap gives C a dethroned notification');
select is(public.test_notes('00000000-0000-0000-0000-00000000000c', 'promoted'), 0, 'and no promoted notification');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000d', 'dethroned'), 2, 'D gets one dethroned push for it');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000d', 'promoted'), 2, 'and no promoted push (still the two from before)');

-- ---------------------------------------------------------------- blocks, both directions
-- D blocks A: A's next swap writes nothing for D, and C (no block) still gets it.
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Block Swap 1', 'final', null, '{}', '{}', null, 1);
reset role;
set constraints all immediate;
set constraints all deferred;
select is(public.test_notes('00000000-0000-0000-0000-00000000000d', 'dethroned'), 2, 'D blocked A: no new dethroned notification for D');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000d', 'dethroned'), 2, 'and no new dethroned push');
select is(public.test_notes('00000000-0000-0000-0000-00000000000c', 'dethroned'), 3, 'C, with no block, still gets the swap');
delete from public.blocks;

-- A blocks D: the other direction.
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000d');
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');
select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Block Swap 2', 'final', null, '{}', '{}', null, 2);
reset role;
set constraints all immediate;
set constraints all deferred;
select is(public.test_notes('00000000-0000-0000-0000-00000000000d', 'dethroned'), 2, 'A blocked D: no new dethroned notification for D either');
select is(public.test_pushes('00000000-0000-0000-0000-00000000000d', 'dethroned'), 2, 'and no new dethroned push');
select is(public.test_notes('00000000-0000-0000-0000-00000000000c', 'dethroned'), 4, 'C still gets it');
insert into public.activities (actor_id, type, pick_id)
values ('00000000-0000-0000-0000-00000000000d', 'saved_pick', public.test_pick('00000000-0000-0000-0000-00000000000a', 'Plain Final'));
set constraints all immediate;
set constraints all deferred;
select is(public.test_notes('00000000-0000-0000-0000-00000000000a', 'saved_pick'), 0, 'a save by someone A blocked notifies A of nothing');
delete from public.blocks;

-- ---------------------------------------------------------------- a private account's swap
-- C follows E (private) with approval; E swaps a final; then C unfollows.
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000c');
select public.follow_user('00000000-0000-0000-0000-00000000000e');
select public.test_login('00000000-0000-0000-0000-00000000000e');
select public.respond_follow_request('00000000-0000-0000-0000-00000000000c', true);
select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'E Dish ' || n, 'final')
from generate_series(1, 5) n;
reset role;
set constraints all immediate;
set constraints all deferred;
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000e');
select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'E New', 'final', null, '{}', '{}', null, 5);
reset role;
set constraints all immediate;
set constraints all deferred;
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000c');
select is((select dish_name from public.get_my_notifications(null, 50)
    where actor_username = 'user_e' and type = 'dethroned'),
  'E New', 'an active follower sees the private account''s new dish');
select is((select other_dish_name from public.get_my_notifications(null, 50)
    where actor_username = 'user_e' and type = 'dethroned'),
  'E Dish 5', 'and the replaced one');
select is(public.unread_notification_count(),
  (select count(*)::int from public.get_my_notifications(null, 50) where read_at is null),
  'the unread count matches the list');
select public.unfollow_user('00000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.get_my_notifications(null, 50)
    where actor_username = 'user_e' and type = 'dethroned'), 0,
  'after unfollowing a private account its swap notification is left out');
select is((select count(*)::int from public.get_my_notifications(null, 50)
    where actor_username = 'user_e' and (dish_name is not null or other_dish_name is not null or photo_path is not null or pick_id is not null)), 0,
  'and no pick details of it come back on any row');
select is(public.unread_notification_count(),
  (select count(*)::int from public.get_my_notifications(null, 50) where read_at is null),
  'the unread count still matches the list');
select is((select count(*)::int from public.get_my_notifications(null, 50)
    where actor_username = 'user_a' and type = 'dethroned'), 4, 'A''s public swaps are still listed');
reset role;

-- ---------------------------------------------------------------- the 50 cap
insert into public.activities (actor_id, type, target_user_id)
select '00000000-0000-0000-0000-00000000000e', 'followed', '00000000-0000-0000-0000-00000000000b' from generate_series(1, 60);
set constraints all immediate;
set constraints all deferred;
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.get_my_notifications(null, 500)), 50,
  'p_limit is capped at 50 (B has more than 60 rows)');
select is((select count(*)::int from public.get_my_notifications()), 20, 'the default page is 20');
reset role;

-- ---------------------------------------------------------------- deleted before commit
-- An activity removed in the same transaction (a quick follow then unfollow) leaves no trace.
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000f');
select public.follow_user('00000000-0000-0000-0000-00000000000b');
select public.unfollow_user('00000000-0000-0000-0000-00000000000b');
reset role;
set constraints all immediate;
set constraints all deferred;
select is((select count(*)::int from public.notifications n join public.activities a on a.id = n.activity_id
    where a.actor_id = '00000000-0000-0000-0000-00000000000f'), 0,
  'a follow undone before commit leaves no notification');

-- ---------------------------------------------------------------- the push queue
select ok(not has_table_privilege('authenticated', 'public.push_outbox', 'select'),
  'authenticated cannot read push_outbox');
select ok(not has_table_privilege('anon', 'public.push_outbox', 'select'),
  'anon cannot read push_outbox');
select ok(not has_function_privilege('authenticated', 'public.claim_push_batch(integer)', 'execute'),
  'authenticated cannot claim a batch');
select ok(not has_function_privilege('authenticated', 'public.finish_push_batch(uuid[], text, text)', 'execute'),
  'authenticated cannot finish a batch');
select ok(not has_function_privilege('anon', 'public.claim_push_batch(integer)', 'execute'),
  'anon cannot claim a batch');
select ok(has_function_privilege('service_role', 'public.claim_push_batch(integer)', 'execute'),
  'service_role can claim a batch');
select ok(has_function_privilege('service_role', 'public.finish_push_batch(uuid[], text, text)', 'execute'),
  'service_role can finish a batch');
select ok(not has_function_privilege('authenticated', 'public._fan_out_activity()', 'execute'),
  'the fan-out function is not callable by clients');
select ok(not has_function_privilege('authenticated', 'public._push_still_wanted(uuid, uuid)', 'execute'),
  'the still-wanted check is not callable by clients');
select ok(not has_function_privilege('anon', 'public.register_push_token(text, text)', 'execute'),
  'anon cannot register a token');
select ok(not has_function_privilege('anon', 'public.get_my_notifications(timestamp with time zone, integer)', 'execute'),
  'anon cannot read notifications');

set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$select * from public.push_outbox$$, '42501', null, 'a signed-in person cannot read push_outbox');
select throws_ok($$select * from public.claim_push_batch(10)$$, '42501', null, 'nor claim a batch');
reset role;

-- The sender re-checks blocks and preferences when it claims: D blocks A now, and C turned
-- push_friends_finals off after some of C's pushes were queued.
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000a');
create temp table pending_before as
  select count(*)::int as n,
         count(*) filter (where public._push_still_wanted(user_id, activity_id))::int as live
  from public.push_outbox where status = 'pending';
select ok((select live from pending_before) < (select n from pending_before),
  'some queued pushes are no longer wanted');
select is((select n from pending_before), (select count(*)::int from public.push_outbox),
  'every queued push is pending before a claim');
create temp table claimed on commit drop as select * from public.claim_push_batch(2);
select is((select count(*)::int from claimed), 2, 'claim_push_batch(2) returns two rows');
select is((select count(*)::int from public.push_outbox where status = 'sending' and attempts = 1), 2,
  'the claimed rows are sending with attempts 1');
select ok((select max(created_at) from claimed) <=
    (select min(created_at) from public.push_outbox where status = 'pending'),
  'the oldest rows are claimed first');
select lives_ok($$select public.finish_push_batch((select array_agg(id) from claimed), 'sent', 'log')$$,
  'finish_push_batch marks the rows');
select is((select count(*)::int from public.push_outbox where status = 'sent' and sender = 'log' and sent_at is not null), 2,
  'they are sent, with the sender and a sent_at');
select is((select count(*)::int from public.claim_push_batch(1000)), (select live - 2 from pending_before),
  'a second claim takes only the pushes still wanted');
select is((select count(*)::int from public.push_outbox where status = 'skipped' and attempts = 0),
  (select n - live from pending_before), 'the rest are skipped, never attempted');
select ok(exists (select 1 from public.push_outbox o join public.activities a on a.id = o.activity_id
    where o.status = 'skipped' and o.user_id = '00000000-0000-0000-0000-00000000000d' and a.actor_id = '00000000-0000-0000-0000-00000000000a'),
  'a push to someone who has since blocked the actor is skipped');
select ok(exists (select 1 from public.push_outbox o join public.activities a on a.id = o.activity_id
    where o.status = 'skipped' and o.user_id = '00000000-0000-0000-0000-00000000000c' and a.type in ('added_final', 'promoted')),
  'a push whose preference was switched off after queueing is skipped');
select is((select count(*)::int from public.claim_push_batch(1000)), 0, 'and then there is nothing left to claim');
select ok(exists (select 1 from public.push_outbox o join public.activities a on a.id = o.activity_id
    where o.status = 'skipped' and o.user_id = '00000000-0000-0000-0000-00000000000c'
      and a.type = 'dethroned' and a.actor_id = '00000000-0000-0000-0000-00000000000e'),
  'a swap push from a private account is skipped once the recipient can no longer see them');

-- Stale pushes at the front of the queue are passed over and the batch still fills: three
-- unwanted pushes (D blocked A) are the oldest, three wanted ones (to B) come after.
insert into public.push_outbox (user_id, activity_id, title, body, created_at)
select '00000000-0000-0000-0000-00000000000d', (select id from public.activities where actor_id = '00000000-0000-0000-0000-00000000000a' limit 1),
       'Final Meal', 'stale ' || n, now() - interval '2 days' + n * interval '1 minute'
from generate_series(1, 3) n;
insert into public.push_outbox (user_id, activity_id, title, body, created_at)
select '00000000-0000-0000-0000-00000000000b', (select id from public.activities where actor_id = '00000000-0000-0000-0000-00000000000a' limit 1),
       'Final Meal', 'live ' || n, now() - interval '1 day' + n * interval '1 minute'
from generate_series(1, 3) n;
create temp table front_claim on commit drop as select * from public.claim_push_batch(2);
select is((select array_agg(body order by body) from front_claim), array['live 1', 'live 2'],
  'the batch skips three stale rows at the head of the queue and still fills with the two oldest wanted ones');
select is((select count(*)::int from public.push_outbox where status = 'skipped' and body like 'stale %'), 3,
  'the stale rows were skipped');
select is((select count(*)::int from public.push_outbox where status = 'pending' and body like 'live %'), 1,
  'the third wanted row is still pending for the next batch');
select throws_ok($$select public.finish_push_batch('{}', 'pending', 'log')$$, 'P0001', 'invalid_push_status',
  'finish_push_batch only accepts sent or failed');

select * from finish();
rollback;
