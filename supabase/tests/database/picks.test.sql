begin;
create extension if not exists pgtap with schema extensions;

select plan(196);

-- Uses the dev seed's Marutama place and its "Tonkotsu Ramen" dish. The seeded people are
-- deleted here (their picks go with them) so nobody's existing finals get in the way; the seed
-- comes back when this transaction rolls back.
-- Users: A = ...0a (trusted), B = ...0b (new), C = ...0c (trusted), D = ...0d (trusted),
--        E = ...0e (new), F = ...0f (no profile).
delete from auth.users;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000d'),
  ('00000000-0000-0000-0000-00000000000e'),
  ('00000000-0000-0000-0000-00000000000f');
insert into public.profiles (id, username, display_name, trust_level) values
  ('00000000-0000-0000-0000-00000000000a', 'user_a', 'Alice', 'trusted'),
  ('00000000-0000-0000-0000-00000000000b', 'user_b', 'Bob', 'new'),
  ('00000000-0000-0000-0000-00000000000c', 'user_c', 'Carol', 'trusted'),
  ('00000000-0000-0000-0000-00000000000d', 'user_d', 'Dave', 'trusted'),
  ('00000000-0000-0000-0000-00000000000e', 'user_e', 'Erin', 'new');
insert into public.places (id, source, name, city, country, location) values
  ('10000000-0000-0000-0000-0000000000a1', 'custom', 'Slot Test Kitchen', 'Vancouver', 'CA',
   'SRID=4326;POINT(-123.1 49.28)'),
  ('10000000-0000-0000-0000-0000000000a2', 'custom', 'Other Test Kitchen', 'Vancouver', 'CA',
   'SRID=4326;POINT(-123.1 49.28)'),
  ('10000000-0000-0000-0000-0000000000a3', 'custom', 'Suggest Test Cafe', 'Vancouver', 'CA',
   'SRID=4326;POINT(-123.1 49.28)');
insert into public.dishes (id, place_id, name) values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1',
   'Chicken Katsu Curry Rice Bowl');

-- ---------------------------------------------------------------- test helpers (rolled back)
-- The slot-integrity invariant: a person's finals are exactly slots 1..n, no gaps and no
-- duplicates, and every honorable has no slot. Called after every operation below.
create function public.test_slots_ok(p_uid uuid, p_what text)
returns text
language plpgsql
as $$
declare
  v_slots int[];
  v_honorable_slots int;
begin
  select coalesce(array_agg(slot order by slot), '{}') into v_slots
  from public.picks where user_id = p_uid and tier = 'final';
  select count(*) into v_honorable_slots
  from public.picks where user_id = p_uid and tier = 'honorable' and slot is not null;
  return extensions.ok(
    v_slots = (select coalesce(array_agg(g), '{}') from generate_series(1, cardinality(v_slots)) g)
    and v_honorable_slots = 0,
    'slots are exactly 1..n after ' || p_what || ' (finals: ' || v_slots::text || ')');
end;
$$;

-- The finals in slot order, as the wording each pick was added with.
create function public.test_finals(p_uid uuid)
returns text
language sql
as $$
  select coalesce(string_agg(original_dish_name, ',' order by slot), '')
  from public.picks where user_id = p_uid and tier = 'final';
$$;

create function public.test_honorables(p_uid uuid)
returns text
language sql
as $$
  select coalesce(string_agg(original_dish_name, ',' order by original_dish_name), '')
  from public.picks where user_id = p_uid and tier = 'honorable';
$$;

create function public.test_pick_id(p_uid uuid, p_name text)
returns uuid
language sql
as $$
  select id from public.picks where user_id = p_uid and original_dish_name = p_name;
$$;

