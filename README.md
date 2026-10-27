# Final Meal

A social food app for iOS, Android and the web. Each person picks the five dishes for their final meal, adds as many Honorable Mentions as they like, follows friends, explores a map and shares live lists by link.

## What you need first

- **Docker Desktop**, running. The local database lives in Docker.
- **Node 22 or newer**, plus **pnpm** (`npm install -g pnpm`).
- **Xcode**, for the iPhone Simulator, with **Expo Go** installed in the Simulator. If it isn't there yet, run `pnpm --filter @finalmeal/mobile ios` once: it opens the Simulator and installs Expo Go (stop it with Ctrl+C afterwards).
- **Android Studio**, for the `Pixel_10` emulator, with **Expo Go** installed on it (`pnpm --filter @finalmeal/mobile android` installs it the first time).

The database tool (the Supabase CLI) is not a separate install: `pnpm install` adds the exact version the project uses.

## Get it running

```sh
pnpm bootstrap   # one time: installs everything, starts the local database, writes the local settings
pnpm dev         # starts the website and the mobile app
```

- The website is at http://localhost:3000.
- The phone app's Expo server starts too. With the iPhone Simulator open, run `xcrun simctl openurl booted exp://127.0.0.1:8081` in a second terminal to load the app in Expo Go. (Keyboard shortcuts such as `i` don't work inside `pnpm dev`.)
- Both show the Final Meal foundation screen with live counts from the local database.

## Try the app

Start the database and the apps first (`pnpm bootstrap` once, then `pnpm dev`). For a clean start, run `pnpm db:reset && pnpm env:local` before you begin.

**On the iPhone 17 Simulator**

1. Open the Simulator, then run `xcrun simctl openurl booted exp://127.0.0.1:8081` to load the app in Expo Go.
2. On Welcome, tap Continue with email and enter an address, for example `josie.test+ios@example.com`.
3. Open the local inbox at http://127.0.0.1:54324. The 6-digit code arrives there (nothing is really sent). Type it into the app.
4. Enter your name, pick a handle, search for your home city, and choose a photo from the library (or skip it). You land on the You tab.
5. Close Expo Go and reopen it: you stay signed in. Edit your bio and save, set the profile to Private, log out, then log back in with the same email.

**On the Pixel 10 emulator**

1. Start the `Pixel_10` emulator from Android Studio, then run `pnpm --filter @finalmeal/mobile android` (or press `a` in a standalone `npx expo start`).
2. Follow steps 2 to 5 above with another address, such as `josie.test+android@example.com`.
3. The Android emulator reaches your computer at `10.0.2.2` instead of `127.0.0.1`. The app swaps the address automatically, so nothing needs changing.

Sign-in codes expire after 10 minutes, and you can ask for a new one every 30 seconds.

### Device checklist (pending Mac)

Phase 2 was built and tested in a cloud session, which has no simulators. These checks still need to be run on Josie's Mac (from a session there, or by hand). Start each with `pnpm db:reset && pnpm env:local`. Take a screenshot of every step.

1. **iPhone 17, full flow.** Start Expo for iOS. Go Welcome, then email `josie.test+ios@example.com`, then read the code in the local inbox (http://127.0.0.1:54324), then Name `Josie` `Tester`, then username `josie_ios`, then city `vanc` and choose Vancouver, BC, Canada, then photo "Choose from library" (use a simulator stock photo), then the loading screen, then the You tab.
2. **iPhone 17, staying signed in.** Kill and relaunch Expo Go: the You tab opens signed in. Edit the bio and tap Save. Set Privacy to Private. Log out and confirm Welcome. Log back in with the same email and confirm the You tab.
3. **iPhone 17, resuming sign-up.** Sign up a second email and stop after the code step (kill the app). Relaunch and confirm it lands on the Name step.
4. **Pixel 10, full flow.** Start the `Pixel_10` emulator, then `npx expo start --android`. Repeat checks 1 and 2 with `josie.test+android@example.com` and username `josie_android`.
5. **Pixel 10, backend unreachable.** Run `pnpm db:stop`. On the email step, tap Send code and confirm it shows `Can’t reach the kitchen right now.` and the button works again afterwards. Then run `pnpm db:start`.
6. **Task 6 Step 4** of the Phase 2 plan (the simulator checks listed there) is also still to be run on the Mac.

Record the results in the Phase 2 progress ledger and tell Claude about anything that looks wrong.

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the website and the mobile app. |
| `pnpm db:reset` | Wipes the local database and rebuilds it with the sample people, places and dishes. |
| `pnpm test` | Runs the quick checks (no database needed). |
| `pnpm db:test` | Runs the database tests. |
| `pnpm test:integration` | Runs the API tests against the local database (it must be running, and `pnpm env:local` run). |
| `pnpm test:e2e` | Runs the website end-to-end tests. |
| `pnpm db:stop` | Stops the local database. |

If `pnpm dev` can't reach the database, run `pnpm db:start` first.

The integration tests create real sign-ups and leave those people behind in the local database. Run `pnpm db:reset` after them and before `pnpm db:test` or `pnpm test:e2e`, which expect exactly the sample people.

## Local tools

- **Studio** (browse the database): http://127.0.0.1:54323
- **Email inbox** (sign-in emails land here, nothing is really sent): http://127.0.0.1:54324

## More

- Design spec: `docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md`
- Screen designs: https://claude.ai/artifact/EJSWeoSKuhgowyi5jeWzPc
- How the backend moves from your laptop to production: `docs/ops/supabase.md`
