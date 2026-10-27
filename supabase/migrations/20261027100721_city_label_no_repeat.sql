-- City label: drop the region when it only repeats the city ("Tokyo, Japan", not
-- "Tokyo, Tokyo, Japan"). The region is left out when it equals the city name or starts with
-- it, ignoring case ("Ho Chi Minh City (HCMC)" for Ho Chi Minh City). Everything else is
-- unchanged: name, then region_code (US, CA, AU only, otherwise region_name), then country_name.
-- Mirrored by formatCityLabel in packages/api/src/cities.ts.
create or replace function public.city_label(c public.cities)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat_ws(', ', c.name,
    case when starts_with(lower(x.region), lower(c.name)) then null else x.region end,
    c.country_name)
  from (select case when c.country in ('US', 'CA', 'AU') then c.region_code else c.region_name end as region) x;
$$;

-- Labels were stored on the profile when the home city was set: recompute them.
update public.profiles p
set home_place_text = public.city_label(c)
from public.cities c
where c.id = p.home_city_id
  and p.home_place_text is distinct from public.city_label(c);
