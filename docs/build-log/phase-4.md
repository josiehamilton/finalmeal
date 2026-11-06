# Phase 4 build log

Copied from the gitignored ledger (.superpowers/sdd/2026-11-03-phase-4-social-feed/progress.md) so a fresh session anywhere can see what was decided. Review files stay local.

Ruling: plan executed without Josie's prior approval — she said on 2026-11-03 to keep building through the MVP and log needs — cost if wrong: rework she can see.
Task 1: dispatched (base 10ac68e, sonnet)
Task 1: implementer DONE at 95263e4 (709 pgTAP). Concern: follow_accepted activity survives unfollow. Review dispatched (opus).
Task 1: review (opus) spec ✅ quality approved; 4 Minor (unfollow leaves follow_accepted; follow_user lock order; test gaps; accept across block) — fix round 1 dispatched to implementer. Ruling: minor-only fix rounds are verified by the controller via the RED/GREEN evidence, not a separate re-review — saves a review seat — cost: a missed minor regression caught at final review.
Task 1: fix round 1 DONE 6cd0f39 (new migration 20261103100200; 730 pgTAP; RED shown)
Task 1: complete (commits 10ac68e..6cd0f39, review clean)
Task 2: dispatched (base 6cd0f39, sonnet)
Task 2: implementer DONE_WITH_CONCERNS at 599a7e8 (872 pgTAP, 42 integration). Added follow_push_log table; key order SERVICE_ROLE_KEY||SECRET_KEY; seed notif count 3→4; types stale. Review dispatched (opus).
Task 2: review (opus) spec ❌ (private actor pick fields leak in get_my_notifications after unfollow), 8 Minor. Fix round 1 dispatched (Important + 6 minors; 2 minors → known-gaps).
Task 2: fix round 1 DONE 163640d (899 pgTAP). Scoped re-review dispatched (opus).
Task 3: dispatched (base 163640d, sonnet) in parallel with Task 2 re-review. Ruling: overlap a read-only re-review with the next implementer — saves wall-clock — cost: a Task 2 fix may land after Task 3 commits (new migration).
Task 2: re-review (opus) all addressed, no new Important; 2 Minor (claim-time re-check misses private-actor rule for dethroned pushes; no test that stale front-of-queue pushes are passed over).
Ruling: Task 2 re-review Minors folded into the Task 3 fix round (new migration redefining _push_still_wanted) — one-liner — cost: none.
Task 2: complete (commits 6cd0f39..163640d, review clean)
Task 3: implementer DONE_WITH_CONCERNS at 8893f49 (1046 pgTAP, 42 integration). Review dispatched (opus).
Task 4: dispatched (base 8893f49, sonnet) in parallel with Task 3 review.
Task 3: review (opus) spec ✅ quality approved; 8 Minor (keyset-tie + promoted-swap hiding tests; pickers privacy tests; index on activities.other_pick_id; save/unsave/save push throttle; cursor 'at' verbatim; Nearby offset dupes → client dedupe by item_key; spec §4 saves wording; seed tidy-ups).
Ruling: blocked people excluded from pickers/place_pickers — Phase 5 Discover must match.
Ruling: DB minors (Task 3 + Task 2 carry-overs) run as one fix round AFTER Task 4 finishes — concurrent db:reset would break both agents — cost: short delay.
Ruling: client notes (pass cursor verbatim; dedupe Nearby by item_key) go into Task 6's dispatch.
Task 3: complete (commits 163640d..8893f49, review clean; minors pending fix round)
Task 4: implementer DONE at 1bdaaef (api unit 216, integration 56, core 63). Review dispatched (opus). DB minors fix round (Task 3 + Task 2 carry-overs) dispatched to Task 3 implementer in parallel.
Task 3 minors + Task 2 carry-overs: fix round DONE 327c614 (1067 pgTAP, 56 integration; RED shown for private-actor push and save throttle). Controller-verified via evidence (minor-only round). types regenerated (save_push_log only) — accepted.
Task 5: dispatched (base 327c614, sonnet) in parallel with Task 4 review.
Task 4: review (opus) spec ✅, needs fixes: I1 getProfilePicks leaks private/blocked picks (plan-mandated caller gating) → enforce in API; I2 realtime fixed topic breaks second subscriber/remount; 10 Minor. Fix round 1 dispatched (api/core only, concurrent with Task 5 in mobile).
Task 4: fix round 1 DONE 847f8c4 (api unit 222, integration 58). Scoped re-review dispatched (opus). needs #21 added (filterSaves rule).
Task 4: re-review (opus) all addressed, no new Important; 1 Minor (anon gets raw 42501; tiny race until Phase 7 RLS — accepted). filterSaves product note → needs #21 (done) and Task 7 dispatch.
Task 4: complete (commits 8893f49..847f8c4, review clean)
Task 5: implementer DONE at 9f68f42 (mobile 641). Copy decisions flagged. Review dispatched (opus).
Task 6: dispatched (base 9f68f42, sonnet) in parallel with Task 5 review.
Task 5: review (opus) spec ✅ quality approved; 12 Minor (stale follow state → id-keyed store; silent follow failure in rows; no load-more retry; follows paging dupes; follows screen ignores privacy by URL; shared home-city helper; …). Ruling: Task 5 minors fixed after Task 6 finishes (both touch follow state). needs #22 added.
Task 5: complete (commits 1308ef7..9f68f42, review clean; minors pending)
Task 6: implementer DONE_WITH_CONCERNS at 63a7119 (mobile 747). Review dispatched (opus). Task 5 minors fix round dispatched in parallel (follow store, people.tsx → lib/city-name).
Task 5: minors fix round DONE cebae25 (mobile 766; shared follow-store). Skipped: search placeholder copy (Josie), 3-round-trip profile open (final review). Feed follow buttons don't seed the store — fold into Task 6 fix round. Controller-verified (minor-only).
Task 7: dispatched (base cebae25, sonnet) in parallel with Task 6 review.
Task 6: review (opus) spec ✅, needs fixes: I1 next-page error retry loop; 10 Minor. Fix round 1 dispatched (concurrent with Task 7). needs #23 added.
Task 6: fix round 1 DONE 96cf391 (mobile 773). Scoped re-review dispatched (opus).
Task 6: re-review (opus) all addressed, no new Important; 2 Minor (no test for second Try-again failure; failed pull-to-refresh on non-empty list stops paging — restore cursor) → final review fix round.
Task 6: complete (commits 0d56962..96cf391, review clean)
Task 8: dispatched (base 96cf391+, sonnet) in parallel with Task 7 build.
Task 7: implementer DONE at 93e9c12 (mobile 823; 2 failing suites are Task 8's in-progress files). Review dispatched (opus). Saved decisions noted for needs list.
Task 7: review (opus) spec ✅ quality approved; 10 Minor. Minors fix round dispatched (concurrent with Task 8).
Task 7: complete (commits 96cf391..93e9c12, review clean; minors pending)
Task 8: implementer DONE_WITH_CONCERNS at d3712be (mobile 876). Review dispatched (opus).
Task 7: minors fix round DONE fbb460e (mobile 889; shared save state; FeedCard on useSave). Skipped minor 5 (reasoned). Controller-verified (minor-only).
Task 8: review (opus) spec ✅, needs fixes: I1 stale push token on non-Settings sign-out (timeout + known-gaps Phase 8 server cleanup); I2 raw hex in ToggleRow → token; 8 Minor. Fix round 1 dispatched.
Task 8: fix round 1 DONE c1c6cbd (mobile 905, ui-tokens 10). Ruling: controller verified the two Important fixes by reading the diff (3 s Promise.race timeout; colors.switchOff token + no-raw-hex test) instead of an Opus re-review — small, test-covered — cost: a missed regression caught at final review. Ruling: unregister lives in Settings log-out (session needed).
Task 8: complete (commits e2b56bc..c1c6cbd, review clean)
Final review dispatched (opus) a9bbd0b..c129aa7. Device steps (Task 9 Steps 1–2): pending Mac.
Final review (opus, a9bbd0b..c129aa7): needs fixes — I1 CI red since 327c614 (web e2e expects old seed counts); I2 save/follow stores survive sign-out (leak previous account's saves). 8 new Minor; 18 deferred triaged (3 fix now). Controller miss: CI was checked green at 163640d and not re-checked after later pushes. Ruling: from now on, check CI after every push.
Final fix round + Task 9 (docs, local checks; device steps pending Mac) dispatched as one (sonnet).
