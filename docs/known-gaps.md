# Known gaps and carry-forward

Things that are deliberately unfinished or must be revisited, with the phase that has to close each. Phases are those in the design spec (`docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md`). Remove an item here when it is done. Row-level security details are in `docs/ops/supabase.md`.

## Phase 3 and Phase 7: privacy and safety

- Revoke the default `TRUNCATE` grants that `anon` and `authenticated` hold on public tables (not reachable through PostgREST, but should not exist). Done for `picks` and `pick_tags` (Phase 3) and `follows`, `activities`, `notifications`, `push_tokens` and the new Phase 4 tables (Phase 4); the other tables remain.
- Enforce private profiles and blocks in the read policies.
- Decide what happens to tag ownership when a personal tag is changed after it is attached to picks.

## Phase 2 carry-forward

Each item names the phase that closes it.

- **Closes before the Phase 2 merge:** device verification of Phase 2 on the iPhone 17 and Pixel 10 (plan Task 6 Step 4, Task 9 Steps 1–2) is pending on Josie's Mac. The checklist is in `README.md` ("Device checklist (pending Mac)").
- **Phase 8:** the auth server answers a wrong code and an expired code the same way, so the "That code has expired…" copy never shows; people see "That code didn’t work…" either way. Revisit with the production auth server.
- **Phase 3:** the integration tests leave their sign-up people behind in the local database. Run `pnpm db:reset` afterwards (see `README.md`). A cleanup step in the test run would remove the need; add it when Phase 3 adds more integration tests.
- **Phase 7:** only `followed` pushes are throttled (once per person per 24 hours, `follow_push_log`). Repeated follow requests (request, cancel, request) and save / unsave loops can still push the target every time; throttle `follow_requested` and `saved_pick` / `saved_from_list` pushes the same way.
- **Phase 7:** avatar storage has no per-person quota beyond the one-name rule (`<id>/avatar-<unix-ms>.jpg`, 2 MiB each). The app removes the old photo when a new one is saved, but nothing stops a client from uploading many files; decide on a limit with the other abuse controls.
- **Phase 8:** the mobile sign-up end-to-end test with Maestro (spec section 10) was not built in Phase 2; it needs the development builds. Web end-to-end runs in Playwright already.
- **Phase 8:** offline cache of the last-seen profile (spec 5.6). Today the You tab shows the friendly error with Try again when the profile cannot be loaded.
- **Hidden until their phase** (nothing is built yet, so nothing is shown): the Privacy Policy link (Phase 8); Share a list on You (Phase 6); the Safety and Your data sections of Settings (Phase 7); the Settings row Remove ads (when the paid tier exists, after Phase 8), Help and Terms (Phase 8).
- **Phase 8:** clean up push tokens whose person has no live session. Log out in Settings forgets the device's token first (waiting at most 3 seconds), but a session that ends any other way (a revoked or expired refresh token, a sign-out from another device, a password change) leaves a live Expo token on that account, and Expo would still deliver its pushes to the phone. Before sending, drop or skip tokens whose user has no live row in `auth.sessions` (or clear them from an auth hook when a session is revoked), or bind each token to a session.
- **Phase 8:** push is wired but switched off (`apps/mobile/src/lib/push.ts`): it needs `extra.eas.projectId` in the app config. When the Expo account exists, also add the `expo-notifications` config plugin and an Android notification channel, and test registration and sign-out on a development build (never run on a device yet).
- **Phase 8:** verify, on the first production deploy, that the remote `avatars` and `pick-photos` buckets really are created. `supabase config push` may not create buckets from `[storage.buckets.*]`; if it does not, run `supabase seed buckets --linked`.
- **Phase 3:** `cities` has no `created_at` / `updated_at` columns (it is reference data written only by the import script), although spec section 4 says every table has them. Add them if a later phase needs to know when a city changed; otherwise note the exception in the spec.

## Phase 3 carry-forward: places