create function public.test_login(p_uid uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------- structure and privileges
select has_function('public', 'suggest_dishes', array['uuid', 'text', 'integer'], 'suggest_dishes exists');
select has_function('public', 'add_pick',
  array['uuid', 'uuid', 'text', 'pick_tier', 'text', 'uuid[]', 'text[]', 'text', 'integer'], 'add_pick exists');
select has_function('public', 'promote_pick', array['uuid', 'integer'], 'promote_pick exists');
select has_function('public', 'demote_pick', array['uuid'], 'demote_pick exists');
select has_function('public', 'remove_pick', array['uuid'], 'remove_pick exists');
select has_function('public', 'update_pick', array['uuid', 'text', 'uuid[]', 'text[]', 'text'], 'update_pick exists');
select has_function('public', 'move_final', array['uuid', 'integer'], 'move_final exists');
select has_view('public', 'dish_stats', 'the dish_stats view exists');
select is(
  (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
   where table_schema = 'public' and table_name = 'dish_stats'),
  array['dish_id', 'final_count', 'honorable_count', 'list_count'],
  'dish_stats has dish_id, final_count, honorable_count, list_count');
select is(
  has_function_privilege('anon',
    'public.add_pick(uuid,uuid,text,public.pick_tier,text,uuid[],text[],text,integer)', 'execute'),
  false, 'anon cannot run add_pick');
select is(
  has_function_privilege('authenticated',
    'public.add_pick(uuid,uuid,text,public.pick_tier,text,uuid[],text[],text,integer)', 'execute'),
  true, 'authenticated can run add_pick');
select is(
  has_function_privilege('authenticated', 'public._resolve_dish(uuid,uuid,text)', 'execute'),
  false, 'the internal _resolve_dish is not callable by clients');

-- ================================================================ A builds a Final Meal
reset role;
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000a');

select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Dish ' || n, 'final')
  from generate_series(1, 5) n
$$, 'A adds five finals');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 1,Dish 2,Dish 3,Dish 4,Dish 5', 'the five finals took slots 1 to 5 in order');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'adding five finals');
select is((select slot::int from public.picks where original_dish_name = 'Dish 1'), 1, 'the first final is slot 1');
select is(
  (select count(*)::int from public.activities
   where actor_id = '00000000-0000-0000-0000-00000000000a' and type = 'added_final'),
  5, 'each final wrote an added_final activity');

-- A sixth final
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Dish 6', 'final')
$$, 'P0001', 'final_full', 'a sixth final without a replace slot raises final_full');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 1,Dish 2,Dish 3,Dish 4,Dish 5', 'final_full changed nothing');
select is((select count(*)::int from public.dishes where name = 'Dish 6'), 0,
  'final_full did not leave a new dish behind');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'a refused sixth final');

select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Dish 6', 'final',
    null, '{}', '{}', null, 9)
$$, 'P0001', 'invalid_slot', 'a replace slot outside 1-5 raises invalid_slot');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Dish 6', 'final',
    null, array['99999999-9999-9999-9999-999999999999']::uuid[], '{}', null, 3)
$$, 'P0001', 'invalid_tag', 'a swap with a bad tag fails');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 1,Dish 2,Dish 3,Dish 4,Dish 5', 'a failed swap changed no slot');
select is(public.test_honorables('00000000-0000-0000-0000-00000000000a'), '',
  'a failed swap demoted nobody');
select is((select count(*)::int from public.dishes where name = 'Dish 6'), 0,
  'a failed swap left no new dish');
select is(
  (select count(*)::int from public.activities where actor_id = '00000000-0000-0000-0000-00000000000a'),
  5, 'a failed swap wrote no activity');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'failed swaps');

-- A swap: Dish 6 takes slot 3, Dish 3 becomes honorable
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Dish 6', 'final',
    null, '{}', '{}', null, 3)
$$, 'a sixth final with p_replace_slot => 3 swaps');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 1,Dish 2,Dish 6,Dish 4,Dish 5', 'the new final is in the replaced slot 3');
select is(public.test_honorables('00000000-0000-0000-0000-00000000000a'), 'Dish 3',
  'the old slot-3 pick is now honorable');
select is((select slot from public.picks where original_dish_name = 'Dish 3'), null,
  'the demoted pick has no slot');
select is(
  (select count(*)::int from public.activities a
   where a.type = 'dethroned'
     and a.actor_id = '00000000-0000-0000-0000-00000000000a'
     and a.pick_id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 6')
     and a.other_pick_id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 3')),
  1, 'a dethroned activity points from the new pick to the old one');
select is(
  (select count(*)::int from public.activities
   where type = 'added_final' and pick_id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 6')),
  1, 'the swap also wrote added_final for the new pick');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'a swap');

-- Demote slot 2 (Dish 2): later slots move up
select lives_ok($$
  select public.demote_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 2'))
$$, 'demote_pick on slot 2');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 1,Dish 6,Dish 4,Dish 5', 'demoting slot 2 moved slots 3-5 up to 2-4');
select is(public.test_honorables('00000000-0000-0000-0000-00000000000a'), 'Dish 2,Dish 3',
  'the demoted pick is honorable');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'demote_pick');
