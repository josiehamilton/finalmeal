-- Tag fixes found in review of the tag_vocabulary migration.
--
-- 1. A personal tag's slug is always derived from its name, on every write path. The Phase 1
--    policies still let a person insert and rename their own personal tags directly, with
--    any slug, which could leave two rows that create_personal_tag treats as different (or a
--    renamed tag with its old slug). This trigger tidies the name (trimmed, inner whitespace
--    collapsed) and sets slug = tag_slug(name), so (owner_id, slug) is unique and consistent
--    however the row is written; a clash is a unique_violation (23505).
-- 2. search_tags also matches the start of any word in a name or alias ("fried" finds
--    "Korean fried chicken"), after whole-name and whole-alias prefixes and before the typo
--    (trigram) fallback.

create function public.tags_set_personal_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'personal' then
    new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
    new.slug := public.tag_slug(new.name);
  end if;
  return new;
end;
$$;

create trigger tags_set_personal_slug before insert or update of name, slug, kind on public.tags
  for each row execute function public.tags_set_personal_slug();

-- ---------------------------------------------------------------- search
-- Order: whole-name prefix, whole-alias prefix, start of any word in the name or an alias,
-- then trigram typo matches by similarity. Within the first three, shorter names first.
-- Word starts are compared on text where every run of non-letters/digits is one space, so
-- "low-fod" finds "Low-FODMAP"; a query with no letters or digits has no word match (and
-- LIKE wildcards in a query are escaped for the prefix match, as before).
create or replace function public.search_tags(p_kind public.tag_kind, p_q text, p_lim integer default 10)
returns setof public.tags
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_folded text := public.city_fold(btrim(coalesce(p_q, '')));
  v_like text;
  v_words text;
  v_word_like text;
begin
  if v_folded = '' then
    return query select * from public.popular_tags(p_kind);
    return;
  end if;

  v_like := replace(replace(replace(v_folded, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_words := btrim(regexp_replace(v_folded, '[^[:alnum:]]+', ' ', 'g'));
  -- v_words has only letters, digits and single spaces, so it needs no LIKE escaping.
  v_word_like := case when v_words = '' then null else '% ' || v_words || '%' end;

  return query
  select t.*
  from public.tags t
  cross join lateral (
    select
      coalesce(bool_or(public.city_fold(n) like v_like) filter (where i = 0), false) as name_prefix,
      coalesce(bool_or(public.city_fold(n) like v_like) filter (where i > 0), false) as alias_prefix,
      coalesce(bool_or(
        ' ' || btrim(regexp_replace(public.city_fold(n), '[^[:alnum:]]+', ' ', 'g')) like v_word_like
      ), false) as word_start,
      coalesce(max(extensions.similarity(public.city_fold(n), v_folded)), 0) as sim,
      coalesce(bool_or(public.city_fold(n) operator(extensions.%) v_folded), false) as fuzzy
    from unnest(array[t.name] || t.aliases) with ordinality as x(n, i0)
    cross join lateral (select i0 - 1 as i) as o
  ) m
  where t.kind = p_kind
    and case
      when p_kind = 'personal' then t.owner_id = (select auth.uid())
      else t.owner_id is null
    end
    and (m.name_prefix or m.alias_prefix or m.word_start or m.fuzzy)
  order by
    case
      when m.name_prefix then 0
      when m.alias_prefix then 1
      when m.word_start then 2
      else 3
    end,
    case when m.name_prefix or m.alias_prefix or m.word_start then char_length(t.name) end,
    m.sim desc,
    t.name,
    t.id
  limit least(greatest(coalesce(p_lim, 10), 0), 50);
end;
$$;
