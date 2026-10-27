-- Dev-only sample data that mirrors the design canvas. Runs on `supabase db reset`
-- (after the migrations) and never in production. Emails are @example.com.

-- ---------------------------------------------------------------- cities
-- 24 real GeoNames cities (ids, names and populations from cities15000), so a full
-- `pnpm db:import-cities` upserts over them cleanly. City data © GeoNames (CC BY 4.0).
insert into public.cities
  (geoname_id, name, ascii_name, region_code, region_name, country, country_name, population, location)
select
  geoname_id, name, ascii_name, region_code, region_name, country, country_name, population,
  extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
from (values
  (6173331, 'Vancouver', 'Vancouver', 'BC', 'British Columbia', 'CA', 'Canada', 662248, 49.24966, -123.11934),
  (5814616, 'Vancouver', 'Vancouver', 'WA', 'Washington', 'US', 'United States', 196442, 45.63873, -122.66149),
  (6174041, 'Victoria', 'Victoria', 'BC', 'British Columbia', 'CA', 'Canada', 289625, 48.4359, -123.35155),
  (6167865, 'Toronto', 'Toronto', 'ON', 'Ontario', 'CA', 'Canada', 2794356, 43.70643, -79.39864),
  (6077243, 'Montréal', 'Montreal', 'QC', 'Quebec', 'CA', 'Canada', 1762949, 45.50884, -73.58781),
  (6141256, 'Saskatoon', 'Saskatoon', 'SK', 'Saskatchewan', 'CA', 'Canada', 266141, 52.13238, -106.66892),
  (5128581, 'New York City', 'New York City', 'NY', 'New York', 'US', 'United States', 8804190, 40.71427, -74.00597),
  (4975802, 'Portland', 'Portland', 'ME', 'Maine', 'US', 'United States', 66881, 43.65737, -70.2589),
  (5746545, 'Portland', 'Portland', 'OR', 'Oregon', 'US', 'United States', 652503, 45.52345, -122.67621),
  (5391959, 'San Francisco', 'San Francisco', 'CA', 'California', 'US', 'United States', 827526, 37.77493, -122.41942),
  (5368361, 'Los Angeles', 'Los Angeles', 'CA', 'California', 'US', 'United States', 3820914, 34.05223, -118.24368),
  (4887398, 'Chicago', 'Chicago', 'IL', 'Illinois', 'US', 'United States', 2664452, 41.85003, -87.65005),
  (3530597, 'Mexico City', 'Mexico City', null, 'Mexico City', 'MX', 'Mexico', 12294193, 19.42847, -99.12766),
  (2643743, 'London', 'London', null, 'England', 'GB', 'United Kingdom', 8961989, 51.50853, -0.12574),
  (2988507, 'Paris', 'Paris', null, 'Île-de-France', 'FR', 'France', 2138551, 48.85341, 2.3488),
  (2950159, 'Berlin', 'Berlin', null, 'State of Berlin', 'DE', 'Germany', 3426354, 52.52437, 13.41053),
  (1850147, 'Tokyo', 'Tokyo', null, 'Tokyo', 'JP', 'Japan', 9733276, 35.6895, 139.69171),
  (1853909, 'Osaka', 'Osaka', null, 'Osaka', 'JP', 'Japan', 2753862, 34.69379, 135.50107),
  (1835848, 'Seoul', 'Seoul', null, 'Seoul', 'KR', 'South Korea', 10349312, 37.566, 126.9784),
  (1609350, 'Bangkok', 'Bangkok', null, 'Bangkok', 'TH', 'Thailand', 5104476, 13.75398, 100.50144),
  (1566083, 'Ho Chi Minh City', 'Ho Chi Minh City', null, 'Ho Chi Minh City (HCMC)', 'VN', 'Vietnam', 14002598, 10.82302, 106.62965),
  (1880252, 'Singapore', 'Singapore', null, null, 'SG', 'Singapore', 5638700, 1.28967, 103.85007),
  (2147714, 'Sydney', 'Sydney', 'NSW', 'New South Wales', 'AU', 'Australia', 5638830, -33.86785, 151.20732),
  (2158177, 'Melbourne', 'Melbourne', 'VIC', 'Victoria', 'AU', 'Australia', 5435590, -37.814, 144.96332)
) as v(geoname_id, name, ascii_name, region_code, region_name, country, country_name, population, lat, lng);

