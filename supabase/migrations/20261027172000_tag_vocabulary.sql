-- Phase 3: the tag vocabulary is reference data, so it lives in a migration and reaches
-- production (seed.sql is dev-only). Phase 1 seeded the same global tags from seed.sql; the
-- upsert below is keyed by (kind, slug), so a database that already has them converges on
-- the same rows and a fresh one just gets them.

alter table public.tags
  add column aliases text[] not null default '{}',
  -- Position in the "Popular" list on TagSearch. Null sorts last (not in the list).
  add column display_order integer;

-- ---------------------------------------------------------------- slugs and search folding
-- The one definition of a tag's slug: accents removed, lower case, runs of anything that is
-- not a letter or digit become one dash. It reproduces the Phase 1 rule for every seeded
-- name ("Korean BBQ" -> korean-bbq, "Low-FODMAP" -> low-fodmap). A name with no letters or
-- digits at all (an emoji) keeps itself as the slug.
create function public.tag_slug(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      btrim(regexp_replace(public.city_fold(input), '[^[:alnum:]]+', '-', 'g'), '-'),
      ''),
    lower(btrim(input)));
$$;

-- ---------------------------------------------------------------- the vocabulary
-- Re-runnable on purpose: a later migration, or a test, can call it again. Featured tags
-- carry display_order (the Popular list); everything else has none. Not callable by clients.
create function public.apply_tag_vocabulary()
returns void
language sql
set search_path = ''
as $$
  insert into public.tags (kind, name, slug, aliases, is_featured, display_order)
  select kind, name, public.tag_slug(name), aliases, display_order is not null, display_order
  from (
    select 'food_type'::public.tag_kind as kind, v.name, v.aliases, v.display_order
    from (values
      ('Greek', '{}'::text[], null),
      ('Rice bowl', array['donburi']::text[], null),
      ('Indian', '{}'::text[], null),
      ('Seafood', '{}'::text[], 12),
      ('Tacos', array['taco']::text[], 8),
      ('Burgers', array['burger', 'hamburger']::text[], 7),
      ('Sandwiches', array['sandwich', 'subs']::text[], null),
      ('Thai', '{}'::text[], null),
      ('Noodles', array['noodle']::text[], 2),
      ('Ramen', array['ramen noodles']::text[], 1),
      ('Sushi', array['nigiri', 'maki']::text[], 6),
      ('Bakery', array['bakeries']::text[], 11),
      ('Dumplings', array['gyoza', 'potstickers']::text[], null),
      ('Pork', '{}'::text[], 5),
      ('Japanese', '{}'::text[], 3),
      ('Soup', array['soups']::text[], 4),
      ('Pizza', array['pie']::text[], 9),
      ('BBQ', array['barbecue', 'barbeque']::text[], 10),
      ('Dessert', array['sweets']::text[], null),
      ('Breakfast', '{}'::text[], null),
      ('Korean', '{}'::text[], null),
      ('Korean BBQ', '{}'::text[], null),
      ('Dim sum', array['yum cha']::text[], null),
      ('Pho', array['vietnamese noodle soup']::text[], null),
      ('Curry', '{}'::text[], null),
      ('Brunch', array['eggs benedict']::text[], null),
      ('Ice cream', array['icecream']::text[], null),
      ('Korean fried chicken', '{}'::text[], null),
      ('Kimchi jjigae', '{}'::text[], null),
      ('Kombucha', '{}'::text[], null),
      ('Chinese', '{}'::text[], null),
      ('Cantonese', '{}'::text[], null),
      ('Sichuan', '{}'::text[], null),
      ('Taiwanese', '{}'::text[], null),
      ('Vietnamese', '{}'::text[], null),
      ('Filipino', '{}'::text[], null),
      ('Indonesian', '{}'::text[], null),
      ('Malaysian', '{}'::text[], null),
      ('Italian', '{}'::text[], null),
      ('French', '{}'::text[], null),
      ('Spanish', '{}'::text[], null),
      ('Portuguese', '{}'::text[], null),
      ('German', '{}'::text[], null),
      ('British', '{}'::text[], null),
      ('Irish', '{}'::text[], null),
      ('Turkish', '{}'::text[], null),
      ('Lebanese', '{}'::text[], null),
      ('Persian', '{}'::text[], null),
      ('Israeli', '{}'::text[], null),
      ('Moroccan', '{}'::text[], null),
      ('Ethiopian', '{}'::text[], null),
      ('West African', '{}'::text[], null),
      ('Middle Eastern', array['levantine']::text[], null),
      ('Mediterranean', '{}'::text[], null),
      ('Mexican', '{}'::text[], null),
      ('Peruvian', '{}'::text[], null),
      ('Brazilian', '{}'::text[], null),
      ('Argentinian', '{}'::text[], null),
      ('Caribbean', '{}'::text[], null),
      ('Cuban', '{}'::text[], null),
      ('American', '{}'::text[], null),
      ('Southern', '{}'::text[], null),
      ('Cajun', array['creole']::text[], null),
      ('Canadian', '{}'::text[], null),
      ('Pasta', '{}'::text[], null),
      ('Steak', array['steakhouse']::text[], null),
      ('Fried chicken', '{}'::text[], null),
      ('Wings', array['chicken wings']::text[], null),
      ('Poke', array['poke bowl']::text[], null),
      ('Sashimi', '{}'::text[], null),
      ('Tempura', '{}'::text[], null),
      ('Udon', '{}'::text[], null),
      ('Yakitori', '{}'::text[], null),
      ('Izakaya', '{}'::text[], null),
      ('Tonkatsu', '{}'::text[], null),
      ('Omakase', array['chef''s choice']::text[], null),
      ('Bibimbap', '{}'::text[], null),
      ('Bulgogi', '{}'::text[], null),
      ('Hot pot', array['hotpot']::text[], null),
      ('Biryani', '{}'::text[], null),
      ('Dosa', '{}'::text[], null),
      ('Tandoori', '{}'::text[], null),
      ('Kebabs', array['kebab', 'kabob']::text[], null),
      ('Shawarma', '{}'::text[], null),
      ('Falafel', '{}'::text[], null),
      ('Gyro', '{}'::text[], null),
      ('Paella', '{}'::text[], null),
      ('Tapas', array['pintxos']::text[], null),
      ('Empanadas', '{}'::text[], null),
      ('Ceviche', array['cebiche']::text[], null),
      ('Burritos', '{}'::text[], null),
      ('Nachos', '{}'::text[], null),
      ('Poutine', '{}'::text[], null),
      ('Fish and chips', '{}'::text[], null),
      ('Lobster roll', '{}'::text[], null),
      ('Oysters', '{}'::text[], null),
      ('Crab', '{}'::text[], null),
      ('Shrimp', '{}'::text[], null),
      ('Salad', '{}'::text[], null),
      ('Banh mi', array['bánh mì']::text[], null),
      ('Bao', '{}'::text[], null),
      ('Congee', '{}'::text[], null),
      ('Laksa', '{}'::text[], null),
      ('Pastries', array['pastry', 'croissants']::text[], null),
      ('Crêpes', '{}'::text[], null),
      ('Donuts', array['doughnuts']::text[], null),
      ('Cake', '{}'::text[], null),
      ('Waffles', '{}'::text[], null),
      ('Pancakes', '{}'::text[], null),
      ('Gelato', '{}'::text[], null),
      ('Coffee', '{}'::text[], null),
      ('Tea', '{}'::text[], null),
      ('Bubble tea', array['boba']::text[], null),
      ('Cocktails', '{}'::text[], null),
      ('Beer', '{}'::text[], null),
      ('Wine', '{}'::text[], null),
      ('Fine dining', '{}'::text[], null),
      ('Street food', array['hawker']::text[], null),
      ('Food truck', '{}'::text[], null),
      ('Pub food', '{}'::text[], null),
      ('Comfort food', '{}'::text[], null),
      ('Fast food', '{}'::text[], null),
      ('Tasting menu', '{}'::text[], null),
      ('Buffet', '{}'::text[], null),
      ('Charcuterie', '{}'::text[], null)
    ) as v(name, aliases, display_order)
    union all
    select 'dietary'::public.tag_kind, v.name, v.aliases, v.display_order
    from (values
      ('Vegan', array['plant-based', 'plant based']::text[], 1),
      ('Vegetarian', array['veggie', 'meatless']::text[], 2),
      ('Gluten-free', array['gf', 'celiac', 'coeliac']::text[], 3),
      ('Low-FODMAP', array['fodmap', 'ibs']::text[], 4),
      ('Dairy-free', array['lactose-free', 'no dairy']::text[], 5),
      ('Nut-free', array['peanut-free', 'no nuts']::text[], 6),
      ('Halal', '{}'::text[], 7),
      ('Kosher', '{}'::text[], null),
      ('Pescatarian', array['pescetarian']::text[], null),
      ('Egg-free', array['no eggs']::text[], null),
      ('Soy-free', array['no soy']::text[], null),
      ('Shellfish-free', array['no shellfish']::text[], null)
    ) as v(name, aliases, display_order)
  ) vocab
  on conflict (kind, slug) where owner_id is null
  do update set
    name = excluded.name,
    aliases = excluded.aliases,
    is_featured = excluded.is_featured,
    display_order = excluded.display_order;