select lives_ok($$
  select public.demote_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 3'))
$$, 'demoting an honorable is a no-op, not an error');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'demoting an honorable');

-- Remove slot 1 (Dish 1): the rest shift up and its rows go
select lives_ok($$
  select public.remove_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 1'))
$$, 'remove_pick on slot 1');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 6,Dish 4,Dish 5', 'removing slot 1 moved the rest up');
select is((select count(*)::int from public.picks where original_dish_name = 'Dish 1'), 0,
  'the removed pick is gone');
select is(
  (select count(*)::int from public.activities
   where actor_id = '00000000-0000-0000-0000-00000000000a' and type = 'added_final'
     and pick_id is null),
  0, 'no activity is left dangling with a null pick');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'remove_pick');

-- Promote with fewer than 5 finals appends
select lives_ok($$
  select public.promote_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 2'))
$$, 'promote_pick with fewer than 5 finals');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 6,Dish 4,Dish 5,Dish 2', 'the promoted pick took the next slot');
select is(
  (select count(*)::int from public.activities
   where type = 'promoted' and pick_id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 2')),
  1, 'a promoted activity was written');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'promote_pick (append)');
select lives_ok($$
  select public.promote_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 2'), 1)
$$, 'promoting a final is a no-op, not an error');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 6,Dish 4,Dish 5,Dish 2', 'promoting a final changed nothing');

select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Dish 7', 'final')
$$, 'a fifth final fills the list again');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'refilling to five');

-- Promote with 5 finals needs a replace slot
select throws_ok($$
  select public.promote_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 3'))
$$, 'P0001', 'final_full', 'promote_pick with 5 finals and no replace slot raises final_full');
select throws_ok($$
  select public.promote_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 3'), 0)
$$, 'P0001', 'invalid_slot', 'promote_pick with a replace slot outside 1-5 raises invalid_slot');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 6,Dish 4,Dish 5,Dish 2,Dish 7', 'refused promotions changed nothing');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'refused promotions');

select lives_ok($$
  select public.promote_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 3'), 1)
$$, 'promote_pick with 5 finals and p_replace_slot => 1 swaps');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 3,Dish 4,Dish 5,Dish 2,Dish 7', 'the promoted pick took slot 1');
select is(public.test_honorables('00000000-0000-0000-0000-00000000000a'), 'Dish 6',
  'the old slot-1 pick is honorable');
select is(
  (select count(*)::int from public.activities a
   where a.type = 'dethroned'
     and a.pick_id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 3')
     and a.other_pick_id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 6')),
  1, 'promotion by swap wrote a dethroned activity');
select is(
  (select count(*)::int from public.activities
   where type = 'promoted' and pick_id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 3')),
  1, 'promotion by swap wrote a promoted activity');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'promote_pick (swap)');

-- move_final
select is(
  (select array_agg(original_dish_name order by slot) from public.move_final(
    public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 7'), 1)),
  array['Dish 7', 'Dish 3', 'Dish 4', 'Dish 5', 'Dish 2'],
  'move_final(slot 5, 1) returns the finals in their new order');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 7,Dish 3,Dish 4,Dish 5,Dish 2', 'move_final(slot 5, 1) moved the others down');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'move_final 5 to 1');
select lives_ok($$
  select public.move_final(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 7'), 5)
$$, 'move_final(slot 1, 5)');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 3,Dish 4,Dish 5,Dish 2,Dish 7', 'move_final(slot 1, 5) moved the others up');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'move_final 1 to 5');
select lives_ok($$
  select public.move_final(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 4'), 4)
$$, 'move_final(slot 2, 4)');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 3,Dish 5,Dish 2,Dish 4,Dish 7', 'move_final(slot 2, 4) moved the ones between up');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'move_final 2 to 4');
select lives_ok($$
  select public.move_final(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 7'), 5)
$$, 'move_final to the slot it is already in is a no-op');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 3,Dish 5,Dish 2,Dish 4,Dish 7', 'a no-op move changed nothing');
select throws_ok($$
  select public.move_final(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 7'), 6)
$$, 'P0001', 'invalid_slot', 'move_final past the last slot raises invalid_slot');
select throws_ok($$
  select public.move_final(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 6'), 1)
$$, 'P0001', 'invalid_slot', 'an honorable cannot be moved');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'refused moves');

-- Moving within a shorter list: only 1..n is allowed
select lives_ok($$
  select public.demote_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 3'))
$$, 'A demotes down to four finals');
select throws_ok($$
  select public.move_final(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 7'), 5)
$$, 'P0001', 'invalid_slot', 'with four finals, slot 5 is not a valid move');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'demote to four');

-- Adding a dish you already have
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Dish 7', 'honorable')
$$, 'P0001', 'duplicate_pick', 'adding a dish already on the list as a final raises duplicate_pick');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'dish  6!', 'final')
$$, 'P0001', 'duplicate_pick', 'adding a dish already an honorable (typed differently) raises duplicate_pick');
select is((select count(*)::int from public.picks where user_id = '00000000-0000-0000-0000-00000000000a'),
  6, 'duplicates created no second pick');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'refused duplicates');

-- An honorable is added with no slot, and p_replace_slot is ignored
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Dish 8', 'honorable',
    null, '{}', '{}', null, 2)
$$, 'adding an honorable (with a stray replace slot)');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 5,Dish 2,Dish 4,Dish 7', 'an honorable did not touch the finals');
select is(
  (select count(*)::int from public.activities
   where type = 'added_honorable' and pick_id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 8')),
  1, 'an added_honorable activity was written');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'adding an honorable');
-- With fewer than 5 finals a final ignores p_replace_slot and appends
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a1', null, 'Dish 9', 'final',
    null, '{}', '{}', null, 1)
