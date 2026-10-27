begin;
create extension if not exists pgtap with schema extensions;

select plan(50);

-- ---------------------------------------------------------------- structure
select has_column('public', 'tags', 'aliases', 'tags.aliases exists');
select has_column('public', 'tags', 'display_order', 'tags.display_order exists');
select has_function('public', 'search_tags', array['tag_kind', 'text', 'integer'], 'search_tags exists');
select has_function('public', 'popular_tags', array['tag_kind'], 'popular_tags exists');
select has_function('public', 'create_personal_tag', array['text'], 'create_personal_tag exists');

-- ---------------------------------------------------------------- the vocabulary
-- (reference data from the migration: these hold whether or not seed.sql ran)
select cmp_ok((select count(*)::int from public.tags where kind = 'food_type' and owner_id is null),
  '>=', 100, 'at least 100 global food_type tags');
select is((select count(*)::int from public.tags where kind = 'dietary' and owner_id is null),
  12, '12 global dietary tags');
select is(
  (select array_agg(name order by display_order) from public.tags
    where kind = 'food_type' and is_featured),
  array['Ramen', 'Noodles', 'Japanese', 'Soup', 'Pork', 'Sushi', 'Burgers', 'Tacos', 'Pizza',
        'BBQ', 'Bakery', 'Seafood'],
  'the 12 featured food_type tags, in display order'
);
select is(
  (select array_agg(name order by display_order) from public.tags
    where kind = 'dietary' and is_featured),
  array['Vegan', 'Vegetarian', 'Gluten-free', 'Low-FODMAP', 'Dairy-free', 'Nut-free', 'Halal'],
  'the 7 featured dietary tags, in display order'
);
select is(
  (select count(*)::int from public.tags
    where owner_id is null and not is_featured and display_order is not null),
  0, 'only featured tags have a display_order'
);
select is(
  (select count(*)::int from public.tags where owner_id is null
    and name in ('Korean', 'Korean BBQ', 'Korean fried chicken', 'Kimchi jjigae', 'Kombucha',
                 'Dim sum', 'Pho', 'Pizza', 'Curry', 'Dumplings', 'BBQ', 'Brunch', 'Ice cream')),
  13, 'every food type on the TagSearch board is there'
);
select is(
  (select count(*)::int from public.tags where owner_id is null and kind = 'dietary'
    and name in ('Vegan', 'Vegetarian', 'Gluten-free', 'Low-FODMAP', 'Dairy-free', 'Nut-free',
                 'Halal', 'Kosher', 'Pescatarian', 'Egg-free', 'Soy-free', 'Shellfish-free')),
  12, 'every dietary tag is there'
);
select is(
  (select slug from public.tags where kind = 'food_type' and name = 'Korean fried chicken'),
  'korean-fried-chicken', 'slugs keep the Phase 1 rule: lower case, dashes'
);
select is((select aliases from public.tags where name = 'Ramen'), array['ramen noodles'],
  'Ramen has the alias "ramen noodles"');
select is((select aliases from public.tags where name = 'Low-FODMAP'), array['fodmap', 'ibs'],
  'Low-FODMAP has the aliases fodmap and ibs');
select is((select aliases from public.tags where name = 'Greek'), '{}'::text[],
  'aliases default to empty');

-- ---------------------------------------------------------------- idempotent upsert
-- The migration's upsert block lives in apply_tag_vocabulary(). Drift a few rows the way an
-- older database might have them, then apply it twice: nothing is added, the drift is fixed.
update public.tags set is_featured = false, display_order = null, aliases = '{}'
  where kind = 'food_type' and slug = 'ramen';
select lives_ok($$select public.apply_tag_vocabulary()$$, 'the upsert block runs');
select is((select is_featured and display_order = 1 and aliases = array['ramen noodles']
             from public.tags where kind = 'food_type' and slug = 'ramen'),
  true, 'a re-apply restores featured, order and aliases');

create temp table before_counts as
  select (select count(*) from public.tags where kind = 'food_type' and owner_id is null) as f,
         (select count(*) from public.tags where kind = 'dietary' and owner_id is null) as d,
         (select count(*) from public.tags where owner_id is null) as g;
select public.apply_tag_vocabulary();
select is(
  (select (select count(*) from public.tags where kind = 'food_type' and owner_id is null) = f
      and (select count(*) from public.tags where kind = 'dietary' and owner_id is null) = d
      and (select count(*) from public.tags where owner_id is null) = g
    from before_counts),
  true, 'applying the vocabulary again leaves the counts unchanged'
);
select is(
  (select count(*)::int from public.tags where owner_id is null and kind = 'food_type' and is_featured),
  12, 'still 12 featured food_type tags'
);

