# Phase 3: Places, Dishes & Your Final Meal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Model rule (Josie):** Sonnet 5.5 subagents implement; Opus 5.5 plans and reviews. Without the plugin, follow `CLAUDE.md` "How we build".

**Goal:** People can build their Final Meal. They search a real restaurant (or add their own), pick or type a dish with smart suggestions, add it as Final Meal or Honorable with an optional photo, note and tags, and swap when their five are full. They see their five and their restaurant-grouped Honorable Mentions on the You tab, open a pick to edit, promote, demote or remove it, and new members get the "Now for the hard part" first-pick step and the First landing screen.

**Architecture:**
- **Data:**
  - The global tag vocabulary moves from dev seed to a migration, so prod has it.
  - Places get search plus a custom-place function.
  - Foursquare Open Source Places is imported by a DuckDB script. A committed Metro Vancouver extract is the dev seed.
- **Writes:** every pick write is a single security-definer SQL function that keeps Final Meal slots contiguous (1..n), resolves dishes with normalised and fuzzy matching, applies tags, and records activities.
- **Clients:**
  - `@finalmeal/api` wraps these functions.
  - The mobile app adds the Add-dish flow (restaurant search, custom place, tags, swap), pick detail, the populated profile tabs with the filter chip row, and the onboarding first pick plus First landing.
  - Everything still runs in Expo Go: no maps this phase.