$$, 'a final with fewer than 5 finals ignores p_replace_slot');
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 5,Dish 2,Dish 4,Dish 7,Dish 9', 'it took the next slot, not slot 1');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'a final that ignored the replace slot');

-- ================================================================ the same dish, typed differently
reset role;
select is((select count(*)::int from public.dishes d join public.places p on p.id = d.place_id
           where p.name = 'Marutama' and d.name = 'Tonkotsu Ramen'), 1, 'seeded: Marutama has Tonkotsu Ramen');
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000c');

select lives_ok($$
  select public.add_pick((select id from public.places where name = 'Marutama'), null,
    'Tonkotsu  Ramen!', 'honorable')
$$, 'C adds "Tonkotsu  Ramen!" at Marutama');
select is(
  (select d.name from public.picks p join public.dishes d on d.id = p.dish_id
   where p.user_id = '00000000-0000-0000-0000-00000000000c' and p.original_dish_name = 'Tonkotsu  Ramen!'),
  'Tonkotsu Ramen', 'it resolved to the seeded Tonkotsu Ramen');
select is(
  (select count(*)::int from public.dishes d join public.places p on p.id = d.place_id
   where p.name = 'Marutama' and d.name_key = 'tonkotsu ramen'),
  1, 'no second dish was made');
select is(
  (select original_dish_name from public.picks where user_id = '00000000-0000-0000-0000-00000000000c'),
  'Tonkotsu  Ramen!', 'the person''s own wording is kept in original_dish_name');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000c', 'C''s first add');

select public.test_login('00000000-0000-0000-0000-00000000000d');
select lives_ok($$
  select public.add_pick((select id from public.places where name = 'Marutama'), null,
    'tonkotsu ramen', 'final')
$$, 'D adds "tonkotsu ramen" at Marutama');
select is(
  (select count(distinct p.dish_id)::int from public.picks p
   where p.original_dish_name in ('tonkotsu ramen', 'Tonkotsu  Ramen!')),
  1, 'C and D are on one dish');
select is(
  (select original_dish_name from public.picks where user_id = '00000000-0000-0000-0000-00000000000d'),
  'tonkotsu ramen', 'D''s wording is kept too');

-- "Tonkotsu Ramen (extra chashu)": the 0.85 similarity rule decides
select lives_ok($$
  select public.add_pick((select id from public.places where name = 'Marutama'), null,
    'Tonkotsu Ramen (extra chashu)', 'honorable')
$$, 'D adds "Tonkotsu Ramen (extra chashu)"');
select is(
  (select (extensions.similarity('tonkotsu ramen extra chashu', 'tonkotsu ramen') >= 0.85)),
  false, 'its similarity to "tonkotsu ramen" is under 0.85 (about 0.54)');
select is(
  (select d.name_key from public.picks p join public.dishes d on d.id = p.dish_id
   where p.original_dish_name = 'Tonkotsu Ramen (extra chashu)'),
  'tonkotsu ramen extra chashu', 'so under the rule it is a new dish, with the wording as its name');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000d', 'D''s adds');

