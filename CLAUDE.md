# Final Meal

A social food app (iOS, Android, web). Each person picks the five dishes for their final meal plus unlimited Honorable Mentions, follows friends, explores a map, and shares live lists by link.

## Who does what

- **Josie Hamilton** is the product designer and owner. She makes product and design decisions.
- **Claude builds everything** (code, infrastructure, deployment). Bring Josie product and design questions with a recommendation, in plain language. Always tell her when you're stuck or need something from her (accounts, keys, decisions, assets).

## Where things live

| What | Where |
|---|---|
| MVP design spec (decisions, architecture, data model, flows, phases) | `docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md`, the source of truth for building |
| Implementation plans (one per build phase) | `docs/superpowers/plans/` |
| Screen designs (live) | Claude Design canvas: https://claude.ai/artifact/EJSWeoSKuhgowyi5jeWzPc |
| Screen designs (snapshot in git) | `design/canvas/project/*.dc.html` + `canvas.json`, a copy of every board for offline reference |
| Canvas generator | `design/canvas-generator/gen.py` (see its README) |
| Brand marks (skull logo) | `design/brand/` |
| Remote | https://github.com/josiehamilton/finalmeal |
| Old Flutter prototype | archived separately ("Final Meal Archive" repo); nothing from it is reused |

## Current status

- 2026-10-26: the MVP design spec is **approved**.
- **Phase 1 (Foundations) is complete** on branch `phase-1-foundations`, pending final review and merge: monorepo, brand tokens, local Supabase schema/RLS/seed, typed API client, web and mobile foundation screens, CI. Plan: `docs/superpowers/plans/2026-10-26-phase-1-foundations.md`.
- **Next:** write the Phase 2 (Accounts & profile) plan.
- **Dev:** `pnpm bootstrap` once, then `pnpm dev` (web at http://localhost:3000, Expo for the mobile app). See `README.md`.
- **iOS testing:** Josie's iPhone 17 simulator (in the app sidebar), via the iOS Simulator tool.
- **Needed from Josie later:** a branded app icon and splash image, before Phase 8.

## Working rules

- **Models:** use Opus 5.5 for planning, specs and reviews; Sonnet 5.5 for implementation (e.g. Sonnet subagents run the tasks in an implementation plan).
- **Spec first.** Don't build features that aren't in the spec without asking Josie. If something in the spec changes, update the spec in the same change.
- **The canvas is the visual source of truth.** Screens should match their artboards. Brand: ember `#C04B28`, ember glow `#E8693F` (no other accent colours); Instrument Serif wordmark, Newsreader display, Manrope UI; the skull marks Final Meal only.
- **Updating the canvas:**
  1. Copy `gen.py` to a scratch folder and edit it there.
  2. Run `python3 gen.py`.
  3. Publish the changed boards with the Artifact tool (`url` = the canvas, `root` = the generated `canvas` folder).
  4. Copy `gen.py` back into `design/canvas-generator/` and refresh the snapshot in `design/canvas/project/`.
  5. Before publishing, check whether the canvas has a newer version (Josie may hand-edit). If it does, read the changed boards and merge first.
- **Commits:** small, descriptive, and ending with the co-author line. Never commit `.env` files or secrets.
- **Supabase is codified:** schema and policy changes go only through `supabase/migrations/`, settings through `supabase/config.toml`, and functions through `supabase/functions/`; record each one in `docs/ops/supabase.md` (the local→prod runbook). `seed.sql` is dev-only. No hand edits in Studio. This keeps local and prod in sync.
- **Local first:** the backend runs in Docker via `supabase start`; cloud setup happens in Phase 8.
