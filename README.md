# Final Meal

A social food app for iOS, Android and the web. Each person picks the five dishes for their final meal, adds as many Honorable Mentions as they like, follows friends, explores a map and shares live lists by link.

## What you need first

- **Docker Desktop**, running. The local database lives in Docker.
- **Node 22 or newer**, plus **pnpm** (`npm install -g pnpm`).
- **Xcode**, for the iPhone Simulator.

## Get it running

```sh
pnpm bootstrap   # one time: installs everything, starts the local database, writes the local settings
pnpm dev         # starts the website and the mobile app
```

- The website is at http://localhost:3000.
- For the phone app, `pnpm dev` starts Expo. Press `i` in that terminal to open it in the iPhone Simulator.
- Both show the Final Meal foundation screen with live counts from the local database.

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the website and the mobile app. |
| `pnpm db:reset` | Wipes the local database and rebuilds it with the sample people, places and dishes. |
| `pnpm test` | Runs the quick checks (no database needed). |
| `pnpm db:test` | Runs the database tests. |
| `pnpm db:stop` | Stops the local database. |

If `pnpm dev` can't reach the database, run `pnpm db:start` first.

## Local tools

- **Studio** (browse the database): http://127.0.0.1:54323
- **Email inbox** (sign-in emails land here, nothing is really sent): http://127.0.0.1:54324

## More

- Design spec: `docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md`
- Screen designs: https://claude.ai/artifact/EJSWeoSKuhgowyi5jeWzPc
- How the backend moves from your laptop to production: `docs/ops/supabase.md`
