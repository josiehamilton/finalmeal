-- Fixes from the Task 3 review of 20261103120000_feeds_and_saves.sql, plus two carried over from
-- the Task 2 re-review (new migration: the originals are already applied on dev databases). No
-- signature or return shape changes.
--
-- 1. activities_other_pick: index for the other_pick_id foreign key (on delete set null) and for
--    remove_pick, which deletes the dethroned rows that name the pick.
-- 2. save_push_log + _fan_out_activity: save, unsave, save again pushes the pick's owner at most
--    once per 24 hours per (saver, pick). The in-app notification is still written each time.
--    Same style as follow_push_log; the log is only written when a push would be queued.
-- 3. _push_still_wanted also applies the private-account rule: a queued dethroned / added_final /
--    promoted push is skipped at claim time when the recipient can no longer see the actor
--    (unfollowed a private account, or a block), like get_my_notifications.

create index activities_other_pick on public.activities (other_pick_id) where other_pick_id is not null;

create table public.save_push_log (
  actor_id uuid not null references public.profiles on delete cascade,
  pick_id uuid not null references public.picks on delete cascade,
  last_pushed_at timestamptz not null,
  primary key (actor_id, pick_id)
);
alter table public.save_push_log enable row level security;
revoke all on public.save_push_log from anon, authenticated;
create index save_push_log_pick on public.save_push_log (pick_id);

create or replace function public._fan_out_activity()
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

  -- A saved_pick push is skipped when the same person already pushed the same pick's owner in
  -- the last 24 hours (save, unsave, save again). Same idea as the followed throttle above;
  -- save_push_log remembers it because unsaving deletes the activity and its push_outbox row.
  if v_act.type = 'saved_pick' then
    insert into public.save_push_log (actor_id, pick_id, last_pushed_at)
    values (v_act.actor_id, v_act.pick_id, now())
    on conflict (actor_id, pick_id) do update set last_pushed_at = excluded.last_pushed_at
      where public.save_push_log.last_pushed_at <= now() - interval '24 hours';
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

create or replace function public._push_still_wanted(p_user uuid, p_activity uuid)
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
      and (a.type not in ('dethroned', 'added_final', 'promoted') or public._can_see(p_user, a.actor_id))
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