-- ---------------------------------------------------------------- people
-- Fixed ids so later phases and tests can refer to people:
-- josie ...0001, mike ...0002, ari ...0003, alli ...0004, dev ...0005, sam ...0006
create temp table seed_people (
  id uuid, username text, display_name text, bio text,
  home_geoname_id integer, trust public.trust_level
) on commit drop;
insert into seed_people values
  ('00000000-0000-4000-8000-000000000001', 'josiehamilton', 'Josie Hamilton', 'Chasing the perfect meal.', 6173331, 'trusted'),
  ('00000000-0000-4000-8000-000000000002', 'mikebrennan',   'Mike Brennan',   'Tokyo → NYC. Always hungry.', 5128581, 'trusted'),
  ('00000000-0000-4000-8000-000000000003', 'arimitchell',   'Ari Mitchell',   'Professional eater. Amateur chef.', 6173331, 'trusted'),
  ('00000000-0000-4000-8000-000000000004', 'allimercer',    'Alli Mercer',    'Spice level: nuclear.', 6141256, 'trusted'),
  ('00000000-0000-4000-8000-000000000005', 'devpatel',      'Dev Patel',      null, 6173331, 'trusted'),
  ('00000000-0000-4000-8000-000000000006', 'samokafor',     'Sam Okafor',     null, 6173331, 'new');

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
  username || '@example.com', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
  '', '', '', ''
from seed_people;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  id::text, id,
  jsonb_build_object('sub', id::text, 'email', username || '@example.com', 'email_verified', true),
  'email', now(), now(), now()
from seed_people;

-- Home city label: name, then region_code (US/CA/AU only, otherwise region_name), then country.
insert into public.profiles (id, username, display_name, bio, home_city_id, home_place_text, home_location, trust_level)
select
  sp.id, sp.username, sp.display_name, sp.bio, c.id,
  concat_ws(', ', c.name,
    case when c.country in ('US', 'CA', 'AU') then c.region_code else c.region_name end,
    c.country_name),
  c.location,
  sp.trust
from seed_people sp
join public.cities c on c.geoname_id = sp.home_geoname_id;

-- ---------------------------------------------------------------- places
insert into public.places (source, name, area, city, region, country, location)
select
  'custom', name, area, city, region, country,
  extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
from (values
  ('Skewers',          '4th Ave',      'Vancouver',   'BC',   'CA', 49.2682, -123.1557),
  ('Marutama',         'Bidwell St',   'Vancouver',   'BC',   'CA', 49.2905, -123.1366),
  ('Kin Kao',          'Main St',      'Vancouver',   'BC',   'CA', 49.2620, -123.1010),
  ('Miku',             'Waterfront',   'Vancouver',   'BC',   'CA', 49.2868, -123.1129),
  ('Lotus Noodle Bar', 'Chinatown',    'Vancouver',   'BC',   'CA', 49.2794, -123.1003),
  ('Hearth Bakery',    'Main St',      'Vancouver',   'BC',   'CA', 49.2585, -123.1007),
  ('Sushi Itto',       'Shibuya',      'Tokyo',       'Tokyo','JP', 35.6595,  139.7005),
  ('Sushi Dai',        'Toyosu',       'Tokyo',       'Tokyo','JP', 35.6655,  139.7707),
  ('Spicy Time',       'Downtown',     'Saskatoon',   'SK',   'CA', 52.1332, -106.6700),
  ('Luke’s Lobster',   'Old Port',     'Portland',    'ME',   'US', 43.6563,  -70.2531),
  ('El Callejón',      'Centro',       'Mexico City', 'CDMX', 'MX', 19.4326,  -99.1332),
  ('J. Grill',         'East Village', 'New York',    'NY',   'US', 40.7306,  -73.9866),
  ('Nami',             'SoHo',         'New York',    'NY',   'US', 40.7240,  -73.9970),
  ('Bánh',             'District 1',   'Saigon',      'SG',   'VN', 10.7769,  106.7009)
) as v(name, area, city, region, country, lat, lng);

