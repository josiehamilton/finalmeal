-- Phase 2: profiles are created and edited only through narrow doors.
--   * No direct insert; direct update is limited to the columns a person may edit.
--   * Onboarding goes through security-definer functions that raise P0001 with a fixed
--     message (profile_exists, username_taken, invalid_username, city_not_found,
--     profile_not_found) so packages/api can map them to friendly copy.

alter table public.profiles
  add column onboarded_at timestamptz,
  add column show_home_city boolean not null default true;

-- avatar_path may only point at the person's own avatar file (<uid>/avatar-<unix-ms>.jpg),
-- never at someone else's object.
alter table public.profiles
  add constraint profiles_avatar_path_own check (
    avatar_path is null or avatar_path ~ ('^' || id::text || '/avatar-[0-9]+\.jpg$')
  );

-- ---------------------------------------------------------------- grants
drop policy profiles_insert_own on public.profiles;
revoke insert, update on public.profiles from anon, authenticated;
grant update (display_name, username, bio, avatar_path, visibility, show_home_city)
  on public.profiles to authenticated;
-- profiles_update_own (row-level, owner only) stays alongside the column grants.

-- ---------------------------------------------------------------- helpers
-- The one definition of the home-city label: name, then region_code (US, CA, AU only,
-- otherwise region_name), then country_name, e.g. "Vancouver, BC, Canada".
create function public.city_label(c public.cities)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat_ws(', ', c.name,
    case when c.country in ('US', 'CA', 'AU') then c.region_code else c.region_name end,
    c.country_name);
$$;

-- ---------------------------------------------------------------- onboarding functions
create function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(p_username ~ '^[A-Za-z0-9_]{3,30}$', false)
    and not exists (
      select 1 from public.profiles p
      where p.username operator(extensions.=) p_username::extensions.citext
        and p.id is distinct from (select auth.uid())
    );
$$;

create function public.create_my_profile(p_display_name text, p_username text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_constraint text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_exists';
  end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,30}$' then
    raise exception 'invalid_username';
  end if;

  insert into public.profiles (id, display_name, username)
  values (v_uid, p_display_name, p_username::extensions.citext)
  returning * into v_profile;
  return v_profile;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'profiles_pkey' then
      raise exception 'profile_exists';
    end if;
    raise exception 'username_taken';
end;
$$;

create function public.set_my_home_city(p_city_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_city public.cities;
  v_profile public.profiles;
begin
  if p_city_id is not null then
    select * into v_city from public.cities where id = p_city_id;
    if not found then
      raise exception 'city_not_found';
    end if;
  end if;

  update public.profiles
  set home_city_id = v_city.id,
      home_location = v_city.location,
      home_place_text = case when v_city.id is null then null else public.city_label(v_city) end
  where id = v_uid
  returning * into v_profile;
  if not found then
    raise exception 'profile_not_found';
  end if;
  return v_profile;
end;
$$;

create function public.finish_onboarding()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  update public.profiles
  set onboarded_at = coalesce(onboarded_at, now())
  where id = (select auth.uid())
  returning * into v_profile;
  if not found then
    raise exception 'profile_not_found';
  end if;
  return v_profile;
end;
$$;

-- Executable by signed-in users only. Supabase also grants new functions to anon by default,
-- so revoke from it explicitly.
revoke all on function public.is_username_available(text) from public, anon;
revoke all on function public.create_my_profile(text, text) from public, anon;
revoke all on function public.set_my_home_city(uuid) from public, anon;
revoke all on function public.finish_onboarding() from public, anon;
grant execute on function public.is_username_available(text) to authenticated;
grant execute on function public.create_my_profile(text, text) to authenticated;
grant execute on function public.set_my_home_city(uuid) to authenticated;
grant execute on function public.finish_onboarding() to authenticated;
