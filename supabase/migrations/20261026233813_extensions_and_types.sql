-- Extensions (all in the `extensions` schema)
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists citext with schema extensions;

-- Enums
create type public.profile_visibility as enum ('public', 'private');
create type public.trust_level as enum ('new', 'trusted', 'flagged');
create type public.place_source as enum ('fsq', 'custom');
create type public.pick_tier as enum ('final', 'honorable');
create type public.tag_kind as enum ('food_type', 'dietary', 'personal');
create type public.follow_status as enum ('active', 'requested');
create type public.activity_type as enum (
  'added_final', 'added_honorable', 'dethroned', 'promoted',
  'followed', 'saved_pick', 'saved_from_list'
);
create type public.report_target as enum ('pick', 'profile', 'list', 'place');
create type public.report_status as enum ('open', 'actioned', 'dismissed');

-- Keeps updated_at current on tables that have it
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Dish name normalisation: unaccent, lower-case, collapse punctuation and
-- whitespace, trim, then fold simple plurals (words > 3 chars ending in s but not ss).
create function public.normalize_dish_name(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(
    case
      when char_length(w) > 3 and w like '%s' and w not like '%ss' then left(w, -1)
      else w
    end,
    ' ' order by ord
  ), '')
  from regexp_split_to_table(
    btrim(regexp_replace(
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, input)),
      '[^[:alnum:]]+', ' ', 'g'
    )),
    ' '
  ) with ordinality as t(w, ord)
  where w <> '';
$$;
