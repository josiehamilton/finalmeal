-- Phase 5, Task 2: the Discover queries.
--
-- 1. A GiST index on the places' points as geometry, so a bounding-box query (the && operator)
--    can use it.
-- 2. public._discover_picks: the one place that decides which picks Discover may show the
--    viewer, and which of them match the filters. Everything below is built on it, so the map
--    pins, the sheet's dish cards and dish search can never disagree about who appears.
-- 3. picks_in_view (map pins), dishes_in_view (the sheet's dish cards) and search_dishes (the
--    Discover search box). All three are for signed-in people only.
-- 4. search_people gets followers_count (active followers), a new last column.
--
-- Who appears (spec 5.4): a pick appears when its owner is 'trusted', or is the viewer, or is
-- someone the viewer actively follows; never across a block (either direction); never at a
-- merged or closed place, a merged dish, or a place that is only at city precision (a custom
-- spot nobody has geocoded yet, or one with no fixed address). Private accounts' picks count and
-- pin, but a private account is never named. A card opens a pick only when the viewer may see
-- it (_can_see).

-- ---------------------------------------------------------------- index
create index places_location_geom on public.places using gist ((location::extensions.geometry));

-- ---------------------------------------------------------------- eligible picks
-- Internal (execute revoked from clients); the public functions below pass auth.uid().
--
-- p_west/p_south/p_east/p_north is the viewport. p_west > p_east means it crosses the
-- antimeridian (two envelopes, [west, 180] and [-180, east]). With p_place_id only that place
-- is looked at and the box is ignored (it may be null); otherwise all four bounds are required.
-- Anything out of range, or a bound missing, or a centre with only one half, raises
-- 'invalid_coordinates'.
--
-- Filters (all optional): p_tier (null = both tiers), p_following_only (only people the viewer
-- actively follows; the viewer's own picks are then left out), p_food_type_ids and p_dietary_ids
-- (global tag ids; the pick needs at least one of each list that is given, and an empty list is
-- the same as none), and a centre with p_radius_m (clamped to 1 000..100 000, used only with a
-- centre). p_dish_ids restricts to those dishes (dish search uses it so it does not scan every
-- pick in the world); null means all dishes.
create function public._discover_picks(
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

  if v_by_box then
    if p_west <= p_east then
      v_env1 := extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326);
    else
      v_env1 := extensions.st_makeenvelope(p_west, p_south, 180, p_north, 4326);
      v_env2 := extensions.st_makeenvelope(-180, p_south, p_east, p_north, 4326);
    end if;
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
  where pl.merged_into_id is null
    and pl.closed_at is null
    and pl.location_precision = 'exact'
    and not pl.no_fixed_address
    and (u.trust_level = 'trusted' or u.id = p_viewer or f.follower_id is not null)
    and not public._is_blocked(p_viewer, u.id)
    and (not coalesce(p_following_only, false) or f.follower_id is not null)
    and (p_tier is null or k.tier = p_tier)
    and (p_dish_ids is null or d.id = any (p_dish_ids))
    and (
      case when v_by_box then
        pl.location::extensions.geometry operator(extensions.&&) v_env1
        or (v_env2 is not null and pl.location::extensions.geometry operator(extensions.&&) v_env2)
      else pl.id = p_place_id end
    )
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
-- One row per place with a matching pick. best_tier is 'final' when any matching pick there is
-- a Final Meal. pick_count counts the matching picks; list_count counts those whose owner is
-- trusted. top_dish_name is the matching dish with the most trusted lists (dish_stats), then one
-- that is somebody's Final first, then by name. The 300 most-listed places, most-listed first.
create function public.picks_in_view(
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
  top_dish as (
    select distinct on (bd.place_id) bd.place_id, d.name
    from by_dish bd
    join public.dishes d on d.id = bd.dish_id
    left join public.dish_stats ds on ds.dish_id = bd.dish_id
    order by bd.place_id, coalesce(ds.list_count, 0) desc, bd.has_final desc, d.name, d.id
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
-- The shared body of dishes_in_view and search_dishes (internal). One row per dish with a
-- matching pick, unordered. Counts come from dish_stats (trusted people only, everyone). pick_id
-- and photo_path are the pick a card may open: among the matching picks the viewer may see
-- (_can_see), the viewer's own first, then people the viewer follows, then public ones, a Final
-- Meal before an honorable, newest first; null when there is none. people are up to three
-- public owners of matching picks (never the viewer; people the viewer follows first, then the
-- newest pick), and a private account is never named. p_with_people false leaves them out.
create function public._discover_dishes(
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
  openable as (
    select distinct on (m.dish_id) m.dish_id, m.pick_id, k.photo_path
    from m
    join public.picks k on k.id = m.pick_id
    where public._can_see(p_viewer, m.owner_id)
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
    coalesce(ds.final_count, 0), coalesce(ds.honorable_count, 0), coalesce(ds.list_count, 0),
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
  left join public.dish_stats ds on ds.dish_id = d.id
  left join openable o on o.dish_id = d.id
  left join named n on n.dish_id = d.id;
$$;

-- The sheet's dish cards for a viewport (or, with p_place_id, one place). Most-listed first,
-- then a Final Meal before an honorable, then nearest to the centre (when there is one), then
-- name. At most 50.
create function public.dishes_in_view(
  p_west double precision default null,
  p_south double precision default null,
  p_east double precision default null,
  p_north double precision default null,
  p_tier public.pick_tier default null,
  p_following_only boolean default false,
  p_food_type_ids uuid[] default null,
  p_dietary_ids uuid[] default null,
  p_center_lat double precision default null,
  p_center_lng double precision default null,
  p_radius_m integer default null,
  p_place_id uuid default null,
  p_limit integer default 50
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
  select r.*
  from public._discover_dishes(
    (select auth.uid()), p_west, p_south, p_east, p_north,
    p_tier, p_following_only, p_food_type_ids, p_dietary_ids,
    p_center_lat, p_center_lng, p_radius_m, p_place_id) r
  order by r.list_count desc, case when r.best_tier = 'final' then 0 else 1 end,
           r.distance_m nulls last, r.dish_name, r.dish_id
  limit least(greatest(coalesce(p_limit, 50), 0), 50);
$$;

-- ---------------------------------------------------------------- dish search
-- Dishes anyone the viewer can see has picked (the same eligibility as the map, no filters, but
-- anywhere in the world). The query is normalised like dish names (normalize_dish_name), then
-- matched against name_key: starts with the query (tier 1), a word starts with it (tier 2),
-- trigram similarity (tier 3). A blank query returns nothing. Order: match tier; with a point,
-- dishes within 50 km first; most-listed; nearest; name. distance_m is from the point (null
-- without one). people is always empty here.
create function public.search_dishes(
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
  with q as (
    select public.normalize_dish_name(coalesce(p_q, '')) as key
  ),
  cand as (
    select d.id,
           case when d.name_key like q.key || '%' then 1
                when ' ' || d.name_key like '% ' || q.key || '%' then 2
                else 3 end as match_tier
    from public.dishes d
    cross join q
    where q.key <> '' and d.merged_into_id is null
      and (d.name_key like q.key || '%'
           or ' ' || d.name_key like '% ' || q.key || '%'
           or d.name_key operator(extensions.%) q.key)
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

-- ---------------------------------------------------------------- people search
-- The previous body (20261103100100_follows.sql) with followers_count (active followers) added
-- as the last column; matching, order and rules are unchanged.
drop function public.search_people(text, integer);
create function public.search_people(p_q text, p_limit integer default 20)
returns table (
  id uuid, username text, display_name text, avatar_path text, viewer_follow text,
  follows_viewer boolean, is_me boolean, followers_count integer
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
    false,
    c.n::integer
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

-- ---------------------------------------------------------------- privileges
-- Supabase grants new functions to anon by default. The internal helpers are for other
-- functions only; the rest are for signed-in people only.
revoke all on function public._discover_picks(uuid, double precision, double precision, double precision,
  double precision, public.pick_tier, boolean, uuid[], uuid[], double precision, double precision,
  integer, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public._discover_dishes(uuid, double precision, double precision, double precision,
  double precision, public.pick_tier, boolean, uuid[], uuid[], double precision, double precision,
  integer, uuid, uuid[], boolean) from public, anon, authenticated;

revoke all on function public.picks_in_view(double precision, double precision, double precision,
  double precision, public.pick_tier, boolean, uuid[], uuid[], double precision, double precision,
  integer, integer) from public, anon;
revoke all on function public.dishes_in_view(double precision, double precision, double precision,
  double precision, public.pick_tier, boolean, uuid[], uuid[], double precision, double precision,
  integer, uuid, integer) from public, anon;
revoke all on function public.search_dishes(text, double precision, double precision, integer)
  from public, anon;
revoke all on function public.search_people(text, integer) from public, anon;

grant execute on function public.picks_in_view(double precision, double precision, double precision,
  double precision, public.pick_tier, boolean, uuid[], uuid[], double precision, double precision,
  integer, integer) to authenticated;
grant execute on function public.dishes_in_view(double precision, double precision, double precision,
  double precision, public.pick_tier, boolean, uuid[], uuid[], double precision, double precision,
  integer, uuid, integer) to authenticated;
grant execute on function public.search_dishes(text, double precision, double precision, integer)
  to authenticated;
grant execute on function public.search_people(text, integer) to authenticated;
