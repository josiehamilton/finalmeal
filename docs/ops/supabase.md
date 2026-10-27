# Supabase: what it is and how it runs

Final Meal keeps all of its data (people, dishes, places, picks, lists) in a Supabase backend, which is a Postgres database plus sign-in, file storage and serverless functions. On a laptop it runs inside Docker, started with one command and thrown away or rebuilt at will; in production it runs as a Supabase Cloud project. To keep the two identical, **everything about the backend is written down as files in git**: database structure and rules in `supabase/migrations/`, settings in `supabase/config.toml`, functions in `supabase/functions/`. Nobody edits the backend by hand in Studio. This page is the runbook for moving those files from the laptop to production, plus an inventory of what exists today.

## Local development

| Command | What it does |
|---|---|
| `pnpm db:start` | Starts the local backend in Docker (first run downloads images). API `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, inbox `http://127.0.0.1:54324`. |
| `pnpm db:stop` | Stops it. |
| `pnpm db:reset` | Wipes the local database and re-applies every migration, then `seed.sql` if present. |
| `pnpm db:test` | Runs the database tests in `supabase/tests/database/` (pgTAP). |
| `pnpm db:import-cities` | Loads the full world city list (see Cities below) into the local database; safe to re-run. Add `-- --db-url <url>` to target another database. |
| `pnpm env:local` | With Supabase running, writes the gitignored env files below from `supabase status`. Re-run it after `db:start` if the keys change. Prints file names only, never keys. |

### Local env files

`pnpm env:local` (script: `scripts/write-local-env.mjs`) creates these, each holding the local API URL and the publishable key (the anon key on older CLIs). A committed `.env.example` sits beside each, with names only.

| File | Variables |
|---|---|
| `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY` |
| `apps/mobile/.env.local` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` |
| `packages/api/.env.test.local` | `SUPABASE_URL`, `SUPABASE_KEY` (read by the `@finalmeal/api` integration tests) |

`NEXT_PUBLIC_*` values are baked in at `next build`, so each environment's web build must be run with that environment's values.

Apps must only ever be given the publishable key. The service-role key is never written to a file.

`@finalmeal/api` tests: `pnpm --filter @finalmeal/api test` (unit, no Supabase needed) and `pnpm --filter @finalmeal/api test:integration` (needs Supabase running, seeded, and `pnpm env:local` run). The sign-up tests create real people through the email-code flow (fresh `@example.com` addresses; local Supabase allows one email per address every 30 s and 30 per hour), so they leave new rows behind: run `pnpm db:reset` to return to the seed before `pnpm db:test` or the web e2e tests, which expect exactly the seeded people (CI runs them in an order that keeps this true, with a reset before the e2e tests). After a schema change, refresh `packages/api/src/database.types.ts` with `pnpm --filter @finalmeal/api gen:types`.

## Supabase CLI version

The CLI is a pinned root devDependency (`supabase` in the root `package.json`, currently exactly `2.121.0`), installed by `pnpm install`; its postinstall download is allowed through `pnpm.onlyBuiltDependencies`. The `pnpm db:*` scripts, `pnpm env:local` and CI all use that copy, so local and CI always run the same version. To use the CLI directly, run `pnpm exec supabase ...`. Upgrade it by changing the version in the root `package.json` and running `pnpm install`; check `pnpm db:reset && pnpm db:test` afterwards. Do not rely on a global (Homebrew) install.

## Rules

- Schema, policies and functions change **only** through files in `supabase/migrations/`. Create one with `pnpm exec supabase migration new <name>`. If you explore in Studio, turn the result into a migration before committing.
- Auth, storage and API settings live in `supabase/config.toml`.
- Edge Functions live in `supabase/functions/`.
- `supabase/seed.sql` is sample data for local development only. It never runs in production: `pnpm exec supabase db push` does not run it, so never run it against the cloud project. It mirrors the design canvas: 6 people (`@example.com` emails, fixed ids `00000000-0000-4000-8000-00000000000N`, josie is `...0001`), 14 places, 17 dishes, 28 picks, the global food-type and dietary tags, Josie's personal tags, follows, 2 shared lists, one save, and a few activities with notifications. `pnpm db:reset` loads it. The other database tests empty these tables inside their own rolled-back transaction, so they stay independent of the seed.
- Every new setting, extension, bucket or secret gets a line in the inventory below.
- Secrets are listed here by name only. Never commit `.env` or `.env.local` files.

## Local to production runbook

Production setup happens in Phase 8. These are the steps then.

1. `pnpm exec supabase login`
2. `pnpm exec supabase link --project-ref <project-ref>`: ties this folder to the cloud project.
3. `pnpm exec supabase db push`: applies any migrations the cloud project has not seen. Never run `seed.sql` against production.
4. `pnpm exec supabase config push`: applies the settings in `config.toml` (auth, storage, API) to the cloud project.
5. `pnpm exec supabase functions deploy`: deploys everything in `supabase/functions/`.
6. `pnpm exec supabase secrets set --env-file <file>`: sets function secrets from a local file kept outside git. Names are listed in the Secrets inventory below.
7. Extensions are created by the migrations themselves, so nothing to enable in the dashboard.

## Before the first production push

Do these before the first `pnpm exec supabase db push` and `pnpm exec supabase config push` (Phase 8). The local defaults are fine for a laptop and wrong for production.

- [ ] **Auth settings in `supabase/config.toml` are local defaults.** Set them for production before the first `pnpm exec supabase config push`:
  - `site_url` (and any extra redirect URLs) to the real web address, not `http://127.0.0.1:3000`
  - email confirmations on (`[auth.email] enable_confirmations = true`)
  - a sensible `minimum_password_length` (local is 6)
  - email rate limits: `[auth.rate_limit] email_sent` is 30 per hour locally; choose the production value (the built-in cloud mailer allows very few, so this only means something once SMTP is on)
  - SMTP (`[auth.email.smtp]`) with a real sender (From address and name), since the built-in cloud mailer is heavily limited and the sign-in code emails depend on it
  - the sign-in code email: confirm `otp_length = 6`, `otp_expiry = 600`, `max_frequency = "30s"` and the two templates (`supabase/templates/`) carry over with `config push`, then send a real code to a real inbox
