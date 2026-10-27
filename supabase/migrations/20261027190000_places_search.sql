-- Places: search, custom places, and the columns the Foursquare import fills.
--
-- 1. New columns on places: address, postcode, category_labels (leaf names such as
--    "Ramen Restaurant", for display) and closed_at (set by the import when Foursquare marks a
--    place closed). Search never shows a closed place or one merged into another.
-- 2. place_search_key() and the stored column places.search_key: the text search compares names
--    through this key (accents removed, lower case, apostrophes dropped, every other run of
--    non-letters/digits one space, and a leading space), so "luke's lob" finds "Luke’s Lobster",
--    "kao" finds "Kin Kao" and "cafe zurich" finds "Café Zürich". One trigram index on the key
--    serves every match.
-- 3. search_places(): type-ahead. Order: name starts with the query, then a word in the name
--    starts with it, then typos (trigram). With a point, ties inside a tier go to the nearest,
--    and only places within 50 km are searched unless that finds fewer than 5, in which case
--    the whole world is searched. Without a point, ties go to the name.
-- 4. create_custom_place(): "Can't find it? Add it". A name, an optional address and a city.
--    The place sits on the city's point (geocoding the address is a Phase 5 known gap), so no
--    location permission is ever needed.

alter table public.places
  add column address text,
  add column postcode text,
  add column category_labels text[] not null default '{}',
  add column closed_at date;

create function public.place_search_key(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select ' ' || btrim(regexp_replace(
    regexp_replace(public.city_fold(input), '[''’]', '', 'g'),
    '[^[:alnum:]]+', ' ', 'g'));
$$;

-- Stored, so a search compares text it already has instead of re-folding every candidate name.
alter table public.places
  add column search_key text generated always as (public.place_search_key(name)) stored;
create index places_search_key_trgm on public.places
  using gin (search_key extensions.gin_trgm_ops);

-- ---------------------------------------------------------------- search
create function public.search_places(
  p_q text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_lim integer default 12
)
returns table (place public.places, distance_m double precision)
language plpgsql
stable
security invoker
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
    select p, extensions.st_distance(p.location, v_point)
    from public.places p
    where p.merged_into_id is null and p.closed_at is null
    order by p.location operator(extensions.<->) v_point, p.id
    limit v_lim;
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
  select
    p,
    case when v_point is null then null else extensions.st_distance(p.location, v_point) end
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
  limit v_lim;
end;
$$;

-- ---------------------------------------------------------------- custom places
create function public.create_custom_place(
  p_name text,
  p_city_id uuid,
  p_address text default null
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
  v_city public.cities;
  v_place public.places;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 80 or char_length(coalesce(v_address, '')) > 200 then
    raise exception 'invalid_place_name';
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

  insert into public.places (source, name, city, region, country, location, address, created_by)
  values ('custom', v_name, v_city.name, coalesce(v_city.region_code, v_city.region_name),
          v_city.country, v_city.location, v_address, v_uid)
  returning * into v_place;
  return v_place;
end;
$$;

revoke all on function public.create_custom_place(text, uuid, text) from public, anon;
grant execute on function public.create_custom_place(text, uuid, text) to authenticated;
