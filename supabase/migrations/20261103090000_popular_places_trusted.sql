-- popular_places counts trusted accounts only, and its order is explicit.
--
-- 1. The spec's Authenticity rule is "trusted-only counts and rankings", enforced in the
--    database. suggest_dishes and dish_stats already do this; popular_places counted every
--    pick, so a few fresh accounts could push any place to the top of a city's most-picked
--    list (the empty state of restaurant search). The counts now join profiles on
--    trust_level = 'trusted', the same rule as dish_stats.
-- 2. The outer select repeats the inner ORDER BY, so the order is guaranteed rather than
--    preserved in practice.
--
-- Signature, security (security definer, search_path = '') and grants are unchanged; the
-- statements below restate them so this file stands on its own.
create or replace function public.popular_places(p_city_id uuid, p_lim integer default 12)
returns table (place public.places, pick_count bigint, distance_m double precision)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lim integer := least(greatest(coalesce(p_lim, 12), 0), 50);
  v_radius constant double precision := 25000;
  v_point extensions.geography;
begin
  select c.location into v_point from public.cities c where c.id = p_city_id;
  if v_point is null then
    return;
  end if;

  return query
  with nearby as (
    select p.id
    from public.places p
    where p.merged_into_id is null and p.closed_at is null
      and extensions.st_dwithin(p.location, v_point, v_radius)
  ),
  counts as (
    select d.place_id, count(*) as n
    from public.dishes d
    join public.picks k on k.dish_id = d.id
    join public.profiles u on u.id = k.user_id and u.trust_level = 'trusted'
    where d.place_id in (select nb.id from nearby nb)
    group by d.place_id
  )
  select public.mask_place(r.p), r.n, r.dist
  from (
    select
      p,
      coalesce(c.n, 0)::bigint as n,
      extensions.st_distance(p.location, v_point) as dist
    from public.places p
    join nearby nb on nb.id = p.id
    left join counts c on c.place_id = p.id
    order by coalesce(c.n, 0) desc, dist, p.name, p.id
    limit v_lim
  ) r
  order by r.n desc, r.dist, (r.p).name, (r.p).id;
end;
$$;

revoke all on function public.popular_places(uuid, integer) from public;
grant execute on function public.popular_places(uuid, integer) to anon, authenticated;