-- ---------------------------------------------------------------- search_tags: prefix, then trigram
select is(
  (select array_agg(name) from (select name from public.search_tags('food_type', 'kor') limit 3) s),
  array['Korean', 'Korean BBQ', 'Korean fried chicken'],
  '"kor" finds Korean, then Korean BBQ, then Korean fried chicken'
);
select is((select name from public.search_tags('dietary', 'fodmap') limit 1), 'Low-FODMAP',
  '"fodmap" finds Low-FODMAP through its alias');
select is((select name from public.search_tags('food_type', 'ramen noo') limit 1), 'Ramen',
  'a prefix of an alias finds the tag');
select is((select name from public.search_tags('food_type', 'CREPE') limit 1), 'Crêpes',
  'search ignores case and accents');
select is((select name from public.search_tags('food_type', 'ramne') limit 1), 'Ramen',
  'a typo still finds the tag by trigram similarity');
select is((select count(*)::int from public.search_tags('dietary', 'kor')), 0,
  'search stays inside the kind it was asked for');
select is((select count(*)::int from public.search_tags('food_type', '   ')), 12,
  'a blank query is the same as an empty one');
select is((select count(*)::int from public.search_tags('food_type', 'b', 3)), 3,
  'the limit is honoured');
select is((select count(*)::int from public.search_tags('food_type', 'b', 0)), 0,
  'a limit of zero returns nothing');
select is((select count(*)::int from public.search_tags('food_type', 'x_%\')), 0,
  'LIKE wildcards in the query are literal');

-- empty query = the featured tags in display order (the TagSearch "Popular" list)
select is((select count(*)::int from public.search_tags('food_type', '')), 12,
  'an empty query returns the 12 featured food_type tags');
select is(
  (select array_agg(name) from public.search_tags('food_type', '')),
  (select array_agg(name) from public.popular_tags('food_type')),
  'an empty query is popular_tags'
);
select is((select name from public.search_tags('food_type', '') limit 1), 'Ramen',
  'the Popular list starts with Ramen');
select is((select count(*)::int from public.search_tags('dietary', '')), 7,
  'an empty dietary query returns the 7 featured dietary tags');

-- ---------------------------------------------------------------- personal tags
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

set local role anon;
select throws_ok($$select public.create_personal_tag('Nope')$$, '42501', null,
  'anon cannot create a personal tag');
select is((select count(*)::int from public.search_tags('food_type', 'kor')), 3,
  'anon can search the global vocabulary');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.create_personal_tag('Rainy day')$$, 'P0001', 'profile_not_found',
  'a person with no profile cannot create a personal tag');
select public.create_my_profile('Ana', 'tag_ana');

select is((select name from public.create_personal_tag('Rainy day')), 'Rainy day',
  'create_personal_tag returns the tag');
select public.create_personal_tag('Rainy day');
select public.create_personal_tag('  rainy   DAY ');
select is(
  (select count(*)::int from public.tags
    where owner_id = '00000000-0000-0000-0000-00000000000a' and kind = 'personal'),
  1, 'creating "Rainy day" repeatedly gives one row'
);
select is((select name from public.search_tags('personal', 'rainy') limit 1), 'Rainy day',
  'the owner finds it through search_tags');
select is((select count(*)::int from public.search_tags('personal', '')), 1,
  'an empty personal query lists the owner''s own tags');

select throws_ok($$select public.create_personal_tag('')$$, 'P0001', 'invalid_tag_name',
  'an empty name is invalid_tag_name');
select throws_ok($$select public.create_personal_tag('   ')$$, 'P0001', 'invalid_tag_name',
  'a blank name is invalid_tag_name');
select throws_ok($$select public.create_personal_tag(null)$$, 'P0001', 'invalid_tag_name',
  'a null name is invalid_tag_name');
select throws_ok($$select public.create_personal_tag(repeat('x', 41))$$, 'P0001', 'invalid_tag_name',
  '41 characters is invalid_tag_name');
select lives_ok($$select public.create_personal_tag(repeat('x', 40))$$, '40 characters is fine');

-- another user cannot see it
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select public.create_my_profile('Ben', 'tag_ben');
select is((select count(*)::int from public.search_tags('personal', 'rainy')), 0,
  'another person cannot find Ana''s personal tag');
select is((select count(*)::int from public.tags where kind = 'personal' and name = 'Rainy day'), 0,
  'another person cannot read Ana''s personal tag directly');
select is((select count(*)::int from public.search_tags('personal', '')), 0,
  'another person''s personal list is empty');
select public.create_personal_tag('Rainy day');
select is((select count(*)::int from public.search_tags('personal', 'rainy')), 1,
  'each person gets their own "Rainy day"');

select * from finish();
rollback;