- **Pending Josie:** generate the real Metro Vancouver extract. It needs her Hugging Face token (`HF_TOKEN` in the root `.env.local`) and the `duckdb` program: `pnpm db:import-places -- --bbox vancouver`, then commit `supabase/seed/places_vancouver.sql`. Until then that file is an empty placeholder and dev search shows only the 14 canvas places. The DuckDB path has never run against the live dataset (no token yet); check its first run (release folder, categories file, column names).
- **Phase 5:** custom spots must get real map pins: geocode their street addresses when maps arrive. Today a custom place sits on its city's point and the address is only text, so every custom place in a city shares one pin. Spots flagged `no_fixed_address` (food trucks, pop-ups) have no address to geocode and need a different answer (a pin the creator drops, or no pin).
- **Later:** merge custom places into Foursquare ones when the same restaurant exists in both (the dev canvas "Marutama" and a Foursquare "Marutama" appear side by side).
- **Phase 8:** closed places stay in the table (with `closed_at`) so a re-import can mark closures; nothing yet hides picks at a place that closed.

## Phase 3 carry-forward: dishes and picks

- **Phase 7:** `dish_stats` is a plain view that counts picks on every read. Make it a materialised view (refreshed on a schedule or by trigger) before dish pages get busy.
- **Phase 7:** pick-photo storage has no per-person quota beyond the one-name rule (`<id>/pick-<unix-ms>.jpg`, 4 MiB each), like avatars; decide on a limit with the other abuse controls. Nothing yet limits how many dishes a new account can create, or how many tags a pick can carry (`add_pick` / `update_pick` take any number of personal tag names).
- **Later:** a merged dish (`dishes.merged_into_id`) is refused by `add_pick` with `place_not_found` rather than followed to its target; follow the merge when dish merging is built.
- **Phase 7 (polish):** onboarding resumes from what the profile already has (`routeFor`), which is an inference with gaps. A person who quit on the photo step with a city set resumes at the first-pick step, so the optional photo is skipped (it can still be added from Edit profile). A person who quit after the pick saved but before onboarding finished (the finish call failed, then the app was killed) sees the first-pick intro again, and adding the same dish gives `That dish is already on your list.`; Skip for now still works and First landing then shows the pick.
- **Phase 7:** dish photos lose their location data because the app always re-encodes them (`preparePickPhoto`), but the server doesn't enforce it. A modified client could upload a JPEG with its own metadata (it would only expose the uploader's own data). Consider stripping or rejecting EXIF server-side with the other abuse controls.
- **Phase 7 (polish):** after "Make it a Final Meal instead" succeeds, the app merges the new tags and note into the pick with a second call. If only that second call fails (a network drop between the two), the screen still closes as saved with no notice, and the tags or note are lost. It needs its own copy (the photo notice would be wrong).
- **Phase 7:** add integration cases for the blocked-person paths once blocks exist (there is no block API in Phase 4, so only pgTAP covers them): `profile_unavailable` from `follow_user` and from accepting a request across a block, `getProfile` returning null across a block, and `getProfilePicks` returning `[]`.
- **Phase 7 (polish):** the notifications cursor is the timestamp alone (`get_my_notifications` pages with `created_at < before`). Two notifications for one person with exactly the same `created_at` that straddle a page boundary would lose the second. Each transaction writes at most one notifying activity per recipient today, so it is unlikely; add an id tiebreak (`before` plus `beforeId`) in a database round if that changes.
- **Phase 4 (screens):** Nearby is offset-paged over a live ranking, so a later page can repeat a card; the screen removes repeats with `appendUniqueByKey` (`@finalmeal/core`) and keeps advancing by `nextOffset`.

## Phase 8: launch

- Expo push sender, and schedule `push-dispatch` (cron or a database webhook on `push_outbox`). Phase 4 queues pushes and the function delivers them through the `log` sender only. Also prune old `push_outbox` rows (sent, failed and skipped) and old `follow_push_log` rows, and decide what to do with rows left in `sending` when a dispatch dies midway (nothing re-queues them yet) and with `failed` rows (no retry yet).
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