-- ---------------------------------------------------------------- dishes
-- name_key is filled by a trigger.
insert into public.dishes (place_id, name)
select p.id, v.dish
from (values
  ('Pork Gyro',             'Skewers'),
  ('Wagyu Beef Don',        'Sushi Itto'),
  ('Nigiri Set',            'Sushi Itto'),
  ('Plain Biryani',         'Spicy Time'),
  ('Lobster Roll',          'Luke’s Lobster'),
  ('Tacos Al Pastor',       'El Callejón'),
  ('Smash Burger',          'J. Grill'),
  ('Banh Mi',               'Bánh'),
  ('Khao Soi',              'Kin Kao'),
  ('Crispy Rice Salad',     'Kin Kao'),
  ('Tonkotsu Ramen',        'Marutama'),
  ('Pork Gyoza',            'Marutama'),
  ('Aburi Salmon Oshi',     'Miku'),
  ('Vegan Dan Dan Noodles', 'Lotus Noodle Bar'),
  ('Cardamom Bun',          'Hearth Bakery'),
  ('Omakase',               'Sushi Dai'),
  ('Toro Hand Roll',        'Nami')
) as v(dish, place)
join public.places p on p.name = v.place;

-- ---------------------------------------------------------------- tags
insert into public.tags (kind, name, slug, is_featured)
select 'food_type', name, replace(lower(name), ' ', '-'), featured
from (values
  ('Greek', false), ('Rice bowl', false), ('Indian', false), ('Seafood', true), ('Tacos', true),
  ('Burgers', true), ('Sandwiches', false), ('Thai', false), ('Noodles', true), ('Ramen', true),
  ('Sushi', true), ('Bakery', true), ('Dumplings', false), ('Pork', true), ('Japanese', true),
  ('Soup', true), ('Pizza', true), ('BBQ', true), ('Dessert', false), ('Breakfast', false),
  ('Korean', false), ('Korean BBQ', false), ('Dim sum', false), ('Pho', false), ('Curry', false),
  ('Brunch', false), ('Ice cream', false)
) as v(name, featured);

insert into public.tags (kind, name, slug, is_featured)
select 'dietary', name, replace(lower(name), ' ', '-'), name <> 'Kosher'
from (values
  ('Vegan'), ('Vegetarian'), ('Gluten-free'), ('Low-FODMAP'),
  ('Dairy-free'), ('Nut-free'), ('Halal'), ('Kosher')
) as v(name);

-- Josie's personal tags
insert into public.tags (kind, name, slug, owner_id)
select 'personal', name, replace(lower(name), ' ', '-'), '00000000-0000-4000-8000-000000000001'
from (values ('Late night'), ('Spicy'), ('Splurge'), ('Rainy day')) as v(name);

