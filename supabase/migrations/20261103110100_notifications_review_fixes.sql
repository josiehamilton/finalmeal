-- Fixes from the Task 2 review of 20261103110000_notifications.sql (new migration: the original
-- is already applied on dev databases). Same signatures and grants unless noted.
--
-- 1. get_my_notifications and unread_notification_count leave out swap notifications
--    (dethroned / added_final / promoted: they describe the actor's own picks) unless the caller
--    can still see the actor (public account, the owner, or an active follower, and no block).
--    Someone who unfollowed a private account no longer learns its dishes. Both functions use the
--    same rule, so the badge matches the list.
-- 2. register_push_token refuses tokens over 512 characters (and the table checks it too).
-- 3. _push_text: a missing list title no longer leaves "your list ." behind.
-- 4. The sender re-checks blocks and the recipient's preference when it claims a batch: pushes
--    that are no longer wanted become `skipped` (attempts stays 0) and are not returned; the
--    limit counts only pushes that are still wanted.

-- ---------------------------------------------------------------- 1. private actors
create or replace function public.unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.notifications n
  join public.activities a on a.id = n.activity_id
  where n.user_id = (select auth.uid())
    and n.read_at is null
    and not public._is_blocked(a.actor_id, n.user_id)
    and (a.type not in ('dethroned', 'added_final', 'promoted') or public._can_see(n.user_id, a.actor_id));
$$;

create or replace function public.get_my_notifications(
  p_before timestamptz default null, p_limit integer default 20
)
returns table (
  id uuid, created_at timestamptz, read_at timestamptz, type public.activity_type,
  actor_id uuid, actor_username text, actor_display_name text, actor_avatar_path text,
  pick_id uuid, dish_name text, photo_path text, other_dish_name text, list_title text,
  viewer_follow text, request_pending boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id, n.created_at, n.read_at, a.type,
    p.id, p.username::text, p.display_name, p.avatar_path,
    a.pick_id, d.name, k.photo_path, od.name, l.title,
    coalesce(vf.status::text, 'none'),
    a.type = 'follow_requested' and exists (
      select 1 from public.follows f
      where f.follower_id = a.actor_id and f.followee_id = me.uid and f.status = 'requested')
  from (select (select auth.uid()) as uid) me
  join public.notifications n on n.user_id = me.uid
  join public.activities a on a.id = n.activity_id
  join public.profiles p on p.id = a.actor_id
  left join public.picks k on k.id = a.pick_id
  left join public.dishes d on d.id = k.dish_id
  left join public.picks ko on ko.id = a.other_pick_id
  left join public.dishes od on od.id = ko.dish_id
  left join public.shared_lists l on l.id = a.list_id
  left join public.follows vf on vf.follower_id = me.uid and vf.followee_id = a.actor_id
  where not public._is_blocked(me.uid, a.actor_id)
    and (a.type not in ('dethroned', 'added_final', 'promoted') or public._can_see(me.uid, a.actor_id))
    and (p_before is null or n.created_at < p_before)
  order by n.created_at desc, n.id desc
  limit least(greatest(coalesce(p_limit, 20), 0), 50);
$$;

-- ---------------------------------------------------------------- 2. token length
alter table public.push_tokens
  add constraint push_tokens_expo_token_length check (char_length(expo_token) <= 512);

create or replace function public.register_push_token(p_token text, p_platform text)
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
  if p_token is null or char_length(p_token) > 512
     or p_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$'
     or p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'invalid_push_token';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_not_found';
  end if;

  -- A token seen under another person is the same phone signed into a new account: it moves.
  insert into public.push_tokens (user_id, expo_token, platform)
  values (v_uid, p_token, p_platform)
  on conflict (expo_token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------- 3. push text
create or replace function public._push_text(
  p_type public.activity_type, p_actor_name text, p_dish text, p_other_dish text, p_list_title text
)
returns table (title text, body text)
language sql
immutable
set search_path = ''
as $$
  select
    'Final Meal'::text,
    coalesce(p_actor_name, 'Someone') || case p_type
      when 'followed' then ' started following you.'
      when 'follow_requested' then ' wants to follow you.'
      when 'follow_accepted' then ' approved your follow request.'
      when 'saved_pick' then ' saved your ' || coalesce(p_dish, 'pick') || '.'
      when 'saved_from_list' then ' saved picks from your list'
        || case when btrim(coalesce(p_list_title, '')) = '' then '.' else ' ' || p_list_title || '.' end
      when 'dethroned' then ' dethroned ' || coalesce(p_other_dish, 'a dish') || ' with '
        || coalesce(p_dish, 'a dish') || ' on their Final Meal.'
      when 'added_final' then ' added ' || coalesce(p_dish, 'a dish') || ' to their Final Meal.'
      when 'promoted' then ' promoted ' || coalesce(p_dish, 'a dish') || ' to their Final Meal.'
      else ''
    end;
$$;

-- ---------------------------------------------------------------- 4. re-check at claim time
alter table public.push_outbox drop constraint push_outbox_status_check;
alter table public.push_outbox add constraint push_outbox_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped'));

-- Is this queued push still wanted: no block between the actor and the recipient, and the
-- recipient's preference for this kind of push is still on? (Same preference mapping as the
-- fan-out.)
create function public._push_still_wanted(p_user uuid, p_activity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.activities a
    left join public.notification_preferences np on np.user_id = p_user
    where a.id = p_activity
      and not public._is_blocked(a.actor_id, p_user)
      and coalesce(case a.type
          when 'dethroned' then np.push_dethroned
          when 'added_final' then np.push_friends_finals
          when 'promoted' then np.push_friends_finals
          when 'saved_pick' then np.push_saves
          when 'saved_from_list' then np.push_saves
          else np.push_new_followers
        end, true)
  );
$$;
revoke all on function public._push_still_wanted(uuid, uuid) from public, anon, authenticated;

create or replace function public.claim_push_batch(p_limit integer default 100)
returns setof public.push_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- First skip pushes that are no longer wanted among the oldest pending ones (so a batch is
  -- never used up by stale rows), then claim the oldest ones that are still wanted.
  update public.push_outbox o
  set status = 'skipped'
  from (
    select p.id, p.user_id, p.activity_id
    from public.push_outbox p
    where p.status = 'pending'
    order by p.created_at, p.id
    limit 500
    for update skip locked
  ) c
  where o.id = c.id and not public._push_still_wanted(c.user_id, c.activity_id);

  return query
  update public.push_outbox o
  set status = 'sending', attempts = o.attempts + 1
  where o.id in (
    select p.id from public.push_outbox p
    where p.status = 'pending' and public._push_still_wanted(p.user_id, p.activity_id)
    order by p.created_at, p.id
    limit least(greatest(coalesce(p_limit, 100), 0), 500)
    for update skip locked
  )
  returning o.*;
end;
$$;