- [ ] **Database locale must match local.** `normalize_dish_name` uses the `[:space:]`, `[:punct:]` and `[:cntrl:]` character classes, whose meaning depends on the locale. Local uses ICU `en_US.UTF-8`; confirm the production database reports the same (`select datcollate, datctype, datlocprovider from pg_database where datname = 'postgres'`) before any dish data is written.
- [ ] **`NEXT_PUBLIC_*` values are baked in at `next build`.** Build the production web app with production values; a build made with local values will point at the local database.
- [ ] **The seed never runs in production.** `seed.sql` is sample data for local development only; `db push` does not run it, and it must never be run by hand against the cloud project.

## Inventory

### `config.toml` settings changed from default

| Setting | Value | Why |
|---|---|---|
| `project_id` | `finalmeal` | Names the local Docker containers and volumes. |
| `[auth.email] otp_length` | `6` | Sign-in is by emailed 6-digit code (same as the default; stated so it cannot drift). |
| `[auth.email] otp_expiry` | `600` | Codes work for 10 minutes (default is 1 hour). The email template says "10 minutes". |
| `[auth.email] max_frequency` | `"30s"` | A person can ask for a new code at most every 30 seconds (default 1s). |
| `[auth.rate_limit] email_sent` | `30` | Emails per hour. Raised from 2 so repeated sign-in testing works locally. Production value: see "Before the first production push". |
| `[auth.email.template.magic_link]` | subject `Your Final Meal code`, `./supabase/templates/magic_link.html` | The email an existing person gets when they ask for a code. Shows the 6-digit `{{ .Token }}`; no link. |
| `[auth.email.template.confirmation]` | subject `Your Final Meal code`, `./supabase/templates/confirmation.html` | The email a brand-new person gets. Identical to the one above; both must be kept in sync. |
| `[storage.buckets.avatars]` | public, `2MiB`, `image/jpeg` | Profile photos (see Storage buckets). |

### Extensions

All installed into the `extensions` schema by `20261026233813_extensions_and_types.sql`.

