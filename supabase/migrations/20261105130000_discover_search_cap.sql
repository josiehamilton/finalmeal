-- Task 2 review fixes, round 2.
--
-- 1. search_dishes' 500-candidate cap now happens after the cheap eligibility checks: a candidate
--    must be at an open, unmerged, exact place and have at least one pick the caller can see (the
--    same rules as _discover_picks: trusted, the caller's own, or actively followed and not
--    flagged; never across a block). The cap keeps the best match tier first, then (with a point)
--    those within 50 km, then the most similar names, which is the order of the final result, so
--    it never cuts the nearest listed dish and never fills with dishes nobody can see.
-- 2. _discover_dish_counts reads the blocked people once per call, not once per pick.
--
-- Signatures, security and grants are unchanged.

create or replace function public._discover_dish_counts(p_viewer uuid, p_dish_ids uuid[])
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
    and k.user_id <> all (coalesce((select public._blocked_with(p_viewer)), '{}'::uuid[]))
  group by k.dish_id;
$$;

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
  -- The patterns are written on name_key itself so the trigram GIN index serves them; a word
  -- start is '% ' || query || '%'.
  with me as (
    select (select auth.uid()) as uid,
           public._blocked_with((select auth.uid())) as blocked,
           public.normalize_dish_name(coalesce(p_q, '')) as key,
           case when p_lat is not null and p_lng is not null
             then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
           end as pt
  ),
  cand as (
    select d.id,
           case when d.name_key like (select key from me) || '%' then 1
                when d.name_key like '% ' || (select key from me) || '%' then 2
                else 3 end as match_tier,
           case when (select pt from me) is not null
                     and extensions.st_dwithin(pl.location, (select pt from me), 50000) then 0
                else 1 end as near
    from public.dishes d
    join public.places pl on pl.id = d.place_id
    where (select key from me) <> '' and d.merged_into_id is null
      and (d.name_key like (select key from me) || '%'
           or d.name_key like '% ' || (select key from me) || '%'
           or d.name_key operator(extensions.%) (select key from me))
      and pl.merged_into_id is null and pl.closed_at is null
      and pl.location_precision = 'exact' and not pl.no_fixed_address
      and exists (
        select 1
        from public.picks k
        join public.profiles u on u.id = k.user_id
        where k.dish_id = d.id
          and u.id <> all (coalesce((select blocked from me), '{}'::uuid[]))
          and (u.id = (select uid from me)
               or (u.trust_level <> 'flagged'
                   and (u.trust_level = 'trusted'
                        or exists (select 1 from public.follows f
                                   where f.follower_id = (select uid from me)
                                     and f.followee_id = u.id and f.status = 'active')))))
    order by 2, 3, extensions.similarity(d.name_key, (select key from me)) desc, d.id
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
