-- Phase 4: saves, the Following and Nearby feeds, pick detail, who-picked-here, and the
-- duplicate-pick detail (known gap M5).
--
-- 1. Saves are written only through save_dish / unsave_dish; a row is readable only by its owner
--    (get_my_saves is the read). A save remembers the pick it came through (via_pick_id) and
--    that pick's owner (via_user_id). If the pick is deleted the save stays and via_pick_id goes
--    null (the activity about it is deleted with the pick by cascade).
-- 2. following_feed: activities of people the caller actively follows, newest first, keyset
--    paged. A swap shows once (the dethroned card).
-- 3. nearby_feed: picks (not activities) by trusted, public accounts at places within 25 km of
--    the caller's chosen home city, ranked by recency plus how many people have the dish.
--    Never the phone's location.
-- 4. get_pick_detail, place_pickers.
-- 5. add_pick names the existing pick in the error detail when it raises duplicate_pick.
--
-- Every read function applies the privacy rules itself (spec 5.5): a private account's picks go
-- only to the owner and active followers (_can_see), blocks hide a person completely, Nearby
-- uses trusted public accounts only, and another person's personal tags are never returned.

-- ---------------------------------------------------------------- saves
alter table public.saves
  add column via_pick_id uuid references public.picks on delete set null,
  add column via_user_id uuid references public.profiles on delete set null;
-- get_my_saves reads by user, newest first; the foreign key to picks needs an index on the
-- referencing side so deleting a pick does not scan every save.
create index saves_user_created on public.saves (user_id, created_at desc);
create index saves_via_pick on public.saves (via_pick_id) where via_pick_id is not null;
-- Activities by pick: the swap check below, and the cascade when a pick is deleted.
create index activities_pick on public.activities (pick_id) where pick_id is not null;

revoke insert, update, delete, truncate on public.saves from anon, authenticated;
drop policy saves_own on public.saves;
create policy saves_select_own on public.saves
  for select to authenticated
  using (user_id = (select auth.uid()));

create function public.save_dish(p_dish_id uuid, p_via_pick_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_via public.picks;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_not_found';
  end if;

  -- One call at a time per person, so rapid taps cannot write a row or an activity twice.
  perform pg_advisory_xact_lock(hashtextextended('save_dish:' || v_uid::text, 0));

  if not exists (select 1 from public.dishes where id = p_dish_id and merged_into_id is null) then
    raise exception 'dish_not_found';
  end if;
  -- Already saved: nothing changes (the first via pick stays).
  if exists (select 1 from public.saves where user_id = v_uid and dish_id = p_dish_id) then
    return;
  end if;

  -- The pick must be of this dish, visible to the caller and someone else's; otherwise it is
  -- ignored and the dish is saved with no via. FOR SHARE: a pick being removed at the same
  -- moment waits for this save to commit.
  if p_via_pick_id is not null then
    select * into v_via
    from public.picks
    where id = p_via_pick_id and dish_id = p_dish_id and user_id <> v_uid
      and public._can_see(v_uid, user_id)
    for share;
  end if;

  insert into public.saves (user_id, dish_id, via_pick_id, via_user_id)
  values (v_uid, p_dish_id, v_via.id, v_via.user_id);
  if v_via.id is not null then
    insert into public.activities (actor_id, type, pick_id)
    values (v_uid, 'saved_pick', v_via.id);
  end if;
end;
$$;

create function public.unsave_dish(p_dish_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_via uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('save_dish:' || v_uid::text, 0));

  delete from public.saves where user_id = v_uid and dish_id = p_dish_id
  returning via_pick_id into v_via;
  -- The owner's notification goes with the activity (cascade).
  if v_via is not null then
    delete from public.activities
    where actor_id = v_uid and type = 'saved_pick' and pick_id = v_via;
  end if;
end;
$$;

-- The caller's saves, newest first. The via columns are null when the pick is gone or the
-- caller can no longer see its owner (went private, or a block); the save itself stays.
-- distance_m is from the caller's home city point, null without one.
create function public.get_my_saves()
returns table (
  dish_id uuid, dish_name text, place public.places, via_pick_id uuid, via_tier public.pick_tier,
  via_user_id uuid, via_username text, photo_path text, saved_at timestamptz,
  distance_m double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id, d.name, public.mask_place(pl), v.pick_id, v.tier, v.user_id, v.username, v.photo_path,
    s.created_at,
    case when mp.home_location is null then null
         else extensions.st_distance(pl.location, mp.home_location) end
  from (select (select auth.uid()) as uid) me
  join public.saves s on s.user_id = me.uid
  join public.dishes d on d.id = s.dish_id
  join public.places pl on pl.id = d.place_id
  left join public.profiles mp on mp.id = me.uid
  left join lateral (
    select k.id as pick_id, k.tier, k.user_id, u.username::text as username, k.photo_path
    from public.picks k
    join public.profiles u on u.id = k.user_id
    where k.id = s.via_pick_id and public._can_see(me.uid, k.user_id)
  ) v on true
  order by s.created_at desc, d.id;
$$;

-- ---------------------------------------------------------------- feed building blocks
-- A pick's global tags as [{id, kind, name, slug, is_featured}]; its personal tags too when
-- asked (pick detail for the owner only).
create function public._pick_tags_json(p_pick_id uuid, p_include_personal boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', t.id, 'kind', t.kind, 'name', t.name, 'slug', t.slug,
                         'is_featured', t.is_featured)
      order by t.kind, t.name, t.id),
    '[]'::jsonb)
  from public.pick_tags pt
  join public.tags t on t.id = pt.tag_id
  where pt.pick_id = p_pick_id and (t.owner_id is null or p_include_personal);
