-- Phase 4: activity fan-out, in-app notifications, notification preferences, push tokens and
-- the push queue.
--
-- 1. notification_preferences: one row per profile (created by a trigger), four push switches.
-- 2. push_tokens: written only through register_push_token / unregister_push_token.
-- 3. notifications: read-only for clients; read state changes through mark_notifications_read.
--    get_my_notifications and unread_notification_count read them (blocks applied).
-- 4. push_outbox + follow_push_log: the push queue and the "one followed push per person per
--    24 hours" memory. Clients cannot touch either; only service_role runs claim_push_batch
--    and finish_push_batch (the push-dispatch Edge Function).
-- 5. The fan-out: a deferred constraint trigger on activities, so it runs at commit and sees
--    every activity of a transaction (a swap's added_final / promoted and dethroned together).
--
-- Phase 4 delivers through a log-only sender; the Expo sender and the schedule are Phase 8.

-- ---------------------------------------------------------------- preferences
create table public.notification_preferences (
  user_id uuid primary key references public.profiles on delete cascade,
  push_dethroned boolean not null default true,
  push_new_followers boolean not null default true,
  push_saves boolean not null default true,
  push_friends_finals boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();
alter table public.notification_preferences enable row level security;

revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
grant update (push_dethroned, push_new_followers, push_saves, push_friends_finals)
  on public.notification_preferences to authenticated;
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function public.create_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_preferences (user_id) values (new.id) on conflict do nothing;
  return null;
end;
$$;
revoke all on function public.create_notification_preferences() from public, anon, authenticated;

create trigger profiles_create_notification_preferences
  after insert on public.profiles
  for each row execute function public.create_notification_preferences();

insert into public.notification_preferences (user_id)
select id from public.profiles
on conflict do nothing;

-- ---------------------------------------------------------------- push tokens
alter table public.push_tokens add column updated_at timestamptz not null default now();
create trigger push_tokens_set_updated_at before update on public.push_tokens
  for each row execute function public.set_updated_at();

revoke insert, update, delete, truncate on public.push_tokens from anon, authenticated;
drop policy push_tokens_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create function public.register_push_token(p_token text, p_platform text)
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
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$'
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

create function public.unregister_push_token(p_token text)
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
  delete from public.push_tokens where expo_token = p_token and user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------- notifications
revoke insert, update, delete, truncate on public.notifications from anon, authenticated;
drop policy notifications_update_own on public.notifications;
create index notifications_activity on public.notifications (activity_id);
alter publication supabase_realtime add table public.notifications;

create function public.mark_notifications_read(p_ids uuid[] default null)
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
  update public.notifications
  set read_at = now()
  where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids));
end;
$$;

-- Unread rows, not counting people the caller has a block with (get_my_notifications leaves
-- those out, so the badge matches the list).
create function public.unread_notification_count()
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
    and not public._is_blocked(a.actor_id, n.user_id);
$$;

