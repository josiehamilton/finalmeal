-- Fixes from the Task 1 review of 20261103100100_follows.sql (new migration: the original is
-- already applied on dev databases). Same signatures, security and grants as before.
--
-- 1. unfollow_user also deletes the owner's follow_accepted activity about that follow (actor =
--    the person unfollowed, target = the caller), so an accepted-then-unfollowed request leaves
--    no "accepted your request" notification behind.
-- 2. follow_user takes its advisory lock first, then reads the target's profile FOR SHARE. A
--    concurrent private -> public switch now waits for the follow to commit, so the approve
--    trigger sees the new `requested` row instead of leaving it stranded on a public account.
-- 3. respond_follow_request refuses to accept across a block (profile_unavailable, the same
--    code follow_user uses). Declining still works, so the owner can clear the request.

create or replace function public.follow_user(p_user_id uuid)
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

  -- One call at a time per person, so rapid taps cannot write a row or an activity twice.
  perform pg_advisory_xact_lock(hashtextextended('follow_user:' || v_uid::text, 0));

  -- FOR SHARE: the target cannot change visibility until this follow is committed.
  select * into v_target from public.profiles where id = p_user_id for share;
  if not found or public._is_blocked(v_uid, p_user_id) then
    raise exception 'profile_unavailable';
  end if;

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

create or replace function public.unfollow_user(p_user_id uuid)
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
  where (actor_id = v_uid and target_user_id = p_user_id and type in ('followed', 'follow_requested'))
     or (actor_id = p_user_id and target_user_id = v_uid and type = 'follow_accepted');
end;
$$;

create or replace function public.respond_follow_request(p_follower_id uuid, p_accept boolean)
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
    if public._is_blocked(v_uid, p_follower_id) then
      raise exception 'profile_unavailable';
    end if;
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