-- The other side of the rule: a near-identical spelling merges onto the existing dish
select is(
  (select (extensions.similarity('chicken katsu curry rice bowl', 'chicken katsu curry rice bowll') >= 0.85)),
  true, 'one extra letter in a long name stays at or above 0.85');
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a1', null,
    'Chicken Katsu Curry Rice Bowll', 'honorable')
$$, 'D adds "Chicken Katsu Curry Rice Bowll"');
select is(
  (select p.dish_id from public.picks p where p.original_dish_name = 'Chicken Katsu Curry Rice Bowll'),
  '20000000-0000-0000-0000-0000000000a1'::uuid, 'it resolved onto the existing dish by similarity');
select is(
  (select count(*)::int from public.dishes where place_id = '10000000-0000-0000-0000-0000000000a1'
     and name ilike 'chicken katsu%'),
  1, 'no second katsu dish was made');

-- Resolving by id
select public.test_login('00000000-0000-0000-0000-00000000000c');
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1',
    null, 'honorable')
$$, 'C adds by dish id alone');
select is(
  (select original_dish_name from public.picks where user_id = '00000000-0000-0000-0000-00000000000c'
     and dish_id = '20000000-0000-0000-0000-0000000000a1'),
  'Chicken Katsu Curry Rice Bowl', 'with only an id, original_dish_name is the dish''s own name');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-0000000000a1',
    'Whatever', 'honorable')
$$, 'P0001', 'place_not_found', 'a dish id from another place raises place_not_found');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000ff', null, 'Whatever', 'honorable')
$$, 'P0001', 'place_not_found', 'an unknown place raises place_not_found');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-0000000000ff',
    null, 'honorable')
$$, 'P0001', 'place_not_found', 'an unknown dish id raises place_not_found');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, '   ', 'honorable')
$$, 'P0001', 'invalid_dish_name', 'a blank dish name raises invalid_dish_name');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, null, 'honorable')
$$, 'P0001', 'invalid_dish_name', 'no name and no id raises invalid_dish_name');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, '!!! ???', 'honorable')
$$, 'P0001', 'invalid_dish_name', 'a name with no letters or digits raises invalid_dish_name');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, repeat('x', 81), 'honorable')
$$, 'P0001', 'invalid_dish_name', 'a name over 80 characters raises invalid_dish_name');
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, repeat('x', 80), 'honorable')
$$, 'a name of exactly 80 characters is fine');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000c', 'C''s adds');

-- ================================================================ photo path, note and tags
select public.test_login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, 'Photo Dish', 'honorable',
    null, '{}', '{}', '00000000-0000-0000-0000-00000000000b/pick-1.jpg')
$$, 'P0001', 'invalid_photo', 'a photo in someone else''s folder raises invalid_photo');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, 'Photo Dish', 'honorable',
    null, '{}', '{}', '00000000-0000-0000-0000-00000000000a/evil.png')
$$, 'P0001', 'invalid_photo', 'a photo that is not pick-<digits>.jpg raises invalid_photo');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, 'Photo Dish', 'honorable',
    null, '{}', '{}', 'pick-1.jpg')
$$, 'P0001', 'invalid_photo', 'a photo with no folder raises invalid_photo');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, 'Photo Dish', 'honorable',
    null, '{}', '{}', '00000000-0000-0000-0000-00000000000a/pick-1.jpg/../x.jpg')
$$, 'P0001', 'invalid_photo', 'a photo path that sneaks in a second segment raises invalid_photo');
select is((select count(*)::int from public.dishes where name = 'Photo Dish'), 0,
  'an invalid photo left no dish behind');
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, 'Photo Dish', 'honorable',
    '  Great broth  ', '{}', '{}', '00000000-0000-0000-0000-00000000000a/pick-1700000000000.jpg')
$$, 'a valid photo path is accepted');
select is(
  (select photo_path || '|' || note from public.picks
   where user_id = '00000000-0000-0000-0000-00000000000a' and original_dish_name = 'Photo Dish'),
  '00000000-0000-0000-0000-00000000000a/pick-1700000000000.jpg|Great broth',
  'the photo path is stored and the note is trimmed');

-- Tags
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, 'Tagged Dish', 'honorable',
    null,
    array[(select id from public.tags where kind = 'food_type' and slug = 'ramen')]::uuid[],
    array['Date night', '  date   night ', 'Cheap eats'])
