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

**Adding dishes**

1. Sign in as the sample member `josiehamilton@example.com` (code from the local inbox). She has four Final Meal dishes and 13 Honorable Mentions. A brand-new account goes through onboarding instead and adds its first pick there ("Now for the hard part"), landing on "Your Final Meal has begun."
2. Tap **+**. Choose a restaurant (the list starts with popular spots in your home city; tap Change to search another city, or "Can’t find it? Add it" for a spot that isn’t listed: it must be a business the public can visit, with a street address or "No fixed address"). Type the dish: dishes other people picked there are suggested. Add tags, a note and a photo if you like, then save.
3. With five Final Meal dishes, adding another asks which one to replace (Swap); the replaced dish becomes an Honorable Mention.
4. Open any dish on You to edit it, move it up, demote or promote it, get directions, or remove it. Filter You by city or tag with the chips.

### Device checklist (Phase 3, pending an idle Mac)

The iPhone run on 2026-11-02 stopped early because the Mac was overloaded (each tap took minutes). Already passed on the iPhone 17: You with the Vancouver filter, the dish suggestion with "· 2 picks here", tags and photo on the Add form, and the duplicate offer ("Make it a Final Meal instead" moved the ramen to #5). Still to run, from a session on the Mac or by hand. Run `pnpm db:reset && pnpm env:local` first, keep one Expo server, and if Expo Go shows old screens, quit Expo Go and reopen the link (it can serve a cached copy).

**iPhone 17**

1. As `josiehamilton@example.com`, add Khao Soi at Kin Kao as Final Meal. It goes to Swap: replace #4. #4 becomes Honorable and Khao Soi is #4.
2. On a dish: Move up, Directions, Edit the note, Remove (confirm). While Edit or Swap is saving, swiping back should do nothing.
3. Add a dish at a new spot "Taco Truck" (No fixed address, Vancouver) and another at "Corner Café", `123 Main St`, Vancouver. Add a dish in Tokyo by switching the city.
4. Promote from Swap, and check that a long dish name's strike-through line looks right.
5. Sign up a new email through onboarding: The hard part, Your first pick, Lock it in, then First landing with "4 seats left".
6. With five Final Meal dishes, First landing says "All five seats taken" and offers "Add an Honorable Mention".

**Pixel 10**

7. Repeat checks 1, 3 and 5.
8. Photo failure: start saving a dish with a photo, then cut the network (`adb shell svc wifi disable` and `adb shell svc data disable`). The dish saves without the photo and the notice "Saved without the photo. Add it from the dish any time." shows (on You, or on First landing for a first pick). Turn the network back on with `enable`.
9. Directions open the maps app.

Take a screenshot of every step and tell Claude about anything that looks wrong.

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
