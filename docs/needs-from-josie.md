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

## Done

- 2026-10-27: GitHub repo and sign-in (`gh auth login`).
- 2026-10-27: Docker Desktop, Android Studio, the iPhone 17 simulator and the Pixel 10 emulator set up.
- 2026-10-27: Cloud environment set up with the image pre-pull setup script.
- 2026-10-27: Decisions: privacy rules for private members, profile filter style (chip row), placeholder domain and icon, the post-meal diary framing (no "I'm here now", addresses instead of map pins).
