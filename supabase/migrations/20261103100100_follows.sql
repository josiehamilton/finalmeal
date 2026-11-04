-- Phase 4: follows (request / approve) and people lookups.
--
-- 1. Follows are written only through functions. Direct insert / update / delete / truncate is
--    revoked from clients, and a row is readable only by the two people in it (counts and lists
--    come from the functions below). This also closes the "follows.status column protection"
--    gap: nobody can set their own status directly any more.
-- 2. Activities are readable only by their actor (feeds and notifications read them through
--    functions), and TRUNCATE is revoked.
-- 3. Helpers _is_blocked / _can_see / _person_match (internal, not executable by clients).
-- 4. follow_user, unfollow_user, respond_follow_request, and a trigger that approves pending
--    requests when a private account goes public.
-- 5. People lookups: get_profile, list_followers, list_following, search_people,
--    suggested_people. Each applies the privacy rules itself (spec 5.5): a private account's
--    bio, home city and picks go only to the owner and active followers, and blocks (either
--    direction) hide a person completely.

-- ---------------------------------------------------------------- grants and policies
revoke insert, update, delete, truncate on public.follows from anon, authenticated;
drop policy follows_insert_as_follower on public.follows;
drop policy follows_delete_either_party on public.follows;
drop policy follows_select on public.follows;
create policy follows_select_own on public.follows
  for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

revoke truncate on public.activities from anon, authenticated;
drop policy activities_select on public.activities;
create policy activities_select_own on public.activities
  for select to authenticated
  using (actor_id = (select auth.uid()));

-- Follower lists and counts read by followee, newest first.
create index follows_followee_created on public.follows (followee_id, created_at desc);