$$;

-- The card fields both feeds share, for one pick as seen by p_viewer. The caller of this
-- helper has already decided that the viewer may see the pick.
create function public._feed_card(p_pick_id uuid, p_viewer uuid)
returns table (
  actor_id uuid, actor_username text, actor_display_name text, actor_avatar_path text,
  pick_id uuid, tier public.pick_tier, slot smallint, note text, photo_path text,
  dish_id uuid, dish_name text, place public.places, tags jsonb, list_count integer,
  saved_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id, u.username::text, u.display_name, u.avatar_path,
    k.id, k.tier, k.slot, k.note, k.photo_path,
    d.id, d.name, public.mask_place(pl), public._pick_tags_json(k.id, false),
    coalesce(ds.list_count, 0),
    exists (select 1 from public.saves s where s.user_id = p_viewer and s.dish_id = d.id)
  from public.picks k
  join public.profiles u on u.id = k.user_id
  join public.dishes d on d.id = k.dish_id
  join public.places pl on pl.id = d.place_id
  left join public.dish_stats ds on ds.dish_id = d.id
  where k.id = p_pick_id;
$$;

-- ---------------------------------------------------------------- Following feed
-- Activities of added_final / added_honorable / promoted / dethroned by people the caller
-- actively follows (never the caller's own, never across a block, and only while the caller can
-- still see the person). A swap writes added_final / promoted and dethroned together for the
-- same pick at the same time; the first is hidden so the swap shows once. Newest first, keyset
-- paged by (p_before, p_before_key) = the last row's (at, item_key).
create function public.following_feed(
  p_before timestamptz default null, p_before_key text default null, p_limit integer default 20
)
returns table (
  item_key text, kind text, at timestamptz,
  actor_id uuid, actor_username text, actor_display_name text, actor_avatar_path text,
  pick_id uuid, tier public.pick_tier, slot smallint, note text, photo_path text,
  dish_id uuid, dish_name text, place public.places, tags jsonb, other_dish_name text,
  list_count integer, saved_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pg.id::text, pg.type::text, pg.created_at,
    c.actor_id, c.actor_username, c.actor_display_name, c.actor_avatar_path,
    c.pick_id, c.tier, c.slot, c.note, c.photo_path,
    c.dish_id, c.dish_name, c.place, c.tags, pg.other_dish_name,
    c.list_count, c.saved_by_me
  from (
    select a.id, a.type, a.created_at, a.pick_id, od.name as other_dish_name, me.uid
    from (select (select auth.uid()) as uid) me
    join public.follows f on f.follower_id = me.uid and f.status = 'active'
    join public.activities a on a.actor_id = f.followee_id
    join public.picks k on k.id = a.pick_id
    left join public.picks ko on ko.id = a.other_pick_id and a.type = 'dethroned'
    left join public.dishes od on od.id = ko.dish_id
    where a.type in ('added_final', 'added_honorable', 'promoted', 'dethroned')
      and public._can_see(me.uid, a.actor_id)
      and not (
        a.type in ('added_final', 'promoted')
        and exists (
          select 1 from public.activities d
          where d.type = 'dethroned' and d.pick_id = a.pick_id and d.created_at = a.created_at)
      )
      and (
        p_before is null
        or a.created_at < p_before
        or (p_before_key is not null and a.created_at = p_before and a.id < p_before_key::uuid)
      )
    order by a.created_at desc, a.id desc
    limit least(greatest(coalesce(p_limit, 20), 0), 50)
  ) pg
  cross join lateral public._feed_card(pg.pick_id, pg.uid) c
  order by pg.created_at desc, pg.id desc;
$$;

-- ---------------------------------------------------------------- Nearby feed
-- Picks by trusted, public accounts other than the caller (and not across a block) at places
-- within 25 km of the caller's home city point. kind is added_final or added_honorable from the
-- pick's current tier, item_key the pick id, at the pick's time. Rank:
--   epoch(created_at) + 86400 * ln(1 + list_count)
-- so each e-fold of the dish's list_count is worth one day of recency. Offset paging, at most
-- 200 rows in total (the last page is cut at 200). Empty without a home city.
create function public.nearby_feed(p_offset integer default 0, p_limit integer default 20)
returns table (
  item_key text, kind text, at timestamptz,
  actor_id uuid, actor_username text, actor_display_name text, actor_avatar_path text,
  pick_id uuid, tier public.pick_tier, slot smallint, note text, photo_path text,
  dish_id uuid, dish_name text, place public.places, tags jsonb, other_dish_name text,
  list_count integer, saved_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pg.id::text,
    case when c.tier = 'final' then 'added_final' else 'added_honorable' end,
    pg.created_at,
    c.actor_id, c.actor_username, c.actor_display_name, c.actor_avatar_path,
    c.pick_id, c.tier, c.slot, c.note, c.photo_path,
    c.dish_id, c.dish_name, c.place, c.tags, null::text,
    c.list_count, c.saved_by_me
  from (
    select
      k.id, k.created_at, me.uid,
      extract(epoch from k.created_at) + 86400 * ln(1 + coalesce(ds.list_count, 0)) as score
    from (select (select auth.uid()) as uid) me
    join public.profiles mp on mp.id = me.uid and mp.home_location is not null
    join public.profiles u on u.id <> me.uid and u.trust_level = 'trusted' and u.visibility = 'public'
    join public.picks k on k.user_id = u.id
    join public.dishes d on d.id = k.dish_id
    join public.places pl on pl.id = d.place_id
      and extensions.st_dwithin(pl.location, mp.home_location, 25000)
    left join public.dish_stats ds on ds.dish_id = d.id
    where not public._is_blocked(me.uid, u.id)
    order by score desc, k.id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 20), 0), 50, greatest(200 - greatest(coalesce(p_offset, 0), 0), 0))
  ) pg
  cross join lateral public._feed_card(pg.id, pg.uid) c
  order by pg.score desc, pg.id;