$$;

revoke all on function public.apply_tag_vocabulary() from public, anon, authenticated;

select public.apply_tag_vocabulary();

-- ---------------------------------------------------------------- search
-- The Popular list: featured tags of a kind in display order (nulls last, then name). For
-- personal tags, which have no featured set, it is the caller's own tags by name.
create function public.popular_tags(p_kind public.tag_kind)
returns setof public.tags
language sql
stable
security invoker
set search_path = ''
as $$
  select t.*
  from public.tags t
  where t.kind = p_kind
    and case
      when p_kind = 'personal' then t.owner_id = (select auth.uid())
      else t.owner_id is null and t.is_featured
    end
  order by t.display_order nulls last, t.name, t.id;
$$;

-- Tag type-ahead. Accent- and case-insensitive. A match on the name or any alias by prefix
-- comes first (name prefixes before alias prefixes, shorter names first), then trigram
-- matches (typos) by similarity. An empty or blank query is the Popular list, in full: it is
-- a curated set, so p_lim does not shorten it. Global kinds search the shared vocabulary;
-- personal searches only the caller's own tags. p_lim is capped at 50.
create function public.search_tags(p_kind public.tag_kind, p_q text, p_lim integer default 10)
returns setof public.tags
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_folded text := public.city_fold(btrim(coalesce(p_q, '')));
  v_like text;