**Tech Stack:** Phase 1–2 stack, plus:
- `@duckdb/node-api` (root dev tool, for the places import)
- the Hugging Face mirror of FSQ OS Places (needs Josie's token)
- a `pick-photos` storage bucket
- `expo-linking` for Directions links

**Spec:** `docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md` sections 2, 4, 5.2, 5.4 (profile), 6, 13. **Canvas:** OnbFirstPick, OnbAddFirst, FirstLand, AddDish, AddDishTags, TagSearch, Swap, PickDetail, Profile, ProfileHM in `design/canvas/project/`. **Carry-forward:** `docs/known-gaps.md`.

## Global Constraints

- **All Phase 1–2 constraints and `CLAUDE.md` rules apply:**
  - tokens only; Instrument Serif, Newsreader and Manrope
  - Supabase codified, with new migrations only and every change in `docs/ops/supabase.md`
  - the pinned CLI via `pnpm exec supabase` / `db:*`
  - never commit `.env*` files or tokens
  - commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
- **Branch:** `phase-3-places-dishes`. No merge into `main` without Josie's OK.
- **Devices:** iPhone 17 (`9C7EFCFB-C079-45DA-9240-D9BE65BAD833`) and the `Pixel_10` AVD in Expo Go, on Josie's Mac only. In cloud sessions, device steps are "pending Mac".
- **Reference data vs dev data:**
  - The global tag vocabulary is reference data, so it goes in a migration.
  - People, picks, follows and lists are dev data, so they go in `seed.sql`.
  - Places come from the import script; the committed Vancouver extract is loaded only by the dev seed.
- **Final Meal slots stay contiguous:** a person with n Final Meal picks has slots exactly 1..n.
  - A new final takes slot n+1.
  - Removing or demoting slot k moves slots k+1..n up by one.
  - A swap puts the new pick in the replaced slot.
- **Foursquare attribution:** the FSQ OS Places `NOTICE` text is committed to `docs/third-party/fsq-os-places-NOTICE.txt` and listed in `docs/ops/supabase.md`. Showing it in the app's About screen is a Phase 8 known-gap.
- **Friendly copy:** new error codes and their exact strings (exported from `@finalmeal/api`):
  - `final_full`: `Your five are full. Choose one to replace.`
  - `duplicate_pick`: `That dish is already on your list.`
  - `place_not_found`: `We couldn’t find that spot. Try searching again.`
  - `invalid_dish_name`: `Give the dish a name (up to 80 characters).`
  - `invalid_place_name`: `Give the spot a name (up to 80 characters).`
  - `pick_not_found`: `That pick isn’t there any more.`
  - `invalid_photo`: `That photo didn’t work. Try another.`
- **Copy:** quote canvas copy exactly, with typographic punctuation. Where the canvas shows sample data (Pork Gyro, Marutama…), render real data instead.

## Review Focus

1. **The same dish typed differently** at the same place ("tonkotsu ramen", "Tonkotsu  Ramen!", "Tonkotsu Ramen (extra chashu)") ends up on one dish. The person's wording is kept in `original_dish_name`, and suggestions show the existing dish first. Pinned in Tasks 3 and 5.
2. **Slot integrity under every path:** add, swap, promote (with and without a swap), demote and remove keep slots 1..n contiguous with no duplicates. A failure part-way changes nothing. Pinned in Task 3 (pgTAP) and Task 4 (integration).
3. **Adding a dish you already have** (either tier) gives `That dish is already on your list.` and doesn't create a second pick. Promoting it instead is offered in the UI. Pinned in Tasks 3 and 6.
4. **Restaurant not found** (a food truck, a pop-up, or no results offline): "Can’t find it? Add it" creates a custom place with a city, and works with location permission denied (city centroid). Pinned in Tasks 2 and 6.
5. **Slow or failed photo upload** while adding a dish: the pick still saves without the photo, and a friendly notice offers to add it later from the pick. No duplicate pick on retry. Pinned in Task 6.

---

### Task 1: Tag vocabulary as reference data + tag search

**Files:**
- Create: migration `<ts>_tag_vocabulary.sql`, `supabase/tests/database/tags.test.sql`
- Modify: `supabase/seed.sql` (remove the global tag inserts; keep Josie's personal tags and pick tags), `docs/ops/supabase.md`

**Interfaces:**
- **New `tags` column:** `aliases text[] not null default '{}'`, searched too (e.g. Ramen: `{'ramen noodles'}`; Low-FODMAP: `{'fodmap','ibs'}`).
- **Migration:** upserts the global vocabulary by `(kind, slug)`, so the Phase 1 seed rows and prod both converge.
  - **food_type:** every name already seeded, plus a broad list to about 120 entries covering world cuisines and dish types. It must include Korean, Korean BBQ, Korean fried chicken, Kimchi jjigae, Kombucha, Dim sum, Pho, Pizza, Curry, Dumplings, BBQ, Brunch and Ice cream (from the TagSearch board). Featured: Ramen, Noodles, Japanese, Soup, Pork, Sushi, Burgers, Tacos, Pizza, BBQ, Bakery, Seafood (unchanged).
  - **dietary:** Vegan, Vegetarian, Gluten-free, Low-FODMAP, Dairy-free, Nut-free, Halal, Kosher, Pescatarian, Egg-free, Soy-free, Shellfish-free. Featured: the first seven, as on the AddDishTags board.
- **`public.search_tags(p_kind tag_kind, p_q text, p_lim int default 10) returns setof public.tags`:**
  - global tags of that kind, matched on `name` or any alias by prefix first, then trigram, with `unaccent`
  - an empty query returns the featured tags in display order
  - for `personal`, only the caller's own tags
- **`public.create_personal_tag(p_name text) returns public.tags`:** security definer; idempotent on the caller's `(owner_id, slug)`; raises `invalid_tag_name` outside 1–40 characters.
- **`popular_tags`:** the ordered "Popular" list for TagSearch, from a `display_order int` column, nulls last.

- [ ] **Step 1: Write the failing pgTAP tests:**
  - after `db reset`, food_type is at least 100 and dietary is 12
  - `search_tags('food_type','kor')` starts with Korean, then Korean BBQ and Korean fried chicken
  - `search_tags('dietary','fodmap')` finds Low-FODMAP
  - `search_tags('food_type','')` returns the 12 featured tags
  - `create_personal_tag('Rainy day')` twice gives one row
  - another user can't see it
  - the migration is idempotent: apply its upsert block twice, and the counts are unchanged
- [ ] **Step 2: Run the tests.** `pnpm db:reset </dev/null && pnpm db:test`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration and seed change.
- [ ] **Step 4: Run the tests again.** Same command. Expected: PASS, including the Phase 1 seed tests (update their tag counts and note it).
- [ ] **Step 5: Commit.** `Make the tag vocabulary reference data and add tag search`

### Task 2: Places: search, custom places, Foursquare import

**Files:**
- Create: migration `<ts>_places_search.sql`, `scripts/import-places.mjs`, `scripts/import-places.test.mjs` (fixture-based), `scripts/fixtures/fsq-sample.csv` (about 20 fictional rows), `supabase/seed/places_vancouver.sql` (generated), `docs/third-party/fsq-os-places-NOTICE.txt`, `supabase/tests/database/places.test.sql`
- Modify: `supabase/config.toml` (`[db.seed] sql_paths = ["./seed.sql", "./seed/places_vancouver.sql"]`, ordered so places load before the picks that reference them; if needed, move the 14 canvas places into the generated file's header or keep them in `seed.sql` first), root `package.json` (`db:import-places`), `docs/ops/supabase.md`, `docs/known-gaps.md`

**Interfaces:**
- **New `places` columns:** `address text`, `postcode text`, `category_labels text[] not null default '{}'`, `closed_at date`.
- **`public.search_places(p_q text, p_lat double precision default null, p_lng double precision default null, p_lim int default 12) returns table (place public.places, distance_m double precision)`:**
  - matches on name: prefix first, then trigram with `unaccent`
  - excludes `merged_into_id is not null` and `closed_at is not null`
  - with coordinates, ranks by text match then distance and only searches within 50 km first, widening to global when there are fewer than 5 hits
  - with no coordinates, ranks by text match then name
  - an empty `p_q` with coordinates returns the nearest 12 food places
- **`public.create_custom_place(p_name text, p_city_id uuid, p_area text default null, p_lat double precision default null, p_lng double precision default null) returns public.places`:**
  - security definer; `source = 'custom'`; `created_by = auth.uid()`
  - uses the city's point when there are no coordinates
  - `city`/`region`/`country` come from the city
  - raises `invalid_place_name` outside 1–80 characters and `city_not_found`
  - rate-limited to 20 custom places per user per day, raising `rate_limited`
- **`scripts/import-places.mjs`:**
  - reads FSQ OS Places parquet from the Hugging Face mirror (`hf://datasets/foursquare/fsq-os-places/...`, newest release folder) through DuckDB, with `HF_TOKEN` from the root `.env.local` (Josie's token; never printed, never committed)
  - keeps only Dining and Drinking categories (check the category taxonomy in the release's categories file and record the filter in the script header)
  - maps fields to `places`
  - modes:
    - `--bbox vancouver` (Metro Vancouver: lat 49.0–49.45, lng −123.35 to −122.5) writes `supabase/seed/places_vancouver.sql`, sorted and deterministic
    - `--db-url <url> [--bbox …|--all]` upserts by `(source, source_id)` in batches and prints counts
  - `--fixture <csv>` reads a local CSV instead, for tests and CI
- **If `HF_TOKEN` is absent:** generating the real Vancouver extract is **pending Josie** (see the ledger). Everything else proceeds with the canvas places plus the fixture, and `places_vancouver.sql` is a valid empty file that says how to regenerate it.

- [ ] **Step 1: Write the failing tests.**
  - **pgTAP:**
    - `search_places('maru', 49.28, -123.12)` returns Marutama first
    - `search_places('sushi', 35.66, 139.70)` ranks Sushi Itto before Vancouver hits
    - a closed place and a merged place never appear
    - `create_custom_place('Grandma’s Kitchen', <Vancouver id>)` uses the Vancouver point
    - an empty name raises `invalid_place_name`
    - the 21st custom place in a day raises `rate_limited`
    - anon can't create
  - **Script test** (`node --test`): the fixture import writes the expected SQL (snapshot of the first rows), skips non-food categories, and never logs the token.
- [ ] **Step 2: Run the tests.** `pnpm db:reset </dev/null && pnpm db:test` and `node --test scripts/import-places.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.** Then, if `HF_TOKEN` is set, run `pnpm db:import-places --bbox vancouver`, commit the generated extract, and record the row count in the report.
- [ ] **Step 4: Run the tests again.** Same commands. Expected: PASS.
- Dev data note: the canvas places in `seed.sql` stay (picks reference them), so a real Foursquare "Marutama" may appear beside the seeded one in dev search. That's acceptable; merging custom places into Foursquare ones is already a known gap.
- [ ] **Step 5: Update known-gaps and commit.** Add "Show Foursquare attribution in the About screen (Phase 8)" and "Run the global places import in prod (Phase 8)" to known-gaps. Commit `Add place search, custom places and the Foursquare import`.

### Task 3: Dishes and picks: the write functions

**Files:**
- Create: migration `<ts>_picks_functions.sql`, migration `<ts>_pick_photos_storage.sql`, `supabase/tests/database/picks.test.sql`, `supabase/tests/database/pick_photos.test.sql`
- Modify: `supabase/config.toml` (`[storage.buckets.pick-photos]`: public, `file_size_limit = "4MiB"`, `allowed_mime_types = ["image/jpeg"]`), `docs/ops/supabase.md`

**Interfaces:**
- All functions below are `security definer`, `search_path = ''`, `authenticated` only, and raise `P0001` with the named codes.
- **`public.suggest_dishes(p_place_id uuid, p_q text, p_lim int default 6) returns table (dish public.dishes, pick_count int)`:**
  - unmerged dishes at the place
  - ranked by `name_key` prefix, then trigram similarity of `normalize_dish_name(p_q)`, then `pick_count`
  - `pick_count` counts picks by `trusted` accounts only
  - an empty `p_q` returns the most-picked 6
- **`public.dish_stats` view:** `dish_id`, `final_count`, `honorable_count`, `list_count` (= final + honorable), counted over `trusted` profiles only. It's a plain view now; materialising it is a Phase 7 gap.
- **Dish resolution** (internal `public._resolve_dish(p_place_id uuid, p_dish_id uuid, p_dish_name text) returns uuid`):
  - a given `p_dish_id` is used if it's at that place; otherwise raise `place_not_found`
  - otherwise use the exact `name_key` match
  - otherwise use the best unmerged dish with `similarity(name_key, normalize_dish_name(p_dish_name)) >= 0.85`
  - otherwise insert a new dish; raise `invalid_dish_name` outside 1–80 characters
- **`public.add_pick(p_place_id uuid, p_dish_id uuid, p_dish_name text, p_tier pick_tier, p_note text default null, p_tag_ids uuid[] default '{}', p_personal_tags text[] default '{}', p_photo_path text default null, p_replace_slot int default null) returns public.picks`:**
  - resolves the dish
  - raises `duplicate_pick` if the caller already has that dish
  - for `final`: with fewer than 5 finals, takes the next slot and ignores `p_replace_slot`
  - for `final` with 5 finals: if `p_replace_slot` is null, raises `final_full`; otherwise the occupant becomes `honorable` (slot null), the new pick takes that slot, and a `dethroned` activity is written with `pick_id` = new and `other_pick_id` = old
  - applies tags: global ids must exist and not be personal; personal names go through `create_personal_tag`
  - writes an `added_final` or `added_honorable` activity
  - `original_dish_name` = `p_dish_name` (or the dish's name if only `p_dish_id` was given)
  - photo path rule: `<uid>/pick-<digits>.jpg`, otherwise `invalid_photo`
- **`public.promote_pick(p_pick_id uuid, p_replace_slot int default null) returns public.picks`:** an honorable becomes final under the same full/swap rules; writes `promoted` (plus `dethroned` when swapping).
- **`public.demote_pick(p_pick_id uuid) returns public.picks`:** a final becomes honorable and later slots shift up.
- **`public.remove_pick(p_pick_id uuid) returns void`:** deletes the pick, its pick_tags and its activities; later slots shift up; best-effort photo cleanup is done client-side.
- **`public.update_pick(p_pick_id uuid, p_note text, p_tag_ids uuid[], p_personal_tags text[], p_photo_path text) returns public.picks`:** replaces the note, tags and photo (null photo clears it).
- **`public.move_final(p_pick_id uuid, p_to_slot int) returns setof public.picks`:** reorders within 1..n, shifting the others.
- **Ownership:** every function acts only on the caller's picks; otherwise raises `pick_not_found`.
- **Column grants:** clients keep no direct insert, update or delete on `picks` / `pick_tags` (revoke them and drop the Phase 1 own-row write policies); reads are unchanged.
- **Storage:** bucket `pick-photos`, with insert, update and delete only in the caller's folder, mirroring the avatar policies and the path check.

- [ ] **Step 1: Write the failing pgTAP tests** (`picks.test.sql`), each as `authenticated`. Plus a test of every Review Focus #1/#2/#3 case:
  - add 5 finals, giving slots 1–5
  - a 6th without a replace slot raises `final_full`
  - a 6th with `p_replace_slot => 3` makes the old slot-3 pick honorable, puts the new one in slot 3, and writes a `dethroned` activity
  - `demote_pick` on slot 2 shifts 3–5 to 2–4
  - `remove_pick` on slot 1 shifts the rest
  - `promote_pick` with fewer than 5 finals appends, and with 5 needs a replace slot
  - `move_final(slot5, 1)` reorders correctly
  - adding the same dish twice raises `duplicate_pick`
  - "Tonkotsu  Ramen!" at Marutama resolves to the seeded Tonkotsu Ramen; "Tonkotsu Ramen (extra chashu)" resolves by similarity if ≥ 0.85, otherwise a new dish, with the test asserting whichever the 0.85 rule gives and both cases covered
  - `original_dish_name` is kept
  - another user's pick raises `pick_not_found`
  - a direct `insert into picks` throws `42501`
  - an invalid photo path raises `invalid_photo`
  - personal tags are created and attached
  - a slot-integrity invariant check after every operation: slots are exactly 1..count
  - **Storage test** (`pick_photos.test.sql`): own-folder insert succeeds; another user's folder fails.
- [ ] **Step 2: Run the tests.** `pnpm db:reset </dev/null && pnpm db:test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Update the Phase 1 RLS tests that used direct pick writes, and explain each change.
- [ ] **Step 4: Run the tests again.** Same command. Expected: all PASS.
- [ ] **Step 5: Commit.** `Add transactional pick functions with contiguous Final Meal slots`

### Task 4: API: tags, places, dishes and picks

**Files:**
- Create in `packages/api/src/`: `tags.ts`, `places.ts`, `dishes.ts`, `picks.ts` (+ unit tests), `picks.integration.test.ts`
- Modify: `index.ts`, `errors.ts` / `friendly.ts` (new codes and copy), `database.types.ts` (regenerate)
- Create in `packages/core/src/`: `group.ts` (+ tests)

**Interfaces:**
- **Types:**
  - `Tag = { id; kind: 'food_type' | 'dietary' | 'personal'; name; slug; featured: boolean }`
  - `Place = { id; name; area: string | null; city; region: string | null; country; source: 'fsq' | 'custom'; lat; lng; distanceM: number | null; label }`, where `label` is `"<area> · <city>"`, or `"<city>"` with no area
  - `DishSuggestion = { id; name; pickCount }`
  - `Pick = { id; tier: 'final' | 'honorable'; slot: number | null; dish: { id; name }; originalDishName; place: Place; note: string | null; photoUrl: string | null; tags: Tag[]; createdAt }`
- **Tags:** `searchTags(client, kind, q, limit?)`, `createPersonalTag(client, name)`
- **Places:** `searchPlaces(client, q, near?: { lat; lng }, limit?)`, `createCustomPlace(client, { name, cityId, area?, lat?, lng? })`
- **Dishes:** `suggestDishes(client, placeId, q)`
- **Picks:**
  - `getMyPicks(client): Promise<Pick[]>`: finals by slot, then honorables newest first
  - `getPick(client, id): Promise<Pick | null>`
  - `addPick(client, input: { placeId; dishId?; dishName; tier; note?; tagIds?; personalTags?; photo?: ArrayBuffer; replaceSlot? }): Promise<Pick>`. It uploads the photo first (JPEG check as in `uploadMyAvatar`), to `pick-photos/<uid>/pick-<ms>.jpg`. If the upload fails, it adds the pick without a photo and returns `{ pick, photoFailed: true }`. So the return type is `{ pick: Pick; photoFailed: boolean }`.
  - `promotePick(client, id, replaceSlot?)`, `demotePick(client, id)`, `removePick(client, id)` (also best-effort deletes the photo object), `updatePick(client, id, patch)`, `moveFinal(client, id, toSlot)`
- **`@finalmeal/core`:**
  - `groupPicksByPlace(picks: Pick-like[]): Array<{ place; picks }>` keeps first-seen order
  - `summarizeGroups(groups) → "<n> picks at <m> spots"`, singular at 1 (`1 pick at 1 spot`)
  - `filterPicks(picks, filter: { city?; tagSlug?; personalTagSlug? })`
  - `chipOptions(picks): Array<{ kind: 'city' | 'tag'; value; label; count }>`: cities by count, then food type, dietary and personal tags by count, each sorted by count descending then name

- [ ] **Step 1: Write the failing tests.**
  - **Unit:** every new error mapping and its copy; `groupPicksByPlace` with the ProfileHM example (Marutama 2 dishes, Kin Kao 2, Miku 1… gives "7 picks at 5 spots" for Honorables in Vancouver from the seed); `chipOptions` ordering; `addPick` with an invalid photo rejects before any request.
  - **Integration** (local Supabase, fresh user):
    - add 5 finals through the API, then a 6th rejects `final_full`, then the swap works, then `getMyPicks` order is right
    - promote, demote and remove keep the slots contiguous
    - a duplicate rejects
    - a photo add gives a fetchable `photoUrl`
    - a failing photo upload (simulate by pointing at an over-limit buffer) gives `photoFailed: true` and the pick exists
    - `searchPlaces('maru', Vancouver)` returns Marutama first
    - `suggestDishes(Marutama, 'tonk')` returns Tonkotsu Ramen
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/core test && pnpm --filter @finalmeal/api test`, then the integration suite after `pnpm env:local`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests again.** Expected: green, plus root lint and typecheck. Run `pnpm db:reset </dev/null` after the integration tests.
- [ ] **Step 5: Commit.** `Add tags, places, dishes and picks to the API`

### Task 5: Mobile: Add a dish (restaurant search, dish suggestions, tags)

**Files:**
- Create in `apps/mobile/`: `app/(app)/add/_layout.tsx`, `add/index.tsx`, `add/place.tsx`, `add/custom-place.tsx`, `add/tags-search.tsx`
- Create in `apps/mobile/src/components/`: `PlaceSearch.tsx`, `DishField.tsx`, `TierChooser.tsx`, `TagPicker.tsx`, `PhotoField.tsx`
- Create: `src/state/add-dish.ts` (draft state, a reducer plus a context), with tests

**Interfaces and copy** (boards AddDish, AddDishTags, TagSearch):
- **Opening the flow:** the centre `+` tab opens `/add` as a modal stack. The first screen is the Add-dish form.
- **Form, title `Add a dish`:**
  - `PhotoField`: square tile labelled `Photo`, beside the text `Photo (optional).` / `Only your own. We never use stock images.` It uses the picker and resize from Phase 2 at 1600 px.
  - `Dish` field (`DishField`), placeholder `e.g. Smash Burger`. Once a restaurant is chosen, typing shows up to 6 suggestions from `suggestDishes`, labelled `<name> · <n> picks here` (omitting the count when it's 0). Choosing one sets `dishId`.
  - `Restaurant` row: shows the place label (`<name>` / `<area> · <city>`) with `Change`, or `Choose a restaurant` when empty. Tapping it opens `/add/place`.
  - `Add to` (`TierChooser`):
    - `Final Meal` with the sub-copy `<n> of 5 used.`, or when full `5 of 5 used. You’ll choose one to replace.`
    - `Honorable` with `Unlimited runners-up.`
  - `Note (optional)` (multi-line Newsreader italic, at most 280).
  - The `Add tags` row (`Optional · food type, dietary, your own`) expands inline (AddDishTags board). It holds:
    - `Food type` with label `Suggested`: the featured tags plus a `More` chip that opens `/add/tags-search`
    - `Dietary` with label `Any that apply`: the featured tags plus `More`
    - `Your tags` with label `Just for you`: the user's personal tags plus a `Your own` chip that prompts for a name
    - a `Hide` link that collapses it
    - selected chips use the ember-wash style
  - CTA: `Add to Final Meal`, or `Add to Honorable`. When five are full and Final Meal is chosen, the CTA reads `Choose one to replace` and opens Swap (Task 6).
  - The CTA is disabled until a restaurant and a dish name are set.
- **Place search** (`/add/place`, no board, styled like City search):
  - title `Choose a restaurant`; field placeholder `Search restaurants`
  - results (300 ms debounce, `near` = current location if granted, otherwise the home city) show the name (bold), `<area> · <city>` and the distance (`450 m` / `3.2 km`, omitted when unknown)
  - with an empty field: the nearest spots
  - footer row `Can’t find it? Add it` opens `/add/custom-place` with the typed text
  - location permission is asked once with `Use my location for nearby spots`; if denied, the home city is used silently
- **Custom place** (`/add/custom-place`):
  - title `Add a spot`
  - fields `Name` (prefilled), `Area or street (optional)`, `City` (CityPicker, defaulting to the home city)
  - toggle `I’m here now` (uses the current location when allowed)
  - CTA `Add spot`, which calls `createCustomPlace` and returns to the form with that place
  - helper `Food trucks, pop-ups, a friend’s place: if it served you a dish worth remembering, it counts.`
- **Tag search** (`/add/tags-search`):
  - title `Add food type` or `Add dietary`, with a `Done` action
  - segmented `Food type | Dietary`
  - search field `Search food types` / `Search dietary`; results with a typed-prefix bold and an add/check toggle
  - empty query: a `Popular` chip row
  - footer `Not here? Add “<q>” to Your tags instead`, which creates a personal tag
- **Duplicate:** if `addPick` rejects `duplicate_pick`, show the copy and, when the existing pick is honorable and Final Meal was chosen, offer `Make it a Final Meal instead` (promote).

- [ ] **Step 1: Write the failing tests:**
  - the draft reducer (set place, dish suggestion, tier, tags, note)
  - the CTA label and disabled rules, including the full-five label
  - `DishField` shows the `· 14 picks here` format and hides 0
  - `PlaceSearch` debounce and the distance formatting (`450 m`, `3.2 km`)
  - the custom-place prefill
  - tag search: the empty state shows Popular, and the footer creates a personal tag
  - the duplicate path offers promote
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Add the Add-a-dish flow with restaurant search, custom spots and tags`

### Task 6: Mobile: save, swap, pick detail, edit

**Files:**
- Create in `apps/mobile/`: `app/(app)/add/swap.tsx`, `app/(app)/pick/[id].tsx`, `app/(app)/pick/[id]/edit.tsx`
- Create in `apps/mobile/src/components/`: `SlotRow.tsx`, `TagChips.tsx`, `PickActions.tsx` (+ tests)

**Interfaces and copy** (boards Swap, PickDetail):
- **Saving:**
  - `addPick` runs with the draft. While saving, the CTA is busy and back is disabled.
  - On success, close the modal, go to You, and refresh.
  - If `photoFailed`, show a toast/banner on You: `Saved without the photo. Add it from the dish any time.`
  - Retrying never double-adds: the CTA is disabled while in flight, and a `duplicate_pick` after a timeout counts as success by re-reading.
- **Swap** (`/add/swap`):
  - header `Your five are full`; title `Something has to go.`
  - an incoming card with the dish, the place label and `Incoming`
  - text `Pick the dish it replaces. That one moves to your Honorable Mentions — nothing is deleted.`
  - the five finals as radio rows (numeral, thumbnail or placeholder, dish, place label); the selected row is struck through in ember glow
  - CTA `Replace <dish name>`, then `addPick` with `replaceSlot`; `Cancel` goes back
  - also used for promote-when-full, with the incoming card showing the honorable being promoted
- **Pick detail** (`/pick/[id]`, own picks; viewing others' picks is Phase 4):
  - a hero photo (or the ember-skull placeholder tile on `ashRaised`)
  - badge `Final Meal · #<slot>` or `Honorable`
  - dish name (Newsreader 40), place label with a pin
  - tag chips
  - buttons `Directions` (opens Apple Maps / Google Maps through `expo-linking` with the coordinates and name) and `Save to try`, which is hidden on your own pick and is a Phase 4 feature
  - your note in quotes (Newsreader italic)
  - the "On 23 Final Meals" row is hidden until Phase 4
  - an overflow menu (`PickActions`):
    - `Edit`
    - `Make it a Final Meal` (honorable), or `Move to Honorable` (final)
    - `Move up` / `Move down` (final, via `moveFinal`)
    - `Remove from my list` (confirm `Remove <dish>? This can’t be undone.`)
- **Edit** (`/pick/[id]/edit`): the photo, note and tags (same components as Add); `Save`. The dish and restaurant aren't editable; the helper says `To change the dish or restaurant, remove this pick and add it again.`

- [ ] **Step 1: Write the failing tests:**
  - swap: selecting a row sets the CTA label, and confirming calls `addPick` with `replaceSlot`
  - the promote-when-full path uses Swap
  - `photoFailed` shows the banner copy
  - the remove confirm copy and the call
  - move up is disabled on slot 1
  - Directions builds the correct URL per platform
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Add saving, swapping, pick detail and editing`

### Task 7: Mobile: You tab with real picks and filters

**Files:**
- Modify: `app/(app)/(tabs)/you.tsx`, `src/components/ProfileHeader.tsx`, `src/components/EmptySeats.tsx`
- Create in `src/components/`: `FinalMealList.tsx`, `HonorableList.tsx`, `FilterChips.tsx` (+ tests)

**Interfaces and copy** (boards Profile, ProfileHM):
- **Stats:** `dishes` = the total number of picks.
- **Tabs:** labels carry counts: `Final Meal <n>`, `Honorable <n>`, `Map`.
- **Filter chip row** (decision: chip row, spec 13.1):
  - shown under the tabs once there is at least 1 pick
  - `All`, then `chipOptions` (cities, then tags), single-select, applies to the Final Meal and Honorable tabs
  - when a filter is active, a summary line `<city or tag> · <n> picks at <m> spots` (Honorable) and a `Share these` link that is hidden until Phase 6
- **Final Meal tab:**
  - `FinalMealList`: slots 1..n as `SlotRow` (numeral, thumbnail, dish, place label), tapping through to pick detail
  - remaining seats: the empty seat row `One seat left. Choose wisely.` when n = 4; with n < 4, the dashed empty seats with `Add a dish` that open `/add` with Final Meal preselected
  - with a filter active, non-matching finals are dimmed, not hidden (they keep their slot numbers)
- **Honorable tab:** `HonorableList` grouped by restaurant. Each group has a header with the place name, `<area> · <city>` and `<n> dishes` (shown from 2 dishes up), then its dishes with the `Honorable` badge and tag chips. Empty: `No honorable mentions yet.`
- **Map tab:** still `Your map fills in as you add dishes.` (maps are Phase 5).
- **Refresh:** pull-to-refresh, and a refresh after any add, swap or edit.

- [ ] **Step 1: Write the failing tests:**
  - the seeded Josie fixture renders 4 finals plus `One seat left. Choose wisely.`
  - Honorable groups show `2 dishes` for Marutama
  - a filter `Vancouver` gives the summary `Vancouver · 8 picks at 6 spots` (use the seed-shaped fixture; assert whatever the fixture yields and document the exact numbers)
  - dimming on the Final Meal tab
  - the tab counts
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Show real picks on the You tab with restaurant grouping and filters`

### Task 8: Mobile: first pick in onboarding, First landing

**Files:**
- Create in `apps/mobile/`: `app/(onboarding)/first-pick.tsx`, `app/(onboarding)/add-first.tsx`, `app/(app)/(tabs)/home.tsx` (First landing; the Feed tab shows it until Phase 4)
- Modify: `app/(onboarding)/photo.tsx` (goes to first-pick), `app/(onboarding)/loading.tsx` (goes to First landing), `src/lib/route-for.ts` (an onboarded person lands on the Feed tab, which shows First landing until Phase 4; no extra flag needed)

**Copy** (boards OnbFirstPick, OnbAddFirst, FirstLand):
- **The hard part:**
  - skull; title `Now for the hard part.`
  - body `Five dishes. Forever. What’s the first one on your Final Meal?`
  - five seat tiles with seat 1 highlighted
  - CTA `Add my first pick` (skull icon) and link `Skip for now`
  - both call `finishOnboarding` at the right point: Skip finishes directly; adding finishes after the pick saves
- **Your first pick:** the Add-dish form (Task 5 components) locked to Final Meal.
  - header `Your first pick` with `#1 of 5`
  - photo label `Add a photo (optional)`, tags label `Tags (optional)`, note label `Why this one? (optional)`
  - CTA `Lock it in` (skull icon), then the loading screen
- **First landing** (`home.tsx`):
  - wordmark header
  - `Welcome, <first name>`; title `Your Final Meal has begun.`
  - a hero card for slot-1 (`Final Meal · #1`, dish, place, note in quotes)
  - the five seats with `<5-n> seats left` (singular `1 seat left`)
  - CTA `Add your next dish`
  - with 0 picks: title `Your table is set.` and CTA `Add your first dish`
  - the "8 others in Vancouver…" line and the "Nearby in <city>" section are hidden until Phase 4
- **Routing:** first landing shows after onboarding. The Feed tab renders First landing until Phase 4 builds the real feed.

- [ ] **Step 1: Write the failing tests:**
  - the onboarding route sequence: photo → first-pick → (Skip) loading → home, and (Add) → add-first → Lock it in → loading → home
  - `routeFor` resume cases still pass, plus the new first-pick resume
  - First landing copy for 0, 1 and 4 picks (the `1 seat left` singular)
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Add the first pick to onboarding and the First landing screen`

### Task 9: Device verification, docs, CI

- [ ] **Step 1: iPhone 17 run.** `pnpm db:reset </dev/null && pnpm env:local`, one Expo server. Screenshot every step. Sign in as seeded `josiehamilton@example.com` (code from Mailpit):
  1. You shows 4 finals, the seat line and Honorable grouped by restaurant. The filter `Vancouver` shows its summary.
  2. Add Tonkotsu Ramen at Marutama as Final Meal (suggestion `· n picks here` shown), with tags and a photo. It becomes #5.
  3. Add another dish as Final Meal, which goes to Swap: replace #4. Confirm #4 is now Honorable and the new dish is #4.
  4. In pick detail: Move up, Directions, Edit the note, Remove (confirm).
  5. Add at a custom spot ("Grandma’s Kitchen", Vancouver, no location).
  6. Adding a duplicate shows the copy and the promote offer.
  7. Sign up a new user through onboarding: The hard part, then Your first pick, then Lock it in, then First landing (`4 seats left`).
- [ ] **Step 2: Pixel_10 run.** Repeat 2, 3, 5 and 7, plus Review Focus #5: put the photo upload in airplane mode mid-save (`adb shell svc wifi disable` and `svc data disable`) and confirm the pick saves without a photo and the banner shows. Re-enable the network after.
- [ ] **Step 3: Run every local check.** `pnpm db:test`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, then `pnpm db:reset </dev/null`.
- [ ] **Step 4: Update the docs.**
  - README "Try the app" gets the add-a-dish steps; the device checklist gets the Phase 3 items.
  - `CLAUDE.md` status: Phase 3 built on its branch, awaiting OK.
  - `docs/known-gaps.md` is updated.
  - Commit `Phase 3: device-verified docs and status`.
- [ ] **Step 5: Push and check CI.** Push `phase-3-places-dishes` and confirm CI is green (give the URL). Don't merge.

## Phase 3 done means

On the iPhone 17 and Pixel 10, a person can:
- search real Vancouver restaurants or add their own spot
- add dishes with suggestions, tags, notes and photos
- fill their five, swap one out, and reorder, demote or remove picks
- see Honorable Mentions grouped by restaurant, with working filter chips

New members get "Now for the hard part" and land on "Your Final Meal has begun." All tests and CI are green.