$$, 'a pick with a global tag and personal tag names');
select is(
  (select string_agg(t.slug, ',' order by t.slug) from public.pick_tags pt
   join public.tags t on t.id = pt.tag_id
   where pt.pick_id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish')),
  'cheap-eats,date-night,ramen', 'the global tag and the (de-duplicated) personal tags are attached');
select is(
  (select count(*)::int from public.tags
   where kind = 'personal' and owner_id = '00000000-0000-0000-0000-00000000000a'),
  2, 'the personal tags were created for A');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, 'Bad Tag Dish', 'honorable',
    null, array[(select id from public.tags where kind = 'personal' limit 1)]::uuid[])
$$, 'P0001', 'invalid_tag', 'a personal tag id passed as a global tag raises invalid_tag');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, 'Bad Tag Dish', 'honorable',
    null, array['99999999-9999-9999-9999-999999999999']::uuid[])
$$, 'P0001', 'invalid_tag', 'an unknown tag id raises invalid_tag');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, 'Bad Tag Dish', 'honorable',
    null, '{}', array[repeat('t', 41)])
$$, 'P0001', 'invalid_tag_name', 'a personal tag name over 40 characters raises invalid_tag_name');
select is((select count(*)::int from public.dishes where name = 'Bad Tag Dish'), 0,
  'a bad tag left no dish or pick behind');

-- update_pick replaces note, tags and photo
select lives_ok($$
  select public.update_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish'),
    'New note',
    array[(select id from public.tags where kind = 'food_type' and slug = 'noodles')]::uuid[],
    array['Cheap eats', 'Late night'],
    '00000000-0000-0000-0000-00000000000a/pick-1700000000001.jpg')
$$, 'update_pick replaces note, tags and photo');
select is(
  (select string_agg(t.slug, ',' order by t.slug) from public.pick_tags pt
   join public.tags t on t.id = pt.tag_id
   where pt.pick_id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish')),
  'cheap-eats,late-night,noodles', 'the tags were replaced, not added to');
select is(
  (select note || '|' || photo_path from public.picks
   where id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish')),
  'New note|00000000-0000-0000-0000-00000000000a/pick-1700000000001.jpg', 'the note and photo were replaced');
select lives_ok($$
  select public.update_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish'),
    null, '{}', '{}', null)
$$, 'update_pick with nulls and empty arrays clears everything');
select is(
  (select count(*)::int from public.pick_tags
   where pick_id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish')),
  0, 'all tags were cleared');
select is(
  (select note is null and photo_path is null from public.picks
   where id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish')),
  true, 'a null note and photo clear them');
select throws_ok($$
  select public.update_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish'),
    'x', '{}', '{}', '00000000-0000-0000-0000-00000000000b/pick-1.jpg')
$$, 'P0001', 'invalid_photo', 'update_pick refuses a bad photo path');

-- A failed update changes nothing
select lives_ok($$
  select public.update_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish'),
    'Keep me', array[(select id from public.tags where kind = 'food_type' and slug = 'noodles')]::uuid[],
    '{}', null)
$$, 'setting a note and a tag to check atomicity');
select throws_ok($$
  select public.update_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish'),
    'Lose me', '{}', array['Fine tag', repeat('t', 41)], null)
$$, 'P0001', 'invalid_tag_name', 'an update with a bad personal tag fails');
select is(
  (select note from public.picks
   where id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish')),
  'Keep me', 'the failed update left the note alone');
select is(
  (select count(*)::int from public.pick_tags
   where pick_id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish')),
  1, 'the failed update left the tags alone');

-- remove_pick removes the pick's tags and activities, including a dethroned one pointing at it
select lives_ok($$
  select public.update_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish'),
    'n', array[(select id from public.tags where kind = 'food_type' and slug = 'ramen')]::uuid[], '{}', null)
$$, 'tagging the pick we are about to remove');
select lives_ok($$
  select public.remove_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Tagged Dish'))
$$, 'removing a tagged honorable');
select is(
  (select count(*)::int from public.picks where original_dish_name = 'Tagged Dish'), 0, 'the pick is gone');
select is(
  (select count(*)::int from public.pick_tags pt
   where not exists (select 1 from public.picks p where p.id = pt.pick_id)),
  0, 'no pick_tags are left pointing at nothing');
select is(
  (select count(*)::int from public.activities a
   where a.actor_id = '00000000-0000-0000-0000-00000000000a' and a.type = 'added_honorable'
     and not exists (select 1 from public.picks p where p.id = a.pick_id)),
  0, 'its added_honorable activity went with it');

-- Removing the pick that a swap demoted removes the dethroned activity that named it
select lives_ok($$
  select public.remove_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 6'))
$$, 'removing Dish 6 (demoted by the earlier promotion of Dish 3)');
select is(
  (select count(*)::int from public.activities
   where type = 'dethroned' and other_pick_id is null),
  0, 'no dethroned activity is left naming a pick that is gone');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'removing honorables');

