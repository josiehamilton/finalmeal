# Supabase: what it is and how it runs

Final Meal keeps all of its data (people, dishes, places, picks, lists) in a Supabase backend, which is a Postgres database plus sign-in, file storage and serverless functions. On a laptop it runs inside Docker, started with one command and thrown away or rebuilt at will; in production it runs as a Supabase Cloud project. To keep the two identical, **everything about the backend is written down as files in git**: database structure and rules in `supabase/migrations/`, settings in `supabase/config.toml`, functions in `supabase/functions/`. Nobody edits the backend by hand in Studio. This page is the runbook for moving those files from the laptop to production, plus an inventory of what exists today.

## Local development

| Command | What it does |
|---|---|
| `pnpm db:start` | Starts the local backend in Docker (first run downloads images). API `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, inbox `http://127.0.0.1:54324`. |
| `pnpm db:stop` | Stops it. |
| `pnpm db:reset` | Wipes the local database and re-applies every migration, then `seed.sql` if present. |
| `pnpm db:test` | Runs the database tests in `supabase/tests/database/` (pgTAP). |
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

`@finalmeal/api` tests: `pnpm --filter @finalmeal/api test` (unit, no Supabase needed) and `pnpm --filter @finalmeal/api test:integration` (needs Supabase running, seeded, and `pnpm env:local` run). After a schema change, refresh `packages/api/src/database.types.ts` with `pnpm --filter @finalmeal/api gen:types`.

## Rules

- Schema, policies and functions change **only** through files in `supabase/migrations/`. Create one with `supabase migration new <name>`. If you explore in Studio, turn the result into a migration before committing.
- Auth, storage and API settings live in `supabase/config.toml`.
- Edge Functions live in `supabase/functions/`.
- `supabase/seed.sql` is sample data for local development only. It never runs in production: `supabase db push` does not run it, so never run it against the cloud project. It mirrors the design canvas: 6 people (`@example.com` emails, fixed ids `00000000-0000-4000-8000-00000000000N`, josie is `...0001`), 14 places, 17 dishes, 28 picks, the global food-type and dietary tags, Josie's personal tags, follows, 2 shared lists, and a few activities with notifications. `pnpm db:reset` loads it. The other database tests empty these tables inside their own rolled-back transaction, so they stay independent of the seed.
- Every new setting, extension, bucket or secret gets a line in the inventory below.
- Secrets are listed here by name only. Never commit `.env` or `.env.local` files.

## Local to production runbook

Production setup happens in Phase 8. These are the steps then.

1. `supabase login`
2. `supabase link --project-ref <project-ref>`: ties this folder to the cloud project.
3. `supabase db push`: applies any migrations the cloud project has not seen. Never run `seed.sql` against production.
4. `supabase config push`: applies the settings in `config.toml` (auth, storage, API) to the cloud project.
5. `supabase functions deploy`: deploys everything in `supabase/functions/`.
6. `supabase secrets set --env-file <file>`: sets function secrets from a local file kept outside git. Names are listed in the Secrets inventory below.
7. Extensions are created by the migrations themselves, so nothing to enable in the dashboard.

## Inventory

### `config.toml` settings changed from default

| Setting | Value | Why |
|---|---|---|
| `project_id` | `finalmeal` | Names the local Docker containers and volumes. |

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
| `public.normalize_dish_name(text)` | Immutable. Turns a dish name into its comparison key: accents removed, lower case, punctuation collapsed, simple plurals folded. |
| `dishes_set_name_key` | Before insert/update on `dishes`: fills `name_key`. |
| `pick_tags_check_owner` | Before insert/update on `pick_tags`: raises `personal_tag_not_owned` if a personal tag is put on someone else's pick. |

### Tables (schema `public`, row-level security on)

Migrations: `20261026234036_core_tables.sql` and `20261026234037_social_tables.sql`. Policies are in `20261027000454_rls_baseline.sql` (see Row-level security below).

- Core: `profiles`, `places`, `dishes`, `picks`, `tags`, `pick_tags`
- Social and operations: `follows`, `saves`, `blocks`, `shared_lists`, `activities`, `notifications`, `push_tokens`, `device_attestations`, `reports`

### Row-level security

Migration: `20261027000454_rls_baseline.sql`; tests: `supabase/tests/database/rls.test.sql`. This is a deliberately simple baseline ("who owns this row"). Phase 3 and Phase 7 will add SQL functions and tighten privacy (private profiles, blocked users, follow requests). "Own" means the row's user column equals the signed-in user. Every update policy also checks that the row stays owned by the caller, so ownership cannot be transferred. Anything without a policy is reachable only through the service role.

| Table | Signed out (`anon`) | Signed in (`authenticated`) |
|---|---|---|
| `places`, `dishes` | read | read; no direct writes |
| `profiles` | read | read; insert and update own |
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

Known gaps left for Phase 3/7: users can edit their own `profiles.trust_level` and `is_business_affiliated`, and set their own follow `status`, because policies are row-level, not column-level.

### Storage buckets

None yet.

### Edge Functions

None yet.

### Secrets (names only)

None yet.
