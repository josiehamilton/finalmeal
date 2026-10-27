-- Custom places are public businesses, and who added one is private.
--
-- A custom place is a restaurant, cafe, food truck or pop-up that anyone can visit (never
-- someone's home), shown in search and, from Phase 5, on the map. So its address is public,
-- like a Foursquare address. Who added it (created_by) is not: nobody can read that column
-- through the API, and search_places / get_place leave it out.
--
-- 1. places.no_fixed_address: true for a custom spot with no street address (a food truck, a
--    pop-up). It is stored on the city's point like every custom place until addresses are
--    geocoded (Phase 5, in docs/known-gaps.md, where custom spots must get real pins).
-- 2. create_custom_place gets a fourth argument, p_no_fixed_address, and an address rule: an
--    address is required unless the spot has no fixed address, and a spot with no fixed
--    address must not give one (both raise address_required).
-- 3. The table-wide SELECT on public.places is revoked from anon and authenticated; they get
--    column-level SELECT on every column except created_by. A new column needs its own grant
--    in the migration that adds it. `select *` on places is therefore refused (42501) from the
--    API: name the columns, or use search_places / get_place.
-- 4. mask_place(): the one definition of the masking (created_by null).
-- 5. search_places() is redefined as security definer so it can read created_by internally, and
--    returns each row masked. Same signature and ranking. get_place(p_id) is the single-place
--    read. Functions that return places rows to clients must be security definer and call
--    mask_place; create_custom_place returns the creator's own row, as before.

alter table public.places add column no_fixed_address boolean not null default false;

revoke select on public.places from anon, authenticated;
grant select (
  id, source, source_id, name, area, city, region, country, location, category_ids,
  merged_into_id, created_at, updated_at, address, postcode, category_labels, closed_at,
  search_key, no_fixed_address
) on public.places to anon, authenticated;

create function public.mask_place(p public.places)
returns public.places
language plpgsql
stable
set search_path = ''
as $$
declare
  r public.places := p;
begin
  r.created_by := null;
  return r;
end;
$$;
revoke all on function public.mask_place(public.places) from public, anon, authenticated;

create or replace function public.search_places(
  p_q text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_lim integer default 12
)
returns table (place public.places, distance_m double precision)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_words text := btrim(public.place_search_key(coalesce(p_q, '')));
  v_lim integer := least(greatest(coalesce(p_lim, 12), 0), 50);
  v_radius constant double precision := 50000;
  v_point extensions.geography;
  v_prefix text;
  v_word text;
  v_key text;
  v_local integer := 0;
begin
  if p_lat is not null and p_lng is not null then
    if not (p_lat between -90 and 90 and p_lng between -180 and 180) then
      raise exception 'invalid_coordinates';
    end if;
    v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;

  -- No usable text: the nearest places to the point, or nothing without one.
  if v_words = '' then
    if v_point is null then
      return;
    end if;
    return query
    select public.mask_place(r.p), r.dist
    from (
      select p, extensions.st_distance(p.location, v_point) as dist
      from public.places p
      where p.merged_into_id is null and p.closed_at is null
      order by p.location operator(extensions.<->) v_point, p.id
      limit v_lim
    ) r;
    return;
  end if;

  -- v_words has only letters, digits and single spaces, so it needs no LIKE escaping.
  v_prefix := ' ' || v_words || '%';
  v_word := '% ' || v_words || '%';
  v_key := ' ' || v_words;

  if v_point is not null then
    select count(*)::integer into v_local from (
      select 1
      from public.places p
      where p.merged_into_id is null and p.closed_at is null
        and extensions.st_dwithin(p.location, v_point, v_radius)
        and (p.search_key like v_word
             or p.search_key operator(extensions.%) v_key)
      limit 5
    ) s;
  end if;

  return query
  select public.mask_place(r.p), r.dist
  from (
    select
      p,
      case when v_point is null then null else extensions.st_distance(p.location, v_point) end as dist
    from public.places p
    where p.merged_into_id is null and p.closed_at is null
      and (v_point is null or v_local < 5 or extensions.st_dwithin(p.location, v_point, v_radius))
      and (p.search_key like v_word
           or p.search_key operator(extensions.%) v_key)
    order by
      case
        when p.search_key like v_prefix then 0
        when p.search_key like v_word then 1
        else 2
      end,
      case when v_point is null then null else p.location operator(extensions.<->) v_point end,
      p.name,
      p.id
    limit v_lim
  ) r;
end;
$$;

create function public.get_place(p_id uuid)
returns public.places
language sql
stable
security definer
set search_path = ''
as $$
  select public.mask_place(p) from public.places p where p.id = p_id;
$$;
revoke all on function public.get_place(uuid) from public;
grant execute on function public.get_place(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- custom places
drop function public.create_custom_place(text, uuid, text);

create function public.create_custom_place(
  p_name text,
  p_city_id uuid,
  p_address text default null,
  p_no_fixed_address boolean default false
)
returns public.places
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
  v_no_fixed boolean := coalesce(p_no_fixed_address, false);
  v_city public.cities;
  v_place public.places;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 80 or char_length(coalesce(v_address, '')) > 200 then
    raise exception 'invalid_place_name';
  end if;
  -- A public business has a street address, unless it has no fixed one (a food truck, a
  -- pop-up); then it must not give one.
  if v_no_fixed <> (v_address is null) then
    raise exception 'address_required';
  end if;
  select * into v_city from public.cities where id = p_city_id;
  if not found then
    raise exception 'city_not_found';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_not_found';
  end if;

  -- One call at a time per person, so two at once cannot both slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended('create_custom_place:' || v_uid::text, 0));
  if (select count(*) from public.places
      where created_by = v_uid and source = 'custom' and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited';
  end if;

  insert into public.places (source, name, city, region, country, location, address,
                             no_fixed_address, created_by)
  values ('custom', v_name, v_city.name, coalesce(v_city.region_code, v_city.region_name),
          v_city.country, v_city.location, v_address, v_no_fixed, v_uid)
  returning * into v_place;
  return v_place;
end;
$$;

revoke all on function public.create_custom_place(text, uuid, text, boolean) from public, anon;
grant execute on function public.create_custom_place(text, uuid, text, boolean) to authenticated;
