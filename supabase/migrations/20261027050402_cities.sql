-- World cities (GeoNames cities15000): the pick-list for a person's home city.
-- Label format used everywhere: name, then region_code (country US, CA or AU only,
-- otherwise region_name), then country_name, e.g. "Vancouver, BC, Canada".
-- City data © GeoNames (CC BY 4.0).

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  geoname_id integer unique not null,
  name text not null,
  ascii_name text not null,
  region_code text,
  region_name text,
  country char(2) not null,
  country_name text not null,
  population integer not null default 0,
  location extensions.geography(Point, 4326) not null
);

create index cities_name_trgm on public.cities using gin (name extensions.gin_trgm_ops);
create index cities_ascii_name_trgm on public.cities using gin (ascii_name extensions.gin_trgm_ops);

-- unaccent() is not immutable, so indexes and searches go through this wrapper (the same
-- pattern as normalize_dish_name). It folds case and accents: "Zürich" -> "zurich".
-- GeoNames' own ascii_name transliterates instead ("Zuerich"), so search matches both.
create function public.city_fold(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, input));
$$;

create index cities_folded_name_trgm on public.cities
  using gin (public.city_fold(name) extensions.gin_trgm_ops);
create index cities_location_gist on public.cities using gist (location);

-- Read-only to clients. Writes happen through the import script (service role / direct connection).
alter table public.cities enable row level security;
revoke all on public.cities from anon, authenticated;
grant select on public.cities to anon, authenticated;
create policy cities_select_all on public.cities
  for select to anon, authenticated using (true);

-- Profiles point at a city. The label is kept in home_place_text.
alter table public.profiles
  add column home_city_id uuid references public.cities on delete set null;
create index profiles_home_city_id_idx on public.profiles (home_city_id);

-- Type-ahead search. Accent- and case-insensitive. Prefix matches (on the display name,
-- its accent-folded form, or GeoNames' transliterated ascii_name) come first, largest city
-- first (then similarity); after them come trigram-only matches (typos) by similarity, then
-- population.
-- An empty or blank query returns nothing.
create function public.search_cities(q text, lim int default 8)
returns setof public.cities
language sql
stable
security invoker
set search_path = ''
as $$
  with p as (
    select
      lower(btrim(coalesce(q, ''))) as raw,
      public.city_fold(btrim(coalesce(q, ''))) as folded
  ),
  pat as (
    select
      raw,
      folded,
      replace(replace(replace(raw, '\', '\\'), '%', '\%'), '_', '\_') || '%' as raw_like,
      replace(replace(replace(folded, '\', '\\'), '%', '\%'), '_', '\_') || '%' as folded_like
    from p
  )
  select c.*
  from public.cities c, pat
  where pat.folded <> ''
    and (
      c.ascii_name ilike pat.folded_like
      or c.name ilike pat.raw_like
      or public.city_fold(c.name) like pat.folded_like
      or c.ascii_name operator(extensions.%) pat.folded
      or public.city_fold(c.name) operator(extensions.%) pat.folded
    )
  order by
    (
      c.ascii_name ilike pat.folded_like
      or c.name ilike pat.raw_like
      or public.city_fold(c.name) like pat.folded_like
    ) desc,
    -- prefix matches: biggest city first; typo (trigram-only) matches fall through to similarity
    case
      when c.ascii_name ilike pat.folded_like
        or c.name ilike pat.raw_like
        or public.city_fold(c.name) like pat.folded_like
      then c.population
      else 0
    end desc,
    greatest(
      extensions.similarity(c.ascii_name, pat.folded),
      extensions.similarity(public.city_fold(c.name), pat.folded)
    ) desc,
    c.population desc,
    c.id
  limit least(greatest(coalesce(lim, 8), 0), 50);
$$;

-- The single nearest city to a point (used to suggest a home city from the device location).
create function public.nearest_city(lat double precision, lng double precision)
returns public.cities
language sql
stable
security invoker
set search_path = ''
as $$
  select c.*
  from public.cities c
  order by c.location operator(extensions.<->)
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
  limit 1;
$$;
