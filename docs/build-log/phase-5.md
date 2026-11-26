# Phase 5 build log

Copied from the gitignored ledger (.superpowers/sdd/2026-11-05-phase-5-discover/progress.md) so a fresh session anywhere can see what was decided. Review files stay local.

**Note:** the original Phase 5 ledger was lost with its session, so the per-task rulings for Tasks 1–7 were not recoverable. What follows is the ledger reconstructed on 2026-11-26 from the commit history (state found, plus the rulings made since). For the decisions Tasks 1–7 made on Josie's behalf, see `git log` on `phase-5-discover` and `docs/needs-from-josie.md` (rows 9b and 27–36), which they logged.

Reconstructed 2026-11-26 in a new cloud session from `git log origin/main..origin/phase-5-discover` (the original ledger was in another session and is gone). Spec: docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md.

## State found
- Tasks 1–7 built and review-fixed on phase-5-discover (981f91e plan .. a4f950b), per commit subjects:
  - T1 geocode: 26032f4, ac21583 (review fix)
  - T2 Discover queries: 8565f31, 34a93f7, b8446f5 (review fixes)
  - T3 API/core: 3903a51
  - T4 map WebView: d772f98, e06b8df, 5de5046 (review fixes)
  - T5 Discover tab: 068235f, d3db377 (review fix), 9bb0b60/1085dd6 (needs list)
  - T6 Search: dab3d76, 015eb48 (review fix), 1dae276 (needs list)
  - T7 Maps on profiles/Saved/First landing: 24a91ed, 404246a (review fix), 44a6ea1 (needs list)
  - a4f950b: further fixes across T5/T6/T7 (view failure through selection errors, first real view, Search focus centre, don't wait for city) — unknown whether re-reviewed.
- CI run 42557022051 on a4f950b: checks ✅, backend ❌ — packages/api/src/discover.integration.test.ts:82 "returns a follower count with people search": searchPeople(client,'ali') returned 0 rows.
- Task 8 (device checklist, docs, CI) not started; no docs/build-log/phase-5.md yet.

## Rulings
- Ruling: continue building Phase 5 without a fresh go-ahead — Josie asked "are you able to continue building?" and on 2026-11-03 said to keep building through the MVP (Phase 4 build log) — cost if wrong: rework she can see; nothing merged to main.
- Ruling: treat Tasks 1–7 as complete (commit subjects show each had a review-fix round); a4f950b's fixes, whose re-review status is unknown, are checked by the final whole-branch review — cost if wrong: a missed regression in those fixes until the final review.
- Ruling: the CI failure is fixed as Step 0 of the Task 8 dispatch (root-cause first), not a separate task — cost if wrong: none.
- Ruling: device Steps 1–2 of Task 8 are "pending an idle Mac" (cloud session) — plan text allows deferral — cost if wrong: none.

## Progress
Task 8: brief written (task-8-brief.md); waiting for local stack
Task 8: dispatched (base a4f950b, sonnet) with Step 0 = CI fix
Ruling: the red CI test (`returns a follower count with people search`) was a wrong test assumption, not a `search_people` bug: it searched `ali`, which matches no seeded person (Alli Mercer is `all…`), so it passed only when another integration file had already created an "Alice" (push test, in parallel, or leftovers from an earlier run). The test now searches `alli` and asserts the seeded `@allimercer` comes back with a numeric follower count — cost if wrong: none (test-only change).
Task 8: device Steps 1–2 pending an idle Mac; local checks all green (see commit); docs updated.

## Final review fixes
Ruling: after a Search focus, distances are measured from the map centre before the jump (otherwise every distance reads 0 m) — a place Search sends you to is flown to and centred, so measuring from the new centre would show 0 m for it — cost if wrong: a distance reads from the old centre rather than the new one; no data effect.
Ruling: the Discover title keeps the previous city name until the next lookup answers (and drops a stale answer) — a ~1 km cache key made nearly every pan flicker to "picks here" — cost if wrong: for a moment the title can name the city of the view just left.
Ruling: a single-place lookup (selecting a pin or a Search focus) ignores the Distance filter; displayed distances still come from the old centre — cost if wrong: a place just outside the radius can be selected from Search.
Ruling: a spot with no pin only moves Discover to its city (city zoom, nothing selected) — matches needs-list row 30 — cost if wrong: none.
