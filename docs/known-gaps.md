# Known gaps and carry-forward

Things that are deliberately unfinished or must be revisited, with the phase that has to close each. Phases are those in the design spec (`docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md`). Remove an item here when it is done. Row-level security details are in `docs/ops/supabase.md`.

## Phase 3 and Phase 7: privacy and safety

- Column-level protection for `follows.status` (policies are row-level today). `profiles.trust_level` and `profiles.is_business_affiliated` are already protected by column grants (Phase 2).
- Revoke the default `TRUNCATE` grants that `anon` and `authenticated` hold on public tables (not reachable through PostgREST, but should not exist).
- Narrow `notifications_update_own` so a user can only change `read_at`, not `activity_id`.
- Enforce private profiles and blocks in the read policies.
- Decide what happens to tag ownership when a personal tag is changed after it is attached to picks.

## Phase 2 carry-forward

Each item names the phase that closes it.

- **Closes before the Phase 2 merge:** device verification of Phase 2 on the iPhone 17 and Pixel 10 (plan Task 6 Step 4, Task 9 Steps 1–2) is pending on Josie's Mac. The checklist is in `README.md` ("Device checklist (pending Mac)").
- **Phase 8:** the auth server answers a wrong code and an expired code the same way, so the "That code has expired…" copy never shows; people see "That code didn’t work…" either way. Revisit with the production auth server.
- **Phase 3:** the integration tests leave their sign-up people behind in the local database. Run `pnpm db:reset` afterwards (see `README.md`). A cleanup step in the test run would remove the need; add it when Phase 3 adds more integration tests.
- **Phase 7:** avatar storage has no per-person quota beyond the one-name rule (`<id>/avatar-<unix-ms>.jpg`, 2 MiB each). The app removes the old photo when a new one is saved, but nothing stops a client from uploading many files; decide on a limit with the other abuse controls.
- **Phase 8:** the mobile sign-up end-to-end test with Maestro (spec section 10) was not built in Phase 2; it needs the development builds. Web end-to-end runs in Playwright already.
- **Phase 8:** offline cache of the last-seen profile (spec 5.6). Today the You tab shows the friendly error with Try again when the profile cannot be loaded.
- **Hidden until their phase** (nothing is built yet, so nothing is shown): the Privacy Policy link (Phase 8); Share a list on You (Phase 6); the Safety and Your data sections of Settings (Phase 7); the Settings rows Remove ads and Notifications (Phase 4, with notifications; Remove ads when the paid tier exists, after Phase 8), Help and Terms (Phase 8).
- **Phase 8:** verify, on the first production deploy, that the remote `avatars` bucket really is created. `supabase config push` may not create buckets from `[storage.buckets.*]`; if it does not, run `supabase seed buckets --linked`.
- **Phase 3:** `cities` has no `created_at` / `updated_at` columns (it is reference data written only by the import script), although spec section 4 says every table has them. Add them if a later phase needs to know when a city changed; otherwise note the exception in the spec.

## Phase 3 carry-forward: places

- **Pending Josie:** generate the real Metro Vancouver extract. It needs her Hugging Face token (`HF_TOKEN` in the root `.env.local`) and the `duckdb` program: `pnpm db:import-places -- --bbox vancouver`, then commit `supabase/seed/places_vancouver.sql`. Until then that file is an empty placeholder and dev search shows only the 14 canvas places. The DuckDB path has never run against the live dataset (no token yet); check its first run (release folder, categories file, column names).
- **Phase 5:** custom spots must get real map pins: geocode their street addresses when maps arrive. Today a custom place sits on its city's point and the address is only text, so every custom place in a city shares one pin. Spots flagged `no_fixed_address` (food trucks, pop-ups) have no address to geocode and need a different answer (a pin the creator drops, or no pin).
- **Later:** merge custom places into Foursquare ones when the same restaurant exists in both (the dev canvas "Marutama" and a Foursquare "Marutama" appear side by side).
- **Phase 8:** closed places stay in the table (with `closed_at`) so a re-import can mark closures; nothing yet hides picks at a place that closed.

## Phase 8: launch

- `KeyboardAvoider` (apps/mobile) adds `StatusBar.currentHeight` on Android to match `measureInWindow`. Verify it on real devices with cutouts, a hidden status bar and landscape; add an Android-platform unit test and an unmount listener-removal assertion.
- iOS keyboard padding jumps instead of easing; consider animating it with the keyboard's duration.

- Replace the placeholder skull icon and splash with Josie's final designs (re-run `pnpm brand:assets` from new source art).
- Use development builds instead of Expo Go.
- Verify the splash background colour on real devices.
- Work through the production configuration checklist in `docs/ops/supabase.md` ("Before the first production push").
- Add the "City data © GeoNames (CC BY 4.0)" line to the About screen.
- Run `pnpm db:import-cities` once against the production database (see "Cities" in `docs/ops/supabase.md`).
- Show Foursquare attribution in the About screen (text in `docs/third-party/fsq-os-places-NOTICE.txt`).
- Run the global places import in prod: `DATABASE_URL=<direct connection string> pnpm db:import-places -- --upsert --all` (see "Places" in `docs/ops/supabase.md`).