-- ---------------------------------------------------------------- helpers
create function public._is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- Can p_viewer see p_owner's bio, home city and picks? Never across a block; always for the
-- owner; for a public account; and for a private one only when the viewer follows actively.
create function public._can_see(p_viewer uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public._is_blocked(p_viewer, p_owner)
    and exists (
      select 1 from public.profiles o
      where o.id = p_owner
        and (
          o.id = p_viewer
          or o.visibility = 'public'
          or exists (
            select 1 from public.follows f
            where f.follower_id = p_viewer and f.followee_id = o.id and f.status = 'active'
          )
        )
    );
$$;

-- How a search query matches a person: 1 = the username starts with it, 2 = a word of the
-- display name starts with it (a multi-word query matches consecutive words), 0 = no match.
-- Case- and accent-insensitive; LIKE wildcards in the query are literal.
create function public._person_match(p_username text, p_display_name text, p_q text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when q.folded = '' then 0
    when public.city_fold(p_username) like q.like_prefix escape '\' then 1
    when q.words <> ''
      and ' ' || btrim(regexp_replace(public.city_fold(p_display_name), '[^[:alnum:]]+', ' ', 'g'))
          like '% ' || q.words || '%' then 2
    else 0
  end
  from (
    select
      f.folded,
      replace(replace(replace(f.folded, '\', '\\'), '%', '\%'), '_', '\_') || '%' as like_prefix,
      btrim(regexp_replace(f.folded, '[^[:alnum:]]+', ' ', 'g')) as words
    from (select public.city_fold(btrim(coalesce(p_q, ''))) as folded) f
  ) q;
$$;

-- ---------------------------------------------------------------- following
create function public.follow_user(p_user_id uuid)
returns public.follow_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target public.profiles;
  v_status public.follow_status;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_user_id = v_uid then
    raise exception 'cannot_follow_self';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_not_found';
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if not found or public._is_blocked(v_uid, p_user_id) then
    raise exception 'profile_unavailable';
  end if;

  -- One call at a time per person, so rapid taps cannot write a row or an activity twice.
  perform pg_advisory_xact_lock(hashtextextended('follow_user:' || v_uid::text, 0));

  select status into v_status from public.follows
  where follower_id = v_uid and followee_id = p_user_id;
  if found then
    return v_status;
  end if;

  if v_target.visibility = 'public' then
    insert into public.follows (follower_id, followee_id, status) values (v_uid, p_user_id, 'active');
    insert into public.activities (actor_id, type, target_user_id) values (v_uid, 'followed', p_user_id);
    return 'active';
  end if;

  insert into public.follows (follower_id, followee_id, status) values (v_uid, p_user_id, 'requested');
  insert into public.activities (actor_id, type, target_user_id) values (v_uid, 'follow_requested', p_user_id);
  return 'requested';
end;
$$;

create function public.unfollow_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('follow_user:' || v_uid::text, 0));

  delete from public.follows where follower_id = v_uid and followee_id = p_user_id;
  -- Their notifications go with the activities (cascade).
  delete from public.activities
  where actor_id = v_uid and target_user_id = p_user_id
    and type in ('followed', 'follow_requested');
end;
$$;

create function public.respond_follow_request(p_follower_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if p_accept then
    update public.follows set status = 'active'
    where follower_id = p_follower_id and followee_id = v_uid and status = 'requested';
    if not found then
      raise exception 'request_not_found';
    end if;
    insert into public.activities (actor_id, type, target_user_id)
    values (v_uid, 'follow_accepted', p_follower_id);
  else
    delete from public.follows
    where follower_id = p_follower_id and followee_id = v_uid and status = 'requested';
    if not found then
      raise exception 'request_not_found';
    end if;
    delete from public.activities
    where actor_id = p_follower_id and target_user_id = v_uid and type = 'follow_requested';
  end if;
end;
$$;

-- Going from private to public approves every pending request, with no activities.
-- (Going the other way leaves existing followers active.)
create function public.approve_requests_on_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.follows set status = 'active'
  where followee_id = new.id and status = 'requested';
  return null;
end;
$$;

create trigger profiles_approve_requests_on_public
  after update of visibility on public.profiles
  for each row
  when (old.visibility = 'private' and new.visibility = 'public')
  execute function public.approve_requests_on_public();

-- ---------------------------------------------------------------- people lookups
create function public.get_profile(p_user_id uuid)
returns table (
  id uuid, username text, display_name text, avatar_path text, bio text, home_city text,
  visibility public.profile_visibility, followers_count integer, following_count integer,
  dishes_count integer, viewer_follow text, follows_viewer boolean, can_see_picks boolean,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.username::text, p.display_name, p.avatar_path,
    case when v.can then p.bio end,
    case when v.can and (p.show_home_city or p.id = me.uid) then p.home_place_text end,
    p.visibility,
    (select count(*)::integer from public.follows f where f.followee_id = p.id and f.status = 'active'),
    (select count(*)::integer from public.follows f where f.follower_id = p.id and f.status = 'active'),
    case when v.can then (select count(*)::integer from public.picks k where k.user_id = p.id) end,
    coalesce((select f.status::text from public.follows f
              where f.follower_id = me.uid and f.followee_id = p.id), 'none'),
    exists (select 1 from public.follows f
            where f.follower_id = p.id and f.followee_id = me.uid and f.status = 'active'),
    v.can,
    coalesce(p.id = me.uid, false)
  from (select (select auth.uid()) as uid) me
  join public.profiles p on p.id = p_user_id
  cross join lateral (select public._can_see(me.uid, p.id) as can) v
  where not public._is_blocked(me.uid, p.id);
$$;

create function public.list_followers(
  p_user_id uuid, p_q text default null, p_offset integer default 0, p_limit integer default 20
)
returns table (
  id uuid, username text, display_name text, avatar_path text, viewer_follow text,
  follows_viewer boolean, is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.username::text, p.display_name, p.avatar_path,
    coalesce(vf.status::text, 'none'),
    fv.follower_id is not null,
    coalesce(p.id = me.uid, false)
  from (select (select auth.uid()) as uid) me
  join public.follows f on f.followee_id = p_user_id and f.status = 'active'
  join public.profiles p on p.id = f.follower_id
  left join public.follows vf on vf.follower_id = me.uid and vf.followee_id = p.id
  left join public.follows fv on fv.follower_id = p.id and fv.followee_id = me.uid and fv.status = 'active'
  where public._can_see(me.uid, p_user_id)
    and not public._is_blocked(me.uid, p.id)
    and (btrim(coalesce(p_q, '')) = '' or public._person_match(p.username::text, p.display_name, p_q) > 0)
  order by f.created_at desc, p.username
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 20), 0), 50);
$$;

create function public.list_following(
  p_user_id uuid, p_q text default null, p_offset integer default 0, p_limit integer default 20
)
returns table (
  id uuid, username text, display_name text, avatar_path text, viewer_follow text,
  follows_viewer boolean, is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.username::text, p.display_name, p.avatar_path,
    coalesce(vf.status::text, 'none'),
    fv.follower_id is not null,
    coalesce(p.id = me.uid, false)
  from (select (select auth.uid()) as uid) me
  join public.follows f on f.follower_id = p_user_id and f.status = 'active'
  join public.profiles p on p.id = f.followee_id
  left join public.follows vf on vf.follower_id = me.uid and vf.followee_id = p.id
  left join public.follows fv on fv.follower_id = p.id and fv.followee_id = me.uid and fv.status = 'active'
  where public._can_see(me.uid, p_user_id)
    and not public._is_blocked(me.uid, p.id)
    and (btrim(coalesce(p_q, '')) = '' or public._person_match(p.username::text, p.display_name, p_q) > 0)
  order by f.created_at desc, p.username
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 20), 0), 50);
$$;

-- Name, username and photo are always visible, so private accounts are included.
create function public.search_people(p_q text, p_limit integer default 20)
returns table (
  id uuid, username text, display_name text, avatar_path text, viewer_follow text,
  follows_viewer boolean, is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.username::text, p.display_name, p.avatar_path,
    coalesce(vf.status::text, 'none'),
    fv.follower_id is not null,
    false
  from (select (select auth.uid()) as uid) me
  join public.profiles p on p.id <> me.uid
  cross join lateral (select public._person_match(p.username::text, p.display_name, p_q) as tier) m
  cross join lateral (
    select count(*) as n from public.follows f where f.followee_id = p.id and f.status = 'active'
  ) c
  left join public.follows vf on vf.follower_id = me.uid and vf.followee_id = p.id
  left join public.follows fv on fv.follower_id = p.id and fv.followee_id = me.uid and fv.status = 'active'
  where m.tier > 0
    and not public._is_blocked(me.uid, p.id)
  order by m.tier, c.n desc, p.username
  limit least(greatest(coalesce(p_limit, 20), 0), 50);
$$;

-- Trusted, public accounts the caller has no follow row with (so not someone they have
-- already asked). Home within 25 km of the caller's home city first, then most followers.
-- The caller's home city is a chosen point, never the phone's position.
create function public.suggested_people(p_limit integer default 5)
returns table (
  id uuid, username text, display_name text, avatar_path text, viewer_follow text,
  follows_viewer boolean, is_me boolean, top_dish text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.username::text, p.display_name, p.avatar_path,
    'none',
    fv.follower_id is not null,
    false,
    (select d.name from public.picks k join public.dishes d on d.id = k.dish_id
      where k.user_id = p.id and k.tier = 'final' and k.slot = 1)
  from (select (select auth.uid()) as uid) me
  left join public.profiles mp on mp.id = me.uid
  join public.profiles p on p.id <> me.uid
  cross join lateral (
    select count(*) as n from public.follows f where f.followee_id = p.id and f.status = 'active'
  ) c
  left join public.follows fv on fv.follower_id = p.id and fv.followee_id = me.uid and fv.status = 'active'
  where p.trust_level = 'trusted'
    and p.visibility = 'public'
    and not exists (select 1 from public.follows f where f.follower_id = me.uid and f.followee_id = p.id)
    and not public._is_blocked(me.uid, p.id)
  order by coalesce(extensions.st_dwithin(p.home_location, mp.home_location, 25000), false) desc,
           c.n desc, p.username
  limit least(greatest(coalesce(p_limit, 5), 0), 50);
$$;

-- ---------------------------------------------------------------- privileges
-- Supabase grants new functions to anon by default; these are for signed-in people only, and
-- the helpers and the trigger function are for other functions only.
revoke all on function public._is_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function public._can_see(uuid, uuid) from public, anon, authenticated;
revoke all on function public._person_match(text, text, text) from public, anon, authenticated;
revoke all on function public.approve_requests_on_public() from public, anon, authenticated;

revoke all on function public.follow_user(uuid) from public, anon;
revoke all on function public.unfollow_user(uuid) from public, anon;
revoke all on function public.respond_follow_request(uuid, boolean) from public, anon;
revoke all on function public.get_profile(uuid) from public, anon;
revoke all on function public.list_followers(uuid, text, integer, integer) from public, anon;
revoke all on function public.list_following(uuid, text, integer, integer) from public, anon;
revoke all on function public.search_people(text, integer) from public, anon;
revoke all on function public.suggested_people(integer) from public, anon;
grant execute on function public.follow_user(uuid) to authenticated;
grant execute on function public.unfollow_user(uuid) to authenticated;
grant execute on function public.respond_follow_request(uuid, boolean) to authenticated;
grant execute on function public.get_profile(uuid) to authenticated;
grant execute on function public.list_followers(uuid, text, integer, integer) to authenticated;
grant execute on function public.list_following(uuid, text, integer, integer) to authenticated;
grant execute on function public.search_people(text, integer) to authenticated;
grant execute on function public.suggested_people(integer) to authenticated;