create function public.get_my_notifications(
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
    and (p_before is null or n.created_at < p_before)
  order by n.created_at desc, n.id desc
  limit least(greatest(coalesce(p_limit, 20), 0), 50);
$$;

-- ---------------------------------------------------------------- push queue
create table public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  activity_id uuid not null references public.activities on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  sender text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index push_outbox_pending on public.push_outbox (created_at, id) where status = 'pending';
create index push_outbox_activity on public.push_outbox (activity_id);
alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from anon, authenticated;

-- When each person was last pushed "X started following you" about each other person. The
-- push_outbox row goes with its activity when someone unfollows, so this remembers the push
-- for the 24-hour rule.
create table public.follow_push_log (
  actor_id uuid not null references public.profiles on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  last_pushed_at timestamptz not null,
  primary key (actor_id, user_id)
);
alter table public.follow_push_log enable row level security;
revoke all on public.follow_push_log from anon, authenticated;

create function public._push_text(
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
      when 'saved_from_list' then ' saved picks from your list ' || coalesce(p_list_title, '') || '.'
      when 'dethroned' then ' dethroned ' || coalesce(p_other_dish, 'a dish') || ' with '
        || coalesce(p_dish, 'a dish') || ' on their Final Meal.'
      when 'added_final' then ' added ' || coalesce(p_dish, 'a dish') || ' to their Final Meal.'
      when 'promoted' then ' promoted ' || coalesce(p_dish, 'a dish') || ' to their Final Meal.'
      else ''
    end;
$$;
revoke all on function public._push_text(public.activity_type, text, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------- fan-out
-- Runs at commit, once per activity row. Recipients are never the actor and never across a
-- block. In-app rows: follow activities (to the target), saves (to the owner) and dethroned
-- (to active followers). Pushes: when the recipient's preference is on and they have a token.
-- added_final / promoted push to followers but write no notification (the feed covers them);
-- when the same transaction also wrote a dethroned for that pick (a swap), only the dethroned
-- fans out, so followers get one notification and one push.
create function public._fan_out_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_act public.activities;
  v_candidates uuid[];
  v_recipients uuid[];
  v_push_to uuid[];
  v_pref text;
  v_actor_name text;
  v_dish text;
  v_other text;
  v_list text;
  v_title text;
  v_body text;
  v_rows integer;
begin
  -- The activity may be gone by commit (an undone follow, a removed pick).
  select * into v_act from public.activities where id = new.id;
  if not found or v_act.type = 'added_honorable' then
    return null;
  end if;
  if v_act.type in ('added_final', 'promoted') and exists (
    select 1 from public.activities d
    where d.type = 'dethroned' and d.pick_id = v_act.pick_id and d.created_at = v_act.created_at
  ) then
    return null;
  end if;

  v_pref := case v_act.type
    when 'dethroned' then 'push_dethroned'
    when 'added_final' then 'push_friends_finals'
    when 'promoted' then 'push_friends_finals'
    when 'saved_pick' then 'push_saves'
    when 'saved_from_list' then 'push_saves'
    else 'push_new_followers'
  end;

  v_candidates := case v_act.type
    when 'followed' then array[v_act.target_user_id]
    when 'follow_requested' then array[v_act.target_user_id]
    when 'follow_accepted' then array[v_act.target_user_id]
    when 'saved_pick' then array(select k.user_id from public.picks k where k.id = v_act.pick_id)
    when 'saved_from_list' then array(select l.owner_id from public.shared_lists l where l.id = v_act.list_id)
    else array(select f.follower_id from public.follows f
               where f.followee_id = v_act.actor_id and f.status = 'active')
  end;

  select coalesce(array_agg(q.r), '{}') into v_recipients
  from (
    select distinct c as r from unnest(v_candidates) c
    where c is not null and c <> v_act.actor_id and not public._is_blocked(v_act.actor_id, c)
  ) q;
  if cardinality(v_recipients) = 0 then
    return null;
  end if;

  if v_act.type not in ('added_final', 'promoted') then
    insert into public.notifications (user_id, activity_id, created_at)
    select r, v_act.id, v_act.created_at from unnest(v_recipients) r;
  end if;

  select coalesce(array_agg(r.uid), '{}') into v_push_to
  from unnest(v_recipients) as r(uid)
  left join public.notification_preferences np on np.user_id = r.uid
  where coalesce(case v_pref
      when 'push_dethroned' then np.push_dethroned
      when 'push_friends_finals' then np.push_friends_finals
      when 'push_saves' then np.push_saves
      else np.push_new_followers
    end, true)
    and exists (select 1 from public.push_tokens t where t.user_id = r.uid);
  if cardinality(v_push_to) = 0 then
    return null;
  end if;

  -- A followed push is skipped when the same person pushed this one in the last 24 hours.
  if v_act.type = 'followed' then
    insert into public.follow_push_log (actor_id, user_id, last_pushed_at)
    values (v_act.actor_id, v_push_to[1], now())
    on conflict (actor_id, user_id) do update set last_pushed_at = excluded.last_pushed_at
      where public.follow_push_log.last_pushed_at <= now() - interval '24 hours';
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      return null;
    end if;
  end if;

  select display_name into v_actor_name from public.profiles where id = v_act.actor_id;
  select d.name into v_dish from public.picks k join public.dishes d on d.id = k.dish_id
  where k.id = v_act.pick_id;
  select d.name into v_other from public.picks k join public.dishes d on d.id = k.dish_id
  where k.id = v_act.other_pick_id;
  select title into v_list from public.shared_lists where id = v_act.list_id;
  select t.title, t.body into v_title, v_body
  from public._push_text(v_act.type, v_actor_name, v_dish, v_other, v_list) t;

  insert into public.push_outbox (user_id, activity_id, title, body, data)
  select u, v_act.id, v_title, v_body,
    jsonb_strip_nulls(jsonb_build_object(
      'type', v_act.type::text, 'pickId', v_act.pick_id, 'userId', v_act.actor_id))
  from unnest(v_push_to) u;
  return null;
end;
$$;
revoke all on function public._fan_out_activity() from public, anon, authenticated;

create constraint trigger activities_fan_out
  after insert on public.activities
  deferrable initially deferred
  for each row execute function public._fan_out_activity();

-- ---------------------------------------------------------------- sender functions
-- Only service_role (the push-dispatch Edge Function) runs these.
create function public.claim_push_batch(p_limit integer default 100)
returns setof public.push_outbox
language sql
security definer
set search_path = ''
as $$
  update public.push_outbox o
  set status = 'sending', attempts = o.attempts + 1
  where o.id in (
    select p.id from public.push_outbox p
    where p.status = 'pending'
    order by p.created_at, p.id
    limit least(greatest(coalesce(p_limit, 100), 0), 500)
    for update skip locked
  )
  returning o.*;
$$;

create function public.finish_push_batch(p_ids uuid[], p_status text, p_sender text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status is null or p_status not in ('sent', 'failed') then
    raise exception 'invalid_push_status';
  end if;
  update public.push_outbox
  set status = p_status, sender = p_sender, sent_at = now()
  where id = any (p_ids) and status = 'sending';
end;
$$;

-- ---------------------------------------------------------------- privileges
-- Supabase grants new functions to anon by default; these are for signed-in people only.
revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
revoke all on function public.unread_notification_count() from public, anon;
revoke all on function public.get_my_notifications(timestamptz, integer) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.unread_notification_count() to authenticated;
grant execute on function public.get_my_notifications(timestamptz, integer) to authenticated;

revoke all on function public.claim_push_batch(integer) from public, anon, authenticated;
revoke all on function public.finish_push_batch(uuid[], text, text) from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer) to service_role;
grant execute on function public.finish_push_batch(uuid[], text, text) to service_role;