$$;

-- ---------------------------------------------------------------- pick detail
-- One pick as the caller may see it: no row when it is missing or the caller cannot see its
-- owner. Tags: global ones, plus the owner's personal tags only for the owner. pickers: up to 4
-- trusted public accounts with this dish as a Final Meal (the owner first when they qualify;
-- blocked people left out). final_count / list_count come from dish_stats.
create function public.get_pick_detail(p_pick_id uuid)
returns table (
  pick_id uuid, tier public.pick_tier, slot smallint, note text, photo_path text,
  original_dish_name text, created_at timestamptz,
  dish_id uuid, dish_name text, place public.places, tags jsonb,
  owner_id uuid, owner_username text, owner_display_name text, owner_avatar_path text,
  is_mine boolean, final_count integer, list_count integer, pickers jsonb, saved_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    k.id, k.tier, k.slot, k.note, k.photo_path, k.original_dish_name, k.created_at,
    d.id, d.name, public.mask_place(pl), public._pick_tags_json(k.id, k.user_id = me.uid),
    u.id, u.username::text, u.display_name, u.avatar_path,
    k.user_id = me.uid,
    coalesce(ds.final_count, 0), coalesce(ds.list_count, 0),
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('id', x.id, 'username', x.username, 'display_name', x.display_name,
                             'avatar_path', x.avatar_path)
          order by x.is_owner desc, x.picked_at desc, x.id),
        '[]'::jsonb)
      from (
        select pu.id, pu.username::text as username, pu.display_name, pu.avatar_path,
               pu.id = k.user_id as is_owner, pk.created_at as picked_at
        from public.picks pk
        join public.profiles pu on pu.id = pk.user_id
          and pu.trust_level = 'trusted' and pu.visibility = 'public'
        where pk.dish_id = d.id and pk.tier = 'final'
          and not public._is_blocked(me.uid, pu.id)
        order by (pu.id = k.user_id) desc, pk.created_at desc, pu.id
        limit 4
      ) x
    ),
    exists (select 1 from public.saves s where s.user_id = me.uid and s.dish_id = d.id)
  from (select (select auth.uid()) as uid) me
  join public.picks k on k.id = p_pick_id
  join public.profiles u on u.id = k.user_id
  join public.dishes d on d.id = k.dish_id
  join public.places pl on pl.id = d.place_id
  left join public.dish_stats ds on ds.dish_id = d.id
  where public._can_see(me.uid, k.user_id);