-- ================================================================ ownership
select public.test_login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$
  select public.promote_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 8'))
$$, 'P0001', 'pick_not_found', 'B cannot promote A''s pick');
select throws_ok($$
  select public.demote_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 2'))
$$, 'P0001', 'pick_not_found', 'B cannot demote A''s pick');
select throws_ok($$
  select public.remove_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 2'))
$$, 'P0001', 'pick_not_found', 'B cannot remove A''s pick');
select throws_ok($$
  select public.update_pick(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 2'),
    'hijack', '{}', '{}', null)
$$, 'P0001', 'pick_not_found', 'B cannot update A''s pick');
select throws_ok($$
  select public.move_final(public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 2'), 1)
$$, 'P0001', 'pick_not_found', 'B cannot move A''s pick');
select throws_ok($$
  select public.remove_pick('99999999-9999-9999-9999-999999999999')
$$, 'P0001', 'pick_not_found', 'a pick id that does not exist raises pick_not_found');
reset role;
select is(public.test_finals('00000000-0000-0000-0000-00000000000a'),
  'Dish 5,Dish 2,Dish 4,Dish 7,Dish 9', 'B''s attempts changed none of A''s finals');
select is((select note from public.picks
  where id = public.test_pick_id('00000000-0000-0000-0000-00000000000a', 'Dish 2')),
  null, 'B''s attempts changed none of A''s notes');

-- A person with no profile
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000f');
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, 'Ghost Dish', 'honorable')
$$, 'P0001', 'profile_not_found', 'someone with no profile raises profile_not_found');

-- ================================================================ direct writes are closed
select public.test_login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$
  insert into public.picks (user_id, dish_id, tier, original_dish_name)
  values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a1', 'honorable', 'x')
$$, '42501', null, 'a direct insert into picks is refused');
select throws_ok($$
  update public.picks set note = 'sneaky' where user_id = '00000000-0000-0000-0000-00000000000a'
$$, '42501', null, 'a direct update of picks is refused');
select throws_ok($$
  update public.picks set slot = 1 where user_id = '00000000-0000-0000-0000-00000000000a'
$$, '42501', null, 'a direct slot update is refused');
select throws_ok($$
  delete from public.picks where user_id = '00000000-0000-0000-0000-00000000000a'
$$, '42501', null, 'a direct delete from picks is refused');
select throws_ok($$
  insert into public.pick_tags (pick_id, tag_id)
  select p.id, t.id from public.picks p, public.tags t
  where p.user_id = '00000000-0000-0000-0000-00000000000a' and t.slug = 'ramen' limit 1
$$, '42501', null, 'a direct insert into pick_tags is refused');
select throws_ok($$
  delete from public.pick_tags
$$, '42501', null, 'a direct delete from pick_tags is refused');
select cmp_ok((select count(*)::int from public.picks), '>', 0, 'reading picks still works');
select cmp_ok((select count(*)::int from public.pick_tags), '>', -1, 'reading pick_tags still works');
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename in ('picks', 'pick_tags') and cmd <> 'SELECT'),
  0, 'no write policies are left on picks or pick_tags');

-- signed out
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a2', null, 'Anon Dish', 'honorable')
$$, '42501', null, 'a signed-out visitor cannot add a pick');
select throws_ok($$
  select public.suggest_dishes('10000000-0000-0000-0000-0000000000a2', 'x')
$$, '42501', null, 'a signed-out visitor cannot ask for suggestions');
select is((select count(*)::int from public.dish_stats) > 0, true, 'a signed-out visitor can read dish_stats');
select cmp_ok((select count(*)::int from public.picks), '>', 0, 'a signed-out visitor can still read picks');

