-- Task 2 review fixes for the Discover queries (20261105100000_discover.sql).
--
-- 1. Pins, counts and cards must always agree, so the dish cards' counts (final / honorable /
--    list) and the map's top-dish ranking now leave out people the viewer has blocked and people
--    who have blocked the viewer, exactly like the pins do. They still count trusted accounts only.
--    They used dish_stats, which knows nothing about the viewer. public._discover_dish_counts is
--    the one definition (trusted-only, block-aware); picks_in_view and dishes_in_view both use it.
-- 2. A flagged account never counts for other people: its picks are not shown or counted, even
--    when the viewer follows it. (The flagged person still sees their own picks.) Showing them
--    without counting them would give pins with "0 picks".
-- 3. Speed:
--    - picks (dish_id) index: every pan and every dish search looked picks up by dish, and no index
--      led with dish_id (dish_stats aggregated all of picks);
--    - blocks (blocked_id) index, for "who has blocked me";
--    - the viewer's blocked people are read once per call (public._blocked_with) and each pick is
--      checked against that array, instead of calling _is_blocked per pick; the openable-pick check
--      repeats _can_see's rule inline (the block part is already in the eligibility);
--    - the box and the place lookup no longer share one CASE predicate. A place lookup becomes a
--      box round that place's own point (plus pl.id = p_place_id), and both envelopes are always
--      set, so the predicate is a plain OR of two && tests that the GiST index serves in any plan;
--    - search_dishes looks at no more than 500 candidate names (best match tier first, then
--      similarity).
--
-- Signatures, security and grants of the client-callable functions are unchanged.

create index picks_dish on public.picks (dish_id);
create index blocks_blocked on public.blocks (blocked_id);

-- ---------------------------------------------------------------- helpers
-- Everyone who has blocked p_viewer or been blocked by them.
create function public._blocked_with(p_viewer uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(b.uid), '{}'::uuid[])
  from (
    select blocked_id as uid from public.blocks where blocker_id = p_viewer
    union
    select blocker_id from public.blocks where blocked_id = p_viewer
  ) b;
$$;

