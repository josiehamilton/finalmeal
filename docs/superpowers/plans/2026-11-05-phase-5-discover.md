# Phase 5: Discover (map, search, filters) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Model rule (Josie):** Sonnet 5.5 subagents implement; Opus 5.5 plans and reviews. Without the plugin, follow `CLAUDE.md` "How we build". Josie said on 2026-11-03 to keep building through the MVP without waiting for plan approval: execute this plan directly and log every ruling.

**Goal:** People browse a dark Vancouver map of picks (a skull pin where anyone has it as a Final Meal, a bone dot otherwise), filter it by pick type, people they follow, distance, food type and dietary tags, open what they find, and search dishes, spots and people from Discover and from the Feed. Profiles get a Map tab, Saved gets a Map view, and custom spots get real positions from a pluggable geocoder.

**Architecture:**
- **Data:**
  - One internal SQL helper, `_discover_picks`, decides which picks the map may use (trusted accounts, people you follow and yourself; never across a block; filters applied). `picks_in_view` (place pins) and `dishes_in_view` (the sheet's dish cards, or one place's dishes) both read it, so pins, counts and cards always agree.
  - `search_dishes` joins the Phase 3 `search_places` and the Phase 4 `search_people` (redefined to return follower counts).
  - Custom spots get `location_precision` (`exact` / `city`) and a geocode queue. A spot stays off the map until its address is geocoded.
- **Geocoding:** an Edge Function, `geocode-places`, drains the queue through a pluggable `Geocoder`: `mock` (local stacks only), `none` (the default anywhere else), and a production adapter, `geoapify`, that is built and tested but stays off until Josie chooses a provider. Like `push-dispatch`, it is called by hand locally (`pnpm geocode`); a schedule comes in Phase 8.
- **Map (Expo Go):** `@maplibre/maplibre-react-native` needs a development build, so the app renders **maplibre-gl inside `react-native-webview`** (shipped in Expo Go; SDK 58 pins `react-native-webview` 14.0.1) with OpenFreeMap tiles and a small typed message bridge (pins, selection, camera and insets in; region changes, pin taps, map taps and load errors out). Switching to native MapLibre with development builds is a Phase 8 known gap. The web app gets no map this phase (Phase 6 builds the web list and map pages).
- **Clients:** `@finalmeal/api` wraps the new functions; `@finalmeal/core` holds the Discover filter model and copy helpers; the mobile app gets the Discover tab, the Filters sheet, one Search screen (replacing Find people), profile Map tabs, Saved's Map view and First landing's "See the map".

**Tech Stack:** The Phase 1–4 stack, plus:
- `react-native-webview` 14.0.1 and `@react-native-community/slider` 5.2.1 (both in Expo Go for SDK 58; add them with `pnpm --filter @finalmeal/mobile exec expo install react-native-webview @react-native-community/slider`)
- `maplibre-gl` 5.x loaded inside the WebView from `cdn.jsdelivr.net` (exact version and SRI hashes pinned in code)
- OpenFreeMap vector tiles and its `dark` style, recoloured to the canvas palette
- PostGIS geometry index for bounding-box queries

