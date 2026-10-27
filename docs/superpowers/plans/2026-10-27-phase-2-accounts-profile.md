# Phase 2: Accounts & Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Model rule (Josie):** implement tasks with Sonnet 5.5 subagents; plan and review with Opus 5.5.

**Goal:** a person can sign up on the iPhone and Android app with an email code, finish the 6-step onboarding (email, code, name, username, home city, photo), land on their own profile (the You tab), edit it, set Public or Private, and log out and back in. All of it runs against the local Supabase backend.

**Architecture:**
- **Database:** stays in charge.
  - Profiles are created and moved through onboarding only via security-definer SQL functions.
  - Clients can update only a fixed list of profile columns (column grants).
  - Cities come from a new `cities` table.
  - Avatars live in a public `avatars` storage bucket with per-user folders.
- **`@finalmeal/api`:** gains typed auth, profile, city and avatar functions plus friendly error copy.
- **New `@finalmeal/core`:** holds shared validation rules.
- **Mobile app:** gains a persisted Supabase session, a sign-in gate, the onboarding screens, and a tabbed shell whose You tab is real (the other tabs are placeholders until later phases).

**Tech Stack:** additions to Phase 1 (whose stack and conventions all stand):
- Supabase Auth email OTP and Storage
- GeoNames `cities15000`
- `expo-secure-store` + `aes-js` + `@react-native-async-storage/async-storage` + `react-native-get-random-values` (Supabase's documented "LargeSecureStore" pattern)
- `expo-image-picker`, `expo-image-manipulator`, `expo-location`
- `sharp` (root dev tool, for brand assets)

**Spec:** `docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md` (sections 4, 5.1, 5.5, 5.6, 8, 10, 11 phase 2, 13). **Visual source:** `design/canvas/project/` boards Welcome, OnbEmail, OnbOtp, OnbName, OnbUsername, OnbLocation, OnbPhoto, OnbTransition, Profile, Settings, EditProfile, Privacy. **Carry-forward:** `docs/known-gaps.md`, section "Phase 2".

## Global Constraints

- **All Phase 1 constraints still apply:**
  - package scope `@finalmeal/*`, TS strict, pnpm only, tokens only (no re-typed hexes)
  - fonts: Instrument Serif wordmark, Newsreader display, Manrope UI
  - Supabase fully codified: migrations, `config.toml` and `docs/ops/supabase.md`; no Studio edits; `seed.sql` is dev-only
  - never commit `.env*` files
  - commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
- **Supabase CLI:** always through the pinned local binary (`pnpm exec supabase …` or the `db:*` scripts). CLI commands may need `</dev/null` in agent harnesses.
- **Migrations:** Phase 1 migrations are on `main`, so Phase 2 adds **new** migration files (`pnpm exec supabase migration new <name> </dev/null`) and never edits Phase 1 ones.
- **Branch:** all work on `phase-2-accounts-profile`. The final task pushes it and confirms CI. Merging into `main` happens in the finishing step.
- **Devices:** use Josie's simulators.
  - iOS: **iPhone 17** (UDID `9C7EFCFB-C079-45DA-9240-D9BE65BAD833`), driven with the iOS Simulator tool or `xcrun simctl`.
  - Android: the **`Pixel_10`** AVD, started with `~/Library/Android/sdk/emulator/emulator -avd Pixel_10`, driven with `~/Library/Android/sdk/platform-tools/adb`.
  - Both run the app in Expo Go.
- **Android networking:** the emulator reaches the Mac at `10.0.2.2`, not `127.0.0.1`.
- **Placeholder domain:** `finalmeal.example` (not used for links until Phase 6). Social sign-in (Apple, Google) stays **hidden** until Phase 8.
- **Copy:** use the exact copy quoted in each task. Typographic apostrophes (’) and ellipses (…) only.
- **Friendly error copy** (spec 5.6). `packages/api` exports these exact strings and the apps never show raw errors:
  - `invalid_email`: `That doesn’t look like an email address.`
  - `invalid_code`: `That code didn’t work. Check it and try again.`
  - `code_expired`: `That code has expired. Tap “Resend code” for a new one.`
  - `rate_limited`: `Too many tries. Wait a minute and try again.`
  - `username_taken`: `That handle’s taken. Try another.`
  - `invalid_username`: `Letters, numbers and underscores, 3–30 characters.`
  - `timeout` and `network`: `Can’t reach the kitchen right now.`
  - `unknown`: `Something went wrong. Try again.`

## Review Focus

1. **Messy email input.** An email typed with capitals or spaces (`  Josie@Example.com `) must be trimmed and lower-cased, get a code, and verify. Pinned in Task 1 (core) and Task 4 (integration).
2. **Wrong, expired or rate-limited codes.** These show the friendly copy, keep the entered email, and leave "Resend code" usable after its 30-second countdown. No stuck spinner. Pinned in Tasks 4 and 7.
3. **Two people racing for the same handle**, differing only in case. The loser gets `That handle’s taken. Try another.` even if the availability check said "Available" a moment earlier. Pinned in Tasks 3 and 4.
4. **App killed mid-onboarding.** Reopening resumes at the right step: verified with no profile goes to Name; profile created but not finished goes to Home city; finished goes to the You tab. Pinned in Task 6 (gate unit tests) and Task 9 (device run).
5. **Backend down, or camera/location permission denied.** Sign-in shows `Can’t reach the kitchen right now.` and re-enables the button. A denied permission leaves the person on the same step with the manual option still working. Pinned in Tasks 6, 7 and 9.

---

### Task 1: `@finalmeal/core` + api client fixes from known-gaps

**Files:**
- Create: `packages/core/` (`package.json`, `tsconfig.json`, `src/index.ts`, `src/validation.ts`, `src/validation.test.ts`), following the `packages/ui-tokens` pattern (own dev deps, `lint`/`typecheck`/`test`).
- Modify: `packages/api/src/client.ts`, `packages/api/src/client.test.ts`, `docs/known-gaps.md`

**Interfaces:**
- **Produces in `@finalmeal/core`:**
  - `USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/` (same as the DB check), `isValidUsername(s: string): boolean`
  - `DISPLAY_NAME_MAX = 60`, `BIO_MAX = 100`
  - `normalizeEmail(s: string): string` (trim + lower-case)
  - `isPlausibleEmail(s: string): boolean`, true for `a@b.co`, false for `a@b`, `@b.co` and an empty string
  - `ONBOARDING_STEPS = 6`
  - `PLACEHOLDER_LINK_DOMAIN = 'finalmeal.example'`
- **Produces in `@finalmeal/api`:**
  - `FinalMealClientOptions.auth?: { storage?: SupportedStorage; persistSession?: boolean; autoRefreshToken?: boolean; detectSessionInUrl?: boolean }`, passed straight to supabase-js `auth`.
  - The timeout now applies only when `new URL(url).pathname` starts with `/rest/v1/` **and** the method is `GET` or `HEAD`.

- [ ] **Step 1: Write the failing tests.**
  - Core:
    - `normalizeEmail('  Josie@Example.com ') === 'josie@example.com'`
    - the `isPlausibleEmail` cases above
    - `isValidUsername('josie_h')` is true; `'ab'`, `'josie hamilton'` and `'ジョシー'` are false
  - API client:
    - a `POST /rest/v1/...` to the hanging server is **not** aborted at `timeoutMs: 200` (race against a 600 ms wait)
    - a `GET` with `/rest/v1/` only in the query string (`/auth/v1/x?next=/rest/v1/`) is not bounded
    - the existing black-hole GET test still rejects with `timeout`
    - `afterEach` destroys open sockets, so the auth-timeout test leaves none
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/core test && pnpm --filter @finalmeal/api test`. Expected: FAIL.
- [ ] **Step 3: Implement** the core module and the client changes.
- [ ] **Step 4: Run the full suite.** `pnpm lint && pnpm typecheck && pnpm test`. Expected: green.
- [ ] **Step 5: Update known-gaps and commit.** Remove the two api items from `docs/known-gaps.md` ("Phase 2"). Commit `Add @finalmeal/core and narrow the request timeout to reads`.

---

### Task 2: World cities

**Files:**
- Create: migration `<ts>_cities.sql`, `scripts/import-cities.mjs`, `supabase/tests/database/cities.test.sql`
- Modify: `supabase/seed.sql` (dev cities), root `package.json` (`db:import-cities`), `docs/ops/supabase.md`

**Interfaces:**
- **Table `public.cities`:**
  - columns: `id uuid pk`, `geoname_id integer unique not null`, `name text not null`, `ascii_name text not null`, `region_code text`, `region_name text`, `country char(2) not null`, `country_name text not null`, `population integer not null default 0`, `location extensions.geography(Point,4326) not null`
  - indexes: GIN trigram on `name` and `ascii_name`; GiST on `location`
  - RLS on, select for `anon` and `authenticated`, no client writes
- **`public.search_cities(q text, lim int default 8) returns setof public.cities`:**
  - stable, security invoker
  - matches `name`/`ascii_name` by prefix or trigram, accent-insensitive (`unaccent`)
  - ordered by prefix match first, then similarity, then population (descending)
  - an empty `q` returns nothing
- **`public.nearest_city(lat double precision, lng double precision) returns public.cities`:** the single nearest city by `<->`.
- **Profiles changes** live in this migration because they reference cities: `profiles.home_city_id uuid references public.cities on delete set null`.
- **Label format,** used everywhere: `Vancouver, BC, Canada`, built as `name`, then `region_code` if present and the country is `US`, `CA` or `AU` (otherwise `region_name`), then `country_name`.
  - `@finalmeal/api` (Task 4) exports `formatCityLabel(c: City): string`.
  - Profiles store the label in the existing `home_place_text`.
- **`scripts/import-cities.mjs` (root script `pnpm db:import-cities`):**
  - downloads `cities15000.zip`, `admin1CodesASCII.txt` and `countryInfo.txt` from `https://download.geonames.org/export/dump/` into a gitignored cache dir
  - parses them and upserts by `geoname_id` into the database at `--db-url` (default: local `postgresql://postgres:postgres@127.0.0.1:54322/postgres`) in batches
  - prints counts; is idempotent
  - uses a Node Postgres client (`postgres` package) as a root devDependency
- **Dev seed:** 24 cities with real GeoNames ids, so a later full import upserts over them cleanly:
  - Vancouver BC CA, Vancouver WA US, Victoria BC CA, Toronto ON CA, Montréal QC CA, Saskatoon SK CA
  - New York NY US, Portland ME US, Portland OR US, San Francisco CA US, Los Angeles CA US, Chicago IL US
  - Mexico City MX, London GB, Paris FR, Berlin DE, Tokyo JP, Osaka JP, Seoul KR, Bangkok TH, Ho Chi Minh City VN, Singapore SG, Sydney NSW AU, Melbourne VIC AU
  - Josie's seeded profile gets `home_city_id` = Vancouver BC; other seeded profiles get their home city.
- **Attribution:** "City data © GeoNames (CC BY 4.0)" in `docs/ops/supabase.md`. The About-screen line comes in Phase 8 and is listed in known-gaps.

- [ ] **Step 1: Write the failing pgTAP tests:**
  - `search_cities('vanc')` returns Vancouver BC first and Vancouver WA second (Vancouver BC has the larger population)
  - `search_cities('montreal')` finds Montréal
  - `search_cities('')` returns 0 rows
  - `nearest_city(49.28, -123.12)` is Vancouver BC
  - anon can select from `cities`; anon/authenticated insert throws `42501`
  - seeded Josie's `home_city_id` is Vancouver BC
- [ ] **Step 2: Run the tests.** `pnpm db:reset && pnpm db:test`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration, seed and import script.
- [ ] **Step 4: Run the tests, then do a full import locally.** `pnpm db:reset && pnpm db:test`. Expected: PASS. Then run `pnpm db:import-cities` once and record the count it prints (about 30k) in the report. Re-run `pnpm db:test`. Expected: still PASS. Then `pnpm db:reset` to return to the dev seed.
- [ ] **Step 5: Commit.** `Add world cities with search and nearest-city lookup`

---

### Task 3: Profiles hardening, auth email codes, avatar storage

**Files:**
- Create: migration `<ts>_profiles_onboarding.sql`, migration `<ts>_avatars_storage.sql`, `supabase/templates/magic_link.html`, `supabase/templates/confirmation.html`, `supabase/tests/database/profiles.test.sql`, `supabase/tests/database/storage.test.sql`
- Modify: `supabase/config.toml`, `supabase/seed.sql` (set `onboarded_at` for the six seeded people), `docs/ops/supabase.md`, `docs/known-gaps.md`

**Interfaces:**
- **New `profiles` columns:** `onboarded_at timestamptz` (null until onboarding finishes), `show_home_city boolean not null default true`.
- **Grants:**
  - Revoke `insert` and `update` on `public.profiles` from `authenticated` and `anon`.
  - `grant update (display_name, username, bio, avatar_path, visibility, show_home_city) on public.profiles to authenticated`.
  - Drop the `profiles_insert_own` policy. Keep `profiles_update_own` (row-level) alongside the column grants.
- **SQL functions:** all `security definer`, `set search_path = ''`, executable by `authenticated` only. Each raises `P0001` with the given message so `packages/api` can map it.
  - **`public.is_username_available(p_username text) returns boolean`:**
    - false if `p_username` fails `^[A-Za-z0-9_]{3,30}$`
    - false if it's taken case-insensitively by someone else
    - true if it's the caller's own current username
  - **`public.create_my_profile(p_display_name text, p_username text) returns public.profiles`:**
    - inserts the profile for `auth.uid()` with defaults (`visibility = 'public'`, `trust_level = 'new'`)
    - raises `profile_exists` if there is one, `username_taken` on a unique violation, `invalid_username` on the format check
    - lets the `display_name` length check raise `23514` as is
  - **`public.set_my_home_city(p_city_id uuid) returns public.profiles`:**
    - sets `home_city_id`, `home_location` (the city point) and `home_place_text` (the label format from Task 2)
    - a null `p_city_id` clears all three
    - raises `city_not_found`
  - **`public.finish_onboarding() returns public.profiles`:** sets `onboarded_at = now()` if null; idempotent.
- **`supabase/config.toml`:**
  - `[auth.email]`: `otp_length = 6`, `otp_expiry = 600`, `max_frequency = "30s"`
  - `[auth.rate_limit]`: `email_sent = 30` for local development. The prod value goes on the runbook checklist.
  - `[auth.email.template.magic_link]` and `[auth.email.template.confirmation]`: subject `Your Final Meal code`, `content_path` pointing at the two templates
  - **Templates:** a minimal on-brand HTML email (night background, bone text, Manrope via a system-font fallback, the wordmark as text). The 6-digit `{{ .Token }}` is shown large. The copy, verbatim:
    - `Here’s your Final Meal code`
    - `{{ .Token }}`
    - `It works for 10 minutes. If you didn’t ask for it, you can ignore this email.`
    - No magic link.
- **Storage:**
  - `[storage.buckets.avatars]` in `config.toml`: `public = true`, `file_size_limit = "2MiB"`, `allowed_mime_types = ["image/jpeg"]`
  - Migration policies on `storage.objects`:
    - `authenticated` may insert, update and delete only where `bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text`
    - public read comes from the bucket being public
  - Object path: `<uid>/avatar-<unix-ms>.jpg`
- **Docs:**
  - `docs/ops/supabase.md`: inventory entries for every new function, grant, setting, template and bucket; a prod-checklist line for `email_sent` and the SMTP sender.
  - `docs/known-gaps.md`: remove "Create profiles without letting people set trust_level…" and "Raise the local email_sent…".

- [ ] **Step 1: Write the failing pgTAP tests.**
  - **`profiles.test.sql`,** all as `authenticated` with JWT claims:
    - direct `insert into profiles` throws `42501`
    - `update profiles set trust_level = 'trusted'` (own row) throws `42501`, and `update … set bio = 'x'` works
    - `create_my_profile('Ana', 'AnaB')` works
    - a second user's `create_my_profile('Bo', 'anab')` raises `username_taken`
    - a repeat call by Ana raises `profile_exists`
    - `create_my_profile('Ana', 'a b')` raises `invalid_username`
    - `is_username_available('ANAB')` is false for others and true for Ana
    - `set_my_home_city(<vancouver id>)` sets the label `Vancouver, BC, Canada` and the location
    - `finish_onboarding()` sets `onboarded_at`, and a second call leaves it unchanged
    - anon can't execute the functions (`42501`)
  - **`storage.test.sql`:**
    - as user A, inserting into `storage.objects` with bucket `avatars` and name `<A>/avatar-1.jpg` succeeds
    - name `<B>/avatar-1.jpg` throws `42501`
- [ ] **Step 2: Run the tests.** `pnpm db:reset && pnpm db:test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the migrations, `config.toml`, templates, seed and docs.
- [ ] **Step 4: Run the tests again.** `pnpm db:reset && pnpm db:test`. Expected: all PASS, including Phase 1's RLS tests. Update any Phase 1 RLS assertion that relied on direct profile inserts, and explain each such change in the report.
- [ ] **Step 5: Commit.** `Lock down profile writes, add onboarding functions, email codes and avatar storage`

---

### Task 4: API: auth, profile, cities, avatar and friendly errors

**Files:**
- Create in `packages/api/src/`: `auth.ts`, `profile.ts`, `cities.ts`, `avatar.ts`, `friendly.ts`, and their `*.test.ts` (unit); `auth.integration.test.ts`, `profile.integration.test.ts`; `test-support/mailpit.ts`
- Modify: `index.ts`, `errors.ts`, `database.types.ts` (regenerate with `gen:types`)

**Interfaces:** every function takes `client: FinalMealClient` first and throws `ApiError` with a code from `FriendlyCode`.
- **Errors:**
  - `type FriendlyCode = 'invalid_email' | 'invalid_code' | 'code_expired' | 'rate_limited' | 'username_taken' | 'invalid_username' | 'profile_exists' | 'city_not_found' | 'timeout' | 'network' | 'unknown'`
  - `friendlyMessage(e: unknown): string` returns the Global Constraints copy. `profile_exists` and `city_not_found` map to `unknown`'s copy.
  - `throwIfError` maps:
    - Supabase Auth `otp_expired` → `code_expired`
    - `invalid_credentials` / `otp_disabled` or a 403 on verify → `invalid_code`
    - `over_email_send_rate_limit` / 429 → `rate_limited`
    - `P0001` messages → the same-named code
    - fetch `TypeError` → `network`
    - `'timeout'` stays as is
- **Auth:**
  - `sendEmailCode(client, email: string): Promise<void>` normalises with `normalizeEmail`, rejects with `invalid_email` if `!isPlausibleEmail`, and uses `signInWithOtp({ email, options: { shouldCreateUser: true } })`
  - `verifyEmailCode(client, email: string, code: string): Promise<void>` uses `verifyOtp({ email, token, type: 'email' })`
  - `signOut(client): Promise<void>`
- **Profile:**
  - `type MyProfile = { id; username; displayName; bio; avatarUrl: string | null; homeCity: { id; label } | null; showHomeCity; visibility: 'public' | 'private'; onboarded: boolean; counts: { followers: number; following: number; dishes: number } }`
  - `getMyProfile(client): Promise<MyProfile | null>` returns null when signed in but no profile row exists. Counts are active follows both ways and picks.
  - `isUsernameAvailable(client, username): Promise<boolean>`
  - `createMyProfile(client, { displayName, username }): Promise<MyProfile>`
  - `updateMyProfile(client, patch: Partial<{ displayName; username; bio; visibility; showHomeCity }>): Promise<MyProfile>`
  - `setMyHomeCity(client, cityId: string | null): Promise<MyProfile>`
  - `finishOnboarding(client): Promise<MyProfile>`
- **Cities:**
  - `type City = { id; name; regionCode; regionName; country; countryName; label }`
  - `searchCities(client, query, limit = 8): Promise<City[]>`
  - `nearestCity(client, lat, lng): Promise<City | null>`
  - `formatCityLabel(c): string`
- **Avatar:** `uploadMyAvatar(client, bytes: ArrayBuffer): Promise<MyProfile>` uploads JPEG to `<uid>/avatar-<ms>.jpg` with `upsert: false`, sets `avatar_path`, and best-effort deletes the previous object. `avatarUrl` comes from the public bucket URL.
- **Test support:** `readLatestCode(email: string): Promise<string>` polls Mailpit's API at `http://127.0.0.1:54324/api/v1/messages` (then the message endpoint) for up to 5 s and extracts the 6-digit code.

- [ ] **Step 1: Write the failing tests.**
  - **Unit:**
    - each error mapping
    - `friendlyMessage` copy is exact
    - `formatCityLabel` for CA, US, JP and GB examples
    - `sendEmailCode` rejects `invalid_email` without a network call
  - **Integration** (local Supabase, sign-ups use fresh random emails at `@example.com`):
    - the full flow: `sendEmailCode('  New.Person+<rand>@Example.com ')`, `readLatestCode`, then `verifyEmailCode`
      - `getMyProfile` is null
      - `isUsernameAvailable('np_<rand>')` is true
      - `createMyProfile` creates the profile
      - `setMyHomeCity(<Vancouver>)` sets the city
      - `finishOnboarding` gives `onboarded: true`, `counts` all 0
      - `uploadMyAvatar(<tiny jpeg>)` gives a fetchable `avatarUrl` (HTTP 200)
    - a wrong code rejects with `invalid_code`
    - two users racing `createMyProfile` for `Race_<rand>` / `race_<rand>`: exactly one wins, the other rejects with `username_taken`
    - **Known-gaps check:** seeded `josiehamilton@example.com` can sign in with an email code, and `getMyProfile` returns `josiehamilton` with `onboarded: true`
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/api test && pnpm env:local && pnpm --filter @finalmeal/api test:integration`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests again.** Same commands, plus root `pnpm lint && pnpm typecheck`. Expected: green.
- [ ] **Step 5: Update known-gaps and commit.** Remove "Check that the seeded users can sign in…" from known-gaps. Commit `Add auth, profile, city and avatar API with friendly errors`.

---

### Task 5: Placeholder brand assets (icon, splash, web favicon)

**Files:**
- Create: `scripts/generate-brand-assets.mjs`, `apps/mobile/app.config.ts` (replaces `app.json`)
- Generated: `apps/mobile/assets/icon.png`, `adaptive-icon.png`, `splash-icon.png`; `apps/web/src/app/icon.png`, `apple-icon.png`
- Modify: root `package.json` (`brand:assets`, `sharp` devDependency allowed in `onlyBuiltDependencies`), `docs/known-gaps.md`

**Interfaces:**
- The script reads `design/brand/icon-skull.svg`, using `colors.night` and `colors.ember` from `@finalmeal/ui-tokens`, and writes:
  - `icon.png`: 1024×1024, night background, ember skull centred, 56% of the height
  - `adaptive-icon.png`: 1024×1024, transparent, ember skull centred, 42% of the height (inside Android's safe zone)
  - `splash-icon.png`: 1024×1024, transparent, ember skull centred, 60% of the height
  - web `icon.png`: 512×512, same as the app icon; `apple-icon.png`: 180×180, same
- **`app.config.ts`:**
  - keeps every Phase 1 `app.json` value (name `Final Meal`, slug `finalmeal`, scheme `finalmeal`, dark UI)
  - imports `colors` from `@finalmeal/ui-tokens` for the splash and adaptive-icon `backgroundColor` (`colors.night`), with no hex literals
  - sets `icon`, `android.adaptiveIcon.foregroundImage`, and the `expo-splash-screen` plugin (`image`, `imageWidth: 120`)
  - adds `ios.infoPlist` usage strings:
    - `NSCameraUsageDescription`: `Final Meal uses your camera for your profile photo.`
    - `NSPhotoLibraryUsageDescription`: `Final Meal uses your photos for your profile photo.`
    - `NSLocationWhenInUseUsageDescription`: `Final Meal uses your location to find your home city.`
- **Known-gaps:** change the Phase 8 icon line to "Replace the placeholder skull icon and splash with Josie's final designs (re-run `pnpm brand:assets` from new source art)".

- [ ] **Step 1: Write the failing test.** `scripts/generate-brand-assets.test.mjs`, run with `node --test`. The root `test` script becomes `turbo run test && node --test scripts/*.test.mjs`. After generation it checks:
  - each output exists with the exact pixel size
  - the `icon.png` corner pixel equals `colors.night`
  - the centre pixel equals `colors.ember` (±2 per channel)
  - the `adaptive-icon.png` corner is transparent
- [ ] **Step 2: Run the test.** `pnpm test`. Expected: FAIL.
- [ ] **Step 3: Implement the script and config.** Run `pnpm brand:assets` and commit the outputs.
- [ ] **Step 4: Run the checks.** `pnpm test && pnpm lint && pnpm typecheck` green, and `pnpm --filter @finalmeal/web test:e2e` still green.
- [ ] **Step 5: Commit.** `Add placeholder skull app icon, splash and web favicon`

---

### Task 6: Mobile foundations: session, gate, shared onboarding UI, Welcome

**Files:**
- Create in `apps/mobile/src/`:
  - `lib/supabase.ts`, `lib/secure-storage.ts`, `lib/route-for.ts` (+ test)
  - `providers/SessionProvider.tsx` (+ test)
  - `components/OnboardingScreen.tsx`, `TextField.tsx`, `PrimaryButton.tsx`, `CodeInput.tsx`, `WelcomeMap.tsx` (each with a test where it has logic)
  - `app/(onboarding)/_layout.tsx`, `app/(onboarding)/welcome.tsx`, `app/(app)/_layout.tsx`
- Modify: `app/_layout.tsx`, `app/index.tsx` (becomes the gate redirect). Delete `src/components/Foundation*` and `src/lib/api.ts` with their tests; they're superseded.

**Interfaces:**
- **`lib/supabase.ts`** exports `supabase: FinalMealClient`:
  - built with `createFinalMealClient`, `auth: { storage: LargeSecureStore, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }`
  - starts and stops auto-refresh on `AppState` changes (Supabase's Expo guide)
  - URL: `EXPO_PUBLIC_SUPABASE_URL` with `127.0.0.1`/`localhost` rewritten to `10.0.2.2` when `Platform.OS === 'android'`
  - missing env throws a clear error inside a function the provider catches, not at import
- **`lib/secure-storage.ts`:** `LargeSecureStore` per Supabase's Expo docs. An AES key lives in `expo-secure-store`; encrypted values live in AsyncStorage; `react-native-get-random-values` is imported first.
- **`lib/route-for.ts`:** `routeFor(state: { session: boolean; profile: MyProfile | null; loading: boolean }): '/welcome' | '/name' | '/city' | '/(app)/you' | null`
  - null while loading
  - no session → `/welcome`
  - session without profile → `/name`
  - profile not onboarded → `/city`
  - otherwise → `/(app)/you`
- **`SessionProvider`** exposes `useSession(): { session; profile; loading; error: string | null; refreshProfile(): Promise<void> }`. It listens to `onAuthStateChange`. If loading the profile fails, `error` holds the friendly copy and the gate shows the Welcome screen with that message plus a "Try again" button.
- **`OnboardingScreen`** props: `{ step?: 1 | 2 | 3 | 4 | 5 | 6; title; subtitle?; onBack?; onSkip?; children; cta: { label; onPress; disabled?; busy? }; footer?: ReactNode }`. It renders:
  - a 6-segment progress bar (ember for done and current steps, `lineStrong` for the rest) and `Step N of 6` (label style)
  - the title in Newsreader italic 300 at 34/1.12 and the subtitle in smoke at 15/1.5
  - a bottom CTA that shows a spinner when `busy` and is disabled while busy
- **`CodeInput`:** 6 boxes; `textContentType="oneTimeCode"` and `autoComplete="one-time-code"`; paste of 6 digits fills all; non-digits ignored; `onComplete(code)`.
- **Welcome** (canvas "Welcome", map version):
  - `WelcomeMap` is a static `react-native-svg` rendering of the canvas map art: the land/water/road shapes and pins from `design/canvas-generator/gen.py` `map_svg` plus the Welcome pins, and the label `Marutama · on 14 Final Meals`
  - wordmark `Final Meal`; title `Eat where people would eat their last meal.`; subtitle `Every pin is someone’s favourite dish, not a star rating.`
  - primary button `Continue with email`, then the line `Already have an account? Log in`. Both go to `/email`.
  - Apple/Google buttons are not rendered (hidden until Phase 8)
- **Tabs placeholder:** `app/(app)/_layout.tsx` exists with a stub You screen so the gate has a target. Task 8 builds the real one.

- [ ] **Step 1: Write the failing tests:**
  - `routeFor`: all five cases
  - the URL rewrite for Android and iOS (with a mocked `Platform`)
  - `CodeInput`: paste `"123456"` calls `onComplete('123456')`; typing `a1` keeps `1`
  - `OnboardingScreen`: shows `Step 3 of 6`, and the CTA is disabled and shows the busy indicator when `busy`
  - `SessionProvider`: a profile-load failure exposes `Can’t reach the kitchen right now.`
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Install the native modules with `npx expo install` from `apps/mobile`, then `pnpm install` from the root.
- [ ] **Step 4: Run the checks and look at Welcome on both devices.**
  - `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
  - Launch on the iPhone 17 and on `Pixel_10` (`cd apps/mobile && npx expo start --ios` / `--android`). Save screenshots of Welcome to the plan workspace: `xcrun simctl io <udid> screenshot …`, `adb exec-out screencap -p > …`.
- [ ] **Step 5: Update known-gaps and commit.** Remove the known-gaps item "Extend `createFinalMealClient` … React Native auth storage". Commit `Add session persistence, sign-in gate and onboarding building blocks`.

---

### Task 7: Onboarding steps 1–6 and the loading screen

**Files:**
- Create in `apps/mobile/app/(onboarding)/`: `email.tsx`, `code.tsx`, `name.tsx`, `username.tsx`, `city.tsx`, `photo.tsx`, `loading.tsx`; `apps/mobile/src/components/CityPicker.tsx`; `apps/mobile/src/lib/avatar.ts`
- Test: `apps/mobile/src/onboarding/*.test.tsx` (screen-level tests with `@finalmeal/api` mocked)

**Interfaces and copy** (canvas boards OnbEmail … OnbTransition; titles verbatim):

1. **Email, step 1.**
   - Title `What’s your email?`. Subtitle `We’ll send a code to sign you in. No passwords to remember.`
   - Field label `Email`, placeholder `you@example.com`. CTA `Send code`.
   - Footer `We never share your email.` (the "Privacy Policy" link is hidden until Phase 8).
   - On success, go to `/code?email=<normalised>`. Errors show under the field.
2. **Code, step 2.**
   - Title `Check your email.`. Subtitle `Enter the 6-digit code we sent to <email>.`
   - `CodeInput` auto-submits when complete. CTA `Verify`.
   - `Resend in 0:SS`, counting down from 30, becomes a `Resend code` link.
   - `Change email` goes back. `Open mail app` (iOS only, `Linking.openURL('message:')`).
   - Errors use the friendly copy and clear the boxes.
   - On success: `refreshProfile()`, then the gate decides.
3. **Name, step 3.**
   - Title `What should we call you?`. Subtitle `This shows on your profile and on every pick.`
   - Fields `First name`, `Last name` (last optional). The display name is `"<first> <last>"` trimmed, at most 60 characters. CTA `Continue`, disabled while first is empty.
   - The name is held in the onboarding route params or context until step 4 creates the profile.
4. **Username, step 4.**
   - Title `Claim your handle.`. Subtitle `This is how friends find your Final Meal.`
   - The field has an `@` prefix and is suggested from the name (lower-case, underscores, trimmed to 30).
   - Live availability (400 ms debounce): `Available` (bone with check), `That handle’s taken. Try another.`, `Letters, numbers and underscores, 3–30 characters.`
   - Helper `Letters, numbers and underscores. You can change it later.` CTA `Continue` calls `createMyProfile`. A `username_taken` from the server shows the taken copy (the race case).
5. **Home city, step 5.**
   - Skip at top right. Title `What’s your home city?`. Subtitle `We’ll show you the best picks nearby. You can change it anytime.`
   - `CityPicker`: field `City`, placeholder `Search your city`; results (250 ms debounce, top 6) show the label with the typed prefix bolded.
   - `Use my current location` asks for location permission (`expo-location`), then calls `nearestCity` and fills the field. Denied shows `No problem. Search for your city instead.`
   - CTA `Continue` (disabled until a city is chosen) calls `setMyHomeCity`. Skip goes to step 6 without setting one.
6. **Photo, step 6.**
   - Skip at top right. Title `Put a face to the plate.`. Subtitle `Optional, but people follow faces.`
   - Buttons `Take a photo` and `Choose from library` use `expo-image-picker` with square crop.
   - `avatar.ts` `prepareAvatar(uri): Promise<ArrayBuffer>` resizes to 512×512 JPEG at quality 0.8 with `expo-image-manipulator`.
   - CTA `Continue` uploads with `uploadMyAvatar` if a photo was chosen, then `finishOnboarding()`. Skip calls `finishOnboarding()` directly.
   - A denied permission shows `No problem. You can add a photo later from Edit profile.`
7. **Loading.**
   - Skull (ember), `There can only be five.` (Newsreader italic 40), thin ember progress bar, `Setting your table…`.
   - Shown for at least 1200 ms after `finishOnboarding`, then `router.replace('/(app)/you')`.
- **Back navigation:** works on steps 2, 3, 4 and 6. Step 5's back is hidden once the profile exists. Android hardware back follows the same rules.

- [ ] **Step 1: Write the failing screen tests:**
  - email normalisation is passed to `sendEmailCode`; an invalid email shows its copy and no call is made
  - code: wrong code shows the copy and clears the boxes; the resend countdown reaches `Resend code` with fake timers; a `rate_limited` error shows its copy
  - username: debounce, all three states, server `username_taken` after "Available"
  - city: results render; permission denied shows its copy; Continue is disabled until selection
  - photo: Skip calls `finishOnboarding` only; denied permission copy
  - loading: navigates after 1200 ms (fake timers)
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Add the six onboarding steps and loading screen`

---

### Task 8: App shell, You tab, Settings, Edit profile, Privacy, Log out

**Files:**
- Create in `apps/mobile/app/(app)/`: `_layout.tsx` (Tabs), `feed.tsx`, `discover.tsx`, `add.tsx`, `saved.tsx`, `you.tsx`, `settings/index.tsx`, `settings/edit-profile.tsx`, `settings/privacy.tsx`, `settings/home-city.tsx`
- Create in `apps/mobile/src/components/`: `TabBar.tsx`, `ComingSoon.tsx`, `ProfileHeader.tsx`, `Avatar.tsx`, `EmptySeats.tsx`, `VisibilityCards.tsx`
- Tests for each screen with logic.

**Interfaces and copy** (canvas Profile, Settings, EditProfile, Privacy):
- **TabBar** (canvas tab bar):
  - Feed, Discover, a centre ember `+` (accessibility label `Add a dish`), Saved, You
  - active tab in bone with a heavier icon, inactive in dim; stroke icons as on the canvas (use `react-native-svg` paths from `gen.py` ICONS)
- **ComingSoon,** used by Feed, Discover, Add and Saved:
  - skull (dim), title in Newsreader italic `Coming soon.`
  - body `This part of Final Meal is still being cooked.`
- **You** (`you.tsx`):
  - top bar with `@<username>` and a settings icon (accessibility label `Settings`), which pushes `/settings`
  - `ProfileHeader`:
    - 80 px avatar (photo, or initials in bone on `ashRaised`)
    - display name (Newsreader 28)
    - home city line with a pin icon, only if a home city is set and `showHomeCity` is true
    - bio (if any)
    - stats `<n> followers`, `<n> following`, `<n> dishes` (singular at 1)
    - button `Edit profile`. "Share a list" is hidden until Phase 6.
  - Segmented tabs `Final Meal` / `Honorable` / `Map`. The filter-chip row is hidden while there are no picks (decision: chip-row style, Phase 3).
  - **Final Meal tab:** `EmptySeats`, five numbered seats (Newsreader italic numerals in dim, dashed `lineStrong` boxes). Seat 1 caption `Your first pick goes here.`; seats 2–5 empty. Below: `Adding dishes arrives in the next build.` (smoke, 13).
  - **Honorable tab:** `No honorable mentions yet.`
  - **Map tab:** `Your map fills in as you add dishes.`
  - Pull-to-refresh reloads the profile.
- **Settings** (`settings/index.tsx`, title `Settings`):
  - sections and rows:
    - `Account`: `Edit profile`, `Sign-in method` (value `Email`, not tappable)
    - `Preferences`: `Privacy & safety`, `Home city` (value = city label or `Not set`, goes to `/settings/home-city`)
  - `Log out` (danger colour) shows a confirm alert `Log out of Final Meal?` with `Cancel` / `Log out`, then `signOut` and the gate sends to Welcome
  - footer `Final Meal · version <expo-constants version>`
  - Remove ads, Notifications, Help, Terms and Privacy Policy rows are hidden until later phases
- **Edit profile:**
  - title `Edit profile` with a `Save` action (ember glow), disabled until something changes and busy while saving
  - `Change photo` (same picker and resize as onboarding, uploads on Save)
  - fields `Name` (1–60), `Username` (`@` prefix, the same live availability states, skipped when unchanged), `Bio` (multi-line Newsreader italic, counter `<n> / 100`), `Home city` (opens `/settings/home-city`)
  - a successful save pops back and the You tab shows the new values; errors show friendly copy inline
- **Home city** (`settings/home-city.tsx`): reuses `CityPicker` plus `Use my current location`; also a `Clear home city` link.
- **Privacy & safety** (`settings/privacy.tsx`), using the decided copy (spec 5.5; supersedes the canvas board):
  - section label `Profile visibility`; `VisibilityCards` is a radio group:
    - **Public:** `Anyone can see your profile, picks and lists`, `People can follow you straight away`
    - **Private:** `People can still find you by name`, `Your picks, lists and home city are only for followers you approve`, `Your picks still help the map, without your name`, `Lists you share by link still show you`
  - helper `Everyone starts public.`
  - toggle `Show my home city`, subtitle `Shown on your profile.`
  - changes save immediately via `updateMyProfile`, with an optimistic UI that rolls back and shows friendly copy on error
  - Safety and Your data sections are hidden until Phase 7

- [ ] **Step 1: Write the failing tests:**
  - You renders the profile from a mocked `useSession`: name, @handle, `0 followers`, `1 following`, home city hidden when `showHomeCity` is false, five seats
  - Settings → Log out confirm calls `signOut`
  - Edit profile: Save is disabled until changed; bio counter; the username-taken state blocks Save
  - Privacy: selecting Private calls `updateMyProfile({ visibility: 'private' })`, and a failure rolls back and shows the copy
  - ComingSoon copy on Feed
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Add tabs, the You profile, settings, edit profile and privacy`

---

### Task 9: Device verification (iPhone 17 + Pixel 10), CI, docs

**Files:**
- Modify: `.github/workflows/ci.yml` (only if needed: integration tests now use Mailpit, which `supabase start` already runs), `README.md`, `CLAUDE.md` ("Current status"), `docs/ops/supabase.md`, `docs/known-gaps.md`
- Workspace only (not committed): screenshots and the run log

**Steps:**
- [ ] **Step 1: Reset, then run the full flow on the iPhone 17.**
  - `pnpm db:reset && pnpm env:local`. Start Expo for iOS.
  - Go Welcome → email `josie.test+ios@example.com` → read the code from Mailpit (`http://127.0.0.1:54324`) → Name `Josie` `Tester` → username `josie_ios` → city `vanc`, choose Vancouver, BC, Canada → photo: Choose from library (use a simulator stock photo) → loading → You.
  - Screenshot each step.
  - Then: kill and relaunch Expo Go, and confirm the You tab opens signed in. Edit the bio, then Save. Privacy → Private. Log out → Welcome. Log back in with the same email → You.
  - **Review Focus #4:** sign up a second email, stop after the code step (kill the app), relaunch, and confirm it lands on Name.
- [ ] **Step 2: Run the same flow on `Pixel_10`** with `josie.test+android@example.com` / `josie_android`. Start the emulator, then `npx expo start --android`. Also run the **Review Focus #5** check: with `pnpm db:stop`, tapping Send code shows `Can’t reach the kitchen right now.` and the button re-enables. Then `pnpm db:start`.
- [ ] **Step 3: Run every local check.** `pnpm db:test`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`.
- [ ] **Step 4: Update the docs.**
  - README: "Try the app" steps for iPhone and Android, including where the email code arrives locally.
  - CLAUDE.md: Phase 2 complete on its branch; next is the Phase 3 plan.
  - known-gaps: what remains for later.
  - Commit `Phase 2: device-verified docs and status`.
- [ ] **Step 5: Push and check CI.** Push `phase-2-accounts-profile` and confirm CI is green on both jobs (give the run URL). Don't merge.

---

## Phase 2 done means

- Josie runs `pnpm bootstrap` and `pnpm dev`, opens the app on the iPhone 17 or Pixel 10, and signs up with an email code read from the local inbox.
- She picks a handle and home city and adds a photo, lands on her profile, edits it, sets Private, logs out and back in.
- Reopening the app keeps her signed in.
- All tests and CI are green.
