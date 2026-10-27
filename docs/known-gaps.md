# Known gaps and carry-forward

Things that are deliberately unfinished or must be revisited, with the phase that has to close each. Phases are those in the design spec (`docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md`). Remove an item here when it is done. Row-level security details are in `docs/ops/supabase.md`.

## Phase 3 and Phase 7: privacy and safety

- Column-level protection for `follows.status` (policies are row-level today). `profiles.trust_level` and `profiles.is_business_affiliated` are already protected by column grants (Phase 2).
- Revoke the default `TRUNCATE` grants that `anon` and `authenticated` hold on public tables (not reachable through PostgREST, but should not exist).
- Narrow `notifications_update_own` so a user can only change `read_at`, not `activity_id`.
- Enforce private profiles and blocks in the read policies.
- Decide what happens to tag ownership when a personal tag is changed after it is attached to picks.

## Phase 2 carry-forward

- Device verification of Phase 2 on the iPhone 17 and Pixel 10 (plan Task 6 Step 4, Task 9 Steps 1–2) is pending on Josie's Mac. The checklist is in `README.md` ("Device checklist (pending Mac)").
- The auth server answers a wrong code and an expired code the same way, so the "That code has expired…" copy never shows; people see "That code didn’t work…" either way. Revisit with the production auth server.
- Auth calls (send code, verify code) have no client-side timeout, so a backend that accepts the connection but never answers leaves the spinner up. Add a timeout in `@finalmeal/api`.
- The integration tests leave their sign-up people behind in the local database. Run `pnpm db:reset` afterwards (see `README.md`). A cleanup step in the test run would remove the need.
- Avatar storage has no per-person quota beyond the one-name rule (`<id>/avatar-<unix-ms>.jpg`, 2 MiB each). The app removes the old photo when a new one is saved, but nothing stops a client from uploading many files; decide on a limit before launch.

## Phase 8: launch

- Replace the placeholder skull icon and splash with Josie's final designs (re-run `pnpm brand:assets` from new source art).
- Use development builds instead of Expo Go.
- Verify the splash background colour on real devices.
- Work through the production configuration checklist in `docs/ops/supabase.md` ("Before the first production push").
- Add the "City data © GeoNames (CC BY 4.0)" line to the About screen.
- Run `pnpm db:import-cities` once against the production database (see "Cities" in `docs/ops/supabase.md`).
