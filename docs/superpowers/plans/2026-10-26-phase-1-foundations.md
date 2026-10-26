# Phase 1: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Model rule (Josie):** implement tasks with Sonnet 5.5 subagents; plan and review with Opus 5.5.

**Goal:** a working monorepo in which the full Supabase backend runs locally in Docker with the MVP schema, row-level security and the canvas sample data, and a Next.js web page and an Expo iOS app both show the Final Meal brand and live counts from that database.

**Architecture:** a pnpm + Turborepo monorepo:
- `packages/ui-tokens` holds the canvas design tokens.
- `supabase/` holds migrations, policies, seed data and pgTAP tests.
- `packages/api` wraps a typed Supabase client.
- `apps/web` (Next.js App Router) and `apps/mobile` (Expo Router) each render one foundation screen from the tokens and the API.
- CI runs everything on GitHub Actions.

**Tech Stack:** Node 22+ (Josie's Mac has 26), pnpm (via corepack), Turborepo, TypeScript (strict), ESLint (flat config) + Prettier, Vitest, Supabase CLI (Docker) with Postgres + PostGIS + pg_trgm + unaccent + citext, pgTAP, `@supabase/supabase-js`, Next.js (App Router, `next/font/google`), Playwright, Expo (latest SDK, Expo Router, `expo-font`, `react-native-svg`), jest-expo + `@testing-library/react-native`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md` (sections 3, 4, 8, 10, 11 phase 1). Visual source: `design/canvas/project/*.dc.html` (Splash and Main boards).

## Global Constraints

- **Package scope:** `@finalmeal/*`. The apps are `@finalmeal/web` and `@finalmeal/mobile`.
- **TypeScript:** `strict: true` everywhere; no `any` in exported signatures.
- **pnpm:** `.npmrc` has `node-linker=hoisted` (required for Expo/Metro in a pnpm monorepo).
- **Colours (verbatim from the canvas):**
  - night `#0B0A09`, ash `#171513`, ash raised `#221F1B`
  - line `rgba(243,237,228,0.09)`, line strong `rgba(243,237,228,0.16)`
  - bone text `#F3EDE4`, smoke `#A39B91`, dim `#8C847A`
  - ember `#C04B28`, ember glow `#E8693F`, ember wash `rgba(192,75,40,0.14)`
  - honorable bone `#E6DFD5`, danger `#FF7A6B`, white `#FFFFFF`
  - **No other accent colours.**
- **Fonts:**
  - wordmark: Instrument Serif 400, letter-spacing −0.01em, text exactly `Final Meal`
  - display: Newsreader (300/400/500, italic and roman)
  - UI: Manrope (400–800)
- **Skull mark:** viewBox `0 0 13.568 16`; the path is the `d` attribute of `design/brand/icon-skull-small.svg`.
- **Tagline copy (exact):** `Five dishes. That’s it. Choose.` (typographic apostrophe).
- **Local only:** no cloud services, no real emails. Seed emails use `@example.com`.
- **Never commit:** `.env` / `.env.local` files. `.env.example` files are committed.
- **Commits:** every commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (or the implementing model's line).
- **Branching:** all Phase 1 work happens on branch `phase-1-foundations` (created at execution start). Task 8 pushes it, confirms CI is green, then merges into `main`.
- **iOS testing:** use Josie's **iPhone 17** simulator (shown in the app sidebar) through the iOS Simulator tool: `attach` first, then screenshot to verify.
- **If Docker isn't running:** run `open -a Docker` and wait for `docker info` to succeed. If Docker still won't start, stop and tell Josie.

## Review Focus

1. **Dish names that differ only in case, accents, spacing, punctuation or a plural `s`** ("Bánh Mì" / "banh mi", "Tacos Al Pastor" / "taco al pastor") must collapse to the same `name_key` and hit the unique index. Pinned in Task 2.
2. **Usernames that differ only in case** ("JosieHamilton" vs "josiehamilton") must be rejected as duplicates. Pinned in Task 2.
3. **Personal tags must stay private:** another signed-in user or an anonymous visitor reading `tags`/`pick_tags` must not see Josie's personal tags. Pinned in Task 3.
4. **Backend down or env missing:** the web page and mobile screen must show the brand plus the message `Can’t reach the kitchen right now.` instead of crashing or showing a blank page. Pinned in Tasks 6 and 7.
5. **Emoji and non-Latin text** in display names, notes and dish names (`Crème Brûlée 🍮`, `ラーメン`) must store and read back unchanged. Pinned in Task 2.

---

### Task 1: Monorepo tooling + `@finalmeal/ui-tokens`

**Files:**
- Create: `package.json` (root, private, `packageManager` pinned to the installed pnpm), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `.npmrc`, `turbo.json`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc`, `.nvmrc` (`22`)
- Create: `packages/ui-tokens/package.json`, `packages/ui-tokens/tsconfig.json`, `packages/ui-tokens/src/index.ts`, `src/colors.ts`, `src/typography.ts`, `src/layout.ts`, `src/skull.ts`, `src/css.ts`, `src/contrast.ts`
- Test: `packages/ui-tokens/src/tokens.test.ts`
- Modify: `.gitignore` (add `.turbo/`, `dist/`, `.next/`, `.expo/`, `ios/`, `android/`, `playwright-report/`, `test-results/`, `.env.local`)

**Interfaces:**
- Produces:
  - **`colors`**, a frozen object: `night, ash, ashRaised, line, lineStrong, bone, smoke, dim, ember, emberGlow, emberWash, honorable, danger, white`, with values from Global Constraints.
  - **`fonts`**: `{ wordmark: 'Instrument Serif', display: 'Newsreader', ui: 'Manrope' }`.
  - **`typeScale`**: `{ wordmark: { size: 40, letterSpacingEm: -0.01 }, display: { size: 36, lineHeight: 1.12 }, title: { size: 17, weight: 700 }, body: { size: 15, lineHeight: 1.5 }, label: { size: 11, weight: 700, letterSpacingEm: 0.12 } }`.
  - **`radii`**: `{ input: 14, card: 20, sheet: 28, pill: 999 }`. **`space`**: `[0, 4, 8, 12, 16, 20, 24, 32]`.
  - **`skull`**: `{ viewBox: '0 0 13.568 16', path: string }`.
  - **`cssVariables(): string`** returns a `:root{...}` block with `--fm-<kebab-name>` for every colour plus `--fm-radius-<name>`.
  - **`contrastRatio(fg: string, bg: string): number`** handles `#RRGGBB` only.
  - Scripts on every package: `lint`, `typecheck`, `test`. Root scripts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, all via turbo.

- [ ] **Step 1: Scaffold the workspace.** Enable corepack, `pnpm init`, add root dev dependencies (`turbo`, `typescript`, `eslint`, `typescript-eslint`, `prettier`, `vitest`). Write the config files above. Run `pnpm install`. Expected: it exits 0.
- [ ] **Step 2: Write the failing tests** in `packages/ui-tokens/src/tokens.test.ts`:
  - `colors.ember === '#C04B28'` and `colors.emberGlow === '#E8693F'`.
  - The set of 6-digit hex values in `colors` contains no colour outside the Global Constraints list.
  - `skull.path` equals the `d` attribute read from `../../../design/brand/icon-skull-small.svg` (read with `fs`, extracted with a regex).
  - `cssVariables()` contains `--fm-night:#0B0A09` and `--fm-ember-glow:#E8693F`.
  - `contrastRatio(colors.bone, colors.night) >= 4.5`, `contrastRatio(colors.smoke, colors.ash) >= 4.5`, `contrastRatio(colors.dim, colors.ash) >= 4.5`, `contrastRatio(colors.white, colors.ember) >= 4.5`, `contrastRatio(colors.emberGlow, colors.night) >= 4.5`.
- [ ] **Step 3: Run the tests.** `pnpm --filter @finalmeal/ui-tokens test`. Expected: FAIL (module not found).
- [ ] **Step 4: Implement the token files.** `contrastRatio` uses the WCAG relative-luminance formula.
- [ ] **Step 5: Run the checks.** `pnpm lint && pnpm typecheck && pnpm test`. Expected: all green.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "Set up monorepo tooling and design tokens"`

---

### Task 2: Local Supabase + MVP schema

**Files:**
- Create: `supabase/config.toml` (via `supabase init`; set `project_id = "finalmeal"`)
- Create: `supabase/migrations/<ts>_extensions_and_types.sql`, `<ts>_core_tables.sql`, `<ts>_social_tables.sql`
- Test: `supabase/tests/database/schema.test.sql`, `supabase/tests/database/normalize.test.sql`
- Modify: root `package.json` scripts: `db:start` (`supabase start`), `db:stop`, `db:reset` (`supabase db reset`), `db:test` (`supabase test db`)

**Interfaces:**
- **Extensions:** `postgis`, `pg_trgm`, `unaccent`, `citext`, all in schema `extensions`.
- **Enums (public):**
  - `profile_visibility`: `public` | `private`
  - `trust_level`: `new` | `trusted` | `flagged`
  - `place_source`: `fsq` | `custom`
  - `pick_tier`: `final` | `honorable`
  - `tag_kind`: `food_type` | `dietary` | `personal`
  - `follow_status`: `active` | `requested`
  - `activity_type`: `added_final` | `added_honorable` | `dethroned` | `promoted` | `followed` | `saved_pick` | `saved_from_list`
  - `report_target`: `pick` | `profile` | `list` | `place`
  - `report_status`: `open` | `actioned` | `dismissed`
- **`public.normalize_dish_name(input text) returns text`**, `immutable`. In order:
  1. `unaccent` (call `extensions.unaccent('extensions.unaccent', input)` so the function can be immutable)
  2. lower-case
  3. replace every run of non-alphanumeric characters with one space
  4. trim
  5. for each word longer than 3 characters ending in `s` but not `ss`, drop the final `s`
- **Shared columns:** every table has `created_at timestamptz not null default now()`. Tables marked † also get `updated_at`, maintained by trigger `public.set_updated_at()`.
- **Tables:** columns and rules per spec section 4, with these exact choices:
  - **`profiles`** †
    - `id uuid pk references auth.users on delete cascade`
    - `username citext unique not null check (username ~ '^[A-Za-z0-9_]{3,30}$')`
    - `display_name text not null check (char_length between 1 and 60)`
    - `avatar_path text`, `bio text check (char_length(bio) <= 100)`
    - `home_place_text text`, `home_location extensions.geography(Point,4326)`
    - `visibility profile_visibility not null default 'public'`, `trust_level trust_level not null default 'new'`
    - `is_business_affiliated boolean not null default false`, `affiliation_note text`
  - **`places`** †
    - `source place_source not null`, `source_id text`
    - `name text not null`, `area text`, `city text not null`, `region text`
    - `country char(2) not null`, `location geography(Point,4326) not null`
    - `category_ids text[] not null default '{}'`
    - `created_by uuid references profiles on delete set null`, `merged_into_id uuid references places`
    - check `(source = 'fsq') = (source_id is not null)`
    - unique `(source, source_id)`; GiST on `location`; GIN `gin_trgm_ops` on `name`
  - **`dishes`** †
    - `place_id uuid not null references places on delete cascade`
    - `name text not null check (char_length between 1 and 80)`
    - `name_key text not null`, set by a before insert/update trigger from `normalize_dish_name(name)`
    - `merged_into_id uuid references dishes`
    - unique index `(place_id, name_key) where merged_into_id is null`; GIN trigram on `name_key`
  - **`picks`** †
    - `user_id uuid not null references profiles on delete cascade`
    - `dish_id uuid not null references dishes on delete restrict`
    - `tier pick_tier not null`, `slot smallint check (slot between 1 and 5)`
    - `note text check (char_length(note) <= 280)`, `photo_path text`
    - `original_dish_name text not null`
    - check `(tier = 'final' and slot is not null) or (tier = 'honorable' and slot is null)`
    - unique `(user_id, dish_id)`; unique index `(user_id, slot) where tier = 'final'`
  - **`tags`**
    - `kind tag_kind not null`, `name text not null check (char_length between 1 and 40)`, `slug text not null`
    - `owner_id uuid references profiles on delete cascade`
    - `is_featured boolean not null default false`
    - check `(kind = 'personal') = (owner_id is not null)`
    - unique index `(kind, slug) where owner_id is null`; unique index `(owner_id, slug) where owner_id is not null`
  - **`pick_tags`**
    - pk `(pick_id, tag_id)`, both `on delete cascade`
    - trigger `pick_tags_check_owner` raises `personal_tag_not_owned` if the tag is personal and its owner ≠ the pick's `user_id`
  - **`follows`**
    - pk `(follower_id, followee_id)`, `status follow_status not null default 'active'`
    - check follower ≠ followee
  - **`saves`**: pk `(user_id, dish_id)`
  - **`blocks`**: pk `(blocker_id, blocked_id)`; check blocker ≠ blocked
  - **`shared_lists`** †
    - `owner_id uuid not null references profiles on delete cascade`
    - `slug citext unique not null check (slug ~ '^[a-z0-9-]{3,60}$')`
    - `title text not null check (char_length between 1 and 80)`
    - `note text check (char_length(note) <= 280)`
    - `filter jsonb not null default '{"scope":"everything"}'`
    - `is_active boolean not null default true`
  - **`activities`**
    - `actor_id uuid not null references profiles on delete cascade`
    - `type activity_type not null`
    - `pick_id → picks on delete cascade`, `other_pick_id → picks on delete set null`
    - `list_id → shared_lists on delete cascade`, `target_user_id → profiles on delete cascade`
    - index `(actor_id, created_at desc)`
  - **`notifications`**
    - `user_id → profiles on delete cascade`, `activity_id → activities on delete cascade`, `read_at timestamptz`
    - index `(user_id, created_at desc)`
  - **`push_tokens`**
    - `user_id → profiles on delete cascade`, `expo_token text unique not null`
    - `platform text check in ('ios','android')`
  - **`device_attestations`**
    - `user_id → profiles on delete cascade`, `platform text not null`
    - `result text check in ('passed','failed','unsupported')`, `checked_at timestamptz not null default now()`
  - **`reports`**
    - `reporter_id → profiles on delete cascade`, `target_type report_target not null`, `target_id uuid not null`
    - `reason text not null check (char_length between 1 and 500)`
    - `status report_status not null default 'open'`
  - All primary keys are `uuid default gen_random_uuid()` except the composite ones.
  - Enable row-level security on every table here. Policies come in Task 3.

- [ ] **Step 1: Initialise and start.** `supabase init`, then `pnpm db:start`. Expected: the CLI prints API URL `http://127.0.0.1:54321` and Studio URL `http://127.0.0.1:54323`. If Docker isn't running, see Global Constraints.
- [ ] **Step 2: Write the failing pgTAP tests.**
  - **`normalize.test.sql`:**
    - `normalize_dish_name('  Tonkotsu   Ramen!! ') = 'tonkotsu ramen'`
    - `('Tacos Al Pastor') = 'taco al pastor'`
    - `('Bánh Mì') = 'banh mi'`
    - `('Crème Brûlée') = 'creme brulee'`
    - `('Tonkotsu Ramen (extra chashu)') = 'tonkotsu ramen extra chashu'`
    - `('Glass') = 'glass'`
    - `('Gas') = 'gas'`
  - **`schema.test.sql`:**
    - `has_table` for all 15 tables.
    - A user (inserted into `auth.users` + `profiles` inside the test transaction) can hold finals in slots 1–5, but a final with slot 6 fails `check_violation`. A second final in an occupied slot fails `unique_violation`. A final with `slot null` fails, and so does an honorable with a slot.
    - Inserting dish `Banh Mi` at a place that already has `Bánh Mì` fails `unique_violation`.
    - Usernames `josiehamilton` then `JosieHamilton` fail `unique_violation`. Username `ab` fails `check_violation`.
    - A personal tag without `owner_id` fails `check_violation`. Linking user B's personal tag to user A's pick raises `personal_tag_not_owned`.
    - A self-follow fails `check_violation`.
    - Profile `display_name 'Crème Brûlée 🍮'`, pick note `'ラーメン最高 🍜'` and dish `'ラーメン'` read back byte-identical.
- [ ] **Step 3: Run the tests.** `pnpm db:test`. Expected: FAIL (missing tables and function).
- [ ] **Step 4: Write the three migrations** to the interfaces above.
- [ ] **Step 5: Reset and test.** `pnpm db:reset && pnpm db:test`. Expected: all pgTAP tests pass.
- [ ] **Step 6: Commit.** `git add supabase package.json && git commit -m "Add local Supabase and the MVP database schema"`

---

### Task 3: Row-level security policies (Phase 1 baseline)

**Files:**
- Create: `supabase/migrations/<ts>_rls_baseline.sql`
- Test: `supabase/tests/database/rls.test.sql`

**Interfaces:**
- Consumes: the Task 2 tables. Phase 3 and 7 plans will add SQL functions and tighten privacy. This baseline is deliberately simple; leave a comment at the top of the migration saying so.
- **Policies** (`anon` = signed-out visitor, `authenticated` = signed in, "own" = the row's user column = `auth.uid()`):
  - **`places`, `dishes`:** select for anon + authenticated; no direct writes.
  - **`tags`:**
    - select where `owner_id is null or owner_id = auth.uid()`
    - insert/update/delete only when `kind = 'personal'` and the tag is own
  - **`pick_tags`:**
    - select when the tag is visible under the `tags` rule
    - insert/delete when the pick is own
  - **`profiles`:** select for anon + authenticated; insert/update own (`id = auth.uid()`).
  - **`picks`:** select for anon + authenticated; insert/update/delete own.
  - **`follows`:**
    - select for authenticated
    - insert when `follower_id = auth.uid()`
    - delete when the user is either party
  - **`saves`, `blocks`, `push_tokens`:** all operations own only.
  - **`device_attestations`:** select own only.
  - **`shared_lists`:**
    - select where `is_active or owner_id = auth.uid()` (anon included)
    - insert/update/delete own
  - **`activities`:** select for authenticated; no direct writes.
  - **`notifications`:** select own; update own (for `read_at`).
  - **`reports`:** insert when `reporter_id = auth.uid()`; no select.

- [ ] **Step 1: Write the failing tests** in `rls.test.sql`. Inside a transaction, create users A and B. Use `set local role anon|authenticated` and `set local request.jwt.claims to '{"sub":"<uuid>","role":"authenticated"}'`, then assert:
  - anon can select `places`
  - anon's `insert into picks` throws `42501`
  - B's update of A's pick affects 0 rows
  - B can't see A's personal tag in `tags` or its `pick_tags` row, but A can
  - anon can't see A's personal tag either
  - B sees 0 of A's `notifications`
  - A's `select` from `reports` returns 0 rows after A inserts a report
  - an inactive shared list of A's is invisible to anon and visible to A
- [ ] **Step 2: Run the tests.** `pnpm db:test`. Expected: the new tests FAIL. RLS is on with no policies, so selects return nothing.
- [ ] **Step 3: Write the policy migration.**
- [ ] **Step 4: Reset and test.** `pnpm db:reset && pnpm db:test`. Expected: all tests pass, including Task 2's.
- [ ] **Step 5: Commit.** `git commit -am "Add baseline row-level security policies"` (add the new files first)

---

### Task 4: Seed data from the canvas

**Files:**
- Create: `supabase/seed.sql` (the CLI runs it on `db reset`)
- Test: `supabase/tests/database/seed.test.sql`

**Interfaces:**
- **Fixed UUIDs** so later phases and tests can refer to people:
  - josie `00000000-0000-4000-8000-000000000001`, mike `…0002`, ari `…0003`, alli `…0004`, dev `…0005`, sam `…0006`
  - Insert into `auth.users` (`instance_id` all zeros, `aud`/`role` `authenticated`, `email` `<username>@example.com`, `email_confirmed_at now()`), then `profiles`.
- **People:**

| key | display_name | username | bio | home | trust |
|---|---|---|---|---|---|
| josie | Josie Hamilton | josiehamilton | Chasing the perfect meal. | Vancouver, BC (49.2827, −123.1207) | trusted |
| mike | Mike Brennan | mikebrennan | Tokyo → NYC. Always hungry. | New York, NY | trusted |
| ari | Ari Mitchell | arimitchell | Professional eater. Amateur chef. | Vancouver, BC | trusted |
| alli | Alli Mercer | allimercer | Spice level: nuclear. | Saskatoon, SK | trusted |
| dev | Dev Patel | devpatel | — | Vancouver, BC | trusted |
| sam | Sam Okafor | samokafor | — | Vancouver, BC | new |

- **Places:** all `source = 'custom'`, `created_by` null, coordinates are approximate and fine for mock data. Each is name, area, city, region, country, then latitude/longitude.
  - Skewers, 4th Ave, Vancouver, BC, CA, 49.2682/−123.1557
  - Marutama, Bidwell St, Vancouver, BC, CA, 49.2905/−123.1366
  - Kin Kao, Main St, Vancouver, BC, CA, 49.2620/−123.1010
  - Miku, Waterfront, Vancouver, BC, CA, 49.2868/−123.1129
  - Lotus Noodle Bar, Chinatown, Vancouver, BC, CA, 49.2794/−123.1003
  - Hearth Bakery, Main St, Vancouver, BC, CA, 49.2585/−123.1007
  - Sushi Itto, Shibuya, Tokyo, Tokyo, JP, 35.6595/139.7005
  - Sushi Dai, Toyosu, Tokyo, Tokyo, JP, 35.6655/139.7707
  - Spicy Time, Downtown, Saskatoon, SK, CA, 52.1332/−106.6700
  - Luke’s Lobster, Old Port, Portland, ME, US, 43.6563/−70.2531
  - El Callejón, Centro, Mexico City, CDMX, MX, 19.4326/−99.1332
  - J. Grill, East Village, New York, NY, US, 40.7306/−73.9866
  - Nami, SoHo, New York, NY, US, 40.7240/−73.9970
  - Bánh, District 1, Saigon, SG, VN, 10.7769/106.7009
- **Dishes (17):**
  - Pork Gyro @Skewers
  - Wagyu Beef Don @Sushi Itto
  - Nigiri Set @Sushi Itto
  - Plain Biryani @Spicy Time
  - Lobster Roll @Luke’s Lobster
  - Tacos Al Pastor @El Callejón
  - Smash Burger @J. Grill
  - Banh Mi @Bánh
  - Khao Soi @Kin Kao
  - Crispy Rice Salad @Kin Kao
  - Tonkotsu Ramen @Marutama
  - Pork Gyoza @Marutama
  - Aburi Salmon Oshi @Miku
  - Vegan Dan Dan Noodles @Lotus Noodle Bar
  - Cardamom Bun @Hearth Bakery
  - Omakase @Sushi Dai
  - Toro Hand Roll @Nami
- **Global tags:**
  - **food_type:** Greek, Rice bowl, Indian, Seafood, Tacos, Burgers, Sandwiches, Thai, Noodles, Ramen, Sushi, Bakery, Dumplings, Pork, Japanese, Soup, Pizza, BBQ, Dessert, Breakfast, Korean, Korean BBQ, Dim sum, Pho, Curry, Brunch, Ice cream
    - featured: Ramen, Noodles, Japanese, Soup, Pork, Sushi, Burgers, Tacos, Pizza, BBQ, Bakery, Seafood
  - **dietary:** Vegan, Vegetarian, Gluten-free, Low-FODMAP, Dairy-free, Nut-free, Halal, Kosher. All featured except Kosher.
  - Slug = lower-case name with spaces as `-`.
- **Josie's personal tags:** Late night, Spicy, Splurge, Rainy day.
- **Picks** (`original_dish_name` = the dish name):
  - **josie:**
    - final 1 Pork Gyro ("Delicious. I’d fly back for it."), 2 Wagyu Beef Don, 3 Plain Biryani, 4 Lobster Roll
    - honorable: Smash Burger, Tacos Al Pastor, Banh Mi, Tonkotsu Ramen, Khao Soi, Aburi Salmon Oshi, Vegan Dan Dan Noodles, Cardamom Bun, Omakase, Nigiri Set, Toro Hand Roll, Pork Gyoza, Crispy Rice Salad
  - **mike:** final 1 Smash Burger, 2 Wagyu Beef Don ("God tier. I still dream about it.")
  - **ari:** final 1 Pork Gyro ("Delicious. I’d fly back for it."), 2 Smash Burger; honorable Tacos Al Pastor
  - **alli:** final 1 Plain Biryani ("The spice level was absolutely perfect."), 2 Khao Soi, 3 Tacos Al Pastor
  - **dev:** final 1 Tonkotsu Ramen ("The broth is a religious experience."); honorable Khao Soi ("Not quite top five, but I’d cross town for it.")
  - **sam:** honorable Omakase
- **Josie's pick tags** (personal tags in *italics*):
  - Pork Gyro: Greek, *Late night*
  - Wagyu Beef Don: Rice bowl, Gluten-free
  - Plain Biryani: Indian, Vegan, Gluten-free
  - Lobster Roll: Seafood
  - Tacos Al Pastor: Tacos, Gluten-free
  - Smash Burger: Burgers
  - Banh Mi: Sandwiches
  - Khao Soi: Thai, Noodles, Dairy-free
  - Tonkotsu Ramen: Ramen, Noodles
  - Aburi Salmon Oshi: Sushi, Low-FODMAP
  - Vegan Dan Dan Noodles: Noodles, Vegan, *Spicy*
  - Cardamom Bun: Bakery, Gluten-free
  - Omakase: Sushi, Gluten-free, *Splurge*
  - Nigiri Set: Sushi, Low-FODMAP
  - Toro Hand Roll: Sushi
  - Pork Gyoza: Dumplings, Pork
  - Crispy Rice Salad: Thai, *Spicy*, Gluten-free
- **Follows (all active):**
  - josie → mike, ari, dev
  - mike, ari, alli, dev, sam → josie
- **Shared lists (owner josie):**
  - `josies-vancouver`, "Josie’s Vancouver", note "Kin Kao first. Trust me.", filter `{"scope":"custom","cities":["Vancouver"],"tiers":["final","honorable"]}`
  - `josies-sushi`, "Sushi, around the world", filter `{"scope":"custom","food_type_tag_ids":["<Sushi tag id>"],"tiers":["final","honorable"]}`, built with a subselect
- **Activities:**
  - ari `dethroned` (`pick_id` = Ari's Smash Burger, `other_pick_id` = Ari's Tacos Al Pastor)
  - alli `followed`, target josie
  - mike `saved_pick` on Josie's Pork Gyro
  - mike `saved_from_list` on `josies-vancouver`
- **Notifications:** one for josie per activity that targets her or her picks (follow, saved_pick, saved_from_list).

- [ ] **Step 1: Write the failing test** in `seed.test.sql`. Assert:
  - 6 profiles, 14 places, 17 dishes, 28 picks
  - josie has 4 finals in slots 1–4 and 13 honorables
  - Josie's 17 picks are at 14 distinct places
  - 27 food_type + 8 dietary global tags; josie has 4 personal tags
  - 2 shared lists; `josies-vancouver` filter `->'cities'` = `'["Vancouver"]'`
  - sam's `trust_level` = `new`
- [ ] **Step 2: Run the tests.** `pnpm db:reset && pnpm db:test`. Expected: the seed tests FAIL.
- [ ] **Step 3: Write `supabase/seed.sql`.** It must be idempotent under `db reset` (the reset drops everything first).
- [ ] **Step 4: Reset and test again.** `pnpm db:reset && pnpm db:test`. Expected: all pass. Open Studio (`http://127.0.0.1:54323`) → `picks` table shows 28 rows.
- [ ] **Step 5: Commit.** `git add supabase/seed.sql supabase/tests && git commit -m "Seed the local database with the canvas cast and dishes"`

---

### Task 5: `@finalmeal/api` typed client + local env script

**Files:**
- Create: `packages/api/package.json`, `tsconfig.json`, `src/index.ts`, `src/client.ts`, `src/stats.ts`, `src/database.types.ts` (generated)
- Create: `scripts/write-local-env.mjs`
- Test: `packages/api/src/stats.integration.test.ts`, `packages/api/vitest.config.ts`

**Interfaces:**
- **Consumes:** the running local Supabase plus the seed from Task 4.
- **Produces:**
  - **`type Database`**, generated by script `gen:types` = `supabase gen types typescript --local > src/database.types.ts`.
  - **`createFinalMealClient(opts: { url: string; key: string }): FinalMealClient`**, where `FinalMealClient = SupabaseClient<Database>`.
  - **`getFoundationStats(client: FinalMealClient): Promise<FoundationStats>`**, with `FoundationStats = { people: number; places: number; dishes: number; picks: number }`. It uses `select('*', { count: 'exact', head: true })` per table and throws `ApiError` on any error.
  - **`class ApiError extends Error { code: string }`**, whose `code` is the Postgres/PostgREST code.
  - **`formatStats(s: FoundationStats): string`** returns `"6 people · 14 places · 17 dishes"`. The separator is ` · ` (U+00B7 with spaces) and each word is singular when the count is 1.
  - **`scripts/write-local-env.mjs`** runs `supabase status -o json` and writes three gitignored files:
    - `apps/web/.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`
    - `apps/mobile/.env.local` with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`
    - `packages/api/.env.test.local` with `SUPABASE_URL`, `SUPABASE_KEY`
    - The key is the publishable key if the status output has one, otherwise the anon key.
    - Root script: `pnpm env:local`.
  - Commit an `.env.example` beside each.

- [ ] **Step 1: Write the failing tests.**
  - **Integration** (`stats.integration.test.ts`, loads `.env.test.local`):
    - `getFoundationStats` returns `{ people: 6, places: 14, dishes: 17, picks: 28 }`.
    - An anon insert into `picks` rejects with an `ApiError` whose `code` is `'42501'`.
  - **Unit:**
    - `formatStats({people:6,places:14,dishes:17,picks:28}) === '6 people · 14 places · 17 dishes'`
    - `formatStats({people:1,places:1,dishes:1,picks:1}) === '1 person · 1 place · 1 dish'`
- [ ] **Step 2: Run the tests.** `pnpm env:local && pnpm --filter @finalmeal/api test`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement.** Run `pnpm --filter @finalmeal/api gen:types`, then write the client, stats, `formatStats` and `ApiError`.
- [ ] **Step 4: Run the tests again.** `pnpm --filter @finalmeal/api test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Add typed API client and local env script"` (after `git add packages/api scripts package.json`)

---

### Task 6: `@finalmeal/web` foundation page

**Files:**
- Create: `apps/web` via `pnpm create next-app` (TypeScript, App Router, ESLint, no Tailwind, `src/` dir), then trim the example content.
- Create/Modify: `apps/web/src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/components/SkullMark.tsx`, `src/components/Foundation.tsx`
- Test: `apps/web/e2e/foundation.spec.ts`, `apps/web/playwright.config.ts` (its `webServer` runs `pnpm dev` on port 3000)

**Interfaces:**
- **Consumes:** `cssVariables`, `colors`, `skull` from ui-tokens; `createFinalMealClient`, `getFoundationStats`, `formatStats` from api.
- **Produces:**
  - **`<SkullMark size: number, color: string, title?: string />`** is an inline SVG. It's `role="img"` with `aria-label` when `title` is set, otherwise `aria-hidden`.
  - **Page `/`** is a server component and uses `export const dynamic = 'force-dynamic'`. It renders, centred on night:
    - `SkullMark` (96, ember, title "Final Meal")
    - `<h1>` "Final Meal" in Instrument Serif at 56px
    - the tagline in Newsreader italic 300, colour smoke
    - a row of 4 labelled swatches: Ember, Ember Glow, Bone, Night
    - the stats line from `formatStats`
  - **On any API error,** the stats line is replaced by `Can’t reach the kitchen right now.` The page still returns 200.
  - **Fonts:** `next/font/google` with `Instrument_Serif` (weight 400), `Newsreader` (300/400/500, normal + italic), `Manrope` (400–800), exposed as CSS variables `--fm-font-wordmark`, `--fm-font-display`, `--fm-font-ui`. `globals.css` injects `cssVariables()` output, sets `body { background: var(--fm-night); color: var(--fm-bone); font-family: var(--fm-font-ui) }`.

- [ ] **Step 1: Write the failing Playwright tests.**
  - `/` has heading `Final Meal`.
  - The text `6 people · 14 places · 17 dishes` is visible.
  - The body's computed `background-color` is `rgb(11, 10, 9)`.
  - The heading's computed `font-family` contains `Instrument Serif`.
  - A second test starts the page with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1` (a separate `webServer` entry on port 3001) and expects `Can’t reach the kitchen right now.` and the heading.
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/web exec playwright install chromium && pnpm --filter @finalmeal/web test:e2e`. Expected: FAIL.
- [ ] **Step 3: Implement** the layout, globals, `SkullMark`, `Foundation` and the page.
- [ ] **Step 4: Run the tests again.** `pnpm --filter @finalmeal/web test:e2e && pnpm lint && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add apps/web && git commit -m "Add web foundation page with brand tokens and live counts"`

---

### Task 7: `@finalmeal/mobile` foundation screen (iOS Simulator)

**Files:**
- Create: `apps/mobile` via `npx create-expo-app@latest apps/mobile` (default Expo Router template). Remove the example tabs and screens. Set `name: "Final Meal"`, `slug: "finalmeal"`, `scheme: "finalmeal"`, `userInterfaceStyle: "dark"`, splash background `#0B0A09`.
- Create/Modify: `apps/mobile/app/_layout.tsx`, `app/index.tsx`, `src/components/SkullMark.tsx`, `src/components/Foundation.tsx`, `src/lib/api.ts`, `metro.config.js` (monorepo watchFolders), `jest.config.js`
- Test: `apps/mobile/src/components/Foundation.test.tsx`

**Interfaces:**
- **Consumes:** ui-tokens and api, as in Task 6. `src/lib/api.ts` exports `client = createFinalMealClient({ url: process.env.EXPO_PUBLIC_SUPABASE_URL!, key: process.env.EXPO_PUBLIC_SUPABASE_KEY! })`.
- **Produces:**
  - **`<Foundation loadStats: () => Promise<FoundationStats> />`** has the same content and copy as the web page, built with `react-native` + `react-native-svg`.
  - **States:**
    - loading: the stats line shows `…`
    - success: the `formatStats` output
    - failure: `Can’t reach the kitchen right now.`
  - **`app/_layout.tsx`** loads `@expo-google-fonts/instrument-serif`, `@expo-google-fonts/newsreader` and `@expo-google-fonts/manrope` with `useFonts`, keeps the splash screen up until they load, and uses status-bar style light.
  - **Scripts:** `ios` (`expo start --ios`), `test` (`jest`).

- [ ] **Step 1: Write the failing tests** (jest-expo, `@testing-library/react-native`):
  - renders text `Final Meal`
  - renders `6 people · 14 places · 17 dishes` after `loadStats` resolves `{people:6,places:14,dishes:17,picks:28}`
  - renders `Can’t reach the kitchen right now.` when `loadStats` rejects
  - the skull has accessibility label `Final Meal`
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement** the layout, `Foundation`, `SkullMark`, the API wiring and the Metro monorepo config.
- [ ] **Step 4: Run the tests again.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Manual check on the iPhone 17 simulator.** Attach the iOS Simulator tool to `iPhone 17`, then run `pnpm env:local && pnpm --filter @finalmeal/mobile ios`. Expected: Expo Go opens on the iPhone 17 and shows the skull, the Instrument Serif wordmark, the tagline, the swatches and `6 people · 14 places · 17 dishes`. Confirm with a simulator screenshot.
- [ ] **Step 6: Commit.** `git add apps/mobile && git commit -m "Add mobile foundation screen with brand fonts and live counts"`

---

### Task 8: CI, one-command dev, and getting-started docs

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`
- Modify: root `package.json` (`dev` = `turbo run dev --filter=@finalmeal/web --filter=@finalmeal/mobile`, `setup` = `pnpm install && pnpm db:start && pnpm env:local`), `turbo.json` (`dev` persistent, not cached), `CLAUDE.md` (Current status)

**Interfaces:**
- **CI on push and PR to `main`, two jobs:**
  - **`checks`:** pnpm install (cached), `pnpm lint`, `pnpm typecheck`, unit tests for ui-tokens, `formatStats` and mobile jest.
  - **`backend`:**
    1. `supabase/setup-cli@v1`
    2. `supabase start`
    3. `supabase test db`
    4. `pnpm env:local`
    5. api integration tests
    6. `playwright install --with-deps chromium`
    7. web e2e

- [ ] **Step 1: Write `ci.yml`.** Commit, then push the `phase-1-foundations` branch (no PR needed). Watch the run with `gh run watch`. Expected: both jobs green. If the backend job fails only on runner resources, record it and tell Josie.
- [ ] **Step 2: Write `README.md`** with:
  - what Final Meal is (2 lines)
  - prerequisites (Docker Desktop, Node 22+, Xcode)
  - `pnpm setup`, `pnpm dev`, `pnpm db:reset`, `pnpm test`
  - where Studio and the local email inbox live (`http://127.0.0.1:54323`, `http://127.0.0.1:54324`)
  - a link to the spec and the canvas
- [ ] **Step 3: Verify from clean.** `pnpm db:stop && pnpm setup && pnpm test && pnpm db:test`. Expected: all green. Then `pnpm dev`. Expected: the web page is at `http://localhost:3000` and Expo starts.
- [ ] **Step 4: Update `CLAUDE.md`.** Current status: Phase 1 complete; next is the Phase 2 (Accounts & profile) plan.
- [ ] **Step 5: Commit and merge.** `git commit -m "Add CI, one-command dev and getting-started guide"`, then, with CI green, merge `phase-1-foundations` into `main` and push.

---

## Phase 1 done means

- Josie runs `pnpm setup` then `pnpm dev`. She sees the Final Meal foundation page in the browser and the same screen in the iPhone Simulator, both showing live counts from the local database. Studio shows the seeded people, places, dishes and picks.
- `pnpm test`, `pnpm db:test` and CI are all green.
