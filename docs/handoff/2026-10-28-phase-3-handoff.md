# Phase 3 handoff (2026-10-28)

Josie paused here to save her weekly usage. Phase 3 is built and merged into `main`. It is **not** finished: one task review, the device checks and the final whole-branch review are still to do.

## What's done

- **Phase 1 (Foundations)** and **Phase 2 (Accounts & profile)**: done, reviewed, device-verified and merged.
- **Phase 3 (Places, dishes & your Final Meal)**, plan `docs/superpowers/plans/2026-10-27-phase-3-places-dishes.md`:

| Task | What it built | Review |
|---|---|---|
| 1 | Tag vocabulary (food types, dietary tags, personal tags) and word-start tag search | Opus, clean |
| 2 | Places: search near a chosen city, custom spots (public businesses only), Foursquare import script | Opus, clean |
| 3 | Picks database functions: add, swap, promote, demote, remove, with your five always numbered 1 to n | Opus, clean |
| 4 | Dish photos: storage, upload, safe cleanup | Opus, clean |
| 5 | Add a dish: restaurant search, city picker, popular spots, Add a spot | Opus, clean |
| 6 | Dish detail, Edit, Swap, promote and demote, directions | Opus, clean |
| 7 | The You tab with real picks, grouped by restaurant, with filters | Opus, clean |
| 8 | First pick in onboarding and the First landing screen | **Built and committed, review not run** |
| 9 | Device verification and the final review | **Not started** |

- **Last checks (2026-10-28):** lint, typecheck and unit tests all pass; 606 database tests pass. The integration and web end-to-end tests were not re-run this session.
- **Every decision Claude made on Josie's behalf** (rulings) and the small review notes that were put off are in `docs/handoff/phase-3-ledger-extract.md`.

## What's next, in order

1. **Review Task 8** on Opus 5.5 (commit `a449564`, base `3d3c87d`). Known concerns to check:
   - With all five Final Meal spots filled, First landing shows "0 seats left" and still offers "Add your next dish". It should say something celebratory and hide the button. **Ask Josie for the copy.**
   - Saving from the Add modal always ends on the You tab, even when started from First landing.
   - `routeFor` guesses whether to resume the first-pick step. Check it after quitting mid-flow.
   - First landing is rendered by `feed.tsx` (there is no `home.tsx`). Confirm that's intended.
   - `replace('/loading')` from the nested stack and blocking swipe-back were only tested with mocks.
2. **Task 9: device checks** on the iPhone 17 simulator (UDID `9C7EFCFB-C079-45DA-9240-D9BE65BAD833`) and the `Pixel_10` emulator, following the plan's Task 9. Also run the items held back from Tasks 6 to 8:
   - iOS swipe-back is blocked while Swap or Edit is saving
   - Edit inside the nested stack (`getParent`)
   - the drawn strike-through line on long dish names
   - promote from Swap
   - the "photo failed" banner
   - Android directions (`geo:` link)
   - the first-pick onboarding flow end to end
   Save screenshots to the ledger folder and compare each screen with its board in `design/canvas/project/`.
3. **Final whole-branch review** on Opus 5.5 of everything Phase 3 changed (`8853827..a449564` plus any fixes since). Triage the deferred minor notes in the ledger extract in the same pass. Fixes go through one Sonnet 5.5 fix round, then a scoped Opus re-check.
4. **Real restaurant data** (needs list item 1). `supabase/places_vancouver.sql` is an empty placeholder until Josie's token is in `.env.local`. First confirm whether the data now comes from Hugging Face or the Foursquare portal.
5. Then **Phase 4** (social and feed). Later phases: 5 Discover map (geocode custom spot addresses), 6 sharing and web (needs the domain), 7 trust and safety, 8 launch.

## How to run and test it

One time: `pnpm bootstrap` (Docker Desktop must be running). After that:

```sh
pnpm db:reset && pnpm env:local   # clean sample data
pnpm dev                          # website + Expo server
```

- **iPhone:** open the iPhone 17 simulator, then `xcrun simctl openurl booted exp://127.0.0.1:8081`.
- **Android:** see README "Try the app". Allow "Nearby devices" the first time.
- **Sign in:**
  - To see a full list, sign in as `josiehamilton@example.com`. The sample account already has five Final Meal dishes plus Honorable Mentions.
  - To try the new first-pick onboarding, sign up with a fresh address such as `josie.test+p3@example.com`.
  - Codes arrive in the local inbox at http://127.0.0.1:54324.
- **Things to try:**
  - Tap **+** to add a dish. Search a Vancouver restaurant, switch city, or Add a spot (needs a street address or "no fixed address").
  - Add tags and a photo.
  - Open a dish to edit it, swap it, move it between Final Meal and Honorable Mentions, or get directions.
  - On You, filter by city and tags.
- **Tests:** `pnpm test` (quick), `pnpm db:test` (database), `pnpm test:integration` then `pnpm db:reset` (API), `pnpm test:e2e` (website).
- **After pulling changes to `supabase/config.toml`:** run `pnpm db:stop && pnpm db:start`.

## Handoff prompt (paste into a new session on the Mac)

```
Pick up Final Meal Phase 3. Read CLAUDE.md, then docs/handoff/2026-10-28-phase-3-handoff.md and docs/handoff/phase-3-ledger-extract.md.

Phase 3 Tasks 1–8 are merged into main; Tasks 1–7 were reviewed clean. Do the "What's next" list in order, using superpowers:subagent-driven-development with the plan docs/superpowers/plans/2026-10-27-phase-3-places-dishes.md (Opus 5.5 reviews, Sonnet 5.5 implements):
1. Recreate the ledger at .superpowers/sdd/2026-10-27-phase-3-places-dishes/progress.md (it's gitignored and may be missing). Mark Tasks 1–7 complete, paste in the rulings from the extract, then run the Task 8 review (BASE 3d3c87d, HEAD a449564) and fix what it finds.
2. Task 9 device checks on the iPhone 17 simulator and Pixel_10, including the held-back items listed in the handoff.
3. Final whole-branch Opus review of Phase 3, one fix round, scoped re-review.
Work on a branch off main and ask me before merging. Ask me for any copy you need (for example the "all five seats filled" First landing message). Keep docs/needs-from-josie.md current and tell me when you're stuck.
```