-- ================================================================ suggestions and stats
-- At Suggest Test Cafe: Gyro Plate (D), Pork Gyro (D final, C honorable, E final), Greek Salad (E).
reset role;
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000d');
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a3', null, 'Gyro Plate', 'honorable')
$$, 'D adds Gyro Plate');
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a3', null, 'Pork Gyro', 'final')
$$, 'D adds Pork Gyro (a final)');
select public.test_login('00000000-0000-0000-0000-00000000000c');
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a3', null, 'pork gyros', 'honorable')
$$, 'C adds "pork gyros" (the same dish; plurals fold)');
select public.test_login('00000000-0000-0000-0000-00000000000e');
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a3', null, 'Pork Gyro', 'final')
$$, 'E (a new account) adds Pork Gyro as a final');
select lives_ok($$
  select public.add_pick('10000000-0000-0000-0000-0000000000a3', null, 'Greek Salad', 'honorable')
$$, 'E adds Greek Salad');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000e', 'E''s adds');
reset role;
-- A merged dish that suggestions must skip.
insert into public.dishes (place_id, name, merged_into_id)
select '10000000-0000-0000-0000-0000000000a3', 'Gyro Old', id
from public.dishes where place_id = '10000000-0000-0000-0000-0000000000a3' and name = 'Pork Gyro';
set local role authenticated;
select public.test_login('00000000-0000-0000-0000-00000000000c');

select is(
  (select count(distinct dish_id)::int from public.picks
   where original_dish_name in ('Pork Gyro', 'pork gyros')),
  1, 'Pork Gyro and "pork gyros" are one dish');
select is(
  (select array_agg((dish).name order by rn) from (
     select s.dish, row_number() over () as rn
     from public.suggest_dishes('10000000-0000-0000-0000-0000000000a3', 'gyro') s) x),
  array['Gyro Plate', 'Pork Gyro'], 'gyro: the name that starts with it first, then the similar one; merged dish skipped');
select is(
  (select pick_count from public.suggest_dishes('10000000-0000-0000-0000-0000000000a3', 'gyro')
   where (dish).name = 'Pork Gyro'),
  2, 'pick_count counts D and C but not the new account E');
select is(
  (select pick_count from public.suggest_dishes('10000000-0000-0000-0000-0000000000a3', 'gyro')
   where (dish).name = 'Gyro Plate'),
  1, 'Gyro Plate has one trusted pick');
select is(
  (select array_agg((dish).name || ':' || pick_count order by rn) from (
     select s.dish, s.pick_count, row_number() over () as rn
     from public.suggest_dishes('10000000-0000-0000-0000-0000000000a3', '') s) x),
  array['Pork Gyro:2', 'Gyro Plate:1', 'Greek Salad:0'],
  'an empty query lists the most-picked first (a dish only a new account picked counts 0)');
select is(
  (select count(*)::int from public.suggest_dishes('10000000-0000-0000-0000-0000000000a3', '', 2)),
  2, 'p_lim limits the list');
select is(
  (select count(*)::int from public.suggest_dishes('10000000-0000-0000-0000-0000000000a3', '   ')),
  3, 'a blank query behaves like an empty one');
select is(
  (select count(*)::int from public.suggest_dishes('10000000-0000-0000-0000-0000000000a3', 'zzzzzz')),
  0, 'a query that matches nothing returns nothing');
select is(
  (select (dish).name from public.suggest_dishes('10000000-0000-0000-0000-0000000000a3', 'Greek Salad!')),
  'Greek Salad', 'the query is normalised the same way dish names are');
select is(
  (select count(*)::int from public.suggest_dishes('10000000-0000-0000-0000-0000000000a1', 'gyro')),
  0, 'suggestions are for one place only');

reset role;
select is(
  (select final_count || '/' || honorable_count || '/' || list_count from public.dish_stats
   where dish_id = (select id from public.dishes
                    where place_id = '10000000-0000-0000-0000-0000000000a3' and name = 'Pork Gyro')),
  '1/1/2', 'dish_stats counts trusted picks only: 1 final (D), 1 honorable (C), list_count 2 (E ignored)');
select is(
  (select final_count || '/' || honorable_count || '/' || list_count from public.dish_stats
   where dish_id = (select id from public.dishes
                    where place_id = '10000000-0000-0000-0000-0000000000a3' and name = 'Greek Salad')),
  '0/0/0', 'a dish only a new account picked has all-zero stats');
select is(
  (select count(*)::int from public.dish_stats
   where dish_id = (select id from public.dishes where name = 'Gyro Old')),
  1, 'a dish nobody picked still has a row, all zeros');

-- Every person's slots are still contiguous at the end
select public.test_slots_ok('00000000-0000-0000-0000-00000000000a', 'the whole run (A)');
select public.test_slots_ok('00000000-0000-0000-0000-00000000000d', 'the whole run (D)');

select * from finish();
rollback;
