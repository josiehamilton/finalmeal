# Known gaps and carry-forward

Things that are deliberately unfinished or must be revisited, with the phase that has to close each. Phases are those in the design spec (`docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md`). Remove an item here when it is done. Row-level security details are in `docs/ops/supabase.md`.

## Phase 2: Accounts and profile

- Check that the seeded users can sign in with an email code (they have `@example.com` addresses; codes land in the local inbox at http://127.0.0.1:54324).

## Phase 3 and Phase 7: privacy and safety

- Column-level protection for `follows.status` (policies are row-level today). `profiles.trust_level` and `profiles.is_business_affiliated` are already protected by column grants (Phase 2).
- Revoke the default `TRUNCATE` grants that `anon` and `authenticated` hold on public tables (not reachable through PostgREST, but should not exist).
- Narrow `notifications_update_own` so a user can only change `read_at`, not `activity_id`.
- Enforce private profiles and blocks in the read policies.
- Decide what happens to tag ownership when a personal tag is changed after it is attached to picks.

## Phase 8: launch

- Branded app icon and splash image from Josie.
- Use development builds instead of Expo Go.
- Verify the splash background colour on real devices.
- Work through the production configuration checklist in `docs/ops/supabase.md` ("Before the first production push").
- Add the "City data © GeoNames (CC BY 4.0)" line to the About screen.
- Run `pnpm db:import-cities` once against the production database (see "Cities" in `docs/ops/supabase.md`).
