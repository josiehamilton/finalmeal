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

**Following, feed and saves (Phase 4)**

1. Sign in as `josiehamilton@example.com` (code from the local inbox). Feed › Following shows Ari's dethroning first (one card), then Pork Gyro and Tonkotsu Ramen. Tap Save on a card: it becomes `Saved`. Feed › Nearby shows Vancouver picks only.
2. Tap the search icon on Feed to open Search (People, Dishes, Spots). On People, search by name or `@handle`, and follow someone. Tap a name to open their profile; tap a dish to open their pick (`On n Final Meals`, Save to try, Unsave).
3. Open `@allimercer`: tap `Follow back`, then look at the followers and following lists. Open `@priyashah` (a private account): the button says `Requested` and the page says `This account is private`.
4. The bell on Feed shows a dot. Activity lists what happened (follows, requests, saves, dethronings) with `Follow back`; `Mark all read` clears the dots. Settings › Notifications has four push switches; push itself starts with the first test build.
5. The Saved tab shows what you saved to try, with chips and long-press to remove.
6. Sign out and sign in as `priyashah@example.com` (also in the local inbox). Activity shows requests from Josie and Sam: approve Josie. Back as Josie, Priya's profile and picks now show.
7. A brand-new account lands on First landing with Nearby picks for its home city; adding a dish from it returns there. After you switch tabs, Feed shows `An empty table.` with Popular people to follow.

**Discover, Search and maps (Phase 5)**

1. Sign in as `josiehamilton@example.com`. The Discover tab opens on Vancouver: a dark map with skull pins (one per spot) and bone dots, and a sheet that says `<n> picks near Vancouver`. Pan and zoom and the pins and sheet follow. Tap a pin to see the dishes picked there (the sheet shows who picked them); tap the map to clear it. `List view` lists every dish in view.
2. Chips: `All`, `Final Meals` and `Honorable` are one choice; `Following` is a separate on/off chip. `Filters` has Distance (1–99 km, or Any, measured from the map's centre), food types and dietary tags; `Show <n> picks` applies them and `Reset` clears them. The map never asks for your location: it starts on your home city.
3. Search: the magnifier on Discover finds dishes and spots (a spot moves the map there); the one on Feed has People, Dishes and Spots tabs.
4. Maps also show on You › Map, on other people's profiles and on Saved › Map view; First landing's `See the map` opens Discover.
5. Custom spots added by street address have no pin until `pnpm geocode` runs (it calls the `geocode-places` function once; on a local stack it uses the mock geocoder, so no key or network is needed). Pull Discover and the pin appears. Spots marked "No fixed address" never get a pin. Production geocoding waits for a provider (`docs/needs-from-josie.md`).

Seeded logins: `josiehamilton@example.com` (public, has followers and saves), `priyashah@example.com` (private, with pending follow requests from Josie and Sam). Others: `arimitchell`, `mikebrennan`, `allimercer`, `devpatel`, `samokafor` at `@example.com`.

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

### Device checklist (Phase 4, pending an idle Mac)

Not yet run on a device: the Phase 4 build was checked by the unit, database, API and web tests only. Run `pnpm db:reset && pnpm env:local` first, keep one Expo server, and take a screenshot of every step.

**iPhone 17** (sign in as `josiehamilton@example.com`, code from the local inbox)

1. Feed › Following shows Ari's dethroning first (one card), then Pork Gyro and Tonkotsu Ramen. Save a card and see `Saved`.
2. Nearby shows Vancouver picks only, with no Sam or Priya.
3. Open Mike's Wagyu Beef Don: `On n Final Meals`. Save to try, then Unsave.
4. Open `@allimercer` from a card: `Follow back`, follow, then check the followers and following lists and search.
5. Open `@priyashah`: `Requested` and `This account is private`.
6. The bell dot shows. Activity shows two unread with `Follow back`. Tap `Mark all read`.
7. Settings › Notifications: switch Saves off, leave and come back, and it's still off.
8. Saved shows the four seeded saves. Try each chip, and long-press to remove one.
9. Sign out and sign in as `priyashah@example.com`: approve Josie in Activity. Back as Josie, Priya's profile and pick now show. (Also check that Saved and the Follow buttons show Josie's own state after switching accounts, not the other person's.)
10. Sign up a new user: First landing shows Nearby in Vancouver. Add a dish from it and land back on First landing. Switch tabs, then Feed shows `An empty table.` with Popular people. Follow one of them from there: the feed fills in.

**Pixel 10**

11. Repeat 1, 4, 6 and 10 in Expo Go, and confirm there is no red error from `expo-notifications` at startup.

Take a screenshot of every step and tell Claude about anything that looks wrong.

### Device checklist (Phase 5, pending an idle Mac)

Not yet run on a device: the Phase 5 build was checked by the unit, database, API and web tests only. Run `pnpm db:reset </dev/null && pnpm env:local` first, keep one Expo server, take a screenshot of every step, and sign in as `josiehamilton@example.com` (code from the local inbox).

**iPhone 17**

1. Discover opens on Vancouver with the dark map, skull pins and bone dots, the legend, and `<n> picks near Vancouver`. Pan and zoom: pins and the sheet follow. The attribution `ⓘ` shows above the sheet and opens in the browser.
2. Tap Kin Kao: the pin grows with its ring and `Kin Kao · <n> lists`; the sheet shows Khao Soi with avatars and the tier counts. Tap the map: it clears.
3. Chips: `Final Meals`, `Honorable`, `Following`. Filters: Sushi + Noodles + Gluten-free, 25 km, then `Show <n> picks`; the Filters dot shows; `Reset`. The slider works in Expo Go.
4. List view lists every in-view dish; open one.
5. Search from Discover: `ramen` shows Dishes and Spots; tap Marutama and the map flies there. From the Feed's search icon: People (`al`), Dishes, Spots tabs; follow someone.
6. You → Map with a chip; @allimercer → Map; Saved → Map view.
7. Add a custom spot with a street address in Vancouver; it has no pin. Run `pnpm geocode`, pull Discover (pan a little): the pin appears near its address area. A "No fixed address" spot never gets a pin.
8. Turn the Mac's Wi-Fi off and reopen Discover: `The map didn’t load.` with `Try again`; Wi-Fi back on, `Try again` loads it.
9. Sign in as a new user without a home city (skip it in onboarding): Discover starts at the world view with `Set your home city to start the map there.`; no location prompt appears anywhere.

**Pixel 10**

10. Repeat 1, 2, 3 and 5 in Expo Go, and confirm the WebView map renders (WebGL) and the slider works.

Extra checks on the maps inside scrolling screens (You, other profiles, Saved):

11. On both phones, open You › Map. Drag the map vertically and horizontally: the map pans and the page stays put. Scroll the page by dragging the header or the chips, and pull down from the header to refresh. Pulling down on the map must not refresh.
12. Pick a chip on the Map tab: the map re-frames to those pins. Pick All: it frames them all again. Do the same on a public profile's Map tab and on Saved's Map view.
13. Sheet-height shifts: each time the in-view sheet changes height (the "Zoom in to see every pick." note appears, or it switches between picks, empty and error), the map is re-padded and the view can shift by half the change. Confirm it is not jarring.
14. Tap a pin near the bottom of the map: the selected-spot sheet is taller than the map's padding, so the pin can sit under it. Confirm it stays visible or decide how to lift it.

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
