-- Small fixes from the Phase 3 final review.
--
-- 1. create_custom_place's 20-a-day cap raises its own code, custom_place_limit, instead of
--    rate_limited, whose copy ("Wait a minute") is wrong for a daily cap. Signature, security
--    and grants are unchanged. (The only difference from the previous body is the code.)
-- 2. A personal tag whose name is blank once tidied is refused on every write path with
--    invalid_tag_name. create_personal_tag already did this; a direct insert or rename
--    (which RLS still allows) hit the table's raw length check instead. A name with no
--    letters or digits (an emoji) keeps itself as the slug, so it is not blank.
-- 3. dish_stats is a read-only view (GROUP BY makes it non-updatable), but Supabase's default
--    privileges still granted clients INSERT/UPDATE/DELETE/TRUNCATE on it. Revoked, so only
--    SELECT remains.

create or replace function public.create_custom_place(
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
    raise exception 'custom_place_limit';
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

create or replace function public.tags_set_personal_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'personal' then
    new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
    if public.tag_slug(new.name) = '' then
      raise exception 'invalid_tag_name';
    end if;
    new.slug := public.tag_slug(new.name);
  end if;
  return new;
end;
$$;

revoke insert, update, delete, truncate on public.dish_stats from anon, authenticated;
