# Supabase: what it is and how it runs

Final Meal keeps all of its data (people, dishes, places, picks, lists) in a Supabase backend, which is a Postgres database plus sign-in, file storage and serverless functions. On a laptop it runs inside Docker, started with one command and thrown away or rebuilt at will; in production it runs as a Supabase Cloud project. To keep the two identical, **everything about the backend is written down as files in git**: database structure and rules in `supabase/migrations/`, settings in `supabase/config.toml`, functions in `supabase/functions/`. Nobody edits the backend by hand in Studio. This page is the runbook for moving those files from the laptop to production, plus an inventory of what exists today.

## Local development

| Command | What it does |
|---|---|
| `pnpm db:start` | Starts the local backend in Docker (first run downloads images). API `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, inbox `http://127.0.0.1:54324`. |
| `pnpm db:stop` | Stops it. |
| `pnpm db:reset` | Wipes the local database and re-applies every migration, then `seed.sql` if present. It does not reload `config.toml` or the email templates: after pulling changes to those, run `pnpm db:stop && pnpm db:start`. |
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
- `supabase/seed.sql` is sample data for local development only. It never runs in production: `pnpm exec supabase db push` does not run it, so never run it against the cloud project. It mirrors the design canvas: 6 people (`@example.com` emails, fixed ids `00000000-0000-4000-8000-00000000000N`, josie is `...0001`), 14 places, 17 dishes, 28 picks, Josie's personal tags (the global food-type and dietary tags are no longer in the seed: they come from the `tag_vocabulary` migration, see Tags), follows, 2 shared lists, one save, and a few activities with notifications. `pnpm db:reset` loads it. The other database tests empty these tables inside their own rolled-back transaction, so they stay independent of the seed.
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
- [ ] **Database locale must match local.** `normalize_dish_name` and `tag_slug` use the `[:space:]`, `[:punct:]`, `[:cntrl:]` and `[:alnum:]` character classes, whose meaning depends on the locale. Local uses ICU `en_US.UTF-8`; confirm the production database reports the same (`select datcollate, datctype, datlocprovider from pg_database where datname = 'postgres'`) before the first `db push` (the tag migration writes slugs) and before any dish data is written.
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
| `[db.seed] sql_paths` | `./seed.sql`, `./seed/places_vancouver.sql` | The dev seed, then the generated Foursquare extract (see Places). |
| `[storage.buckets.avatars]` | public, `2MiB`, `image/jpeg` | Profile photos (see Storage buckets). |
| `[storage.buckets.pick-photos]` | public, `4MiB`, `image/jpeg` | Photos on picks (see Storage buckets). Needs `pnpm db:stop && pnpm db:start` before `db reset` creates it. |

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
| `public.tag_slug(text)` | Immutable. A tag's slug: accents removed, lower case, runs of non-letters/digits become one dash (`Korean BBQ` becomes `korean-bbq`; same result as the Phase 1 rule for every seeded name). Used by the vocabulary and `create_personal_tag`. |
| `public.apply_tag_vocabulary()` | Upserts the global `food_type` and `dietary` tags by `(kind, slug)` (name, aliases, featured and display order are overwritten). Called once by the `tag_vocabulary` migration; safe to call again (tests do). Not executable by `anon` or `authenticated`. |
| `public.popular_tags(p_kind)` | Stable, security invoker. The TagSearch "Popular" list: featured tags of the kind by `display_order` (nulls last, then name); for `personal`, the caller's own tags by name. |
| `public.search_tags(p_kind, p_q, p_lim default 10)` | Stable, security invoker. Tag type-ahead over `name` and `aliases`, accent- and case-insensitive: whole-name prefix first, then whole-alias prefix, then the start of any word in the name or an alias (`fried` finds Korean fried chicken), shorter names first within these, then trigram typo matches by similarity. An empty or blank query returns `popular_tags(p_kind)` in full (`p_lim` does not shorten it). `personal` searches only the caller's own tags. `p_lim` is capped at 50. Open to `anon` and `authenticated`. |
| `public.create_personal_tag(p_name)` | Security definer, `authenticated` only. Trims and collapses whitespace, then creates the caller's personal tag, or returns the one with the same slug (idempotent; the first spelling is kept). Raises `P0001` with message `invalid_tag_name` outside 1-40 characters, or `profile_not_found`. |
| `tags_set_personal_slug` | Before insert, or update of name, slug or kind, on `tags`: for personal tags, trims and collapses whitespace in `name` and sets `slug = tag_slug(name)`. |
| `public.place_search_key(text)` | Immutable. A place name's search key: `city_fold` (accents removed, lower case), apostrophes dropped, every other run of non-letters/digits one space, with a leading space. `Luke’s Lobster` becomes ` lukes lobster`. Stored in `places.search_key`. |
| `public.search_places(p_q, p_lat, p_lng, p_lim default 12)` | Stable, security definer (so it can read `created_by`, then masks it); open to `anon` and `authenticated`. Returns `(place public.places, distance_m double precision)` with `created_by` always null (via `mask_place`). Excludes merged (`merged_into_id`) and closed (`closed_at`) places. Order: name starts with the query, then a word of the name starts with it, then trigram typo matches. With a point, ties go to the nearest and only places within 50 km are searched, widening to the whole world when that finds fewer than 5; without a point `distance_m` is null and ties go to the name. An empty query with a point returns the nearest `p_lim` places; with no point, nothing. `p_lim` is capped at 50. Coordinates outside the valid range raise `invalid_coordinates`. The point is whatever the caller chose (a city's point), never the phone's location. |
| `public.get_place(p_id)` | Stable, security definer, open to `anon` and `authenticated`. One place by id, with `created_by` null (via `mask_place`); null when the id does not exist. Use it (or `search_places`) to show a place; `select *` on `places` is refused (see Places). |
| `public.mask_place(places)` | Internal (execute revoked from clients). Returns the row with `created_by` set to null. Any function that returns `places` rows to clients must be security definer and pass them through it. |
| `public.create_custom_place(p_name, p_city_id, p_address default null, p_no_fixed_address default false)` | Security definer, `authenticated` only. Creates a `custom` place for the caller on the city's point (`city`, `region` (`region_code`, else `region_name`) and `country` come from the city). Custom places are public businesses (see Places): an address is required unless `p_no_fixed_address` is true (food truck, pop-up), in which case it must be null; either mistake raises `address_required`. The name is trimmed and whitespace-collapsed; `address` is trimmed (blank counts as none) and `no_fixed_address` is stored. Raises `P0001` with message `invalid_place_name` (name outside 1-80 characters, or address over 200), `address_required`, `city_not_found`, `profile_not_found` or `rate_limited` (20 custom places per person in a rolling 24 hours; calls from one person are serialised by an advisory lock so two at once cannot slip under it). Returns the new row including `created_by` (it is the caller's own). |
| `pick_tags_check_owner` | Before insert/update on `pick_tags`: raises `personal_tag_not_owned` if a personal tag is put on someone else's pick. |
| `public.suggest_dishes(p_place_id, p_q, p_lim default 6)` | Stable, security definer, `authenticated` only. Returns `(dish public.dishes, pick_count integer)`: unmerged dishes at the place whose normalised name (`normalize_dish_name(p_q)`) starts with the query, or is at least 0.3 trigram-similar to it. Order: name starts with the query, then similarity, then `pick_count`, then name. `pick_count` counts picks (final or honorable) by `trusted` accounts only. An empty or blank query returns the most-picked dishes (by `pick_count`, then name). `p_lim` is capped at 20. |
| `public.add_pick(p_place_id, p_dish_id, p_dish_name, p_tier, p_note, p_tag_ids, p_personal_tags, p_photo_path, p_replace_slot)` | Security definer, `authenticated` only; the only way to create a pick. One transaction, one lock per person. Resolves the dish (`_resolve_dish`), then raises `duplicate_pick` if the caller already has it (either tier). A `final` takes slot n+1 when the caller has fewer than 5 finals (`p_replace_slot` is then ignored); with 5 it raises `final_full` unless `p_replace_slot` (1-5) is given, in which case that pick becomes honorable, the new pick takes the slot and a `dethroned` activity is written (`pick_id` new, `other_pick_id` old). Global tags (`p_tag_ids`) must exist and have no owner (`invalid_tag`); personal tag names go through `create_personal_tag`. `original_dish_name` is the trimmed `p_dish_name` (the dish's name when only an id was given). The note is trimmed (blank is none). `p_photo_path` must be null or `<uid>/pick-<digits>.jpg` (`invalid_photo`). Writes `added_final` or `added_honorable`. Raises `P0001` with message `place_not_found`, `invalid_dish_name`, `duplicate_pick`, `final_full`, `invalid_slot`, `invalid_tag`, `invalid_tag_name`, `invalid_photo` or `profile_not_found`. Returns the new row. |
| `public.promote_pick(p_pick_id, p_replace_slot default null)` | Security definer, `authenticated` only. An honorable becomes final under the same full / swap rules as `add_pick`; writes `promoted` (plus `dethroned` on a swap). Promoting a pick that is already final returns it unchanged. `pick_not_found` when the pick is not the caller's. |
| `public.demote_pick(p_pick_id)` | Security definer, `authenticated` only. A final becomes honorable (slot null) and every later final moves up one slot. Demoting an honorable returns it unchanged. |
| `public.remove_pick(p_pick_id)` | Security definer, `authenticated` only. Deletes the pick, its `pick_tags` (cascade) and every activity about it: those it wrote and any `dethroned` that named it as the replaced pick (their notifications go by cascade). Later finals move up one slot. The photo object is removed by the client (best effort). |
| `public.update_pick(p_pick_id, p_note, p_tag_ids, p_personal_tags, p_photo_path)` | Security definer, `authenticated` only. Replaces the note, the whole tag set and the photo path (null clears; null arrays mean no tags), with the same tag and photo rules as `add_pick`. Everything or nothing. |
| `public.move_final(p_pick_id, p_to_slot)` | Security definer, `authenticated` only. Moves a final to `p_to_slot` (1..n) and shifts the finals between up or down by one. Returns all the caller's finals in slot order. A pick that is not final, or a slot outside 1..n, raises `invalid_slot`; moving to the current slot is a no-op. |
| `public._begin_pick_write()`, `_check_pick_photo(uid, path)`, `_set_pick_tags(pick, tag_ids, personal_tags)`, `_resolve_dish(place, dish_id, dish_name)`, `_claim_final_slot(uid, replace_slot)`, `_own_pick(uid, pick_id)`, `_close_slot_gap(uid, slot)` | Internal helpers for the pick functions (execute revoked from clients). `_begin_pick_write` finds the caller (`not_authenticated`, `profile_not_found`) and takes a per-person advisory lock so counting finals and the duplicate check cannot race. `_resolve_dish` is described under Dishes and picks below. |

### Tables (schema `public`, row-level security on)

Migrations: `20261026234036_core_tables.sql` and `20261026234037_social_tables.sql`. Policies are in `20261027000454_rls_baseline.sql` (see Row-level security below).

- Core: `profiles`, `places`, `dishes`, `picks`, `tags`, `pick_tags`
- Reference data: `cities` (see Cities below) and the global rows of `tags` (see Tags below)
- Social and operations: `follows`, `saves`, `blocks`, `shared_lists`, `activities`, `notifications`, `push_tokens`, `device_attestations`, `reports`

### Row-level security

Migration: `20261027000454_rls_baseline.sql`; tests: `supabase/tests/database/rls.test.sql`. This is a deliberately simple baseline ("who owns this row"). Phase 3 and Phase 7 will add SQL functions and tighten privacy (private profiles, blocked users, follow requests). "Own" means the row's user column equals the signed-in user. Every update policy also checks that the row stays owned by the caller, so ownership cannot be transferred. Anything without a policy is reachable only through the service role.

| Table | Signed out (`anon`) | Signed in (`authenticated`) |
|---|---|---|
| `places`, `dishes`, `cities` | read | read; no direct writes |
| `profiles` | read | read; no direct insert (use `create_my_profile`); update own, limited to the columns listed under Profile writes below |
| `picks` | read | read; no direct writes (use the pick functions; see Dishes and picks) |
| `tags` | read global tags | read global tags and own personal tags; insert, update, delete own personal tags only |
| `pick_tags` | read when the tag is visible | same; no direct writes (use `add_pick` / `update_pick`) |
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

Sign-in and sign-up are by emailed 6-digit code (no link, no password). Settings are in the `config.toml` table above. Both `supabase/templates/magic_link.html` (existing people) and `supabase/templates/confirmation.html` (new people) are the same minimal on-brand page: night background, bone text, wordmark as text, Manrope with a system-font fallback, the code shown large. The two colours in the templates are copied from `packages/ui-tokens` because email cannot import tokens. Locally the emails arrive in the inbox at http://127.0.0.1:54324. Auth settings and email templates only take effect after `pnpm db:stop && pnpm db:start`. `pnpm db:reset` reloads the database but not the auth container's settings, so after pulling a change to `supabase/config.toml` or `supabase/templates/` always stop and start (a stack started before the templates existed sends the default "Your sign-in link" email with no code).

### Cities

Migration: `20261027050402_cities.sql`; tests: `supabase/tests/database/cities.test.sql`.

- **`public.cities`**: one row per world city: `geoname_id` (unique), `name`, `ascii_name`, `region_code`, `region_name`, `country` (ISO code), `country_name`, `population`, `location` (`geography(Point, 4326)`). Indexes: GIN trigram on `name`, on `ascii_name` and on `city_fold(name)` (search), GiST on `location` (nearest city). Row-level security is on and `anon` and `authenticated` can only `select`; there are no client writes (privileges are revoked, not just policies). Rows are written by the import script or the dev seed.
- **`profiles.home_city_id`** (`uuid`, references `cities`, `on delete set null`, indexed) is added by the same migration. The city label is stored in `profiles.home_place_text`.
- **Label format**, used everywhere: `name`, then `region_code` if the country is `US`, `CA` or `AU` (otherwise `region_name`), then `country_name`. Examples: `Vancouver, BC, Canada`, `Paris, Île-de-France, France`. `region_code` is only filled for `US`, `CA` and `AU`. A region that equals the city name or starts with it (any case) is left out, so `Tokyo, Japan` and `Ho Chi Minh City, Vietnam`, not `Tokyo, Tokyo, Japan`. Migration `20261027100721_city_label_no_repeat.sql` redefines `city_label` this way and recomputes the stored `profiles.home_place_text`; tests: `supabase/tests/database/city_label.test.sql`. `formatCityLabel` in `packages/api/src/cities.ts` applies the same rule.
- **Dev seed**: 24 cities with real GeoNames ids, names and populations (so the full import upserts over them cleanly), and every seeded profile has a `home_city_id`.
- **Full import**: `pnpm db:import-cities` (script: `scripts/import-cities.mjs`, uses the `postgres` package from the root devDependencies) downloads GeoNames `cities15000.zip`, `admin1CodesASCII.txt` and `countryInfo.txt` into the gitignored `.cache/geonames/` folder and upserts them by `geoname_id` in batches of 1,000, printing the counts. It skips neighbourhoods (feature code `PPLX`, such as "Downtown Vancouver") and historical places (`PPLH`), which leaves about 31,800 cities. Canadian provinces and Australian states are mapped from GeoNames numeric admin1 codes to their usual abbreviations inside the script. Re-running it is safe. Downloads are cached; delete `.cache/geonames` to fetch fresh GeoNames data. Production: run it once against the cloud database in Phase 8 with `pnpm db:import-cities -- --db-url <direct connection string>` (the connection string is a secret; never commit it). After a full import, `pnpm db:reset` returns the local database to the 24-city dev seed.
- **Attribution**: City data © GeoNames (CC BY 4.0), https://www.geonames.org. The in-app About line comes in Phase 8 (listed in `docs/known-gaps.md`).

### Tags

Migrations: `20261027172000_tag_vocabulary.sql` and `20261027172829_tag_slug_trigger_and_word_search.sql`; tests: `supabase/tests/database/tags.test.sql`.

- **The global vocabulary is reference data, so it is in the migration, not `seed.sql`.** `supabase db push` therefore gives production the same `food_type` (125) and `dietary` (12) tags as a local `db reset`. The migration calls `public.apply_tag_vocabulary()`, which upserts by `(kind, slug)`, so a database that already holds the Phase 1 seeded tags converges on the same rows (no duplicates), and the call is safe to repeat. To add or rename a tag later, write a new migration that upserts the changed rows (do not edit this one once it is on main).
- **New columns on `tags`**: `aliases text[] not null default '{}'` (extra search words, e.g. Ramen: `ramen noodles`; Low-FODMAP: `fodmap`, `ibs`) and `display_order integer` (position in the "Popular" list, null for tags that are not in it).
- **Featured / Popular**: food types Ramen, Noodles, Japanese, Soup, Pork, Sushi, Burgers, Tacos, Pizza, BBQ, Bakery, Seafood (in that order); dietary Vegan, Vegetarian, Gluten-free, Low-FODMAP, Dairy-free, Nut-free, Halal.
- **Search and personal tags**: `search_tags`, `popular_tags` and `create_personal_tag` (see Functions and triggers). A personal tag's name is tidied (trimmed, inner whitespace collapsed) and its slug is always `tag_slug(name)`, on every write path: the `tags_set_personal_slug` trigger (migration `tag_slug_trigger_and_word_search`) sets both on insert and on update of the name, slug or kind, so `(owner_id, slug)` stays unique and consistent even when a person inserts or renames their own tag directly (RLS still allows that); a clash is a `unique_violation` (23505). `create_personal_tag` is the idempotent door: it returns the existing row instead of raising.
- **Dev seed**: `seed.sql` no longer inserts global tags; it keeps Josie's four personal tags and the pick tags, which refer to the global ones by slug.

### Places

Migrations: `20261027190000_places_search.sql` and `20261027200000_places_privacy.sql`; tests: `supabase/tests/database/places.test.sql` and `scripts/import-places.test.mjs`.

- **New columns on `places`**: `address`, `postcode`, `category_labels text[]` (leaf names such as `Ramen Restaurant`, for display), `closed_at date`, `no_fixed_address boolean` (see below), and the generated stored `search_key` (see `place_search_key`), indexed with a GIN trigram index. The older `places_name_trgm` index stays.
- **Search and custom places**: `search_places`, `get_place` and `create_custom_place` (see Functions and triggers). A custom place sits on its city's point; geocoding the address into a real map pin is a Phase 5 known gap.
- **Custom places are public businesses.** They are restaurants, cafes, food trucks and pop-ups that anyone can visit (never someone's home), shown in search and, from Phase 5, on the map. So:
  - **Addresses are public**, custom and Foursquare alike (`places.address` is readable by everyone).
  - **`created_by` is private.** The table-wide `SELECT` on `places` is revoked from `anon` and `authenticated` and re-granted column by column for every column except `created_by` (migration `20261027200000_places_privacy.sql`). Reading `created_by` (or `select *`) through the API fails with `42501`; `search_places` and `get_place` return it as null. A migration that adds a column to `places` must also grant `select` on it to `anon, authenticated`, or clients cannot read it.
  - **An address is required unless the spot has no fixed address.** `create_custom_place` raises `address_required` for no address without `p_no_fixed_address`, and for an address with it. `places.no_fixed_address` (default false; Foursquare rows are false) records the flag.
- **Seed files** (`[db.seed] sql_paths` in `config.toml`): `seed.sql` first (people, the 14 canvas places and the picks that reference them), then `seed/places_vancouver.sql` (the generated Foursquare extract). The order matters: picks find their places by name, so the extract must load after them. Changing `sql_paths` needs `pnpm db:stop && pnpm db:start` before `db reset` uses it.
- **Import script** `scripts/import-places.mjs` (`pnpm db:import-places -- <flags>`):
  - `--bbox vancouver` writes `supabase/seed/places_vancouver.sql` (Metro Vancouver, lat 49.0-49.45, lng -123.35 to -122.5; sorted by Foursquare id, no timestamps, so the same release gives the same file).
  - `--upsert --bbox vancouver|--all` upserts by `(source, source_id)` in batches of 1,000 and prints counts. The target database comes from the `DATABASE_URL` environment variable only (there is no flag for it, so a password never lands in shell history or the process list); it and its password are scrubbed from any error text. Local: `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm db:import-places -- --upsert --bbox vancouver`. Production in Phase 8: the same with the direct connection string and `--all` (the connection string is a secret).
  - `--fixture <csv>` reads a local CSV instead of Hugging Face (`scripts/fixtures/fsq-sample.csv`, about 20 fictional rows; used by the tests and CI).
  - Source: the Hugging Face mirror `hf://datasets/foursquare/fsq-os-places/release/<newest dt=...>/places/parquet/`, read with the `duckdb` command line program (`brew install duckdb`). It needs `HF_TOKEN` (Josie's token) in the root `.env.local`; the token goes to DuckDB on standard input, is never printed or written, and is scrubbed from error text. Only places under the `Dining and Drinking` category are kept; the script first checks the release's categories file still has that branch.
  - The committed `places_vancouver.sql` is an empty placeholder until Josie generates the real extract (listed in `docs/known-gaps.md`).
- **Dev data note**: the canvas places stay in `seed.sql` (picks reference them), so a real Foursquare "Marutama" may appear beside the seeded one.
- **Attribution and licence**: FSQ OS Places © Foursquare Labs, Inc., Apache License 2.0. The notice is `docs/third-party/fsq-os-places-NOTICE.txt` and the full licence text is `docs/third-party/fsq-os-places-LICENSE.txt`. The generated seed file's header and the import script's header both carry the Apache 2.0 section 4(b) change notice: "Changes: filtered to Dining and Drinking categories; fields mapped to Final Meal's places table."; the in-app About line comes in Phase 8 (see `docs/known-gaps.md`).

### Dishes and picks

Migration: `20261027210000_picks_functions.sql`; tests: `supabase/tests/database/picks.test.sql`.

- **Writes go through functions only.** The Phase 1 own-row insert, update and delete policies on `picks` and the insert and delete policies on `pick_tags` are dropped, and `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` on both tables are revoked from `anon` and `authenticated` (a direct write fails with `42501`). Reads are unchanged. `dishes` still has no client writes; dishes are created inside `add_pick`. Functions: `add_pick`, `promote_pick`, `demote_pick`, `remove_pick`, `update_pick`, `move_final`, `suggest_dishes` (see Functions and triggers).
- **Final Meal slots are always exactly 1..n.** A new final takes n+1, removing or demoting slot k moves k+1..n up by one, a swap puts the new pick in the replaced slot, and `move_final` shifts the picks between. Each function does its whole change in one transaction under a per-person advisory lock, so a failure part-way changes nothing and two requests from one person cannot interleave.
- **How slots shift without colliding.** The Phase 1 rule was a partial unique index on `(user_id, slot) where tier = 'final'`; Postgres checks that row by row, so `slot = slot - 1` can hit a neighbour mid-statement. The migration replaces it with the constraint `picks_user_slot_unique`, `unique (user_id, slot) deferrable initially immediate`. A deferrable constraint is checked when the statement finishes, so one `UPDATE` can move a whole run of slots and only the end state has to be unique. It is never deferred to commit, so a mistake still raises inside the function. Honorable picks have a null slot and nulls are distinct, so the old `where` clause is not needed (the check `final <=> slot is not null` stays). A duplicate slot is still `23505`.
- **`public._resolve_dish`** (the one place a dish is found or made): a given `p_dish_id` must be an unmerged dish at that place (otherwise `place_not_found`, as for an unknown or merged place); otherwise the name is trimmed and whitespace-collapsed and `invalid_dish_name` is raised outside 1-80 characters or when it normalises to nothing; then an exact `name_key` match; then the closest unmerged dish at the place with `similarity(name_key, normalize_dish_name(name)) >= 0.85` (best first, oldest wins ties); otherwise a new dish (a simultaneous insert by someone else is detected and reused). "Tonkotsu  Ramen!" and "tonkotsu ramen" are one dish by the exact rule; "Tonkotsu Ramen (extra chashu)" is about 0.54 similar, so it is a new dish; a one-letter typo in a long name merges. The wording is kept per person in `picks.original_dish_name`.
- **`public.dish_stats`** (view, security invoker): one row per dish with `final_count`, `honorable_count` and `list_count` (= both), counting `trusted` profiles only. A plain view for now; materialising it is a Phase 7 gap (`docs/known-gaps.md`).
- **Trust:** `trust_level` decides what counts in `suggest_dishes.pick_count` and `dish_stats`; any signed-in person with a profile can add picks.
- **Error codes** (message of a `P0001` exception): `final_full`, `duplicate_pick`, `place_not_found`, `invalid_dish_name`, `pick_not_found`, `invalid_photo` have friendly copy in `@finalmeal/api`; `invalid_slot` (a replace or target slot that does not apply) and `invalid_tag` (a tag id that does not exist or is not a global tag) are for programming errors and show the generic message; `invalid_tag_name` and `profile_not_found` come from the existing tag and profile code.
- **Photo path:** `picks.photo_path` is null or `<uid>/pick-<digits>.jpg`, checked by `add_pick` and `update_pick` (the table itself has no check; the functions are the only writers).

### Storage buckets

Migrations (policies): `20261027052235_avatars_storage.sql` and `20261027210100_pick_photos_storage.sql`; tests: `supabase/tests/database/storage.test.sql` and `supabase/tests/database/pick_photos.test.sql`.

- **`avatars`**: declared in `config.toml` as `[storage.buckets.avatars]` (public, `2MiB`, `image/jpeg` only). `supabase start` and `db reset` create the bucket from that setting (on the first production deploy, verify that `config push` does too; if not, run `supabase seed buckets --linked`, see `docs/known-gaps.md`); the migration holds only the policies, so the bucket row is not duplicated in SQL. Public read comes from the bucket being public (no read policy for anonymous visitors).
- **Object path:** `<uid>/avatar-<unix-ms>.jpg`, one folder per person.
- **Policies on `storage.objects`** (`authenticated`): `avatars_insert_own`, `avatars_update_own` and `avatars_delete_own` allow the operation only where `bucket_id = 'avatars'` and the first folder of the path is the caller's id; insert and update also require the whole name to match `<uid>/avatar-<digits>.jpg`, so `<uid>/evil.png` is refused. `avatars_select_own` lets the caller see their own folder through the API; the Storage API cannot delete or replace a file without it. Nobody can list other people's files through the API.
- **`pick-photos`**: declared in `config.toml` as `[storage.buckets.pick-photos]` (public, `4MiB`, `image/jpeg` only); a config change, so `pnpm db:stop && pnpm db:start` is needed before `db reset` creates it. Same verify-on-first-deploy note as `avatars`. Object path `<uid>/pick-<unix-ms>.jpg`, one folder per person. Policies on `storage.objects` (`authenticated`): `pick_photos_insert_own`, `pick_photos_update_own`, `pick_photos_delete_own` and `pick_photos_select_own`, the same shape as the avatars ones (own folder; insert and update also require the `pick-<digits>.jpg` name). `add_pick` / `update_pick` accept only the same path shape for `picks.photo_path`.
- Direct SQL deletes from `storage.objects` are blocked by Supabase itself (use the Storage API), so the tests check the delete policy exists instead of running a delete.

### Edge Functions

None yet.

### Secrets (names only)

- `HF_TOKEN`: Josie's Hugging Face token, read from the root `.env.local` (never committed) by `scripts/import-places.mjs` only.
