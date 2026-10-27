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
- The website shows the Final Meal foundation screen with live counts from the local database. The phone app opens on Welcome (sign up or log in with an email code).

## Try the app

Start the database and the apps first (`pnpm bootstrap` once, then `pnpm dev`). For a clean start, run `pnpm db:reset && pnpm env:local` before you begin. If you reset the database while the app is already signed in, the app notices that the account is gone and returns to Welcome by itself.

**On the iPhone 17 Simulator**

1. Open the Simulator, then run `xcrun simctl openurl booted exp://127.0.0.1:8081` to load the app in Expo Go. Expo Go shows a floating tools button that can sit on top of Save, the Settings icon and Skip. Hide it: long-press the button and choose Hide, or turn it off in Expo Go's settings.
2. On Welcome, tap Continue with email and enter an address, for example `josie.test+ios@example.com`.
3. Open the local inbox at http://127.0.0.1:54324. The 6-digit code arrives there (nothing is really sent). Type it into the app.
4. Enter your name, pick a handle, search for your home city, and choose a photo from the library (or skip it). You land on the You tab.
5. Close Expo Go and reopen it: you stay signed in. Edit your bio and save, set the profile to Private, log out, then log back in with the same email.

**On the Pixel 10 emulator**

1. Start the `Pixel_10` emulator from Android Studio. `pnpm dev` holds the Expo port (8081), so stop it first (Ctrl+C in its terminal), then run `pnpm --filter @finalmeal/mobile android`: it starts Expo and opens the app in the emulator. (To keep `pnpm dev` running instead, load the app into its Expo server with `adb shell am start -a android.intent.action.VIEW -d exp://10.0.2.2:8081`. Never start a second Expo server beside `pnpm dev`.)
2. The first time Expo Go runs on the Pixel it asks for "Nearby devices" (local network access). Tap Allow. This is for development only; without it Expo Go cannot reach your computer, and Send code waits about 15 seconds, then shows `Can’t reach the kitchen right now.` Hide Expo Go's floating tools button here too (see the iPhone step 1).
3. Follow steps 2 to 5 above with another address, such as `josie.test+android@example.com`.
4. The Android emulator reaches your computer at `10.0.2.2` instead of `127.0.0.1`. The app swaps the address automatically, so nothing needs changing.
5. After pulling changes to `supabase/config.toml` or `supabase/templates/`, run `pnpm db:stop && pnpm db:start`. `pnpm db:reset` reloads the database but not the sign-in settings, so a stack started before the change keeps sending the old email (for example a link with no 6-digit code).

Sign-in codes expire after 10 minutes, and you can ask for a new one every 30 seconds.

### Device checklist (pending Mac)

Phase 2 was built and tested in a cloud session, which has no simulators. These checks still need to be run on Josie's Mac (from a session there, or by hand). Run `pnpm db:reset && pnpm env:local` once per device run: before check 1 for the iPhone checks (1 to 3), and before check 4 for the Pixel checks (4 and 5). Do not reset in between: check 2 reuses the account made in check 1, and check 4 makes its own account for the Pixel (it repeats checks 1 and 2). Take a screenshot of every step. If the database is reset while the app is still signed in, the app signs itself out and returns to Welcome, so no reinstall is needed.

1. **iPhone 17, full flow.** Start Expo for iOS. Go Welcome, then email `josie.test+ios@example.com`, then read the code in the local inbox (http://127.0.0.1:54324), then Name `Josie` `Tester`, then username `josie_ios`, then city `vanc` and choose Vancouver, BC, Canada, then photo "Choose from library" (use a simulator stock photo), then the loading screen, then the You tab.
2. **iPhone 17, staying signed in.** Kill and relaunch Expo Go: the You tab opens signed in. Edit the bio and tap Save. Set Privacy to Private. Log out and confirm Welcome. Log back in with the same email and confirm the You tab.
3. **iPhone 17, resuming sign-up.** Sign up a second email and stop after the code step (kill the app). Relaunch and confirm it lands on the Name step.
4. **Pixel 10, full flow.** Start the `Pixel_10` emulator and open the app as in the Pixel steps above (stop `pnpm dev` first, or load the app into its running Expo server; never start a second server). Reset the database once, then repeat checks 1 and 2 with `josie.test+android@example.com` and username `josie_android`.
5. **Pixel 10, backend unreachable.** Run `pnpm db:stop`. On the email step, tap Send code and confirm it shows `Can’t reach the kitchen right now.` within about 15 seconds and the button works again afterwards. Then run `pnpm db:start`.
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
