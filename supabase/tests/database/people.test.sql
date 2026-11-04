begin;
create extension if not exists pgtap with schema extensions;

select plan(49);

-- Runs on top of the dev seed (Josie ...0001 follows Mike, Ari and Dev; Alli is in Saskatoon;
-- Sam is a new account), plus the fixtures below. Rolled back at the end.
-- Fixtures (the seed's people keep their ids):
--   Priya  ...00a1  private, trusted, Vancouver     "Priya Shah"
--   Vera   ...00a2  public, trusted, Vancouver      "Vera Lindqvist" (hides her city)
--   Zed    ...00a3  public, trusted, Toronto        "Zed Ortiz"
--   Bea    ...00a4  public, trusted, Vancouver      "Bea Arden"  (blocks Josie)
--   Nina   ...00a5  public, trusted, no home city    "Nina Novak"
create function public.test_login(p_uid uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a5'),
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000a4');
insert into public.profiles (id, username, display_name, bio, home_place_text, home_location,
                             visibility, trust_level, show_home_city)
select v.id::uuid, v.username, v.display_name, v.bio, public.city_label(c), c.location,
       v.vis::public.profile_visibility, 'trusted', v.show_city
from (values
  ('00000000-0000-0000-0000-0000000000a1', 'priya_s', 'Priya Shah', 'Private bio', 6173331, 'private', true),
  ('00000000-0000-0000-0000-0000000000a2', 'vera_l', 'Vera Lindqvist', 'Vera bio', 6173331, 'public', false),
  ('00000000-0000-0000-0000-0000000000a3', 'zed_o', 'Zed Ortiz', 'Zed bio', 6167865, 'public', true),
  ('00000000-0000-0000-0000-0000000000a4', 'bea_arden', 'Bea Arden', 'Bea bio', 6173331, 'public', true)
) as v(id, username, display_name, bio, geoname, vis, show_city)
join public.cities c on c.geoname_id = v.geoname;

-- Nina has no home city.
insert into public.profiles (id, username, display_name, trust_level)
values ('00000000-0000-0000-0000-0000000000a5', 'nina_n', 'Nina Novak', 'trusted');

-- Priya has two picks, Zed one; Vera's Final Meal slot 1 is Pork Gyro.
insert into public.picks (user_id, dish_id, tier, slot, original_dish_name)
select v.uid::uuid, d.id, v.tier::public.pick_tier, v.slot, d.name
from (values
  ('00000000-0000-0000-0000-0000000000a1', 'Pork Gyro', 'honorable', null::smallint),
  ('00000000-0000-0000-0000-0000000000a1', 'Omakase', 'honorable', null),
  ('00000000-0000-0000-0000-0000000000a3', 'Omakase', 'honorable', null),
  ('00000000-0000-0000-0000-0000000000a2', 'Pork Gyro', 'final', 1)
) as v(uid, dish, tier, slot)
join public.dishes d on d.name = v.dish;

-- Zed has two active followers (Alli and Mike), so he outranks Alli (none) among far people.
insert into public.follows (follower_id, followee_id, status) values
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-0000000000a3', 'active'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-0000000000a3', 'active'),
  -- a pending request to Priya from Mike, and Ari follows Priya
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'requested'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-0000000000a1', 'active'),
  -- Dev follows Vera
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-0000000000a2', 'active');
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------- structure
select has_function('public', 'get_profile', array['uuid'], 'get_profile exists');
select has_function('public', 'list_followers', array['uuid', 'text', 'integer', 'integer'], 'list_followers exists');
select has_function('public', 'list_following', array['uuid', 'text', 'integer', 'integer'], 'list_following exists');
select has_function('public', 'search_people', array['text', 'integer'], 'search_people exists');
select has_function('public', 'suggested_people', array['integer'], 'suggested_people exists');
select ok(not has_function_privilege('authenticated', 'public._can_see(uuid, uuid)', 'execute'),
  '_can_see is not executable by clients');
select ok(not has_function_privilege('authenticated', 'public._is_blocked(uuid, uuid)', 'execute'),
  '_is_blocked is not executable by clients');
select ok(not has_function_privilege('anon', 'public.get_profile(uuid)', 'execute'),
  'anon cannot run get_profile');

-- ================================================================ Josie (stranger to Priya)
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000001');

select is((select can_see_picks from public.get_profile('00000000-0000-0000-0000-0000000000a1')), false,
  'a stranger cannot see a private account''s picks');
select is((select bio is null and home_city is null and dishes_count is null
   from public.get_profile('00000000-0000-0000-0000-0000000000a1')),
  true, 'a private profile gives a stranger a null bio, home_city and dishes_count');
select is((select username || '|' || display_name || '|' || followers_count || '|' || following_count
   from public.get_profile('00000000-0000-0000-0000-0000000000a1')),
  'priya_s|Priya Shah|1|0', 'name, username and active follower count are always visible (the request does not count)');
select is((select viewer_follow from public.get_profile('00000000-0000-0000-0000-0000000000a1')), 'none',
  'viewer_follow is none for a stranger');
select is((select follows_viewer or is_me from public.get_profile('00000000-0000-0000-0000-0000000000a1')), false,
  'Priya does not follow Josie, and it is not Josie''s profile');

select is((select can_see_picks and is_me and dishes_count = 17 and bio = 'Chasing the perfect meal.'
   and home_city = 'Vancouver, BC, Canada' and followers_count = 5 and following_count = 3
   from public.get_profile('00000000-0000-4000-8000-000000000001')),
  true, 'Josie sees all of her own profile, with active counts');
select is((select follows_viewer from public.get_profile('00000000-0000-4000-8000-000000000002')), true,
  'Mike follows Josie, so follows_viewer is true');
select is((select viewer_follow from public.get_profile('00000000-0000-4000-8000-000000000002')), 'active',
  'Josie follows Mike, so viewer_follow is active');
select is((select home_city from public.get_profile('00000000-0000-0000-0000-0000000000a2')), null,
  'show_home_city = false hides the city from others');
select is((select bio from public.get_profile('00000000-0000-0000-0000-0000000000a2')), 'Vera bio',
  'but a public profile''s bio is visible');
select is((select count(*)::int from public.get_profile('00000000-0000-0000-0000-0000000000a4')), 0,
  'a profile that blocked Josie gives no row');
select is((select count(*)::int from public.get_profile('00000000-0000-0000-0000-0000000000ff')), 0,
  'a missing profile gives no row');

-- Lists of a private user
select is((select count(*)::int from public.list_followers('00000000-0000-0000-0000-0000000000a1')), 0,
  'list_followers of a private user is empty for a stranger');
select is((select count(*)::int from public.list_following('00000000-0000-0000-0000-0000000000a1')), 0,
  'list_following of a private user is empty for a stranger');

-- ================================================================ Ari (active follower of Priya)
select public.test_login('00000000-0000-4000-8000-000000000003');
select is((select can_see_picks and dishes_count = 2 and bio = 'Private bio'
   and home_city = 'Vancouver, BC, Canada'
   from public.get_profile('00000000-0000-0000-0000-0000000000a1')),
  true, 'an active follower sees a private account''s bio, city and dish count');
select is((select viewer_follow from public.get_profile('00000000-0000-0000-0000-0000000000a1')), 'active',
  'viewer_follow is active');
select is((select string_agg(username, ',') from public.list_followers('00000000-0000-0000-0000-0000000000a1')),
  'arimitchell', 'list_followers of a private user is full for a follower (active follows only)');

-- A requested follower is still a stranger
select public.test_login('00000000-0000-4000-8000-000000000002');
select is((select viewer_follow || '|' || can_see_picks::text
   from public.get_profile('00000000-0000-0000-0000-0000000000a1')),
  'requested|false', 'a requested follower sees viewer_follow requested but no picks');
select is((select count(*)::int from public.list_followers('00000000-0000-0000-0000-0000000000a1')), 0,
  'and cannot list the private account''s followers');

-- ================================================================ lists on a public profile
select public.test_login('00000000-0000-4000-8000-000000000001');
select is((select string_agg(username, ',' order by ord) from
   (select username, row_number() over () as ord
    from public.list_followers('00000000-0000-4000-8000-000000000001')) s),
  (select string_agg(p.username::text, ',' order by f.created_at desc, p.username)
   from public.follows f join public.profiles p on p.id = f.follower_id
   where f.followee_id = '00000000-0000-4000-8000-000000000001' and f.status = 'active'),
  'list_followers is newest follow first');
select is((select count(*)::int from public.list_followers('00000000-0000-4000-8000-000000000001')), 5,
  'Josie has five followers');
select is((select string_agg(username, ',' order by username)
   from public.list_following('00000000-0000-4000-8000-000000000001')),
  'arimitchell,devpatel,mikebrennan', 'Josie follows three people');
select is((select string_agg(username, ',')
   from public.list_followers('00000000-0000-4000-8000-000000000001', 'sam')), 'samokafor',
  'p_q filters by username prefix');
select is((select string_agg(username, ',')
   from public.list_followers('00000000-0000-4000-8000-000000000001', 'MIT')), 'arimitchell',
  'p_q matches the start of a display-name word, case-insensitively');
select is((select count(*)::int from public.list_followers('00000000-0000-4000-8000-000000000001', 'itchell')), 0,
  'p_q does not match the middle of a word');
select is((select count(*)::int from public.list_followers('00000000-0000-4000-8000-000000000001', null, 3, 20)), 2,
  'p_offset skips');
select is((select count(*)::int from public.list_followers('00000000-0000-4000-8000-000000000001', null, 0, 2)), 2,
  'p_limit limits');
select is((select count(*)::int from public.list_followers('00000000-0000-0000-0000-0000000000a4')), 0,
  'a list on a profile that blocked the caller is empty');

-- ================================================================ search_people
select is((select string_agg(username, ',') from public.search_people('ar')), 'arimitchell',
  'search_people(ar) finds arimitchell (and not Bea Arden, who blocked Josie)');
select is((select string_agg(username, ',' order by username) from public.search_people('pri')), 'priya_s',
  'private accounts are included');
select is((select string_agg(username, ',') from public.search_people('lind')), 'vera_l',
  'matches the start of a display-name word (Lindqvist)');
select is((select count(*)::int from public.search_people('josie')), 0, 'the caller is excluded');
select is((select count(*)::int from public.search_people('   ')), 0, 'a blank query returns nothing');
select is((select count(*)::int from public.search_people(null)), 0, 'a null query returns nothing');
select is((select string_agg(username, ',') from public.search_people('zed')), 'zed_o',
  'search_people matches Zed');

-- ================================================================ suggested_people
-- Josie follows Mike, Ari and Dev. Left: Alli (Saskatoon), Sam (new), Priya (private), Vera
-- (Vancouver), Zed (Toronto, 2 followers), Bea (blocked), Nina (no city, no followers).
-- Expected: Vera first (home within 25 km), then Zed (more followers), then Alli and Nina
-- (no followers, by username).
select is((select string_agg(username, ',') from public.suggested_people(10)),
  'vera_l,zed_o,allimercer,nina_n',
  'suggestions: nearby first, then by followers; never Sam, Priya, Bea, a followed person or Josie');
select is((select top_dish from public.suggested_people(10) where username = 'vera_l'), 'Pork Gyro',
  'top_dish is the slot-1 Final Meal dish name');
select is((select top_dish from public.suggested_people(10) where username = 'zed_o'), null,
  'top_dish is null without a slot-1 final');
select is((select count(*)::int from public.suggested_people(1)), 1, 'p_limit applies');

-- A requested follow is not "no row at all": Priya is private anyway, so use Zed.
reset role;
insert into public.follows (follower_id, followee_id, status) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'requested');
set local role authenticated;
select public.test_login('00000000-0000-4000-8000-000000000001');
select is((select string_agg(username, ',') from public.suggested_people(10)), 'vera_l,allimercer,nina_n',
  'someone Josie has already asked to follow is not suggested');

-- A caller with no home city gets only the follower-count ordering (then username), and sees
-- everyone who is trusted and public, including Bea (she only blocked Josie).
select public.test_login('00000000-0000-0000-0000-0000000000a5');
select is((select string_agg(username, ',') from public.suggested_people(10)),
  'josiehamilton,zed_o,arimitchell,devpatel,mikebrennan,vera_l,allimercer,bea_arden',
  'a caller with no home city gets follower count, then username');

select * from finish();
rollback;
