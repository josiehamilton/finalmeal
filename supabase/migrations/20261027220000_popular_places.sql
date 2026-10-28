-- Restaurant search with an empty field: the most-picked spots in a chosen city.
--
-- search_places('', point) returns the nearest places in the world, which is not "popular in
-- that city" (it spills into other cities and, in the dev seed, other countries). popular_places
-- answers the Add-a-dish screen's empty state.
--
-- "In that city" means within 25 km of the city's point, not a match on the place's city,
-- region and country text: Foursquare locality strings vary ("Vancouver", "North Vancouver",
-- "Burnaby"), while the radius covers a metro area the same way for every city, and custom places
-- already sit on their city's point. Order: picks per place (all picks, trusted or not) most
-- first, then nearest to the city's point, then name. Merged and closed places are left out.
-- Security definer (it counts picks across people, which RLS hides), search_path '', every row
-- masked (created_by null), open to anon and authenticated. The point is the city's, never the
-- phone's location.
create function public.popular_places(p_city_id uuid, p_lim integer default 12)
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
  ) r;
end;
$$;

revoke all on function public.popular_places(uuid, integer) from public;
grant execute on function public.popular_places(uuid, integer) to anon, authenticated;