$$;

-- ---------------------------------------------------------------- who picked here
-- other_count: distinct trusted accounts other than the caller with any pick at the place
-- (private accounts count, as on Discover; blocked people do not). people: up to p_limit of
-- the public ones, most recent pick first. Always one row.
create function public.place_pickers(p_place_id uuid, p_limit integer default 3)
returns table (other_count integer, people jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with pickers as (
    select u.id, u.username::text as username, u.display_name, u.avatar_path, u.visibility,
           max(k.created_at) as last_at
    from (select (select auth.uid()) as uid) me
    join public.dishes d on d.place_id = p_place_id
    join public.picks k on k.dish_id = d.id
    join public.profiles u on u.id = k.user_id and u.trust_level = 'trusted'
    where u.id is distinct from me.uid and not public._is_blocked(me.uid, u.id)
    group by u.id
  )
  select
    count(*)::integer,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('id', q.id, 'username', q.username, 'display_name', q.display_name,
                           'avatar_path', q.avatar_path)
        order by q.last_at desc, q.id)
      from (
        select * from pickers
        where visibility = 'public'
        order by last_at desc, id
        limit least(greatest(coalesce(p_limit, 3), 0), 50)
      ) q
    ), '[]'::jsonb)
  from pickers;
$$;

-- ---------------------------------------------------------------- add_pick: duplicate detail
-- Same signature and body as 20261027210000_picks_functions.sql; the only change is that
-- duplicate_pick carries the existing pick as JSON in the error detail,
--   {"pick_id": "<uuid>", "tier": "final" | "honorable"}
-- so the app can offer "Make it a Final Meal instead" without its own lookup (known gap M5).
create or replace function public.add_pick(
  p_place_id uuid,
  p_dish_id uuid,
  p_dish_name text,
  p_tier public.pick_tier,
  p_note text default null,
  p_tag_ids uuid[] default '{}',
  p_personal_tags text[] default '{}',
  p_photo_path text default null,
  p_replace_slot integer default null
)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._begin_pick_write();
  v_typed text := nullif(btrim(coalesce(p_dish_name, '')), '');
  v_dish_id uuid;
  v_original text;
  v_slot integer;
  v_old uuid;
  v_existing public.picks;
  v_pick public.picks;
