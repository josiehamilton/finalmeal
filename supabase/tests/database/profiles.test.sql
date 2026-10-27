begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

-- Start from an empty database: the dev seed is deleted here and comes back
-- when this transaction rolls back.
delete from auth.users;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

-- ===== Structure =====
select has_column('public', 'profiles', 'onboarded_at', 'profiles.onboarded_at exists');
select col_default_is('public', 'profiles', 'show_home_city', 'true', 'show_home_city defaults to true');
select has_function('public', 'create_my_profile', array['text', 'text'], 'create_my_profile exists');
select has_function('public', 'is_username_available', array['text'], 'is_username_available exists');
select has_function('public', 'set_my_home_city', array['uuid'], 'set_my_home_city exists');
select has_function('public', 'finish_onboarding', array[]::text[], 'finish_onboarding exists');

-- ===== Ana (A) signs in with no profile yet =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok($$
  insert into public.profiles (id, username, display_name)
  values ('00000000-0000-0000-0000-00000000000a', 'direct_a', 'Direct')
$$, '42501', null, 'authenticated cannot insert a profile directly');

select lives_ok($$select public.create_my_profile('Ana', 'AnaB')$$, 'create_my_profile works');
select is(
  (select username::text || '|' || display_name || '|' || visibility::text || '|' || trust_level::text
     || '|' || is_business_affiliated::text || '|' || show_home_city::text
     || '|' || (onboarded_at is null)::text
   from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'AnaB|Ana|public|new|false|true|true',
  'the new profile has safe defaults and is not onboarded yet'
);

select throws_ok($$select public.create_my_profile('Ana again', 'ana_2')$$,
  'P0001', 'profile_exists', 'a repeat call raises profile_exists');
select throws_ok($$update public.profiles set trust_level = 'trusted' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'cannot change own trust_level');
select throws_ok($$update public.profiles set is_business_affiliated = true where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'cannot change own is_business_affiliated');
select throws_ok($$update public.profiles set onboarded_at = null where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'cannot write onboarded_at directly');
select lives_ok($$update public.profiles set bio = 'x' where id = '00000000-0000-0000-0000-00000000000a'$$,
  'can update own bio');
select is((select bio from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'x', 'the bio changed');

select is(public.is_username_available('anab'), true, 'own username counts as available (any case)');
select is(public.is_username_available('a b'), false, 'invalid usernames are not available');

-- ===== Bo (B) =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is(public.is_username_available('ANAB'), false, 'a name taken by someone else is not available');
select is(public.is_username_available('fresh_name'), true, 'a free name is available');
select throws_ok($$select public.create_my_profile('Bo', 'anab')$$,
  'P0001', 'username_taken', 'a duplicate username (any case) raises username_taken');
select throws_ok($$select public.create_my_profile('Bo', 'a b')$$,
  'P0001', 'invalid_username', 'a bad username raises invalid_username');
select throws_ok($$select public.create_my_profile('', 'bo_bo')$$,
  '23514', null, 'an empty display name raises the check violation');
select throws_ok($$select public.set_my_home_city(null)$$,
  'P0001', 'profile_not_found', 'set_my_home_city needs a profile first');
select throws_ok($$select public.finish_onboarding()$$,
  'P0001', 'profile_not_found', 'finish_onboarding needs a profile first');
select lives_ok($$select public.create_my_profile('Bo', 'bo_bo')$$, 'Bo can create a profile');

-- ===== Ana: home city and onboarding =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok($$select public.set_my_home_city('99999999-9999-9999-9999-999999999999')$$,
  'P0001', 'city_not_found', 'an unknown city raises city_not_found');

select public.set_my_home_city((select id from public.cities where geoname_id = 6173331));
select is(
  (select home_place_text || '|' || (home_location is not null)::text || '|' || (home_city_id is not null)::text
   from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Vancouver, BC, Canada|true|true',
  'set_my_home_city stores the label, the point and the city'
);
select public.set_my_home_city(null);
select is(
  (select (home_place_text is null and home_location is null and home_city_id is null)
   from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  true, 'a null city clears all three'
);

select public.finish_onboarding();
select set_config('test.first_onboarded',
  (select onboarded_at::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), true);
select isnt(current_setting('test.first_onboarded'), '', 'finish_onboarding sets onboarded_at');
select pg_sleep(0.01);
select public.finish_onboarding();
select is(
  (select onboarded_at::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  current_setting('test.first_onboarded'),
  'a second finish_onboarding leaves onboarded_at unchanged'
);

-- ===== Signed out =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.is_username_available('whatever')$$, '42501', null, 'anon cannot run is_username_available');
select throws_ok($$select public.create_my_profile('X', 'xxx')$$, '42501', null, 'anon cannot run create_my_profile');
select throws_ok($$select public.set_my_home_city(null)$$, '42501', null, 'anon cannot run set_my_home_city');
select throws_ok($$select public.finish_onboarding()$$, '42501', null, 'anon cannot run finish_onboarding');

select * from finish();
rollback;