-- A dish card's counts as p_viewer sees them: trusted accounts only, without anyone blocked
-- either way. Dishes with no such picks have no row.
create function public._discover_dish_counts(p_viewer uuid, p_dish_ids uuid[])
returns table (dish_id uuid, final_count integer, honorable_count integer, list_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    k.dish_id,
    (count(*) filter (where k.tier = 'final'))::integer,
    (count(*) filter (where k.tier = 'honorable'))::integer,
    count(*)::integer
  from public.picks k
  join public.profiles u on u.id = k.user_id and u.trust_level = 'trusted'
  where k.dish_id = any (p_dish_ids)
    and k.user_id <> all (public._blocked_with(p_viewer))
  group by k.dish_id;
$$;

revoke all on function public._blocked_with(uuid) from public, anon, authenticated;
revoke all on function public._discover_dish_counts(uuid, uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------- eligible picks
create or replace function public._discover_picks(
  p_viewer uuid,
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_tier public.pick_tier default null,
  p_following_only boolean default false,
  p_food_type_ids uuid[] default null,
  p_dietary_ids uuid[] default null,
  p_center_lat double precision default null,
  p_center_lng double precision default null,
  p_radius_m integer default null,
  p_place_id uuid default null,
  p_dish_ids uuid[] default null
)
returns table (
  pick_id uuid,
  owner_id uuid,
  owner_trusted boolean,
  owner_public boolean,
  viewer_follows boolean,
  dish_id uuid,
  place_id uuid,
  tier public.pick_tier,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_by_box boolean := p_place_id is null;
  v_env1 extensions.geometry;
  v_env2 extensions.geometry;
  v_centre extensions.geography;
  v_radius double precision;
  v_blocked uuid[] := public._blocked_with(p_viewer);
  v_foods uuid[] := case when coalesce(cardinality(p_food_type_ids), 0) = 0 then null else p_food_type_ids end;
  v_diets uuid[] := case when coalesce(cardinality(p_dietary_ids), 0) = 0 then null else p_dietary_ids end;
begin
  if (p_center_lat is null) <> (p_center_lng is null)
     or (p_south is not null and not p_south between -90 and 90)
     or (p_north is not null and not p_north between -90 and 90)
     or (p_west is not null and not p_west between -180 and 180)
     or (p_east is not null and not p_east between -180 and 180)
     or (p_center_lat is not null and not p_center_lat between -90 and 90)
     or (p_center_lng is not null and not p_center_lng between -180 and 180)
     or (v_by_box and (p_west is null or p_south is null or p_east is null or p_north is null))
     or (p_south is not null and p_north is not null and p_south > p_north) then
    raise exception 'invalid_coordinates';
  end if;

  -- Both envelopes are always set (the same one twice when the box does not cross the
  -- antimeridian), so the filter below is a plain OR of two && tests.
  if v_by_box then
    if p_west <= p_east then
      v_env1 := extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326);
      v_env2 := v_env1;
    else
      v_env1 := extensions.st_makeenvelope(p_west, p_south, 180, p_north, 4326);
      v_env2 := extensions.st_makeenvelope(-180, p_south, p_east, p_north, 4326);
    end if;
  else
    -- A place lookup is a box round the place's own point.
    select pl.location::extensions.geometry into v_env1 from public.places pl where pl.id = p_place_id;
    v_env2 := v_env1;
  end if;

  if p_center_lat is not null then
    v_centre := extensions.st_setsrid(extensions.st_makepoint(p_center_lng, p_center_lat), 4326)::extensions.geography;
    if p_radius_m is not null then
      v_radius := least(greatest(p_radius_m, 1000), 100000);
    end if;
  end if;

  return query
  select
    k.id, u.id, u.trust_level = 'trusted', u.visibility = 'public', f.follower_id is not null,
    d.id, pl.id, k.tier, k.created_at
  from public.picks k
  join public.profiles u on u.id = k.user_id
  join public.dishes d on d.id = k.dish_id and d.merged_into_id is null
  join public.places pl on pl.id = d.place_id
  left join public.follows f
    on f.follower_id = p_viewer and f.followee_id = u.id and f.status = 'active'
  where (pl.location::extensions.geometry operator(extensions.&&) v_env1
         or pl.location::extensions.geometry operator(extensions.&&) v_env2)
    and (p_place_id is null or pl.id = p_place_id)
    and pl.merged_into_id is null
    and pl.closed_at is null
    and pl.location_precision = 'exact'
    and not pl.no_fixed_address
    -- trusted people, the viewer's own picks, and people the viewer follows; a flagged account
    -- only ever shows to itself
    and (u.id = p_viewer
         or (u.trust_level <> 'flagged' and (u.trust_level = 'trusted' or f.follower_id is not null)))
    and u.id <> all (v_blocked)
    and (not coalesce(p_following_only, false) or f.follower_id is not null)
    and (p_tier is null or k.tier = p_tier)
    and (p_dish_ids is null or d.id = any (p_dish_ids))
    and (v_radius is null or extensions.st_dwithin(pl.location, v_centre, v_radius))
    and (v_foods is null or exists (
      select 1 from public.pick_tags pt
      join public.tags t on t.id = pt.tag_id and t.kind = 'food_type' and t.owner_id is null
      where pt.pick_id = k.id and pt.tag_id = any (v_foods)))
    and (v_diets is null or exists (
      select 1 from public.pick_tags pt
      join public.tags t on t.id = pt.tag_id and t.kind = 'dietary' and t.owner_id is null
      where pt.pick_id = k.id and pt.tag_id = any (v_diets)));
end;
$$;

-- ---------------------------------------------------------------- map pins
create or replace function public.picks_in_view(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_tier public.pick_tier default null,
  p_following_only boolean default false,
  p_food_type_ids uuid[] default null,
  p_dietary_ids uuid[] default null,
  p_center_lat double precision default null,
  p_center_lng double precision default null,
  p_radius_m integer default null,
  p_limit integer default 300
)
returns table (
  place_id uuid,
  name text,
  area text,
  address text,
  city text,
  lat double precision,
  lng double precision,
  best_tier public.pick_tier,
  pick_count integer,
  list_count integer,
  top_dish_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with m as materialized (
    select * from public._discover_picks(
      (select auth.uid()), p_west, p_south, p_east, p_north,
      p_tier, p_following_only, p_food_type_ids, p_dietary_ids,
      p_center_lat, p_center_lng, p_radius_m)
  ),
  by_place as (
    select
      m.place_id,
      case when bool_or(m.tier = 'final') then 'final' else 'honorable' end::public.pick_tier as best_tier,
      count(*)::integer as pick_count,
      (count(*) filter (where m.owner_trusted))::integer as list_count
    from m
    group by m.place_id
  ),
  by_dish as (
    select m.place_id, m.dish_id, bool_or(m.tier = 'final') as has_final
    from m
    group by m.place_id, m.dish_id
  ),
  counts as (
    select * from public._discover_dish_counts(
      (select auth.uid()), (select array_agg(bd.dish_id) from by_dish bd))
  ),
  top_dish as (
    select distinct on (bd.place_id) bd.place_id, d.name
    from by_dish bd
    join public.dishes d on d.id = bd.dish_id
    left join counts c on c.dish_id = bd.dish_id
    order by bd.place_id, coalesce(c.list_count, 0) desc, bd.has_final desc, d.name, d.id
  )
  select
    pl.id, pl.name, pl.area, pl.address, pl.city,
    extensions.st_y(pl.location::extensions.geometry),
    extensions.st_x(pl.location::extensions.geometry),
    bp.best_tier, bp.pick_count, bp.list_count, td.name
  from by_place bp
  join public.places pl on pl.id = bp.place_id
  join top_dish td on td.place_id = bp.place_id
  order by bp.list_count desc, case when bp.best_tier = 'final' then 0 else 1 end,
           bp.pick_count desc, pl.id
  limit least(greatest(coalesce(p_limit, 300), 0), 300);
$$;

-- ---------------------------------------------------------------- dish cards
-- The openable-pick test is _can_see's rule written inline: blocks are already out of m, and the
-- viewer may see their own picks, public accounts' picks and picks of people they follow.
create or replace function public._discover_dishes(
  p_viewer uuid,
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_tier public.pick_tier default null,
  p_following_only boolean default false,
  p_food_type_ids uuid[] default null,
  p_dietary_ids uuid[] default null,
  p_center_lat double precision default null,
  p_center_lng double precision default null,
  p_radius_m integer default null,
  p_place_id uuid default null,
  p_dish_ids uuid[] default null,
  p_with_people boolean default true
)
returns table (
  dish_id uuid,
  dish_name text,
  place public.places,
  best_tier public.pick_tier,
  final_count integer,
  honorable_count integer,
  list_count integer,
  pick_id uuid,
  photo_path text,
  distance_m double precision,
  people jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with m as materialized (
    select * from public._discover_picks(
      p_viewer, p_west, p_south, p_east, p_north,
      p_tier, p_following_only, p_food_type_ids, p_dietary_ids,
      p_center_lat, p_center_lng, p_radius_m, p_place_id, p_dish_ids)
  ),
  by_dish as (
    select m.dish_id,
           case when bool_or(m.tier = 'final') then 'final' else 'honorable' end::public.pick_tier as best_tier
    from m
    group by m.dish_id
  ),
  counts as (
    select * from public._discover_dish_counts(p_viewer, (select array_agg(bd.dish_id) from by_dish bd))
  ),
  openable as (
    select distinct on (m.dish_id) m.dish_id, m.pick_id, k.photo_path
    from m
    join public.picks k on k.id = m.pick_id
    where m.owner_id = p_viewer or m.owner_public or m.viewer_follows
    order by m.dish_id, (m.owner_id = p_viewer) desc, m.viewer_follows desc,
             (m.tier = 'final') desc, m.created_at desc, m.pick_id
  ),
  named as (
    select r.dish_id,
           jsonb_agg(jsonb_build_object('id', r.id, 'username', r.username,
                                        'display_name', r.display_name, 'avatar_path', r.avatar_path)
                     order by r.rn) as people
    from (
      select m.dish_id, u.id, u.username::text as username, u.display_name, u.avatar_path,
             row_number() over (partition by m.dish_id
                                order by m.viewer_follows desc, m.created_at desc, u.username) as rn
      from m
      join public.profiles u on u.id = m.owner_id
      where p_with_people and m.owner_public and m.owner_id <> p_viewer
    ) r
    where r.rn <= 3
    group by r.dish_id
  )
  select
    d.id, d.name, public.mask_place(pl), bd.best_tier,
    coalesce(c.final_count, 0), coalesce(c.honorable_count, 0), coalesce(c.list_count, 0),
    o.pick_id, o.photo_path,
    case when p_center_lat is null then null
      else extensions.st_distance(
        pl.location,
        extensions.st_setsrid(extensions.st_makepoint(p_center_lng, p_center_lat), 4326)::extensions.geography)
    end,
    coalesce(n.people, '[]'::jsonb)
  from by_dish bd
  join public.dishes d on d.id = bd.dish_id
  join public.places pl on pl.id = d.place_id
  left join counts c on c.dish_id = d.id
  left join openable o on o.dish_id = d.id
  left join named n on n.dish_id = d.id;
$$;

-- ---------------------------------------------------------------- dish search
-- As before, but at most 500 candidate dishes go to the eligibility pass: the best match tier
-- first, then the most similar name.
create or replace function public.search_dishes(
  p_q text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_limit integer default 20
)
returns table (
  dish_id uuid,
  dish_name text,
  place public.places,
  best_tier public.pick_tier,
  final_count integer,
  honorable_count integer,
  list_count integer,
  pick_id uuid,
  photo_path text,
  distance_m double precision,
  people jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  -- The patterns are written on name_key itself (no expression around the column) so the
  -- trigram GIN index serves all three tests; a word start is '% ' || query || '%'.
  with cand as (
    select d.id,
           case when d.name_key like public.normalize_dish_name(coalesce(p_q, '')) || '%' then 1
                when d.name_key like '% ' || public.normalize_dish_name(coalesce(p_q, '')) || '%' then 2
                else 3 end as match_tier
    from public.dishes d
    where public.normalize_dish_name(coalesce(p_q, '')) <> '' and d.merged_into_id is null
      and (d.name_key like public.normalize_dish_name(coalesce(p_q, '')) || '%'
           or d.name_key like '% ' || public.normalize_dish_name(coalesce(p_q, '')) || '%'
           or d.name_key operator(extensions.%) public.normalize_dish_name(coalesce(p_q, '')))
    order by 2, extensions.similarity(d.name_key, public.normalize_dish_name(coalesce(p_q, ''))) desc, d.id
    limit 500
  )
  select r.*
  from public._discover_dishes(
    (select auth.uid()), -180, -90, 180, 90,
    p_center_lat => p_lat, p_center_lng => p_lng,
    p_dish_ids => coalesce((select array_agg(c.id) from cand c), '{}'::uuid[]),
    p_with_people => false) r
  join cand c on c.id = r.dish_id
  order by c.match_tier,
           case when p_lat is not null and r.distance_m <= 50000 then 0 else 1 end,
           r.list_count desc, r.distance_m nulls last, r.dish_name, r.dish_id
  limit least(greatest(coalesce(p_limit, 20), 0), 20);
$$;