| Extension | Used for |
|---|---|
| `postgis` | `geography` columns and distance queries (places, home location) |
| `pg_trgm` | Fuzzy search on place and dish names |
| `unaccent` | Removing accents when normalising dish names |
| `citext` | Case-insensitive usernames and list slugs |

`pgtap` (database tests) is created inside the test files, not in a migration.

### Enums (schema `public`)

| Enum | Values |
|---|---|
| `profile_visibility` | `public`, `private` |
| `trust_level` | `new`, `trusted`, `flagged` |
| `place_source` | `fsq`, `custom` |
| `pick_tier` | `final`, `honorable` |
| `tag_kind` | `food_type`, `dietary`, `personal` |
| `follow_status` | `active`, `requested` |
| `activity_type` | `added_final`, `added_honorable`, `dethroned`, `promoted`, `followed`, `saved_pick`, `saved_from_list` |
| `report_target` | `pick`, `profile`, `list`, `place` |
| `report_status` | `open`, `actioned`, `dismissed` |

### Functions and triggers

| Name | Purpose |
|---|---|
| `public.set_updated_at()` | Trigger function that refreshes `updated_at` on update. |
| `public.normalize_dish_name(text)` | Immutable. Turns a dish name into its comparison key: accents removed, lower case, split into words on whitespace, punctuation, symbols and emoji (combining marks such as Thai tone marks stay inside their word), simple plurals folded. A name that normalises to empty is rejected by the `dishes.name_key <> ''` check. |
| `dishes_set_name_key` | Before insert/update on `dishes`: fills `name_key`. |
| `public.search_cities(q, lim default 8)` | Stable, security invoker. City type-ahead: matches `name` and `ascii_name` by prefix or trigram similarity (accent- and case-insensitive via `unaccent`); orders prefix matches first (largest city first, then similarity), then typo-tolerant trigram matches by similarity, then population. Empty or blank `q` returns nothing; `lim` is capped at 50. |
| `public.city_fold(text)` | Immutable. Lower-cases and removes accents ("Zürich" becomes "zurich"); used by `search_cities` and its trigram index, because `unaccent()` itself is not immutable. |
| `public.nearest_city(lat, lng)` | Stable, security invoker. The single nearest city to a point (PostGIS `<->`). |
| `public.city_label(public.cities)` | Immutable. The home-city label (see Cities): `Vancouver, BC, Canada`, `Tokyo, Japan`. Used by `set_my_home_city` and `seed.sql` so there is one definition. |
| `public.is_username_available(p_username)` | Security definer, `authenticated` only. False if the name fails `^[A-Za-z0-9_]{3,30}$` or someone else has it (case-insensitive); true if it is free or already the caller's. |
| `public.create_my_profile(p_display_name, p_username)` | Security definer, `authenticated` only. The only way to create a profile: inserts the caller's row with defaults (`visibility = 'public'`, `trust_level = 'new'`, not business-affiliated, not onboarded). Raises `P0001` with message `profile_exists`, `username_taken` or `invalid_username`; a display name outside 1-60 characters raises the `23514` check violation as is. |
| `public.set_my_home_city(p_city_id)` | Security definer, `authenticated` only. Sets `home_city_id`, `home_location` (the city point) and `home_place_text` (label); a null id clears all three. Raises `city_not_found` or `profile_not_found`. |
| `public.finish_onboarding()` | Security definer, `authenticated` only. Sets `onboarded_at = now()` if it is still null (idempotent). Raises `profile_not_found` when the caller has no profile. |
| `pick_tags_check_owner` | Before insert/update on `pick_tags`: raises `personal_tag_not_owned` if a personal tag is put on someone else's pick. |

### Tables (schema `public`, row-level security on)

Migrations: `20261026234036_core_tables.sql` and `20261026234037_social_tables.sql`. Policies are in `20261027000454_rls_baseline.sql` (see Row-level security below).

- Core: `profiles`, `places`, `dishes`, `picks`, `tags`, `pick_tags`
- Reference data: `cities` (see Cities below)
- Social and operations: `follows`, `saves`, `blocks`, `shared_lists`, `activities`, `notifications`, `push_tokens`, `device_attestations`, `reports`