**Spec:** `docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md`: sections 1.1, 4, 5.2 (custom places), 5.4 (Discover, Profile), 5.5, 6, 7 and 11 (Phase 5 row). **Canvas:** Discover, DiscoverHM, DiscoverFilters, DiscoverSearch, Search, TagSearch (styling for the Filters "More" search), ProfileMap, plus the Saved and FirstLand "Map view" / "See the map" links, in `design/canvas/project/`. **Carry-forward:** `docs/known-gaps.md` (Phase 5: geocode custom spots; Search replaces Find people behind the Feed's search icon; a Map tab on other profiles and on You) and the Phase 4 ruling in `docs/build-log/phase-4.md`: blocked people are excluded from pickers, and Discover must match.

## Global Constraints

- **All Phase 1–4 constraints and `CLAUDE.md` rules apply:**
  - tokens only (the `no-raw-colours` test also covers the new map files; colours inside the map page come from `@finalmeal/ui-tokens`); Instrument Serif, Newsreader and Manrope; ember `#C04B28` and ember glow `#E8693F` are the only accents
  - Supabase is codified: new migrations only, `security definer` functions with `set search_path = ''`, execute revoked from `public`/`anon` unless stated, every change recorded in `docs/ops/supabase.md` in the same commit; spec changes in the same commit as the code
  - use the pinned CLI via `pnpm exec supabase` / `db:*`; never commit `.env*` files or keys
  - commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
- **Branch:** `phase-5-discover` (off `main` after the Phase 4 merge). No merge into `main` without Josie's OK. Check CI after every push (Phase 4 ruling).
- **Expo Go only.** No native module that Expo Go does not ship. Nothing imports `@maplibre/maplibre-react-native`. Add native packages only with `expo install` so versions match SDK 58.
- **No current location, ever.**
  - Nothing in this phase imports `expo-location`, and the map page never touches `navigator.geolocation` or adds a `GeolocateControl` (tests scan for all three).
  - The Discover map starts at the viewer's **home city point** (zoom 12). Without a home city it starts at the world view (`lat 20, lng 0, zoom 1.5`) and the sheet prompts for a city.
  - **Distance on Discover is measured from the map's current centre**: the Distance filter, the distances on Discover's cards and sheet, and Discover-opened Search results. Search opened from the Feed measures from the home city point. A distance of 100 km or more is not shown.
- **Who appears on the map** (pins, counts in the sheet, dish cards, dish search): picks whose owner is `trusted`, or is the viewer, or is someone the viewer **actively** follows; never across a block (either direction); never at a merged or closed place; never at a place with `location_precision = 'city'`.
  - Private trusted accounts' picks count and pin, but **private accounts are never named** on Discover or Search dish results (no avatar, name or link), even to approved followers.
  - A card or row opens a pick (`pick_id`) only when the viewer may see it (`_can_see`): the viewer's own first, then people they follow, then public; Final before Honorable; newest first. Otherwise `pick_id` is null and the row is not a link.
  - Named people (`people`) are public, non-blocked owners of matching picks, never the viewer, people you follow first, at most 3.
  - Displayed counts (`list_count`, `final_count`, `honorable_count`) are trusted-only, as in `dish_stats`.
- **Filters:** tier (`All` / `Final Meals` / `Honorable`, single choice), `Following` (only people you follow), distance (1–99 km, or `Any`), food types and dietary tags (global tags on the pick). Within a kind tags are **any of**; across kinds **all of** (Sushi or Noodles, and Gluten-free). Personal tags are never filters on Discover.
- **Map tiles:** OpenFreeMap (`https://tiles.openfreemap.org/styles/dark`). The map's attribution control stays visible (compact, bottom-right, lifted above the sheet). Its links open in the system browser; the WebView never navigates away from its own page.
- **Not built this phase** (hide the controls; never show dead buttons):
  - the **Shared lists** section of Discover search (Phase 6: `shared_lists` search arrives with Your lists)
  - every Share control, including the ProfileMap board's `Share these` and `Share a list` (Phase 6)
  - the ProfileMap board's `More filters` button
  - the board's suggestion reasons (`Also has Wagyu Beef Don`, `Followed by Ari`, `Popular in Vancouver`)
  - any web map (Phase 6)
  - a drop-a-pin control for food trucks and pop-ups (they have no pin; see Decisions)
- **Limits:** `picks_in_view` returns at most 300 places (the most-listed first); `dishes_in_view` at most 50 dishes; searches 20 rows per kind; cap any `p_limit` at those values.
- **Errors:** no new client-facing codes. `invalid_coordinates` (already raised by `search_places`) maps to the `unknown` copy. Network and server failures use the existing friendly copy plus `Try again`.
- **Copy:** quote canvas copy exactly, with typographic punctuation. Where the canvas shows sample data (`14 lists`, `1.8 km`, names), render real data. Copy not on the canvas is pinned in the task that uses it and listed under Decisions for Josie.

## Review Focus

1. **Privacy on the map.** A private trusted member's pick makes a pin and counts, but no name, avatar or profile link appears anywhere on Discover, and its card opens nothing for non-followers. A blocked person's picks vanish from pins, cards, people rows and dish search, both ways. A brand-new account you don't follow is not on your map; one you follow is. Pinned in Task 2.
2. **Fast panning and odd viewports.** Rapid pans fire many region changes: only the latest response is shown (older ones are dropped), and the sheet never shows counts from a different viewport than the pins. A viewport that crosses the antimeridian (Fiji, Alaska) still finds its places; the world view returns the 300 most-listed places and says `Zoom in to see every pick.` Pinned in Tasks 2 and 5.
3. **The map fails to load** (offline, CDN or tile server down, a WebGL failure). The map area shows `The map didn’t load.` with `Try again`; the chips, Filters, Search and the sheet's list still work. Pinned in Tasks 4 and 5.
4. **Custom spots never get a fake pin.** A pending, not-found or failed spot, and one with no fixed address, has no pin (it is not stacked on its city's centre). A geocoder answer more than 50 km from the spot's city is refused as not found. The mock geocoder never runs on a non-local stack, even when `GEOCODER=mock` is set. Pinned in Task 1.
5. **No home city, and no location.** Discover without a home city starts at the world view with `Set your home city to start the map there.`; nothing asks for location permission; distances come from the map's centre. Pinned in Tasks 4, 5 and 6.

---

### Task 1: Geocode custom spots (database, pluggable geocoder, Edge Function)

**Files:**
- Create: migration `20261105090000_place_geocoding.sql`, `supabase/tests/database/geocoding.test.sql`, `supabase/functions/_shared/geocoder.ts`, `supabase/functions/_shared/geocoder-geoapify.ts`, `supabase/functions/_shared/service-auth.ts`, `supabase/functions/geocode-places/index.ts`, `scripts/geocode-places.mjs`, `scripts/geocoder.test.mjs`, `packages/api/src/geocode.integration.test.ts`
- Modify: `supabase/functions/push-dispatch/index.ts` (use `isServiceRequest` from `service-auth.ts`; no behaviour change), `supabase/config.toml` (`[functions.geocode-places] verify_jwt = true`), root `package.json` (`"geocode": "node scripts/geocode-places.mjs"`), `docs/ops/supabase.md` (columns, functions, Edge Function, Secrets `GEOCODER` and `GEOAPIFY_API_KEY`, and a "Before the first production push" line: set `GEOCODER` only once Josie has chosen a provider), the spec §4 (`places` columns) and §5.2 (custom places are geocoded; no-fixed-address spots have no pin)

**Interfaces:**
- **`places` columns** (grant client `select` on `location_precision` only; the others stay server-side):
  - `location_precision text not null default 'exact' check (location_precision in ('exact','city'))`
  - `geocode_status text not null default 'not_needed' check (geocode_status in ('not_needed','pending','geocoding','done','not_found','failed'))`
  - `geocode_attempts smallint not null default 0`, `geocode_claimed_at timestamptz`, `geocoded_at timestamptz`, `geocoder text`
  - partial index `places_geocode_queue on places (created_at) where geocode_status = 'pending'`
  - **Backfill:** custom places with `created_by is not null`: `location_precision = 'city'`, and `geocode_status = 'pending'` (or `'not_needed'` when `no_fixed_address`). Seed places (`created_by` null, hand-placed coordinates) stay `exact` / `not_needed`.
- **`create_custom_place`** (`create or replace`, same signature, grants restated): the new row gets `location_precision = 'city'` and `geocode_status = 'pending'`, or `'not_needed'` with `no_fixed_address`. Nothing else changes.
- **`public.claim_geocode_batch(p_limit integer default 20)`** (service_role only) returns `table (place_id uuid, name text, address text, postcode text, city text, region text, country text, city_lat double precision, city_lng double precision)`:
  - rows with `geocode_status = 'pending'`, or `'geocoding'` with `geocode_claimed_at < now() - interval '10 minutes'` (a dispatch that died), oldest first, `for update skip locked`, at most 20
  - sets `geocode_status = 'geocoding'`, `geocode_claimed_at = now()`, `geocode_attempts + 1`
  - `city_lat`/`city_lng` are the place's current point (still the city's point while it is unplaced)
- **`public.finish_geocode(p_place_id uuid, p_result text, p_lat double precision default null, p_lng double precision default null, p_geocoder text default null) returns text`** (service_role only), returning the status it set:
  - `found` with valid coordinates within **50 000 m** of the place's current point: `location` moves there, `location_precision = 'exact'`, `geocode_status = 'done'`, `geocoder`, `geocoded_at = now()`
  - `found` but invalid or too far, or `not_found`: `geocode_status = 'not_found'`, position untouched
  - `retry`: back to `'pending'`, or `'failed'` once `geocode_attempts >= 3`
  - a place not in `'geocoding'` is left alone (returns its current status)
- **`supabase/functions/_shared/geocoder.ts`** (no Deno APIs, so Node's test runner can load it, like `push-sender.ts`):
  - `export interface GeocodeQuery { address: string; postcode: string | null; city: string; region: string | null; country: string; near: { lat: number; lng: number } }`
  - `export type GeocodeResult = { status: 'found'; lat: number; lng: number } | { status: 'not_found' } | { status: 'retry'; reason: string }`
  - `export interface Geocoder { name: string; geocode(q: GeocodeQuery): Promise<GeocodeResult> }`
  - `mockGeocoder`: deterministic. An address starting with `Nowhere` gives `not_found` (a documented test hook). Otherwise FNV-1a of `lower(address)|lower(city)` picks a bearing (0–360°) and a distance (300–2500 m) from `near`, and returns `found`.
  - `noneGeocoder`: never called (the function claims nothing with it); `geocode` returns `retry`.
  - `isLocalStack(supabaseUrl: string | undefined): boolean`: the hostname is `kong`, `localhost`, `127.0.0.1` or `host.docker.internal`.
  - `geocoderFromEnv(env: { GEOCODER?: string; GEOAPIFY_API_KEY?: string; SUPABASE_URL?: string }, fetchImpl?: typeof fetch): Geocoder`:
    - unset or empty: `mock` on a local stack, `none` elsewhere
    - `none`: none
    - `mock`: mock on a local stack; elsewhere `none`, with a one-time warning `The mock geocoder only runs on a local stack; using none`
    - `geoapify`: `geoapifyGeocoder(key, fetchImpl)`; without a key, `none` with the warning `GEOAPIFY_API_KEY is not set; using none`
    - anything else: `none`, with the warning `Unknown GEOCODER "<value>"; using none`
- **`supabase/functions/_shared/geocoder-geoapify.ts`** (the production adapter, off until Josie chooses):
  - `geoapifyGeocoder(apiKey: string, fetchImpl = fetch): Geocoder` with `name: 'geoapify'`
  - GET `https://api.geoapify.com/v1/geocode/search` with `text` = address, postcode, city, region, country joined by `, ` (blank parts dropped), `filter=circle:<lng>,<lat>,50000`, `bias=proximity:<lng>,<lat>`, `limit=1`, `format=json`, `apiKey`
  - first result with `rank.confidence >= 0.7` is `found` (`lat`, `lon`); no such result is `not_found`; HTTP 429 or 5xx or a network error is `retry`; other HTTP errors are `not_found`. The key never appears in a log line.
- **`supabase/functions/_shared/service-auth.ts`:** `isServiceRequest(req: Request, serviceKey: string | undefined): boolean`, the constant-time bearer comparison moved out of `push-dispatch`.
- **`geocode-places`** (POST): 401 unless `isServiceRequest`. With `none` it claims nothing. Otherwise it claims a batch, geocodes rows one at a time, calls `finish_geocode` for each, and responds `{ claimed, found, notFound, retried, geocoder }`. Database access through PostgREST with `fetch`, as `push-dispatch` does.
- **`scripts/geocode-places.mjs`:** the `push-dispatch.mjs` pattern (reads `supabase status -o json`, POSTs with the service key, prints the JSON, never prints the key).

- [ ] **Step 1: Write the failing tests.**
  - **`geocoding.test.sql`** (as `authenticated` for creation, `service_role` for the queue):
    - `create_custom_place('Ember Dogs', <Vancouver city id>, '1820 Commercial Dr')` gives `location_precision = 'city'`, `geocode_status = 'pending'`; with `p_no_fixed_address => true`, `'not_needed'`
    - `claim_geocode_batch()` returns the pending spot with its city's point and marks it `geocoding` with 1 attempt; a second call returns nothing; after `geocode_claimed_at` is backdated 11 minutes, it is claimed again
    - `finish_geocode(id, 'found', 49.269, -123.069, 'mock')` returns `done`, moves the point, sets `exact`
    - `found` at `48.4284, -123.3656` (Victoria, ~95 km) returns `not_found` and leaves the point
    - `retry` three times ends `failed`
    - `authenticated` can't execute `claim_geocode_batch` or `finish_geocode`, and can't select `geocode_status`; it can select `location_precision`
    - seed places are all `exact`
  - **`scripts/geocoder.test.mjs`** (`node --test`):
    - `geocoderFromEnv` for each row of the selection table above (local `http://kong:8000` and remote `https://abc.supabase.co`), with each warning shown once
    - the mock is deterministic (same query, same point), lands 300–2500 m from `near`, and gives `not_found` for `Nowhere Rd`
    - Geoapify with a fake `fetch`: the request URL has the circle filter, bias and joined text; confidence 0.9 is `found`, 0.5 is `not_found`, 429 and a thrown error are `retry`, 400 is `not_found`; the key is not in any `console` output
    - `isServiceRequest` accepts the exact key and rejects a different one, a missing header and a user JWT
  - **`geocode.integration.test.ts`** (local stack; skip with the `push.integration.test.ts` hint when the function isn't served):
    - a fresh user creates a custom spot `<suffix> Test Tacos`, `12 Main St`, in Vancouver; POST `/functions/v1/geocode-places` with `serviceRoleKey()` returns 200 with `geocoder: 'mock'` and `found >= 1`; `getPlace` then has a point within 3 km of Vancouver's and differs from it
    - a spot at `Nowhere Rd` ends `not_found` (`notFound >= 1`) and stays at the city point
    - POST with the user's JWT gives 401
- [ ] **Step 2: Run the tests.** `pnpm db:reset </dev/null && pnpm db:test`, `node --test scripts/geocoder.test.mjs`, then `pnpm env:local && pnpm --filter @finalmeal/api test:integration -- geocode`. Expected: FAIL.
- [ ] **Step 3: Implement.** Restart the stack (`pnpm db:stop && pnpm db:start`) so it serves the new function.
- [ ] **Step 4: Run the tests again.** Same commands, plus `pnpm --filter @finalmeal/api test:integration -- push` (the auth refactor). Expected: PASS. Run `pnpm geocode` once and paste its output in the report.
- [ ] **Step 5: Commit.** `Geocode custom spots through a pluggable geocoder (mock locally, off in production)`

### Task 2: Discover queries: picks in view, dishes in view, dish search, people with follower counts

**Files:**
- Create: migration `20261105100000_discover.sql`, `supabase/tests/database/discover.test.sql`, `supabase/tests/database/search.test.sql`
- Modify: `supabase/tests/database/people.test.sql` (the new `followers_count` column), `docs/ops/supabase.md`, the spec §5.4 (Discover: who appears, filter rules, distance from the map's centre)

**Interfaces:**
- **Index:** `create index places_location_geom on public.places using gist ((location::extensions.geometry))`. Bounding boxes use `location::extensions.geometry operator(extensions.&&) extensions.st_makeenvelope(w, s, e, n, 4326)`.
- **Filter arguments** (the same names and order in all three Discover functions):
  `p_tier public.pick_tier default null` (null = All), `p_following_only boolean default false`, `p_food_type_ids uuid[] default null`, `p_dietary_ids uuid[] default null`, `p_center_lat double precision default null`, `p_center_lng double precision default null`, `p_radius_m integer default null`
  - `p_radius_m` is clamped to 1 000–100 000 and applies only with a centre.
  - Coordinates out of range raise `invalid_coordinates`.
- **`public._discover_picks(p_viewer uuid, p_west double precision, p_south double precision, p_east double precision, p_north double precision, <filter arguments>, p_place_id uuid default null)`** (internal; execute revoked from clients) returns `table (pick_id uuid, owner_id uuid, owner_trusted boolean, owner_public boolean, viewer_follows boolean, dish_id uuid, place_id uuid, tier public.pick_tier, created_at timestamptz)`:
  - eligibility as in Global Constraints ("Who appears on the map")
  - with `p_place_id`, only that place and the bounding box is ignored (it may be null); otherwise all four bounds are required
  - `p_west > p_east` means the box crosses the antimeridian: two envelopes, `[west, 180]` and `[-180, east]`
  - tag filters: the pick has at least one of `p_food_type_ids` (when given) **and** at least one of `p_dietary_ids` (when given), through `pick_tags`
- **`public.picks_in_view(p_west, p_south, p_east, p_north, <filter arguments>, p_limit integer default 300)`** (`authenticated`, stable) returns `table (place_id uuid, name text, area text, address text, city text, lat double precision, lng double precision, best_tier public.pick_tier, pick_count integer, list_count integer, top_dish_name text)`:
  - one row per place with a matching pick; `best_tier` is `final` if any matching pick is Final
  - `pick_count` = matching picks; `list_count` = matching picks whose owner is trusted
  - `top_dish_name` = the matching dish with the highest `dish_stats.list_count`, then Final first, then name
  - order `list_count desc, best_tier (final first), pick_count desc, place_id`; at most 300
- **`public.dishes_in_view(p_west default null, p_south default null, p_east default null, p_north default null, <filter arguments>, p_place_id uuid default null, p_limit integer default 50)`** (`authenticated`, stable) returns `table (dish_id uuid, dish_name text, place public.places, best_tier public.pick_tier, final_count integer, honorable_count integer, list_count integer, pick_id uuid, photo_path text, distance_m double precision, people jsonb)`:
  - one row per dish with a matching pick; `place` through `mask_place`
  - counts from `dish_stats` (trusted, all people)
  - `pick_id` and `photo_path`: the openable pick (rule in Global Constraints), or null
  - `distance_m` from the centre when given, else null
  - `people`: up to 3 `{id, username, display_name, avatar_path}` (rule in Global Constraints)
  - order `list_count desc, best_tier (final first), distance_m nulls last, dish_name`; at most 50
- **`public.search_dishes(p_q text, p_lat double precision default null, p_lng double precision default null, p_limit integer default 20)`** (`authenticated`, stable) returns the same table as `dishes_in_view` with `people = '[]'`:
  - dishes with at least one eligible pick (no filters), unmerged, at an open, unmerged place
  - matching on `normalize_dish_name(p_q)` against `name_key`: starts with, then a word starts with, then trigram (`%`); a blank query returns nothing
  - order: match tier, then (with a point) places within 50 km first, then `list_count desc`, then distance, then name
- **`public.search_people(p_q text, p_limit integer default 20)`:** `drop function` and recreate with the same matching, order and rules, adding `followers_count integer` (active followers) as the last column. Grants restated.

- [ ] **Step 1: Write the failing pgTAP tests** (seed data; Vancouver box `-123.3, 49.1, -122.9, 49.4`).
  - **`discover.test.sql`:**
    - as Mike: six places (Skewers, Marutama, Kin Kao final; Miku honorable; Lotus Noodle Bar final via Priya's private pick; Hearth Bakery honorable); Skewers `pick_count = 2`
    - as Mike, `dishes_in_view(p_place_id => Lotus Noodle Bar)`: Xiao Long Bao has `pick_id` null and empty `people`; no row anywhere names Priya; after Priya approves a follow from Mike, `pick_id` is Priya's pick and `people` is still empty
    - as Mike, Sushi Dai (Tokyo) has `pick_count = 1` (Sam is `new`); as Sam, 2 (his own counts)
    - `p_tier => 'honorable'` as Josie leaves out Skewers
    - `p_following_only` as Josie: only Skewers, Marutama and Kin Kao
    - `p_food_type_ids => {noodles}` as Mike: Kin Kao, Marutama and Lotus, with Marutama's `best_tier = 'honorable'` (Dev's untagged Final doesn't match)
    - `{noodles}` plus `p_dietary_ids => {vegan}`: Lotus only; `{noodles, sushi}`: also Miku
    - centre Kin Kao, `p_radius_m => 1000`: Kin Kao and Hearth Bakery only
    - Josie blocks Ari: as Josie, Skewers `pick_count = 1` and Ari is in no `people`; as Ari, Josie's picks are gone
    - a custom spot with a pick is absent while `city` and present after `finish_geocode(…, 'found', …)`
    - a fixture place at lng 179.5 is found by the box `west 170, east -170`
    - a box with `p_north = 95` raises `invalid_coordinates`
    - `p_limit => 1000` returns at most 300; `anon` can't execute either function
    - `people` order: as Josie on Khao Soi, Dev (followed) before Alli
  - **`search.test.sql`:**
    - `search_dishes('ramen', 49.28, -123.12)` as Josie starts with Tonkotsu Ramen at Marutama, with a `distance_m` and `pick_id` = Josie's own pick
    - `search_dishes('xiao')` as Mike returns Xiao Long Bao with `pick_id` null
    - `search_dishes('omakase')` as Mike returns Josie's Omakase dish; with Josie's pick removed and only Sam's left, nothing
    - a blank query returns nothing
    - `search_people('ali')` as Josie returns `allimercer` with `followers_count` equal to her active followers
- [ ] **Step 2: Run the tests.** `pnpm db:reset </dev/null && pnpm db:test`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration and the doc and spec lines.
- [ ] **Step 4: Run the tests again.** Expected: PASS, every suite.
- [ ] **Step 5: Commit.** `Add the Discover map queries, dish search and follower counts in people search`

### Task 3: API and core: Discover, search, place precision

**Files:**
- Create: `packages/api/src/discover.ts` (+ `discover.test.ts`), `packages/api/src/discover.integration.test.ts`, `packages/core/src/discover.ts` (+ `discover.test.ts`; export from `index.ts`)
- Modify: `packages/api/src/places.ts` (`PLACE_COLUMNS`, `PlaceRow`, `Place.onMap`), `packages/api/src/people.ts` (`searchPeople` returns `PersonSearchRow[]`), `packages/api/src/index.ts`, `packages/api/src/database.types.ts` (regenerate)

**Interfaces:**
- **Consumes:** Task 1's `location_precision`; Task 2's functions, as named there.
- **`places.ts`:** `PLACE_COLUMNS` gains `location_precision`; `PlaceRow.location_precision?: 'exact' | 'city'`; `Place.onMap: boolean` (true unless `'city'`; a missing value counts as exact).
- **`@finalmeal/core` `discover.ts`:**
  - `type DiscoverTier = 'all' | 'final' | 'honorable'`
  - `interface DiscoverFilters { tier: DiscoverTier; followingOnly: boolean; radiusKm: number | null; foodTypeIds: string[]; dietaryIds: string[] }` and `DEFAULT_DISCOVER_FILTERS` (`all`, `false`, `null`, `[]`, `[]`)
  - `RADIUS_SLIDER_MAX = 100`; `radiusFromSlider(v: number): number | null` (100 is `null`, otherwise the rounded value, 1–99); `sliderFromRadius(r: number | null): number`; `radiusLabel(r: number | null): string` → `Any` / `25 km`
  - `sheetFilterCount(f: DiscoverFilters): number`: 1 for a radius, plus the number of food-type and dietary tags (tier and Following are on the chip row and don't count)
  - `picksNearLabel(n: number, city: string | null): string` → `12 picks near Vancouver` / `1 pick near Vancouver` / `12 picks here`
  - `formatDistance(m: number | null): string | null` → `850 m` under 1 km, `1.2 km` under 10 km, `12 km` under 100 km, null at 100 km or more and for null
  - `listsLabel(n: number): string | null` → `14 lists` / `1 list`, null at 0
  - `placeCallout(name: string, listCount: number): string` → `Marutama · 14 lists`, or `Marutama` at 0
  - `tierCountsLabel(finalCount: number, honorableCount: number, lead: 'final' | 'honorable'): string | null` → the lead tier first: `Honorable for 6 people · Final Meal for 2`; `Final Meal for 1 person`; a zero part is left out; null when both are 0
  - `followersLabel(n: number): string` → `567 followers` / `1 follower`
  - `mapSummary(picks: readonly PickLike[], chipLabel: string | null): string` → `Sushi · 4 picks in 3 cities`, or `4 picks in 3 cities` without a chip; `1 pick in 1 city` (cities counted by `cityKey`)
  - `citiesLine(picks: readonly PickLike[], max = 3): string` → `Vancouver, Tokyo, New York`, then ` +<n>` for more, most picks first
- **`@finalmeal/api` `discover.ts`:**
  - `interface MapBounds { west: number; south: number; east: number; north: number }`; `interface LatLng { lat: number; lng: number }`
  - `interface DiscoverPlace { id: string; name: string; label: string; city: string; lat: number; lng: number; bestTier: 'final' | 'honorable'; pickCount: number; listCount: number; topDishName: string }` (`label` from `formatPlaceLabel`)
  - `interface DiscoverDish { dishId: string; dishName: string; place: Place; bestTier: 'final' | 'honorable'; finalCount: number; honorableCount: number; listCount: number; pickId: string | null; photoUrl: string | null; distanceM: number | null; people: PersonSummary[] }`
  - `getPicksInView(client, bounds: MapBounds, filters: DiscoverFilters, center: LatLng): Promise<{ places: DiscoverPlace[]; truncated: boolean }>` (`truncated` when 300 come back)
  - `getDishesInView(client, bounds: MapBounds | null, filters: DiscoverFilters, center: LatLng | null, opts?: { placeId?: string; limit?: number }): Promise<DiscoverDish[]>`
  - `searchDishes(client, q: string, near?: LatLng, limit = 20): Promise<DiscoverDish[]>` (a blank query resolves `[]` without a call)
  - Filters map to arguments as: `tier` `all` → omitted; empty tag arrays → omitted (pass `undefined`, never `[]`); `radiusKm` → `p_radius_m = radiusKm * 1000`; the centre is always sent. Every read is a GET rpc with `.retry(false)`, like `searchPlaces`.
- **`people.ts`:** `type PersonSearchRow = PersonRow & { followersCount: number }`; `searchPeople(client, q, limit?)` returns `PersonSearchRow[]`.

- [ ] **Step 1: Write the failing tests.**
  - **Unit (core):** every helper above with its pinned strings, including `radiusFromSlider(100) === null`, `radiusFromSlider(25.4) === 25`, `formatDistance(99_400) === '99 km'`, `formatDistance(100_000) === null`, `formatDistance(850) === '850 m'`, `formatDistance(1234) === '1.2 km'`, `tierCountsLabel(2, 6, 'honorable') === 'Honorable for 6 people · Final Meal for 2'`, `tierCountsLabel(1, 0, 'final') === 'Final Meal for 1 person'`, `citiesLine` with five cities ending in ` +2`, `mapSummary` singular.
  - **Unit (api):** filter-to-argument mapping (tier omitted at `all`, empty arrays omitted, radius in metres, an antimeridian box passed through unchanged); `onMap` false for `city` and true when the column is missing; a `dishes_in_view` row maps `people` to `PersonSummary` with avatar URLs and `photo_path` to a public URL; `searchDishes('  ')` makes no call.
  - **Integration** (`discover.integration.test.ts`, seed): a fresh Vancouver user gets the six Vancouver places from `getPicksInView` with `Skewers` `bestTier: 'final'`; `getDishesInView(null, …, { placeId: <Lotus> })` includes Xiao Long Bao with `pickId: null`; `searchDishes('ramen', Vancouver)` starts with Tonkotsu Ramen; `searchPeople('ali')[0].followersCount` is a number.
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/core test && pnpm --filter @finalmeal/api test`, then `pnpm env:local && pnpm --filter @finalmeal/api test:integration -- discover`. Expected: FAIL.
- [ ] **Step 3: Implement.** Regenerate `database.types.ts` with the pinned CLI.
- [ ] **Step 4: Run the tests again.** Green, plus root `pnpm lint && pnpm typecheck` (the web app compiles against the new types). Run `pnpm db:reset </dev/null` afterwards.
- [ ] **Step 5: Commit.** `Add Discover, dish search and place precision to the API and core`

### Task 4: The map component: MapLibre in a WebView, with a typed bridge

**Files:**
- Create in `apps/mobile/src/map/`: `bridge.ts`, `map-page.ts`, `PicksMap.tsx`, `pins.ts`, `camera.ts` (+ `bridge.test.ts`, `map-page.test.ts`, `PicksMap.test.tsx`, `pins.test.ts`)
- Create: `apps/mobile/__mocks__/react-native-webview.tsx` (a `View` that records props and exposes `injectJavaScript`), `apps/mobile/src/test-support/map.ts` (`emitMapEvent(event: MapEvent)`, `sentCommands(): MapCommand[]`), `apps/mobile/src/test-support/fake-maplibre.ts` (a fake `maplibregl` and DOM for running the page script in Node)
- Modify: `apps/mobile/package.json` (via `expo install`: `react-native-webview`, `@react-native-community/slider`), `packages/ui-tokens/src/map.ts` and `colors.ts` (new tokens below; extend `tokens.test.ts`), `apps/mobile/src/screens/no-raw-colours.test.ts` (covers `src/map`), `apps/mobile/src/screens/add-flow-no-location.test.ts` (covers `src/map` and asserts the page has no `geolocation` / `GeolocateControl`), `docs/known-gaps.md` (Phase 8 items below), the spec §7

**Interfaces:**
- **Tokens:**
  - `map`: add `road: 'rgba(243,237,228,0.07)'`, `roadMajor: 'rgba(243,237,228,0.12)'`, `label: '#8C847A'`, `labelHalo: '#0B0A09'` (from the canvas map art; `land`, `water`, `park` stay)
  - `colors`: add `glass: 'rgba(23,21,19,0.94)'` (the map's floating controls), `emberRing: 'rgba(232,105,63,0.35)'` (selected Final pin), `honorableRing: 'rgba(230,223,213,0.3)'` (selected Honorable pin)
- **`bridge.ts`:**
  - `interface MapCamera { lat: number; lng: number; zoom: number }`
  - `interface MapRegion { bounds: MapBounds; center: LatLng; zoom: number }` (`MapBounds`, `LatLng` from `@finalmeal/api`)
  - `interface MapPin { id: string; lat: number; lng: number; tier: 'final' | 'honorable'; label: string }` (`label` is the callout shown when selected)
  - `type MapCommand = { type: 'setPins'; pins: MapPin[] } | { type: 'select'; id: string | null } | { type: 'flyTo'; camera: MapCamera } | { type: 'fitPins'; maxZoom: number } | { type: 'setInsets'; top: number; bottom: number }`
  - `type MapEvent = { type: 'ready' } | { type: 'region'; region: MapRegion } | { type: 'pinPress'; id: string } | { type: 'mapPress' } | { type: 'error'; reason: 'load' | 'style' }`
  - `parseMapEvent(data: string): MapEvent | null`: strict shape checks (finite numbers, latitudes −90..90, longitudes −180..180, string ids, known types); anything else is null
  - `commandScript(cmd: MapCommand): string` → `window.__fm&&window.__fm.receive(<JSON>);true;`
- **`camera.ts`:** `HOME_ZOOM = 12`, `FOCUS_ZOOM = 15`, `WORLD_CAMERA: MapCamera = { lat: 20, lng: 0, zoom: 1.5 }`.
- **`map-page.ts`:**
  - `MAPLIBRE_GL_VERSION`: an exact 5.x version at least two weeks old (`npm view maplibre-gl@5 version`), with `MAPLIBRE_GL_JS_SRI` and `MAPLIBRE_GL_CSS_SRI` (`sha384-…`, computed with `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`); script and link tags carry `integrity` and `crossorigin="anonymous"`
  - `OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'`
  - `MAP_PAGE_SCRIPT: string`: plain ES2017 in a template string (never `Function.toString`, which Hermes strips). It:
    - creates the map in `#map` at the initial camera, `attributionControl: { compact: true }` at bottom-right, no other controls, `dragRotate` and `pitchWithRotate` off
    - recolours the style on `style.load` by layer type and `source-layer`, not by layer id: `background` → `map.land`; fills on `water` → `map.water`; fills on `park` and on `landcover` wood/grass → `map.park`; lines on `transportation` → `map.road` (`motorway`, `trunk`, `primary` → `map.roadMajor`); symbol `text-color` → `map.label` with halo `map.labelHalo`
    - draws pins as HTML markers: Final 38 px, `colors.ember` fill, 2 px `colors.night` border, white skull (`skull.path`); selected 44 px with `box-shadow: 0 0 0 4px <emberRing>`. Honorable 18 px `colors.honorable`, 3 px night border; selected 26 px with `0 0 0 5px <honorableRing>`. The selected pin shows its callout (`colors.bone` background, `colors.night` 12 px bold text, radius 10, padding 6/10) just below it. Markers carry `aria-label` `Final Meal pick` / `Honorable Mention pick` (`, selected`).
    - posts `ready` once loaded; `region` on `moveend` (bounds from `getBounds`, normalised so a box crossing the antimeridian has `west > east`); `pinPress` on a marker tap (stopping propagation); `mapPress` on a bare map tap; `error` with `load` when `maplibregl` is missing or WebGL fails, and `style` when the style fails
    - receives commands through `window.__fm.receive`: `setPins` replaces all markers (diffed by id); `select` restyles; `flyTo`; `fitPins` (one pin: centre at `maxZoom`; none: no-op); `setInsets` sets `map.setPadding` and lifts the attribution control above `bottom`
  - `buildMapHtml(opts: { camera: MapCamera; interactive: boolean }): string`: the full document (viewport meta with `user-scalable=no`, `#map` filling the page on a `map.land` background, the pinned CDN tags with an `onerror` that posts `error`/`load`, then the script with the tokens and camera inlined as JSON)
- **`PicksMap.tsx`:**
  - props `{ initialCamera: MapCamera; pins: MapPin[]; selectedId: string | null; insets?: { top: number; bottom: number }; interactive?: boolean; onRegionChange?: (r: MapRegion) => void; onPinPress?: (id: string) => void; onMapPress?: () => void; fitOnFirstPins?: boolean; testID?: string }`
  - `forwardRef` handle `PicksMapHandle { flyTo(camera: MapCamera): void }`
  - one `WebView` with `source={{ html: buildMapHtml(…) }}`, `originWhitelist={['*']}`, `geolocationEnabled={false}`, `setSupportMultipleWindows={false}`, and `onShouldStartLoadWithRequest` that allows only the page itself and opens `http(s)` links in `Linking.openURL`
  - commands sent before `ready` are queued and flushed in order on `ready`; pins, selection and insets are re-sent whenever their props change
  - unknown or malformed messages are ignored; a `pinPress` for an id not in `pins` is ignored
  - until `ready`, a `colors.ash` placeholder; on `error`, the text `The map didn’t load.` and a `Try again` button that remounts the WebView (new `key`)
  - `fitOnFirstPins`: on the first non-empty `pins` after `ready`, send `fitPins` with `maxZoom: 14`
- **`pins.ts`:**
  - `pinsForDiscover(places: DiscoverPlace[]): MapPin[]` (label `placeCallout(name, listCount)`)
  - `pinsForPicks(picks: Pick[]): MapPin[]`: one pin per place with `place.onMap`; tier `final` if any of them is Final; label `<place name> · <n> picks` (`1 pick`)
  - `pinsForSaves(saves: SavedDish[]): MapPin[]`: the same, tier from `viaTier` (`honorable` when null)

- [ ] **Step 1: Write the failing tests.**
  - `bridge.test.ts`: `parseMapEvent` accepts each event and rejects bad JSON, unknown types, `lat: 91`, a NaN zoom, and a numeric id; `commandScript` round-trips through `JSON.parse` of its argument, and a pin label containing `</script>` or a quote can't break out (it's JSON-encoded)
  - `map-page.test.ts`:
    - `buildMapHtml` contains the pinned version in both CDN URLs, both `integrity` attributes, the OpenFreeMap style URL, and no `geolocation` or `GeolocateControl`; `MAPLIBRE_GL_VERSION` matches `/^5\.\d+\.\d+$/`
    - running `MAP_PAGE_SCRIPT` against `fake-maplibre`: `ready` is posted after the fake `load`; `setPins` with two pins adds two markers and a second `setPins` with one removes the other; `select` gives the selected marker 44 px and the ring; a marker tap posts `pinPress` and no `mapPress`; a `moveend` posts `region` with the fake bounds; recolouring sets `background-color` to `#141210` and a water fill to `#0F1A1F`; with `maplibregl` undefined the script posts `error`/`load`
  - `PicksMap.test.tsx`: commands before `ready` are queued then sent in order; a `region` event calls `onRegionChange`; a `pinPress` for an unknown id is ignored; `error` shows `The map didn’t load.` and `Try again` remounts; a link request opens `Linking.openURL` and returns false; `fitOnFirstPins` sends one `fitPins`
  - `pins.test.ts`: two picks at Marutama make one Final pin labelled `Marutama · 2 picks`; a `city`-precision place makes none; a save without `viaTier` is Honorable
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test -- src/map && pnpm --filter @finalmeal/ui-tokens test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Install the two packages with `expo install`. Update the spec §7: the MVP app uses maplibre-gl in a WebView (Expo Go), native MapLibre arrives with development builds. Add to `docs/known-gaps.md` under Phase 8: "Switch the map to `@maplibre/maplibre-react-native` once the app moves to development builds (keep the bridge's `MapPin`/`MapRegion` shapes); bundle maplibre-gl with the app instead of loading it from jsDelivr; native pins get accessibility labels (the WebView's markers are not reachable by VoiceOver/TalkBack: Discover's List view is the accessible path until then)" and "Check OpenFreeMap's terms and capacity before launch; self-hosted Protomaps is the fallback (spec §7)".
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Add a MapLibre map in a WebView with a typed bridge, for Expo Go`

### Task 5: The Discover tab: map, chips, sheets, list view, Filters

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/discover.tsx` (replaces `ComingSoon`; keep `ComingSoon.tsx` only if something still uses it, otherwise delete it and `coming-soon.test.tsx`)
- Create in `apps/mobile/src/components/`: `DiscoverTopBar.tsx`, `MapLegend.tsx`, `DiscoverSheet.tsx`, `DiscoverDishCard.tsx`, `SelectedPlaceSheet.tsx`, `DiscoverListView.tsx`, `FiltersSheet.tsx`, `DishResultRow.tsx` (+ tests)
- Create: `apps/mobile/src/state/discover.ts` (`useDiscover`) with tests; `apps/mobile/src/screens/discover.test.tsx`
- Modify: `apps/mobile/src/screens/add-flow-no-location.test.ts` (covers `app/(app)/(tabs)/discover.tsx`, `src/state/discover.ts` and `src/components/Discover*.tsx`)

**Interfaces and copy** (boards Discover, DiscoverHM, DiscoverFilters):
- **Consumes:** Task 3 (`getPicksInView`, `getDishesInView`, `nearestCity`, core helpers), Task 4 (`PicksMap`, `pinsForDiscover`, camera constants).
- **`useDiscover(home: LatLng | null)`** returns `{ filters, setFilters(f), region, places, truncated, dishes, cityName, status: 'idle' | 'loading' | 'ready' | 'error', selectedId, select(id | null), selected: DiscoverDish[] | null, onRegionChange(r), retry() }`:
  - a region change is debounced 250 ms; each load runs `getPicksInView` and `getDishesInView(bounds, filters, center, { limit: 20 })` together under one request number, and a response for an older number is dropped (pins and sheet always come from the same request)
  - a filter change reloads at once (no debounce) and clears the selection
  - `cityName` comes from `nearestCity(center)`, cached by the centre rounded to 2 decimals
  - `select(id)` loads `getDishesInView(null, filters, center, { placeId: id })`; a stale selection response is dropped; selecting `null` clears it
  - a failure sets `status: 'error'` with the friendly copy; `retry` repeats the last load
- **Screen layout** (the map fills the screen behind the status bar; the tab bar stays):
  - **`DiscoverTopBar`** at the top safe inset + 8, padding 8/16, gap 10:
    - a 48 px pill (`colors.glass`, `lineStrong` border, radius full) with the search icon and `Dishes, spots, people` in `smoke` 15 px; it opens `/search?from=discover&lat=<centre>&lng=<centre>`
    - a 44 px round `Filters` button (`colors.glass`, aria `Filters`); when `sheetFilterCount > 0` an 8 px `emberGlow` dot at its top-right and `accessibilityValue={{ text: '<n> on' }}`
    - below, the chip row (36 px pills, 13 px semibold): `All`, `Final Meals`, `Honorable` (single choice, `aria-pressed`), then `Following` (an independent toggle). Selected chips use the board's bone fill with night text.
  - **`MapLegend`** at top 170 (under the chips), right 16: `colors.glass`, radius 12, `line` border, 12 px `smoke`: an 18 px ember disc with the skull, `Final Meal`; a 12 px `honorable` dot, `Honorable`.
  - `PicksMap` gets `pins = pinsForDiscover(places)`, `selectedId`, and `insets` (the top bar's height, the sheet's height). A pin tap calls `select`; a map tap clears it.
  - **Focus from Search:** route params `placeId`, `lat`, `lng` (from Task 6) fly to `FOCUS_ZOOM` there and select `placeId` once its pin is loaded; the params are cleared after use.
  - **Start:** `HOME_ZOOM` at the home city's point (`getCity(homeCity.id)`), or `WORLD_CAMERA`. The camera survives tab switches (the tab stays mounted).
- **`DiscoverSheet`** (above the tab bar; `colors.ash`, top radius 24, `lineStrong` top border, a decorative 40×5 handle):
  - title `picksNearLabel(sum of pickCount, cityName)` (17 px bold) and the link `List view` (13 px bold, `emberGlow`)
  - when `truncated`, a line under the title: `Zoom in to see every pick.` (12 px `dim`)
  - a horizontal list of `DiscoverDishCard`s (240 wide, `ashRaised`, radius 16, padding 10): a 64 px radius-12 photo or placeholder tile, the dish (Newsreader 19), the place name (12 px `smoke`), and a meta line (11 px bold uppercase, letter-spaced) `Final Meal · 14 lists` in `emberGlow` or `Honorable · 6 lists` in `honorable` (just the tier when `listsLabel` is null). A card with `pickId` opens `/pick/<pickId>`; without one it is not a link.
  - **Empty, no filters:** title `No picks here yet.`, body `Move the map or zoom out to find more.`
  - **Empty, with filters** (any filter not at its default): title `No picks match these filters.` and the link `Reset filters` (sets `DEFAULT_DISCOVER_FILTERS`)
  - **No home city** (while the camera is still the world view): title `Set your home city to start the map there.` and the outline button `Choose home city` (opens `/settings/home-city`); the cards still show below it when there are any
  - **Error:** the friendly copy and `Try again`
- **`SelectedPlaceSheet`** (replaces the sheet while a pin is selected; padding 8/20/16; max height half the screen, scrolling): one block per dish in `selected`:
  - an 84 px radius-14 photo or placeholder; the badge `Final Meal` (ember, skull) or `Honorable` (the Phase 4 outline pill); the dish (Newsreader 22); `<place name> · <area or street> · <formatDistance>` (13 px `smoke`; parts that are missing are left out)
  - when `people` is non-empty or `tierCountsLabel` is not null: overlapping 24 px avatars (`-8` overlap, 2 px `ash` ring), then `tierCountsLabel(finalCount, honorableCount, bestTier)` (13 px `smoke`)
  - the block opens `/pick/<pickId>` when set
  - the selected pin's callout on the map is `placeCallout(name, listCount)` (from `pinsForDiscover`)
- **`DiscoverListView`** (from `List view`; full height over the map, under the top bar; no board, so it reuses the DiscoverSearch row style):
  - header `picksNearLabel(…)` with the link `Map view` (back to the map)
  - `DishResultRow`s for the loaded dishes (`getDishesInView` with `limit: 50` when opened): a 48 px radius-10 photo or placeholder, the dish (15 px bold), `<place name> · <formatDistance>` (13 px `smoke`), and on the right `listsLabel` (12 px bold `emberGlow`); a row with `pickId` opens it, a row without one selects its place and returns to the map
  - this is the accessible path to every pick (the WebView's markers are not)
- **`FiltersSheet`** (a `Modal`, `animationType="slide"`, over a `colors.scrim` backdrop; `ash`, top radius 28, padding 10/20/34, gap 24):
  - header `Filters` (Newsreader italic 300, 30 px) and `Reset` (14 px semibold `smoke`; resets the draft to `DEFAULT_DISCOVER_FILTERS` but keeps `followingOnly`)
  - section labels (11 px bold uppercase, 0.12em, `dim`): `Pick type`, `Distance`, `Food type`, `Dietary`
  - `Pick type`: `All`, `Final Meals`, `Honorable` (the same state as the chip row)
  - `Distance`: the value on the right (`radiusLabel`, 14 px bold `emberGlow`); a `Slider` (`@react-native-community/slider`, 1–100, step 1, `minimumTrackTintColor` ember) with the accessibility label `Distance in kilometres`; 100 means `Any`
  - `Food type` and `Dietary`: the Popular tags (`searchTags(kind, '')`, first 8), then any chosen tags not in it, then a `More` chip (outline, plus icon). Selected chips use the board's ember-wash fill, 1.5 px `emberGlow` border and a check icon. `More` reveals a search field under the group (`Search food types` / `Search dietary`, 300 ms debounce, TagSearch board styling) whose results (up to 10) appear as chips in the same group.
  - the button `Show <n> picks` / `Show 1 pick` / `No picks match` (ember, full width): `n` is the sum of `pickCount` from `getPicksInView(region, draft, center)`, debounced 300 ms while the draft changes; it applies the draft and closes. Closing by the backdrop or a swipe discards the draft.

- [ ] **Step 1: Write the failing tests:**
  - `useDiscover`: two region changes 100 ms apart make one load; a slow first response arriving after the second is dropped; a filter change reloads at once and clears the selection; `select` loads the place's dishes; an error then `retry` recovers
  - the screen, with mocked API (Vancouver fixtures): pins sent to the map match the places; the sheet reads `12 picks near Vancouver` and the first card `Tonkotsu Ramen` / `Marutama` / `Final Meal · 14 lists`; a card without `pickId` is not a button
  - a `pinPress` for Kin Kao shows the DiscoverHM block: `Honorable`, `Khao Soi`, `Kin Kao · Main St · 1.8 km`, two avatars and `Honorable for 6 people · Final Meal for 2`; a `mapPress` brings back the in-view sheet
  - the empty, filtered-empty (with `Reset filters` working), truncated, error and no-home-city states with their copy; with no home city the first camera is `WORLD_CAMERA`
  - the chip row: `Final Meals` sets `tier: 'final'` and `All` clears it; `Following` toggles on its own
  - Filters: picking `Sushi`, `Noodles` and `Gluten-free` and moving the slider to 25 shows `25 km` and a recount; `Show 9 picks` applies and the Filters dot appears with `4 on` (one radius plus three tags); the backdrop discards; `Reset` keeps Following; the slider at 100 reads `Any`; `More` then typing `kor` lists `Korean`
  - List view lists the rows and `Map view` returns; a row without `pickId` selects its place
  - focus params fly to `FOCUS_ZOOM` and select the place
  - the search pill opens `/search` with `from=discover` and the map's centre
  - no `expo-location` import in any Discover file (the extended scan)
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Build the Discover tab: map, filters, in-view picks and the selected spot`

### Task 6: Search (dishes, spots, people), replacing Find people

**Files:**
- Create: `apps/mobile/app/(app)/search.tsx`, `apps/mobile/src/components/SpotResultRow.tsx` (+ test), `apps/mobile/src/screens/search.test.tsx`
- Modify: `apps/mobile/src/components/FeedHeader.tsx` (Search opens `/search?from=feed`), `apps/mobile/src/components/FeedEmpty.tsx` (`Find people` opens `/search?from=feed`), `apps/mobile/src/components/PersonRow.tsx` (an optional `subtitle` prop, if it has none), `docs/known-gaps.md` (remove the Phase 5 "Search replaces Find people" line; add under Phase 6: "Discover search's Shared lists section (DiscoverSearch board): search active `shared_lists` by title, show `@owner · <n> picks`")
- Delete: `apps/mobile/app/(app)/people.tsx` and `apps/mobile/src/screens/people.test.tsx` (move any still-useful assertions into `search.test.tsx`)

**Interfaces and copy** (boards Search, DiscoverSearch):
- **Consumes:** `searchDishes`, `searchPlaces`, `searchPeople` (`PersonSearchRow`), `getSuggestedPeople` (Task 3 and earlier), `DishResultRow` (Task 5), `PersonRow` and `FollowButton` (Phase 4).
- **Route** `/search` (pushed over the tabs) with params `from: 'feed' | 'discover'`, and for Discover `lat`, `lng` (the map's centre). Feed mode uses the home city's point (`getCity(homeCity.id)`) as `near`, or none.
- **Top row** (padding 8/16, gap 10): a 48 px search field (`ash`, 1 px `emberGlow` border while focused, radius full; search icon; a clear button when there is text; accessibility label `Search`; placeholder `Dishes, spots, people`; autofocused), then `Cancel` (15 px semibold `bone`; goes back).
- Typing is debounced 300 ms, a leading `@` is ignored for people (as in Phase 4), and only the newest response is shown.
- **Feed mode** (Search board): tabs `People` | `Dishes` | `Spots` (14 px bold; selected `bone` with a 2 px `emberGlow` underline, others `dim`), People first.
  - **People:** with text, `searchPeople` rows: avatar 46, name (15 px bold), subtitle `@<username> · <followersLabel>`, and a `FollowButton`; then the section `Suggested for you` with `getSuggestedPeople(5)`. Without text, only `Suggested for you` with `getSuggestedPeople(20)`. Suggested subtitles are `#1 · <topDish>`, or `@username` without one.
  - **Dishes:** `DishResultRow`s from `searchDishes(q, near)`.
  - **Spots:** `SpotResultRow`s from `searchPlaces(q, near)`: a 40 px round `ashRaised` tile with the pin icon, the name (15 px semibold), and `<area or street> · <formatDistance>` (13 px `smoke`), or `place.label` when there's no distance.
- **Discover mode** (DiscoverSearch board): no tabs; sections in this order, each hidden when empty: `Dishes` (up to 5), `Spots` (up to 5), `People` (up to 3). Section labels 11 px bold uppercase, 0.12em, `dim`. The `Shared lists` section is not shown until Phase 6. Without text, a centred hint: `Search dishes, spots and people.`
- **Taps:** a dish with `pickId` opens `/pick/<pickId>`; a dish without one, and any spot, goes to the Discover tab focused on that place (`router.navigate({ pathname: '/discover', params: { placeId, lat, lng } })`); a person opens `/u/<id>`.
- **No results** (every list empty for a non-blank query): `No matches for “<q>”.`
- **Errors:** the friendly copy and `Try again`.

- [ ] **Step 1: Write the failing tests:**
  - Feed mode with `al`: tabs `People` / `Dishes` / `Spots`; `Alli Mercer` with `@allimercer · 567 followers` and `Follow`, `Ari Mitchell` with `Following`; then `Suggested for you`
  - empty query: only `Suggested for you`, with `#1 · Wagyu Beef Don`-style subtitles; `@al` searches `al`
  - Dishes tab with `ramen`: `Tonkotsu Ramen`, `Marutama · 1.2 km`, `14 lists`; Spots tab: `Marutama Ramen`, `Bidwell St · 1.2 km`
  - Discover mode: sections `Dishes`, then `Spots`, with no `Shared lists` and no tabs; `searchDishes` and `searchPlaces` get the passed centre; the empty hint copy
  - a dish without `pickId` and a spot both navigate to `/discover` with `placeId`, `lat`, `lng`; a dish with one opens the pick
  - a slow first response is dropped when a newer one has arrived
  - `No matches for “zzz”.`; error and `Try again`
  - the Feed's Search button and FeedEmpty's `Find people` open `/search?from=feed`; `/people` no longer exists
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Add Search for dishes, spots and people; it replaces Find people`

### Task 7: Maps on profiles, Saved and First landing

**Files:**
- Create: `apps/mobile/src/components/ProfileMapPanel.tsx`, `apps/mobile/src/components/PlacePicksCard.tsx` (+ tests)
- Modify: `apps/mobile/app/(app)/(tabs)/you.tsx` (the Map tab shows `ProfileMapPanel`; the chips also show on the Map tab), `apps/mobile/app/(app)/u/[id].tsx` (a `Map` tab after `Honorable`, only when `canSeePicks`; remove the "No Map tab" comment), `apps/mobile/app/(app)/(tabs)/saved.tsx` (the `Map view` / `Grid view` button), `apps/mobile/src/components/FirstLanding.tsx` (`See the map`), their tests (`you.test.tsx`, `other-profile.test.tsx`, `saved.test.tsx` — replace the "no Map view" assertion, `FirstLanding.test.tsx` — replace the two "no See the map" assertions), `docs/known-gaps.md` (remove the Phase 5 Map-tab line and the Phase 5 custom-spots line, which Task 1 closed; keep the no-fixed-address note as a Decision instead)

**Interfaces and copy** (boards ProfileMap, Saved, FirstLand):
- **Consumes:** `PicksMap`, `pinsForPicks`, `pinsForSaves` (Task 4); `mapSummary`, `citiesLine` (Task 3); `filterPicks`, `chipOptions` (core).
- **`ProfileMapPanel({ picks: Pick[]; chipLabel: string | null; emptyText: string; onOpenPick(id: string): void })`**:
  - a summary row above the map: `mapSummary(picks, chipLabel)` (13 px `smoke`); no `Share these`
  - the map card: margin 6/20, radius 20, `line` border, `PicksMap` with `pinsForPicks(picks)`, `fitOnFirstPins`, and the initial camera at the first pin's place (or `WORLD_CAMERA`)
  - the footer overlay (left/right/bottom 12, padding 12/14, radius 14, `colors.glass`, 13 px): `<chipLabel or All picks>` in bold, then ` · <citiesLine(picks)>` in `smoke`; on the right the legend, a 10 px ember dot `Final` and a 10 px `honorable` dot `Honorable`
  - a pin tap swaps the footer for **`PlacePicksCard`**: the place name (bold) and up to 3 of the person's picks there (dish name, then ` · Final Meal` or ` · Honorable`), each opening the pick, then `+ <n> more` when there are more; a map tap restores the footer
  - no picks with a pin: `emptyText`
- **You:** the Map tab uses the chip-filtered picks (both tiers); `emptyText` = `Your map fills in as you add dishes.` (the existing copy). The chip row now shows on all three tabs.
- **Other profiles:** tabs `Final Meal <n>`, `Honorable <n>`, `Map`; `emptyText` = `No picks on the map yet.`. A private profile you can't see has no tabs (unchanged).
- **Saved:** the header's 44 px round button (aria `Map view`, a map icon; `Grid view` with a grid icon while on the map) switches the grid for a map of the chip-filtered saves (`pinsForSaves`), in the same card style as the profile map without the footer summary. A pin tap shows a `PlacePicksCard` of the saved dishes there (` · via @<username>` when set), opening `/pick/<viaPickId>` when there is one. Empty map: `Nothing here with this filter.` (existing copy) or `Nothing saved yet.`
- **First landing:** next to `Nearby in <city>`, the link `See the map` (13 px bold `emberGlow`) switches to the Discover tab.

- [ ] **Step 1: Write the failing tests:**
  - You → Map with the seed-shaped Josie fixture and the `Sushi` chip: `Sushi · 4 picks in 3 cities` and the footer `Sushi · Vancouver, Tokyo, New York`; pins sent equal `pinsForPicks` of the filtered picks; a pin tap shows the place's picks and tapping one opens it; with no picks, `Your map fills in as you add dishes.`
  - another profile shows `Map` after `Honorable` and its empty copy; a private, not-approved profile shows no tabs
  - Saved: `Map view` switches to the map, the label becomes `Grid view`, the chips filter the pins, and a pin's card opens the via pick
  - First landing: `See the map` navigates to `/discover`
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Add Map tabs to profiles, a Map view to Saved, and See the map`

### Task 8: Device checklist, docs, CI

The Mac is often busy, so the device steps may be deferred. If so, mark them "pending an idle Mac" in the ledger and in README's device checklist, and say so in the report. Everything else in this task still happens.

- [ ] **Step 1: iPhone 17 run** (may be deferred). `pnpm db:reset </dev/null && pnpm env:local`, one Expo server. Screenshot every step. Sign in as `josiehamilton@example.com` (code from Mailpit):
  1. Discover opens on Vancouver with the dark map, skull pins and bone dots, the legend, and `<n> picks near Vancouver`. Pan and zoom: pins and the sheet follow. The attribution `ⓘ` shows above the sheet and opens in the browser.
  2. Tap Kin Kao: the pin grows with its ring and `Kin Kao · <n> lists`; the sheet shows Khao Soi with avatars and the tier counts. Tap the map: it clears.
  3. Chips: `Final Meals`, `Honorable`, `Following`. Filters: Sushi + Noodles + Gluten-free, 25 km, then `Show <n> picks`; the Filters dot shows; `Reset`. The slider works in Expo Go.
  4. List view lists every in-view dish; open one.
  5. Search from Discover: `ramen` shows Dishes and Spots; tap Marutama and the map flies there. From the Feed's search icon: People (`al`), Dishes, Spots tabs; follow someone.
  6. You → Map with a chip; @allimercer → Map; Saved → Map view.
  7. Add a custom spot with a street address in Vancouver; it has no pin. Run `pnpm geocode`, pull Discover (pan a little): the pin appears near its address area. A "No fixed address" spot never gets a pin.
  8. Turn the Mac's Wi-Fi off and reopen Discover: `The map didn’t load.` with `Try again`; Wi-Fi back on, `Try again` loads it.
  9. Sign in as a new user without a home city (skip it in onboarding): Discover starts at the world view with `Set your home city to start the map there.`; no location prompt appears anywhere.
- [ ] **Step 2: Pixel_10 run** (may be deferred). Repeat 1, 2, 3 and 5 in Expo Go, and confirm the WebView map renders (WebGL) and the slider works.
- [ ] **Step 3: Run every local check.** `pnpm db:test`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm geocode`, then `pnpm db:reset </dev/null`.
- [ ] **Step 4: Update the docs.**
  - README "Try the app": the Discover, Filters, Search and Map steps, and `pnpm geocode` (custom spots get their pins when it runs; on a local stack it uses the mock geocoder); the device checklist gets the Phase 5 items (pending an idle Mac where deferred).
  - `CLAUDE.md` status: Phase 5 built on its branch.
  - `docs/known-gaps.md`: confirm Tasks 1, 4, 6 and 7 edits; add under Phase 8: "Schedule `geocode-places` with `push-dispatch` (cron or a database webhook on new custom places); until then run `pnpm geocode`" and "Set `GEOCODER` (and the provider key) in production once Josie chooses a provider; until then custom spots stay off the map"; add under Later: "A dish page behind dish search (today a dish opens one pick of it, or the map)".
  - `docs/needs-from-josie.md`: add under Accounts and keys "**Geocoding provider account** (recommended: Geoapify, free tier): puts custom spots on the map in production. Needed by Phase 8. Key goes in Supabase secrets as `GEOAPIFY_API_KEY`, never in chat." Add each Decision below as one Decisions row with its default.
  - Copy the ledger's rulings to `docs/build-log/phase-5.md`, as Phase 4 did.
  - Commit `Phase 5: device checklist, status, known gaps and open decisions`.
- [ ] **Step 5: Push and check CI.** Push `phase-5-discover` and confirm CI is green (give the URL). Don't merge.

## Phase 5 done means

On the iPhone 17 and Pixel 10 (or with the device run marked pending an idle Mac), a person can:
- browse the Vancouver map with skull pins and bone dots, pan and zoom, and open what they find
- filter by pick type, people they follow, distance from the map's centre, food type and dietary tags
- search dishes, spots and people from Discover and from the Feed
- see their own and other people's picks on a profile Map tab, and their saves on a map

Custom spots get positions from the mock geocoder locally; production geocoding waits for Josie's provider choice. All tests and CI are green.

## Decisions for Josie

Each has a default that this plan builds. Change any of them and Claude updates the app.

1. **Map in Expo Go:** MapLibre runs inside a web view with OpenFreeMap's free dark map, recoloured to the canvas. It looks the same, but scrolls a little less smoothly than a native map and its pins can't be read by VoiceOver (List view covers that). Native MapLibre comes with the test builds in Phase 8.
2. **Distance is measured from the centre of the map** (not your home city), so it works when you browse a trip. It starts at `Any`; the slider goes 1–99 km and then `Any`. Distances of 100 km or more aren't shown.
3. **Who shows on the map:** picks from trusted accounts (public and private), people you follow (even if brand new) and you. Brand-new accounts you don't follow don't show until they're trusted.
4. **Private members are never named on Discover,** even to their approved followers. Their pins count, and followers can still open the pick.
5. **Custom spots appear on the map only once their address is found.** Food trucks and pop-ups ("No fixed address") never get a pin; they still show in search and on lists.
6. **Geocoding provider (needed before testers):** Claude recommends **Geoapify** (free tier fits early use, results may be stored, OpenStreetMap data with attribution), with OpenCage as the alternative; Claude re-checks their current terms when you choose. Until then production geocoding is off and custom spots stay off the map.
7. **How filters combine:** any of your chosen food types, and any of your chosen dietary tags (Sushi or Noodles, and Gluten-free).
8. **Discover chips:** All / Final Meals / Honorable is one choice; `Following` is a separate on/off chip that shows only people you follow. The Filters dot counts distance and tags only.
9. **One Search screen:** from the Feed it has People / Dishes / Spots tabs (Search board); from Discover it shows grouped results (DiscoverSearch board). Find people is gone. The Shared lists section arrives in Phase 6.
10. **Search taps:** a dish opens one pick of it (yours, then a friend's, then a public one), or the map when none is open to you; a spot moves the Discover map there.
11. **Suggested for you** keeps the Phase 4 suggestions with `#1 · <dish>` lines; the board's reasons ("Also has…", "Followed by…", "Popular in…") aren't built.
12. **Selected pin:** the sheet lists every matching dish at that spot, and its counts ("Honorable for 6 people · Final Meal for 2") are trusted counts across everyone, not just the filter.
13. **List view** (no board): a full list of the dishes in view, styled like search rows, with `Map view` to go back.
14. **New copy** (not on the canvas): `No picks here yet.` / `Move the map or zoom out to find more.`, `No picks match these filters.` / `Reset filters`, `Zoom in to see every pick.`, `Set your home city to start the map there.`, `The map didn’t load.`, `Search dishes, spots and people.`, `No matches for “<q>”.`, `No picks on the map yet.`, `Show 1 pick` / `No picks match`, `All picks` (profile map footer without a filter), and the Filters `More` chip.
15. **Maps elsewhere:** profile Map tabs show a short place card when you tap a pin; Saved's `Map view` button switches between the grid and a map; First landing's `See the map` opens Discover. `Share these` stays hidden until Phase 6.