begin
  if v_folded = '' then
    return query select * from public.popular_tags(p_kind);
    return;
  end if;

  v_like := replace(replace(replace(v_folded, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select t.*
  from public.tags t
  cross join lateral (
    select
      coalesce(bool_or(public.city_fold(n) like v_like) filter (where i = 0), false) as name_prefix,
      coalesce(bool_or(public.city_fold(n) like v_like) filter (where i > 0), false) as alias_prefix,
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
    and (m.name_prefix or m.alias_prefix or m.fuzzy)
  order by
    case when m.name_prefix then 0 when m.alias_prefix then 1 else 2 end,
    case when m.name_prefix or m.alias_prefix then char_length(t.name) end,
    m.sim desc,
    t.name,
    t.id
  limit least(greatest(coalesce(p_lim, 10), 0), 50);
end;
$$;

-- ---------------------------------------------------------------- personal tags
-- Creates the caller's personal tag, or returns the one they already have: a tag is the same
-- tag when its slug is ("Rainy day", "rainy  DAY"). The first spelling is kept. The name is
-- trimmed and has its inner whitespace collapsed; it must be 1-40 characters after that.
create function public.create_personal_tag(p_name text)
returns public.tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_tag public.tags;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 40 then
    raise exception 'invalid_tag_name';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_not_found';
  end if;

  insert into public.tags (kind, name, slug, owner_id)
  values ('personal', v_name, public.tag_slug(v_name), v_uid)
  on conflict (owner_id, slug) where owner_id is not null do nothing;

  select * into v_tag from public.tags
  where owner_id = v_uid and slug = public.tag_slug(v_name);
  return v_tag;
end;
$$;

-- Supabase grants new functions to anon by default. Searching the vocabulary is public (the
-- global tags are readable by anyone); creating a personal tag needs a signed-in person.
revoke all on function public.create_personal_tag(text) from public, anon;
grant execute on function public.create_personal_tag(text) to authenticated;