### Row-level security

Migration: `20261027000454_rls_baseline.sql`; tests: `supabase/tests/database/rls.test.sql`. This is a deliberately simple baseline ("who owns this row"). Phase 3 and Phase 7 will add SQL functions and tighten privacy (private profiles, blocked users, follow requests). "Own" means the row's user column equals the signed-in user. Every update policy also checks that the row stays owned by the caller, so ownership cannot be transferred. Anything without a policy is reachable only through the service role.

| Table | Signed out (`anon`) | Signed in (`authenticated`) |
|---|---|---|
| `places`, `dishes`, `cities` | read | read; no direct writes |
| `profiles` | read | read; no direct insert (use `create_my_profile`); update own, limited to the columns listed under Profile writes below |
| `picks` | read | read; insert, update, delete own |
| `tags` | read global tags | read global tags and own personal tags; insert, update, delete own personal tags only |
| `pick_tags` | read when the tag is visible | same; insert and delete when the pick is own |
| `follows` | none | read; follow as yourself; delete when either party |
| `saves`, `blocks`, `push_tokens` | none | all operations, own rows only |
| `device_attestations` | none | read own |
| `shared_lists` | read active lists | read active lists and own inactive ones; insert, update, delete own |
| `activities` | none | read; no direct writes |
| `notifications` | none | read and update own |
| `reports` | none | insert as yourself; cannot read |

Known gaps (full carry-forward list with the phase that closes each: `docs/known-gaps.md`):

- **Follow status.** A user can set their own follow `status`, for the same reason.
- **Default TRUNCATE grants.** `anon` and `authenticated` hold the default `TRUNCATE` grant on public tables. It is not reachable through PostgREST (no HTTP verb maps to it), but a later migration should revoke it.
- **`notifications_update_own` is row-level.** A user can rewrite `activity_id` on their own notifications (the policy only checks `user_id`). Tighten with a column grant limited to `read_at`.

### Profile writes

Migration: `20261027052232_profiles_onboarding.sql`; tests: `supabase/tests/database/profiles.test.sql`.

- **New columns:** `onboarded_at timestamptz` (null until onboarding finishes) and `show_home_city boolean not null default true`.
- **Grants:** `insert` and `update` on `public.profiles` are revoked from `anon` and `authenticated`; `authenticated` gets `update (display_name, username, bio, avatar_path, visibility, show_home_city)` only. So `trust_level`, `is_business_affiliated`, `affiliation_note`, `onboarded_at`, `home_*` and `id` cannot be written directly (error `42501`); the home fields change through `set_my_home_city`. The `profiles_insert_own` policy was dropped; `profiles_update_own` stays (row-level, owner only) alongside the column grants.
- **Functions** (`is_username_available`, `create_my_profile`, `set_my_home_city`, `finish_onboarding`): see Functions and triggers. They are `security definer` with `search_path = ''`. Execute is granted to `authenticated` only and explicitly revoked from `anon` (Supabase grants new functions to `anon` by default). Error messages are the contract with `packages/api`: `profile_exists`, `username_taken`, `invalid_username`, `city_not_found`, `profile_not_found`.
- `city_label` is not one of these: it is a plain immutable security-invoker function, executable by anyone, and PostgREST exposes it as a computed column on `cities`.
- **`profiles_avatar_path_own` check:** `avatar_path` must be null or `<own id>/avatar-<unix-ms>.jpg`, so a profile cannot point at someone else's file (a violation is `23514`).
- Remaining column protection (Phase 3/7): `follows.status`, see Known gaps above.

### Sign-in emails

Sign-in and sign-up are by emailed 6-digit code (no link, no password). Settings are in the `config.toml` table above. Both `supabase/templates/magic_link.html` (existing people) and `supabase/templates/confirmation.html` (new people) are the same minimal on-brand page: night background, bone text, wordmark as text, Manrope with a system-font fallback, the code shown large. The two colours in the templates are copied from `packages/ui-tokens` because email cannot import tokens. Locally the emails arrive in the inbox at http://127.0.0.1:54324. Auth settings only take effect after `pnpm db:stop && pnpm db:start`.

