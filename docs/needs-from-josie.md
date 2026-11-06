# What Claude needs from Josie

A running list, newest needs added as they come up. Nothing here blocks today's work unless marked **Blocking**. When something is done, tell Claude and it gets moved to "Done".

**Rule for keys and passwords:** never paste them into chat or commit them. Each item says where to put it.

## Accounts and keys

| # | What | Why | Needed by | How |
|---|---|---|---|---|
| 1 | **Restaurant data access** (Hugging Face read token, or possibly a free Foursquare portal account instead) | Download the free Foursquare restaurant data. It pulls real Vancouver spots once, then the global import for launch. | Phase 3 (until then the app uses the sample restaurants) | **Wait for Claude to confirm which one.** Foursquare's docs say the data now comes through their own portal, and the Hugging Face copy may be out of date. Claude will check the first time you're both on the Mac. If it's Hugging Face: create a free account at huggingface.co, accept the terms on huggingface.co/datasets/foursquare/fsq-os-places, then Settings → Access Tokens → create a **Read** token, and add `HF_TOKEN=<token>` to `~/Documents/FinalMeal/.env.local` (git ignores this file). |
| 2 | **A domain name** | Share links (`yourdomain/l/josies-vancouver`), web pages, app links, and the sign-in email sender | Phase 6 (placeholder `finalmeal.example` until then) | Buy one (about $15/year) and tell Claude the name. DNS setup comes later, with Claude's help. |
| 3 | **Apple Developer Program** ($99/year) | Sign in with Apple, TestFlight, App Store | Phase 8 | Enrol at developer.apple.com with your Apple ID. |
| 4 | **Google Play Console** ($25 once) | Android testing and the Play Store | Phase 8 | Sign up at play.google.com/console. |
| 5 | **Supabase account** (cloud) | The production backend (about $25–35/month on Pro) | Phase 8 | Sign up at supabase.com. Claude sets up the project with you. |
| 6 | **Vercel account** | Hosting the web pages (about $20/month on Pro; the free plan bans commercial use) | Phase 8 | Sign up at vercel.com with GitHub. |
| 7 | **Expo account** | Cloud builds for iPhone and Android | Phase 8 | Sign up at expo.dev. |
| 8 | **Email sending service** (e.g. Resend) | Sending real sign-in codes from your domain | Phase 8 (needs the domain) | Sign up when we get there; Claude walks you through it. |
| 9 | **Sentry account** (free tier) | Crash reports from the app and web | Phase 8 | Sign up at sentry.io. |

## Design

| # | What | Needed by |
|---|---|---|
| 10 | **Final app icon and splash image.** The app uses a placeholder ember skull for now. Give Claude the source art and it re-runs `pnpm brand:assets`. | Phase 8 |
| 11 | **Canvas update for the Privacy screen.** The app follows the newer privacy rule, so the canvas board is out of date. Optional; Claude can update the board whenever you like. | Any time |

## Decisions

| # | Decision | Needed by | Current default |
|---|---|---|---|
| 12 | How often ads appear in the feed, and whether they're sold directly to restaurants or through an ad network | After the MVP | About every 5th card, restaurants directly |
| 13 | Pricing for removing ads (or a subscription) | After Claude's running-cost model | Not built yet |
| 14 | Optional: allow a startup hook so cloud sessions install the project automatically | Any time | Sessions run `pnpm install` themselves (fine as is) |
| 15 | Copy for First landing when all five Final Meal spots are filled (it said "0 seats left") | Phase 3 wrap-up | Placeholder: "All five seats taken", and the button becomes "Add an Honorable Mention". Swap in your wording any time. |
| 16 | When someone promotes a dish they already had ("Make it a Final Meal instead"), what happens to the photo, note and tags they just entered? | Phase 3 wrap-up | Tags are added; the new photo and note fill in only if the pick had none (nothing is overwritten) |
| 17 | Should the collapsed "Add tags" row list the chosen tags (e.g. "Ramen · Vegan · Rainy day")? Today it always says "Optional · food type, dietary, your own" | Any time | Not built; Claude recommends showing them |
| 18 | Copy for the daily limit on adding new spots (20 a day) | Any time | "You’ve added a lot of spots today. Try again tomorrow." |
| 19 | You tab filters: the empty copy "No honorable mentions match this filter.", tab counts that follow the filter, and leaving out More filters, per-row Promote and the group chevron for now | Any time | Built as described; say if any should change |
| 20 | **Phase 4 social & feed choices** (all built with these defaults; plan `docs/superpowers/plans/2026-11-03-phase-4-social-feed.md`, "Decisions for Josie"): Nearby = spots within 25 km of your home city; no Trending tab; follow requests in Activity with Approve / Decline; going Private keeps followers, going Public approves pending requests; only the four push toggles shown; no milestone or invite notifications in the MVP; caption "#2 on their Final Meal"; personal tags never shown to others; new empty-state copy ("Nothing new yet.", "Nothing nearby yet.", "No activity yet.", "Nothing saved yet.", "This account is private" / "Follow to see their picks."). | Any time | As listed |
| 21 | Saved tab chips: "Final Meals" and "Honorable" filter by the tier of the friend's pick you saved from. If they removed that pick or went private, the save shows only under All (and Nearby) and loses its photo. | Any time | As described |
| 22 | Profiles and follow lists: Follow buttons are ember everywhere (the FeedEmpty board shows bone buttons in its Popular list), and new empty copy: "No Final Meal dishes yet.", "No Final Meal dishes match this filter.", "No suggestions yet. Search for a friend by name or @handle.", "This profile isn't available.", "Your request is waiting for approval." | Any time | As listed |
| 23 | Feed details not on the canvas: the Following / Nearby tab row also shows above the empty state; the Honorable badge on cards is a dark pill with an outline; a failed next page shows "Try again" at the bottom; search boxes say "Search followers" / "Search following" / "Search people". | Any time | As listed |
| 24 | Saved tab details: the "Remove from Saved" alert has a title only; Nearby with no home city shows a "Choose home city" button; the filter chips hide when nothing is saved; long-press remove is also an accessibility action. | Any time | As listed |
| 25 | Activity and notification settings: a new neutral colour token for a switch that's off (`switchOff` #3A3530, from the board); Follow back in Activity uses the shared 36 px pill (board shows 34); the empty Activity state has no board, so Claude styled it (Newsreader italic title, centred body); Log out waits at most 3 seconds to forget the phone's push token. | Any time | As listed |
| 26 | "Popular near <city>" (Find people) can include people who aren't actually near; and opening a private account's pick after losing access shows the same "That pick isn’t there any more." as a removed pick. | Any time | As described |

## Done

- 2026-10-27: GitHub repo and sign-in (`gh auth login`).
- 2026-10-27: Docker Desktop, Android Studio, the iPhone 17 simulator and the Pixel 10 emulator set up.
- 2026-10-27: Cloud environment set up with the image pre-pull setup script.
- 2026-10-27: Decisions: privacy rules for private members, profile filter style (chip row), placeholder domain and icon, the post-meal diary framing (no "I'm here now", addresses instead of map pins).
