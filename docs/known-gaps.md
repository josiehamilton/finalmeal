# Known gaps and carry-forward

Things that are deliberately unfinished or must be revisited, with the phase that has to close each. Phases are those in the design spec (`docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md`). Remove an item here when it is done. Row-level security details are in `docs/ops/supabase.md`.

## Phase 2: Accounts and profile

- Check that the seeded users can sign in with an email code (they have `@example.com` addresses; codes land in the local inbox at http://127.0.0.1:54324).
- Raise the local `[auth.rate_limit] email_sent` in `supabase/config.toml` for development when Phase 2 starts. It is 2 per hour now, which will get in the way of repeated sign-in testing. Note only; not changed yet. Record any change in `docs/ops/supabase.md`.
- Create profiles without letting people set `trust_level` or `is_business_affiliated` (the `profiles_insert_own` policy lets a user insert their own row with any values). Use a security-definer function or column grants.
- Extend `createFinalMealClient` (`packages/api/src/client.ts`) with React Native auth storage so mobile sessions persist.
- Narrow the request timeout in `createFinalMealClient` to the URL path (`new URL(url).pathname`) and to reads (GET/HEAD). Today it bounds every `/rest/v1/` request, so a timed-out write could still commit on the server.
- Close the open socket left by the auth-timeout test in `packages/api/src/client.test.ts` (destroy connections in `afterEach`).

## Phase 3 and Phase 7: privacy and safety

- Column-level protection for `profiles.trust_level`, `profiles.is_business_affiliated` and `follows.status` (policies are row-level today).
- Revoke the default `TRUNCATE` grants that `anon` and `authenticated` hold on public tables (not reachable through PostgREST, but should not exist).
- Narrow `notifications_update_own` so a user can only change `read_at`, not `activity_id`.
- Enforce private profiles and blocks in the read policies.
- Decide what happens to tag ownership when a personal tag is changed after it is attached to picks.

## Phase 8: launch

- Branded app icon and splash image from Josie.
- Use development builds instead of Expo Go.
- Verify the splash background colour on real devices.
- Work through the production configuration checklist in `docs/ops/supabase.md` ("Before the first production push").