### Cities

Migration: `20261027050402_cities.sql`; tests: `supabase/tests/database/cities.test.sql`.

- **`public.cities`**: one row per world city: `geoname_id` (unique), `name`, `ascii_name`, `region_code`, `region_name`, `country` (ISO code), `country_name`, `population`, `location` (`geography(Point, 4326)`). Indexes: GIN trigram on `name`, on `ascii_name` and on `city_fold(name)` (search), GiST on `location` (nearest city). Row-level security is on and `anon` and `authenticated` can only `select`; there are no client writes (privileges are revoked, not just policies). Rows are written by the import script or the dev seed.
- **`profiles.home_city_id`** (`uuid`, references `cities`, `on delete set null`, indexed) is added by the same migration. The city label is stored in `profiles.home_place_text`.
- **Label format**, used everywhere: `name`, then `region_code` if the country is `US`, `CA` or `AU` (otherwise `region_name`), then `country_name`. Examples: `Vancouver, BC, Canada`, `Paris, Île-de-France, France`. `region_code` is only filled for `US`, `CA` and `AU`. A region that equals the city name or starts with it (any case) is left out, so `Tokyo, Japan` and `Ho Chi Minh City, Vietnam`, not `Tokyo, Tokyo, Japan`. Migration `20261027100721_city_label_no_repeat.sql` redefines `city_label` this way and recomputes the stored `profiles.home_place_text`; tests: `supabase/tests/database/city_label.test.sql`. `formatCityLabel` in `packages/api/src/cities.ts` applies the same rule.
- **Dev seed**: 24 cities with real GeoNames ids, names and populations (so the full import upserts over them cleanly), and every seeded profile has a `home_city_id`.
- **Full import**: `pnpm db:import-cities` (script: `scripts/import-cities.mjs`, uses the `postgres` package from the root devDependencies) downloads GeoNames `cities15000.zip`, `admin1CodesASCII.txt` and `countryInfo.txt` into the gitignored `.cache/geonames/` folder and upserts them by `geoname_id` in batches of 1,000, printing the counts. It skips neighbourhoods (feature code `PPLX`, such as "Downtown Vancouver") and historical places (`PPLH`), which leaves about 31,800 cities. Canadian provinces and Australian states are mapped from GeoNames numeric admin1 codes to their usual abbreviations inside the script. Re-running it is safe. Downloads are cached; delete `.cache/geonames` to fetch fresh GeoNames data. Production: run it once against the cloud database in Phase 8 with `pnpm db:import-cities -- --db-url <direct connection string>` (the connection string is a secret; never commit it). After a full import, `pnpm db:reset` returns the local database to the 24-city dev seed.
- **Attribution**: City data © GeoNames (CC BY 4.0), https://www.geonames.org. The in-app About line comes in Phase 8 (listed in `docs/known-gaps.md`).

### Storage buckets

Migration (policies): `20261027052235_avatars_storage.sql`; tests: `supabase/tests/database/storage.test.sql`.

- **`avatars`**: declared in `config.toml` as `[storage.buckets.avatars]` (public, `2MiB`, `image/jpeg` only). `supabase start`, `db reset` and `config push` create the bucket from that setting; the migration holds only the policies, so the bucket row is not duplicated in SQL. Public read comes from the bucket being public (no read policy for anonymous visitors).
- **Object path:** `<uid>/avatar-<unix-ms>.jpg`, one folder per person.
- **Policies on `storage.objects`** (`authenticated`): `avatars_insert_own`, `avatars_update_own` and `avatars_delete_own` allow the operation only where `bucket_id = 'avatars'` and the first folder of the path is the caller's id; insert and update also require the whole name to match `<uid>/avatar-<digits>.jpg`, so `<uid>/evil.png` is refused. `avatars_select_own` lets the caller see their own folder through the API; the Storage API cannot delete or replace a file without it. Nobody can list other people's files through the API.
- Direct SQL deletes from `storage.objects` are blocked by Supabase itself (use the Storage API), so the tests check the delete policy exists instead of running a delete.

### Edge Functions

None yet.

### Secrets (names only)

None yet.