begin
  if char_length(coalesce(v_typed, '')) > 80 then
    raise exception 'invalid_dish_name';
  end if;
  perform public._check_pick_photo(v_uid, p_photo_path);

  v_dish_id := public._resolve_dish(p_place_id, p_dish_id, p_dish_name);
  select * into v_existing from public.picks where user_id = v_uid and dish_id = v_dish_id;
  if found then
    raise exception 'duplicate_pick'
      using detail = json_build_object('pick_id', v_existing.id, 'tier', v_existing.tier)::text;
  end if;
  -- The person's own wording, kept as typed (trimmed); the dish's name when only an id was given.
  v_original := coalesce(v_typed, (select name from public.dishes where id = v_dish_id));

  if p_tier = 'final' then
    select s.v_slot, s.v_old into v_slot, v_old from public._claim_final_slot(v_uid, p_replace_slot) s;
  end if;

  insert into public.picks (user_id, dish_id, tier, slot, note, photo_path, original_dish_name)
  values (v_uid, v_dish_id, p_tier, v_slot, nullif(btrim(coalesce(p_note, '')), ''),
          p_photo_path, v_original)
  returning * into v_pick;

  perform public._set_pick_tags(v_pick.id, p_tag_ids, p_personal_tags);

  insert into public.activities (actor_id, type, pick_id)
  values (v_uid, case when p_tier = 'final' then 'added_final' else 'added_honorable' end::public.activity_type,
          v_pick.id);
  if v_old is not null then
    insert into public.activities (actor_id, type, pick_id, other_pick_id)
    values (v_uid, 'dethroned', v_pick.id, v_old);
  end if;

  return v_pick;
end;
$$;

-- ---------------------------------------------------------------- privileges
-- Supabase grants new functions to anon by default; these are for signed-in people only, and
-- the helpers are for other functions only.
revoke all on function public._pick_tags_json(uuid, boolean) from public, anon, authenticated;
revoke all on function public._feed_card(uuid, uuid) from public, anon, authenticated;

revoke all on function public.save_dish(uuid, uuid) from public, anon;
revoke all on function public.unsave_dish(uuid) from public, anon;
revoke all on function public.get_my_saves() from public, anon;
revoke all on function public.following_feed(timestamptz, text, integer) from public, anon;
revoke all on function public.nearby_feed(integer, integer) from public, anon;
revoke all on function public.get_pick_detail(uuid) from public, anon;
revoke all on function public.place_pickers(uuid, integer) from public, anon;
grant execute on function public.save_dish(uuid, uuid) to authenticated;
grant execute on function public.unsave_dish(uuid) to authenticated;
grant execute on function public.get_my_saves() to authenticated;
grant execute on function public.following_feed(timestamptz, text, integer) to authenticated;
grant execute on function public.nearby_feed(integer, integer) to authenticated;
grant execute on function public.get_pick_detail(uuid) to authenticated;
grant execute on function public.place_pickers(uuid, integer) to authenticated;

revoke all on function public.add_pick(uuid, uuid, text, public.pick_tier, text, uuid[], text[], text, integer)
  from public, anon;
grant execute on function public.add_pick(uuid, uuid, text, public.pick_tier, text, uuid[], text[], text, integer)
  to authenticated;
