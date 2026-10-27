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
| Known gaps and what each phase must close | `docs/known-gaps.md` |
| Remote | https://github.com/josiehamilton/finalmeal |
| Old Flutter prototype | archived separately ("Final Meal Archive" repo); nothing from it is reused |

## Current status

- **Phase 1 (Foundations): done and merged to `main`** (2026-10-27). Monorepo, brand tokens, local Supabase schema/RLS/seed, typed API client, web and mobile foundation screens, CI.
- **Phase 2 (Accounts & profile): plan approved by Josie, ready to build.** Plan: `docs/superpowers/plans/2026-10-27-phase-2-accounts-profile.md`. Build on branch `phase-2-accounts-profile` (create it from `main`); don't merge into `main` without Josie's OK.
- **Leftovers and later work:** `docs/known-gaps.md`.
- **Dev:** `pnpm bootstrap` once, then `pnpm dev` (web at http://localhost:3000, Expo for the mobile app). See `README.md`.
- **Devices (Josie's Mac only):** iPhone 17 simulator and the `Pixel_10` Android emulator, both running the app in Expo Go.
- **Placeholders until Josie decides:** link domain `finalmeal.example`; a generated ember-skull app icon and splash.

## How we build (works with or without workflow plugins)

1. **Spec, then plan, then build.** Josie approves the spec and each phase's plan before code. Plans live in `docs/superpowers/plans/` and list tasks with exact files, interfaces, copy and tests.
2. **One task at a time, test first.** For each task, write the failing tests, see them fail, implement, see them pass, then commit with the co-author line.
3. **Builder and reviewer are different agents.** A Sonnet 5.5 subagent builds each task from the plan's task text. An Opus 5.5 subagent reviews the diff against the task and the spec before the next task starts. Fixes go back to the builder, and the reviewer re-checks only the fix.
4. **Keep a progress ledger** in `.superpowers/sdd/<plan-name>/progress.md` (gitignored): one line per task started, fixed and completed with commit ranges, plus every decision made on Josie's behalf (`Ruling: what — why — cost if wrong`). After a context reset, trust the ledger and `git log`.
5. **Finish with one whole-branch review on Opus 5.5,** fix its findings in one round, push the branch, confirm CI is green, then ask Josie before merging into `main`. Report every ruling to her.
6. **Decide, don't stall.** Make reasonable calls when the plan is unclear, and record them. Only stop for Josie on: anything destructive or irreversible, security-sensitive actions, merging/pushing to `main` or publishing, accounts or keys she must create, or a plan so broken every path is a guess.

## Cloud session vs Josie's Mac (Phase 2)

- **In a cloud session:** build and test Tasks 1–5, 7 and 8 fully (unit tests, pgTAP, API integration against local Supabase in Docker, web e2e if the Playwright domains are allowed). In Task 2, download.geonames.org is probably not on the cloud's allowed list. Skip the optional full city import (`pnpm db:import-cities`) and rely on the dev seed, or ask Josie to add the domain.
- **Needs Josie's Mac:** the simulator checks in Task 6 Step 4 and Task 9 Steps 1–2 (iPhone 17 and Pixel 10). In a cloud session, do everything else in those tasks, mark the device steps "pending Mac" in the ledger and the final report, push the branch, and tell Josie to run them from a session on her Mac.

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
- **Local first:** the backend runs in Docker via `pnpm db:start`; cloud setup happens in Phase 8.

## Working in a cloud session

A cloud session (claude.ai/code) works on a fresh copy of this repository. This file, the spec, the plans and the design snapshot come along; personal notes and plugins from Josie's Mac do not.

- **Already there:** Node 22, pnpm, `gh` and Docker (`docker compose` works). With the default "Trusted" network access, npm, GitHub and the Docker registries are reachable, so the local Supabase backend runs in a cloud session just like on the Mac.

**Setting up the cloud environment** (claude.ai/code, environment settings):

1. **Network access:** choose "Trusted" (the default). Don't pick "None".
2. **Web end-to-end tests (optional):** Playwright downloads its browser from hosts outside the Trusted list. To run `pnpm test:e2e` in the cloud, choose "Custom" (keep the Trusted list included if it offers that), then add these two under "Custom allowed domains": `cdn.playwright.dev` and `playwright.download.prss.microsoft.com`. In a session, run `pnpm --filter @finalmeal/web exec playwright install --with-deps chromium` once. If you'd rather skip this, leave web e2e to CI, which runs it on every push.
3. **Setup script:** leave it **empty**. Node 22, pnpm and Docker are already installed, and setup scripts run before the repository is in place, so project installs can't go there.
4. **Secrets:** none needed for local-only work. Don't paste keys into the environment settings.

**First steps in every cloud session** (before anything else):

1. `pnpm install --frozen-lockfile`. It installs everything, including the pinned Supabase CLI, and takes a minute or two.
2. When a task needs the database: `pnpm db:start`, then `pnpm env:local`. The first start in a session downloads the backend's Docker images and takes a few minutes.

- **Who tests what:** a cloud session builds and tests code for web, Android and iOS (unit tests, API integration tests, web end-to-end). Looking at the app on the iPhone Simulator or an Android emulator happens on Josie's Mac. Expo cloud builds come in Phase 8.
- The rules above (models, spec first, Supabase codified, no secrets in commits) apply in cloud sessions too.