-- ---------------------------------------------------------------- picks
-- tier/slot per person; original_dish_name is the dish name.
insert into public.picks (user_id, dish_id, tier, slot, note, original_dish_name)
select pe.id, d.id, v.tier::public.pick_tier, v.slot::smallint, v.note, d.name
from (values
  ('josiehamilton', 'Pork Gyro',             'final',     1,    'Delicious. I’d fly back for it.'),
  ('josiehamilton', 'Wagyu Beef Don',        'final',     2,    null),
  ('josiehamilton', 'Plain Biryani',         'final',     3,    null),
  ('josiehamilton', 'Lobster Roll',          'final',     4,    null),
  ('josiehamilton', 'Smash Burger',          'honorable', null, null),
  ('josiehamilton', 'Tacos Al Pastor',       'honorable', null, null),
  ('josiehamilton', 'Banh Mi',               'honorable', null, null),
  ('josiehamilton', 'Tonkotsu Ramen',        'honorable', null, null),
  ('josiehamilton', 'Khao Soi',              'honorable', null, null),
  ('josiehamilton', 'Aburi Salmon Oshi',     'honorable', null, null),
  ('josiehamilton', 'Vegan Dan Dan Noodles', 'honorable', null, null),
  ('josiehamilton', 'Cardamom Bun',          'honorable', null, null),
  ('josiehamilton', 'Omakase',               'honorable', null, null),
  ('josiehamilton', 'Nigiri Set',            'honorable', null, null),
  ('josiehamilton', 'Toro Hand Roll',        'honorable', null, null),
  ('josiehamilton', 'Pork Gyoza',            'honorable', null, null),
  ('josiehamilton', 'Crispy Rice Salad',     'honorable', null, null),
  ('mikebrennan',   'Smash Burger',          'final',     1,    null),
  ('mikebrennan',   'Wagyu Beef Don',        'final',     2,    'God tier. I still dream about it.'),
  ('arimitchell',   'Pork Gyro',             'final',     1,    'Delicious. I’d fly back for it.'),
  ('arimitchell',   'Smash Burger',          'final',     2,    null),
  ('arimitchell',   'Tacos Al Pastor',       'honorable', null, null),
  ('allimercer',    'Plain Biryani',         'final',     1,    'The spice level was absolutely perfect.'),
  ('allimercer',    'Khao Soi',              'final',     2,    null),
  ('allimercer',    'Tacos Al Pastor',       'final',     3,    null),
  ('devpatel',      'Tonkotsu Ramen',        'final',     1,    'The broth is a religious experience.'),
  ('devpatel',      'Khao Soi',              'honorable', null, 'Not quite top five, but I’d cross town for it.'),
  ('samokafor',     'Omakase',               'honorable', null, null)
) as v(username, dish, tier, slot, note)
join seed_people pe on pe.username = v.username
join public.dishes d on d.name = v.dish;

