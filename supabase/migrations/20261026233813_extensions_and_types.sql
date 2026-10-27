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

-- Dish name normalisation: unaccent, lower-case, split into words on whitespace,
-- punctuation, control characters and symbols (including emoji), then fold simple
-- plurals (words > 3 chars ending in s but not ss).
-- Words are split on separators rather than "anything that is not a letter", so combining
-- marks (Thai tone marks, Devanagari vowel signs, ...) stay inside their word. The symbol
-- ranges are explicit because the database's [:punct:] class covers punctuation only, not
-- symbols: ASCII symbols, Latin-1 symbols, general punctuation, currency, arrows, maths,
-- technical, shapes and dingbats, CJK symbols, fullwidth punctuation, emoji and tags.
-- U+200C/U+200D (zero-width joiners, needed inside Persian/Indic words) are kept; those left
-- at the edge of a word by an emoji sequence are trimmed. A name with no letters or digits
-- normalises to '' and is rejected by the dishes.name_key check.
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
    regexp_replace(
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, input)),
      '[[:space:][:punct:][:cntrl:]$+<=>^`|~\u00A0-\u00A9\u00AB-\u00B4\u00B6-\u00B9\u00BB-\u00BF\u00D7\u00F7\u2000-\u200B\u200E-\u206F\u20A0-\u20CF\u2100-\u214F\u2190-\u2BFF\u2E00-\u2E7F\u3000-\u3004\u3008-\u3020\u3030\u3036-\u3037\u303D-\u303F\u3200-\u33FF\u4DC0-\u4DFF\uFE00-\uFE0F\uFE10-\uFE1F\uFE30-\uFE6F\uFEFF\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\uFFE0-\uFFEE\uFFFC\uFFFD\U0001F000-\U0001FAFF\U000E0000-\U000E007F]+',
      ' ', 'g'
    ),
    ' '
  ) with ordinality as t(raw, ord),
  lateral (select btrim(raw, chr(8204) || chr(8205)) as w) trimmed
  where w <> '';
$$;