-- Josie's pick tags (global tags by kind+slug, personal tags by owner+slug)
insert into public.pick_tags (pick_id, tag_id)
select p.id, t.id
from (values
  ('Pork Gyro',             'greek'),
  ('Pork Gyro',             'late-night'),
  ('Wagyu Beef Don',        'rice-bowl'),
  ('Wagyu Beef Don',        'gluten-free'),
  ('Plain Biryani',         'indian'),
  ('Plain Biryani',         'vegan'),
  ('Plain Biryani',         'gluten-free'),
  ('Lobster Roll',          'seafood'),
  ('Tacos Al Pastor',       'tacos'),
  ('Tacos Al Pastor',       'gluten-free'),
  ('Smash Burger',          'burgers'),
  ('Banh Mi',               'sandwiches'),
  ('Khao Soi',              'thai'),
  ('Khao Soi',              'noodles'),
  ('Khao Soi',              'dairy-free'),
  ('Tonkotsu Ramen',        'ramen'),
  ('Tonkotsu Ramen',        'noodles'),
  ('Aburi Salmon Oshi',     'sushi'),
  ('Aburi Salmon Oshi',     'low-fodmap'),
  ('Vegan Dan Dan Noodles', 'noodles'),
  ('Vegan Dan Dan Noodles', 'vegan'),
  ('Vegan Dan Dan Noodles', 'spicy'),
  ('Cardamom Bun',          'bakery'),
  ('Cardamom Bun',          'gluten-free'),
  ('Omakase',               'sushi'),
  ('Omakase',               'gluten-free'),
  ('Omakase',               'splurge'),
  ('Nigiri Set',            'sushi'),
  ('Nigiri Set',            'low-fodmap'),
  ('Toro Hand Roll',        'sushi'),
  ('Pork Gyoza',            'dumplings'),
  ('Pork Gyoza',            'pork'),
  ('Crispy Rice Salad',     'thai'),
  ('Crispy Rice Salad',     'spicy'),
  ('Crispy Rice Salad',     'gluten-free')
) as v(dish, tag_slug)
join public.dishes d on d.name = v.dish
join public.picks p on p.dish_id = d.id and p.user_id = '00000000-0000-4000-8000-000000000001'
join public.tags t on t.slug = v.tag_slug
  and (t.owner_id is null or t.owner_id = '00000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------- follows
insert into public.follows (follower_id, followee_id, status)
select f.id, e.id, 'active'
from (values
  ('josiehamilton', 'mikebrennan'), ('josiehamilton', 'arimitchell'), ('josiehamilton', 'devpatel'),
  ('mikebrennan', 'josiehamilton'), ('arimitchell', 'josiehamilton'), ('allimercer', 'josiehamilton'),
  ('devpatel', 'josiehamilton'),    ('samokafor', 'josiehamilton')
) as v(follower, followee)
join seed_people f on f.username = v.follower
join seed_people e on e.username = v.followee;

-- ---------------------------------------------------------------- shared lists
insert into public.shared_lists (owner_id, slug, title, note, filter) values
  ('00000000-0000-4000-8000-000000000001', 'josies-vancouver', 'Josie’s Vancouver', 'Kin Kao first. Trust me.',
   '{"scope":"custom","cities":["Vancouver"],"tiers":["final","honorable"]}'::jsonb);

insert into public.shared_lists (owner_id, slug, title, filter)
select
  '00000000-0000-4000-8000-000000000001', 'josies-sushi', 'Sushi, around the world',
  jsonb_build_object(
    'scope', 'custom',
    'food_type_tag_ids', jsonb_build_array((select id from public.tags where kind = 'food_type' and slug = 'sushi')),
    'tiers', jsonb_build_array('final', 'honorable')
  );

-- ---------------------------------------------------------------- activities and notifications
insert into public.activities (actor_id, type, pick_id, other_pick_id, list_id, target_user_id)
select
  '00000000-0000-4000-8000-000000000003', 'dethroned',
  (select p.id from public.picks p join public.dishes d on d.id = p.dish_id
    where p.user_id = '00000000-0000-4000-8000-000000000003' and d.name = 'Smash Burger'),
  (select p.id from public.picks p join public.dishes d on d.id = p.dish_id
    where p.user_id = '00000000-0000-4000-8000-000000000003' and d.name = 'Tacos Al Pastor'),
  null, null;

insert into public.activities (actor_id, type, target_user_id) values
  ('00000000-0000-4000-8000-000000000004', 'followed', '00000000-0000-4000-8000-000000000001');

insert into public.activities (actor_id, type, pick_id)
select '00000000-0000-4000-8000-000000000002', 'saved_pick', p.id
from public.picks p join public.dishes d on d.id = p.dish_id
where p.user_id = '00000000-0000-4000-8000-000000000001' and d.name = 'Pork Gyro';

-- Mike's save behind that activity.
insert into public.saves (user_id, dish_id)
select '00000000-0000-4000-8000-000000000002', d.id
from public.dishes d
where d.name = 'Pork Gyro';

insert into public.activities (actor_id, type, list_id)
select '00000000-0000-4000-8000-000000000002', 'saved_from_list', id
from public.shared_lists where slug = 'josies-vancouver';

-- One notification for josie per activity that targets her or her picks.
insert into public.notifications (user_id, activity_id)
select '00000000-0000-4000-8000-000000000001', id
from public.activities
where type in ('followed', 'saved_pick', 'saved_from_list');
