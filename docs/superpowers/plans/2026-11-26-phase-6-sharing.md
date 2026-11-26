# Phase 6: Sharing & web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Model rule (Josie):** Sonnet 5.5 subagents implement; Opus 5.5 plans and reviews. Without the plugin, follow `CLAUDE.md` "How we build". **This plan waits for Josie's approval before any code is written.** Once approved, move it to `docs/superpowers/plans/2026-11-26-phase-6-sharing.md` and keep the ledger in `.superpowers/sdd/2026-11-26-phase-6-sharing/progress.md`.

**Goal:** A person shares a live list of their picks (their five, everything, a city, a food type, a tag or a custom mix) as a readable link, manages their links in Your lists, and anyone who opens the link sees it on the web (list and map, a link preview, sign-up prompts) or in the app, always evaluated live.

**Architecture:**
- **One filter, one evaluator.** A shared list stores a saved filter (`shared_lists.filter`), never a copy of picks. `@finalmeal/core` owns the filter schema (parse, normalise, compare, match) and the slug and title rules; Postgres mirrors the same normalisation (`_normalize_list_filter`, `_list_slug_base`) and evaluates the filter on every read through one internal helper, `_list_pick_ids`. Every count, page, preview image and search row reads that helper, so they always agree.
- **Functions only.** Clients can no longer read or write `shared_lists` directly (the Phase 1 policies are replaced): `share_list`, `update_shared_list` and `get_my_lists` for owners; `get_shared_list`, `get_shared_list_picks`, `search_shared_lists` and `save_list` for viewers. Privacy, blocks, deactivation, slugs and rate limits live there.
- **Web:** Next.js 16 renders `/l/[slug]` on the server on every request (no caching), with a MapLibre GL map (the Phase 5 OpenFreeMap style recoloured to the canvas tokens), Open Graph tags, a generated preview image (`opengraph-image.tsx`), a sign-up sheet and a small email-code join flow (`/join`) that finishes the save or follow it was opened from. `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` are served by route handlers with placeholder app IDs until the Phase 8 accounts exist.
- **App:** the Share hub, Share a list, Your lists (the board's automatic lists plus a new Shared links section), Your list, and the shared-list screen at `/l/[slug]` (so `finalmeal://l/<slug>` and, in Expo Go, `exp://…/--/l/<slug>` open it). Discover search gains its Shared lists section; profile "Share a list" and "Share these" appear.
- **Links:** the link domain is one value, `LINK_DOMAIN = 'finalmeal.example'` in `@finalmeal/core`. Local stacks override the origin to `http://localhost:3000` through `pnpm env:local` (`EXPO_PUBLIC_LINK_ORIGIN`, `NEXT_PUBLIC_LINK_ORIGIN`), so a copied link opens the local web page.

**Tech Stack:** The Phase 1–5 stack, plus:
- `expo-clipboard` (in Expo Go for SDK 58; add with `pnpm --filter @finalmeal/mobile exec expo install expo-clipboard`)
- `maplibre-gl` **5.24.0** as an npm dependency of `apps/web` (the same version the app's WebView pins in `apps/mobile/src/map/map-page.ts`)
- `next/og` `ImageResponse` for the preview image, with fonts read from `@expo-google-fonts/newsreader`, `@expo-google-fonts/manrope` and `@expo-google-fonts/instrument-serif` (the versions `apps/mobile/package.json` already uses) added to `apps/web` dependencies
- `@finalmeal/core` added to `apps/web` dependencies
- Next.js 16.4.6 has breaking changes from older versions (`apps/web/AGENTS.md`): before writing web code, read `apps/web/node_modules/next/dist/docs/` on dynamic route params and `searchParams` (both Promises), `generateMetadata`, `not-found.tsx`, `opengraph-image.tsx` and route handlers.

**Spec:** `docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md`: sections 1.1 (sharing), 1.2 (story images and a full web app are not in the MVP), 2 (Sharing, Grouping), 3 and 3.1 (`apps/web`), 4 (`shared_lists`, `activities.saved_from_list`), 5.3 (Share), 5.4 (Search: shared lists arrive now; Profile: "Share these"), 5.5 (privacy), 6 (web footer attribution), 7 (web MapLibre), 10 (testing), 11 (Phase 6 row), 12–13 (domain placeholder). **Canvas:** ShareHub, ShareList, SharedList, MyLists, MyList, WebList, WebMap, WebSignup, WebDesktop, Profile / ProfileHM / ProfileMap ("Share these", "Share a list", the header share icon), DiscoverSearch (Shared lists), OnbEmail / OnbOtp / OnbName / OnbUsername (copy for the web join steps), in `design/canvas/project/`, with exact copy in `design/canvas-generator/gen.py`. **Not built:** ShareImage and ShareCard's image card (story-image sharing, spec 1.2). **Carry-forward:** `docs/known-gaps.md` ("Phase 6: sharing": Discover search's Shared lists section; "Hidden until their phase": Share a list on You), the Phase 4 ruling that blocked people are excluded everywhere (`docs/build-log/phase-4.md`), and the Phase 5 ruling that a spot with no pin is never stacked on its city's centre (`docs/build-log/phase-5.md`).

## Global Constraints

- **All Phase 1–5 constraints and `CLAUDE.md` rules apply:**
  - tokens only (the mobile `no-raw-colours` test covers every new mobile file; a new web test, Task 7, covers `apps/web/src`); Instrument Serif, Newsreader and Manrope; ember `#C04B28` and ember glow `#E8693F` are the only accents
  - Supabase is codified: new migrations only, `security definer` functions with `set search_path = ''`, execute revoked from `public` and granted as stated, every change recorded in `docs/ops/supabase.md` in the same commit; spec changes in the same commit as the code
  - use the pinned CLI via `pnpm exec supabase` / `db:*`; regenerate `packages/api/src/database.types.ts` with it; never commit `.env*` files or keys
  - commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
- **Branch:** `phase-6-sharing`, created from `phase-5-discover` (Phase 5 is not merged into `main` yet; this phase builds on its Search screen, profile maps and map tokens). When Phase 5 merges, rebase `phase-6-sharing` onto `main` (or merge `main` into it) before the final review. No merge into `main` without Josie's OK. Check CI after every push.
- **Expo Go only.** No native module that Expo Go does not ship; add native packages only with `expo install`. Universal Links and App Links need development builds and real app IDs (Phase 8): this phase serves the files and builds the route, and tests opening it through the `exp://` / `finalmeal://` scheme.
- **No current location, ever.** Nothing here imports `expo-location` or touches `navigator.geolocation`; the web map adds no `GeolocateControl` (tests scan for all three). Lists and the web show **no distances** (there is no viewer position to measure from).
- **What a list contains:** the owner's picks that match its filter, evaluated on every read, both tiers unless the filter says otherwise, whatever the owner's trust level (spec 4: a new account's picks show in its shared lists). Never another person's picks.
  - `final_five`: the owner's Final Meal picks; `everything`: all their picks; `custom`: picks matching **all** of the given kinds, **any** of the values within a kind (cities, food types, dietary tags, the owner's own personal tags), and the given tiers.
  - Rows carry global tags only (food type and dietary), never personal tags, even for the owner. Rows carry no note.
  - Picks are ordered Final by slot, then Honorable newest first (`sortPicks`), then grouped by restaurant in first-appearance order (`groupPicksByPlace`).
- **Who can see a list** (`get_shared_list`, `get_shared_list_picks`):
  - an **active** list: anyone with the link, signed in or not, including a **private** owner's list (spec 5.5, Privacy board: "Lists you share by link still show you"); the owner's name, @username and photo always show
  - never across a block in either direction: a blocked viewer gets `list_not_found`, the same answer as a list that does not exist
  - an **inactive** (turned off) list: only its owner; everyone else gets `list_not_found`
  - a row opens its pick (`can_open`) only when `_can_see(viewer, owner)`; on the web rows never open a pick (there is no web pick page)
- **Search** (`search_shared_lists`): active lists with at least one pick, whose owner is **public** and is trusted, the viewer, or someone the viewer actively follows; never across a block. A private owner's lists are never in search.
- **Writes:** only through `share_list`, `update_shared_list` and `save_list`. At most **30 new lists per person per rolling 24 hours** (`list_limit`). Titles 1–80 characters after trimming; notes ≤ 280 (blank is none). A list's filter and slug never change after creation; its title, note and on/off state can.
- **Slugs:** from the title (Task 1 rules), unique across every list ever made (case-insensitive, `citext`), never reused; a clash gets `-2`, `-3` … `-99`, then a random 6-character ending; a **private** owner's new slug always ends in `-` plus 4 random hex characters.
- **Link domain:** one value, `LINK_DOMAIN` in `packages/core/src/links.ts` (`finalmeal.example`). Links are `<origin>/l/<slug>` with origin `https://finalmeal.example`, or the `EXPO_PUBLIC_LINK_ORIGIN` / `NEXT_PUBLIC_LINK_ORIGIN` override that `pnpm env:local` sets to `http://localhost:3000`.
- **Web:** `/l/[slug]` is rendered per request (`export const dynamic = 'force-dynamic'`, no `revalidate`, no fetch cache), so every view is live. It reads with the anon key on the server; a signed-in browser re-reads with its session for saved state. The page never shows a dead button: Apple and Google sign-in, App Store / Google Play, Terms, Privacy and Report this list stay hidden (Phases 7–8).
- **Not built this phase** (hide the controls):
  - story images: ShareImage, ShareCard's image card and its `Story` / `Save image` actions, and ShareList's `Link` / `Story image` toggle
  - Share on feed cards, on pick detail and on other people's profiles (there is no pick or profile web page in the MVP)
  - editing a list's filter after it is shared (make a new link instead)
  - Report this list (Phase 7), the root web page beyond today's foundation page
- **Limits:** `get_shared_list_picks` returns at most 500 picks; `search_shared_lists` 20 rows (Discover shows 3); filter arrays at most 20 entries each.
- **Errors:** new codes `list_not_found`, `list_limit`, `invalid_list_title`, `invalid_list_filter`, added to `FriendlyCode` with copy (Task 2/3). Network and server failures use the existing friendly copy plus `Try again`.
- **Copy:** quote canvas copy exactly, with typographic punctuation (’ “ ” …). Where the canvas shows sample data (`8 picks at 6 spots`, `updated 2 days ago`, names), render real data. Copy not on the canvas is pinned in the task that uses it and listed under Decisions for Josie.

## Review Focus

1. **Privacy and blocks on a link.** A private member's active list opens for anyone with the link and names them, but never appears in Search, and its rows don't open picks for people they haven't approved. A blocked person (either direction) sees `This list isn’t available.`, exactly like a missing list. Personal tags never appear on a row, even on a list filtered by one. A turned-off link is unavailable to everyone but its owner. Pinned in Task 3 (pgTAP) and Task 6 (screen).
2. **Live means live.** Removing a pick, demoting a Final Meal, adding a newly tagged pick or retagging one changes the next view of every list it affects (counts, rows, map, preview image) with nothing cached on the web. Pinned in Task 3 (pgTAP, integration) and Task 8 (e2e across a change).
3. **Odd titles and slugs.** An emoji-only title, an 80-character title, accents (`Crème brûlée`), apostrophes (`Josie’s`), two people sharing `Josie’s Vancouver`, a rename (the link must not change), and a mixed-case URL (`/l/Josies-Vancouver`) all behave, and the app's slug preview matches the server's. Pinned in Tasks 1 and 2 (the same case table on both sides).
4. **Hostile input.** A hand-made filter (unknown keys, wrong types, 10 000 ids, someone else's personal tag, a food-type id used as dietary), a 500-character or `%00` slug, a `next` parameter pointing off-site in `/join`, and `<script>` in a title or note (HTML and preview image) are refused or rendered as text. Pinned in Tasks 2, 7 and 8.
5. **The backend or the map is down.** `/l/<slug>` answers within 3 seconds with `Can’t reach the kitchen right now.` (never the 404 page, and marked `noindex`); the preview image falls back to the brand card; when tiles or WebGL fail the list still works and the map says `The map didn’t load.`; in the app the list shows the friendly copy and `Try again`. Pinned in Tasks 6 and 7.

---

### Task 1: List filters, slugs, titles and links in `@finalmeal/core`

**Files:**
- Create: `packages/core/src/lists.ts` (+ `lists.test.ts`), `packages/core/src/links.ts` (+ `links.test.ts`), `packages/core/src/list-cases.ts` (the shared case table; imported by tests directly, not exported from `index.ts`)
- Modify: `packages/core/src/index.ts` (export `lists` and `links`), `packages/core/src/validation.ts` and `validation.test.ts` (remove `PLACEHOLDER_LINK_DOMAIN`; `LINK_DOMAIN` replaces it), `apps/mobile/src/components/FeedEmpty.tsx` (import `LINK_DOMAIN`; the invite message is unchanged), the spec §4 (`shared_lists.filter`: city keys, normalised form, validated by `parseListFilter`) and §13 item 4 (the one value is `LINK_DOMAIN`; local stacks use `http://localhost:3000`)

**Interfaces:**
- **Produces (`lists.ts`):**
  - `type ListScope = 'final_five' | 'everything' | 'custom'`; `type ListTier = 'final' | 'honorable'`
  - `interface ListFilter { scope: ListScope; cities?: string[]; food_type_tag_ids?: string[]; dietary_tag_ids?: string[]; personal_tag_ids?: string[]; tiers?: ListTier[] }` (snake_case: it is stored as is)
  - `LIST_FILTER_MAX_ENTRIES = 20`
  - `parseListFilter(input: unknown): { ok: true; filter: ListFilter } | { ok: false; reason: string }` — validates and returns the **normal form**:
    - an object with `scope` and only the six known keys; `scope` one of the three
    - `cities`: strings in `cityKey` form (`name|region|country`: exactly two `|`, name non-empty, 1–200 characters); tag arrays: lower-cased UUIDs; `tiers`: `final` / `honorable`
    - each array: at most 20 entries, de-duplicated, sorted by code point; empty arrays dropped; `tiers` with both values dropped
    - `final_five` and `everything` with any remaining key: not ok
    - `custom` with no remaining key: becomes `{ scope: 'everything' }`
  - `listFiltersEqual(a: ListFilter, b: ListFilter): boolean` (compares normal forms)
  - `interface ListPickLike extends PickLike { tier: ListTier; tags: ReadonlyArray<{ id: string; kind: TagKind; slug: string; name: string }> }`
  - `matchesListFilter(pick: ListPickLike, filter: ListFilter): boolean` (the Global Constraints rule; `final_five` = `tier === 'final'`)
  - `filterForChip(chip: ChipOption, picks: readonly ListPickLike[]): ListFilter` — a city chip gives `{ scope: 'custom', cities: [value] }`; a tag chip finds the tag's id in `picks` and puts it in the array for its kind
  - `encodeListFilter(f: ListFilter): string` / `decodeListFilter(s: string): ListFilter | null` (JSON of the normal form for route params; decode runs `parseListFilter`)
  - `slugifyListTitle(title: string): string`:
    - NFKD, strip combining marks, lower-case; remove `'` and `’` entirely; every other run of characters outside `[a-z0-9]` becomes `-`; trim `-`
    - longer than 50: cut at the last `-` at or before 50 (or at 50 when there is none), trim `-`
    - shorter than 3: `list`
  - `firstName(displayName: string, username: string): string` (first word of the display name, else the username)
  - `defaultListTitle(first: string, filter: ListFilter, labels: { city?: string; tags?: string[] }): string`:
    - `final_five` → `Josie’s Final Meal`; `everything` → `Josie’s picks`
    - one city and nothing else → `Josie’s Vancouver`; one tag and nothing else → `Josie’s Sushi` (food type, dietary or personal)
    - one city and one or two tags → `Vegan in Tokyo` / `Vegan & Gluten-free in Tokyo`; anything else → `Josie’s list`
  - `listCountsLabel(picks: number, spots: number): string` → `8 picks at 6 spots` / `1 pick at 1 spot` (the same wording as `summarizeGroups`)
  - `tierBreakdown(finals: number, honorables: number): string` → `1 Final Meal · 7 Honorable`, zero parts left out (`2 Final Meals`)
  - `everythingLabel(picks: readonly PickLike[]): string` → `17 picks · 7 cities` / `1 pick · 1 city` (cities by `cityKey`)
  - `updatedAgo(iso: string, now: Date): string` → `updated just now` (< 1 min), `updated 5 minutes ago` / `updated 1 minute ago`, `updated 3 hours ago`, `updated yesterday` (< 2 days), `updated 2 days ago` (< 30 days), else `updated on 3 Nov` (the `relativeTime` month names)
  - `listOwnerLine(username: string, picks: number): string` → `@josiehamilton · 2 picks` / `· 1 pick`
  - `joinsAutomatically(filter: ListFilter, labels: { city?: string; tag?: string }): string` → `New Vancouver picks join automatically.` (one city only), `New Sushi picks join automatically.` (one tag only), `New picks join automatically.` (`everything`), `Swap a dish and the list changes too.` (`final_five`), else `New picks that match join automatically.`
- **Produces (`links.ts`):**
  - `LINK_DOMAIN = 'finalmeal.example'` (the one value to change when Josie buys a domain)
  - `linkOrigin(override?: string | null): string` → the override without a trailing `/` when it is an `http:` or `https:` URL, else `https://finalmeal.example`
  - `listUrl(origin: string, slug: string): string` → `<origin>/l/<slug>`
  - `displayLink(url: string): string` → the URL without its scheme (`finalmeal.example/l/josies-vancouver`)
  - `LIST_PATH_PATTERN = /^\/l\/([a-z0-9-]{3,60})$/i`; `slugFromPath(path: string): string | null`
- **`list-cases.ts`:** `export const SLUG_CASES: Array<[title: string, slug: string]>` and `export const FILTER_CASES: Array<{ name: string; input: unknown; normal: ListFilter | null }>` — Task 2's pgTAP repeats the same rows (copy them into the SQL test by hand; a comment in each file points at the other).

- [ ] **Step 1: Write the failing tests.**
  - `SLUG_CASES` (each asserted with `slugifyListTitle`): `Josie’s Vancouver` → `josies-vancouver`; `Sushi, around the world` → `sushi-around-the-world`; `Crème brûlée` → `creme-brulee`; `🍜` → `list`; `ab` → `list`; `  Late   night!! ` → `late-night`; `Mike's NYC` → `mikes-nyc`; an 80-character title of words → ≤ 50 characters ending on a whole word; `----` → `list`
  - `FILTER_CASES` (each asserted with `parseListFilter`): `{scope:'everything'}` stays; `{scope:'custom',cities:['Vancouver|BC|CA','Vancouver|BC|CA'],tiers:['honorable','final']}` → `{scope:'custom',cities:['Vancouver|BC|CA']}`; `{scope:'custom'}` → `{scope:'everything'}`; `{scope:'custom',tiers:['honorable']}` stays; upper-case UUIDs lower-cased and sorted; not ok for: a missing scope, `scope:'all'`, an unknown key, `cities:['Vancouver']`, a number in an array, 21 entries, `tiers:[]`… (empty is dropped: ok), `tiers:['gold']`, `{scope:'final_five',tiers:['final']}`, `{scope:'everything',cities:[…]}`, an array instead of an object, `null`
  - `matchesListFilter`: the seed-shaped Josie fixtures: Vancouver city filter matches 8 of 17; `{food:[noodles], dietary:[vegan]}` matches only Vegan Dan Dan Noodles; `{food:[sushi, noodles]}` matches 7; `final_five` matches the 4 Finals; a personal tag id matches only picks with it
  - `filterForChip` for a city chip and a `Sushi` chip; `defaultListTitle` for every row above, with `’`; `encodeListFilter` / `decodeListFilter` round-trip and `decodeListFilter('{"scope":"x"}') === null`
  - `listCountsLabel(1, 1)`, `tierBreakdown(1, 7)`, `tierBreakdown(2, 0) === '2 Final Meals'`, `everythingLabel` on the fixtures `=== '17 picks · 7 cities'`, every `updatedAgo` band, `listOwnerLine('josiehamilton', 1)`, every `joinsAutomatically` branch
  - `linkOrigin()` / `linkOrigin('http://localhost:3000/')` / `linkOrigin('javascript:alert(1)')`; `listUrl`; `displayLink`; `slugFromPath('/l/Josies-Vancouver') === 'Josies-Vancouver'` and `slugFromPath('/l/../x') === null`
  - `validation.test.ts`: `LINK_DOMAIN === 'finalmeal.example'` replaces the old constant's test; FeedEmpty's test still sees the same invite message
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/core test`. Expected: FAIL (missing modules).
- [ ] **Step 3: Implement** the two modules and the case table, the rename, and the spec lines.
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/core test && pnpm --filter @finalmeal/mobile test -- FeedEmpty && pnpm lint && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `Add the shared list filter, slug, title and link rules to core`

### Task 2: Shared lists: writes, slugs, evaluation and locked-down access (database + API)

**Files:**
- Create: migration `supabase/migrations/20261126090000_shared_lists_writes.sql`, `supabase/tests/database/shared_lists.test.sql`, `packages/api/src/lists.ts` (+ `lists.test.ts`), `packages/api/src/lists.integration.test.ts`
- Modify: `supabase/seed.sql` (lists below), `supabase/tests/database/seed.test.sql` and `rls.test.sql` (new list count, new policies), `packages/api/src/errors.ts` and `friendly.ts` (+ tests), `packages/api/src/index.ts`, `packages/api/src/database.types.ts` (regenerate), `docs/ops/supabase.md` (Functions, Row-level security, a new "Shared lists" section), the spec §4 (`shared_lists` rules: written and read only through functions; slug rules) and §5.3

**Interfaces:**
- **Consumes:** Task 1's normal form and slug rules (mirrored in SQL).
- **SQL (all `security definer`, `set search_path = ''`):**
  - `public._normalize_list_filter(p jsonb) returns jsonb` — `immutable`; the `parseListFilter` normal form, or **null** when invalid (no ownership checks: those need tables). Internal (no client execute).
  - `public._list_slug_base(p_title text) returns text` — `immutable`; the `slugifyListTitle` rules, with accents removed through `extensions.unaccent` as `normalize_dish_name` does. Internal.
  - Table changes: `alter table public.shared_lists add constraint shared_lists_filter_normal check (public._normalize_list_filter(filter) is not distinct from filter)`; index `shared_lists_owner_created on (owner_id, created_at desc)`.
  - `public._list_pick_ids(p_owner uuid, p_filter jsonb) returns setof uuid` — `stable`; the owner's picks matching the filter (Global Constraints). City match: `place.city || '|' || coalesce(place.region, '') || '|' || place.country` (core `cityKey`). Personal tags count only when `tags.owner_id = p_owner`. Internal.
  - `public._list_counts(p_owner uuid, p_filter jsonb) returns table (pick_count integer, place_count integer, final_count integer, honorable_count integer, last_change timestamptz)` — `stable`; `last_change` = the newest `picks.updated_at` among them (null for none). Internal.
  - **The owner row** every owner function returns: `table (id uuid, slug text, title text, note text, filter jsonb, is_active boolean, pick_count integer, place_count integer, final_count integer, updated_at timestamptz, created_at timestamptz)`, where `updated_at = greatest(list.updated_at, last_change)`.
  - `public.share_list(p_filter jsonb, p_title text, p_note text default null)` (`authenticated`) returns the owner row:
    - `not_authenticated` (42501) without a user; `profile_not_found` without a profile
    - `invalid_list_filter` when `_normalize_list_filter` is null, or a tag id in it is not a tag of that kind (`food_type` / `dietary`), or a personal tag id is not the caller's own
    - `invalid_list_title` when the trimmed, whitespace-collapsed title is empty or over 80
    - the note is trimmed and blank becomes null; over 280 is left to the table's check (`23514`, which the API maps to `unknown`), since the app caps the field at 280
    - under one advisory lock per person (`share_list:<uid>`): if the caller has an **active** list with an equal normal filter, update its title (and note when given) and return it (no new row, no rate count)
    - otherwise `list_limit` when the caller made 30 or more lists in the last 24 hours (active or not)
    - slug: `_list_slug_base(title)`; when the owner is private, append `-` + 4 random hex characters; on a clash (any row, any owner, case-insensitive) try `-2` … `-99`, then `-` + 6 random `[a-z0-9]`
  - `public.update_shared_list(p_list_id uuid, p_title text default null, p_note text default null, p_clear_note boolean default false, p_is_active boolean default null)` (`authenticated`) returns the owner row: owner only (anyone else, or a missing id: `list_not_found`); a null argument leaves that field; `p_clear_note` sets the note to null; never changes `slug` or `filter`; title rules as above.
  - `public.get_my_lists()` (`authenticated`, `stable`) returns the owner rows of the caller's lists, newest `created_at` first.
  - **Access:** drop `shared_lists_select`, `shared_lists_insert_own`, `shared_lists_update_own`, `shared_lists_delete_own`; create `shared_lists_select_own` (`authenticated`, `owner_id = auth.uid()`); revoke `insert, update, delete, truncate` on `shared_lists` from `anon` and `authenticated`, and `select` from `anon`.
- **Seed** (inserted directly; each filter already in normal form, which the new check enforces):
  - `josies-vancouver`: filter becomes `{"scope":"custom","cities":["Vancouver|BC|CA"]}` (title and note unchanged)
  - `josies-sushi`: `{"scope":"custom","food_type_tag_ids":[<sushi>]}`
  - new `josies-ramen`, `Ramen in Vancouver`: `{"scope":"custom","cities":["Vancouver|BC|CA"],"food_type_tag_ids":[<ramen>]}`
  - new `priyas-vancouver`, `Priya’s Vancouver`, owner Priya (private): `{"scope":"custom","cities":["Vancouver|BC|CA"]}`
  - new `josies-old-list`, `Josie’s old list`, `{"scope":"everything"}`, `is_active = false`
  - `created_at` spread so `get_my_lists` order is fixed (Vancouver newest, then sushi, ramen, old list)
- **API (`packages/api/src/lists.ts`):**
  - `interface OwnedList { id: string; slug: string; title: string; note: string | null; filter: ListFilter; isActive: boolean; pickCount: number; placeCount: number; finalCount: number; updatedAt: string; createdAt: string }`
  - `shareList(client, input: { filter: ListFilter; title: string; note?: string | null }): Promise<OwnedList>`
  - `updateSharedList(client, id: string, patch: { title?: string; note?: string | null; isActive?: boolean }): Promise<OwnedList>` (`note: null` sends `p_clear_note: true`)
  - `getMyLists(client): Promise<OwnedList[]>` (GET rpc, `.retry(false)`)
  - a row whose `filter` fails `parseListFilter` throws `ApiError('invalid_list_filter')` (never reached with the check constraint; it keeps the type honest)
  - `FriendlyCode` gains `list_not_found` (`This list isn’t available.`), `list_limit` (`You’ve made a lot of lists today. Try again tomorrow.`), `invalid_list_title` (`Give the list a name (up to 80 characters).`) and `invalid_list_filter` (the `unknown` copy)

- [ ] **Step 1: Write the failing tests.**
  - **`shared_lists.test.sql`:**
    - every `FILTER_CASES` and `SLUG_CASES` row from Task 1 through `_normalize_list_filter` / `_list_slug_base` (same expected values)
    - as Josie, `share_list('{"scope":"custom","cities":["Vancouver|BC|CA"],"tiers":["honorable","final"]}', 'Josie’s Vancouver')` returns the seeded `josies-vancouver` (same id, 8 picks, 6 places, 1 final) and adds no row
    - as Josie, `share_list('{"scope":"everything"}', 'Josie’s picks')` → slug `josies-picks`, 17 / 14 / 4; then `('{"scope":"custom","tiers":["honorable"]}', 'Josie’s picks')` → `josies-picks-2`
    - as Mike, `share_list(<Vancouver>, 'Josie’s Vancouver')` → `josies-vancouver-2`
    - as Priya, `share_list('{"scope":"everything"}', 'Priya’s picks')` → slug matching `^priyas-picks-[0-9a-f]{4}$`
    - title `🍜` → slug `list` (then `list-2`); an 81-character title and a blank title raise `invalid_list_title`
    - as Mike, a filter with Josie's personal tag `late-night` raises `invalid_list_filter`; so does a food-type id passed in `dietary_tag_ids`, an unknown key, and 21 cities
    - after 30 new lists for a fresh user in one transaction, the 31st raises `list_limit`; a reused filter still works
    - `update_shared_list` as Josie renames `josies-vancouver` and its slug is unchanged; `p_is_active => false` then `true`; `p_clear_note => true` clears the note; as Mike on Josie's list, `list_not_found`
    - `get_my_lists()` as Josie: `josies-vancouver`, `josies-sushi` (4 picks, 4 places), `josies-ramen` (1, 1), `josies-old-list` (inactive, 17, 14), in that order; `updated_at` moves forward after `update_pick` on Khao Soi
    - as `authenticated`: `insert into shared_lists` and `update shared_lists` fail with 42501; `select` sees only the caller's rows; as `anon`: `select` fails or sees nothing; `anon` cannot execute `share_list`, `update_shared_list`, `get_my_lists`; nobody can execute the `_` helpers
    - a direct insert with `filter = '{"scope":"custom"}'` (not normal) violates `shared_lists_filter_normal`
  - **`lists.test.ts` (unit):** `shareList` sends `p_filter`, `p_title`, `p_note`; `updateSharedList(id, { note: null })` sends `p_clear_note: true` and no `p_note`; a row maps to `OwnedList` with camel-case fields; the four new friendly codes and their copy
  - **`lists.integration.test.ts`:** a fresh Vancouver user adds two picks (one tagged Noodles), `shareList` with their city filter gives 2 picks; sharing it again returns the same id; `getMyLists` has it; `updateSharedList` renames it; a second fresh user can't update it (`list_not_found`)
- [ ] **Step 2: Run the tests.** `pnpm db:reset </dev/null && pnpm db:test`; `pnpm --filter @finalmeal/api test`; `pnpm env:local && pnpm --filter @finalmeal/api test:integration -- lists`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration, seed, API module and the doc and spec lines; regenerate the types.
- [ ] **Step 4: Run the tests again,** plus `pnpm lint && pnpm typecheck` (the apps compile against the new types). Expected: PASS, every pgTAP suite. Run `pnpm db:reset </dev/null` afterwards.
- [ ] **Step 5: Commit.** `Write shared lists only through functions, with readable slugs and live counts`

### Task 3: Reading shared lists: the list, its picks, search, Save all and Activity (database + API)

**Files:**
- Create: migration `supabase/migrations/20261126100000_shared_lists_reads.sql`, `supabase/tests/database/shared_list_reads.test.sql`
- Modify: `supabase/tests/database/notifications.test.sql` (the new column), `packages/api/src/lists.ts` (+ tests), `packages/api/src/lists.integration.test.ts`, `packages/api/src/notifications.ts` (+ test), `packages/api/src/index.ts`, `packages/api/src/database.types.ts`, `docs/ops/supabase.md`, the spec §5.3 (live, privacy, Save all) and §5.4 Search (shared lists are in Discover search)

**Interfaces:**
- **Consumes:** `_list_pick_ids`, `_list_counts` (Task 2); `_can_see`, `_is_blocked`, `_blocked_with`, `mask_place`, `_pick_tags_json` (Phases 3–5).
- **SQL:**
  - `public._visible_list(p_viewer uuid, p_slug text) returns public.shared_lists` — `stable`; the list by slug (case-insensitive) when the viewer may see it (Global Constraints), else raises `list_not_found`. Internal.
  - `public.get_shared_list(p_slug text)` (`anon`, `authenticated`, `stable`) returns `table (id uuid, slug text, title text, note text, filter jsonb, is_active boolean, updated_at timestamptz, owner_id uuid, owner_username text, owner_display_name text, owner_avatar_path text, owner_is_private boolean, pick_count integer, place_count integer, final_count integer, honorable_count integer, viewer_is_owner boolean, viewer_follow_state text)`:
    - `filter` only for the owner (null otherwise); `viewer_follow_state` `none` / `requested` / `active`, null for `anon` and for the owner
    - `updated_at` as in Task 2
  - `public.get_shared_list_picks(p_slug text)` (`anon`, `authenticated`, `stable`) returns `table (pick_id uuid, tier public.pick_tier, slot smallint, note text, photo_path text, original_dish_name text, created_at timestamptz, dish_id uuid, dish_name text, place jsonb, tags jsonb, can_open boolean, saved boolean)`:
    - the same `list_not_found` rule; rows in the Global Constraints order; at most 500
    - `note` always null; `tags` global only (`_pick_tags_json` without personal tags); `place` through `mask_place`
    - `can_open = _can_see(viewer, owner)` (false for `anon` on a private owner, true for `anon` on a public one); `saved` = the viewer has saved the dish (false for `anon`)
  - `public.search_shared_lists(p_q text, p_limit integer default 20)` (`authenticated`, `stable`) returns `table (slug text, title text, owner_id uuid, owner_username text, pick_count integer)`:
    - eligibility in Global Constraints ("Search"); a blank query returns nothing
    - match on `normalize_dish_name(title)` against `normalize_dish_name(p_q)`: starts with, then a word starts with, then trigram (`%`)
    - order: match tier, `pick_count desc`, title; at most 20 (cap `p_limit`); evaluate counts only for the first 200 title matches
  - `public.save_list(p_slug text) returns integer` (`authenticated`):
    - `list_not_found` as above; the owner gets 0
    - one advisory lock per person (`save_dish:<uid>`, the same key as `save_dish`, so the two can't race)
    - saves every listed dish the caller has not saved, each with `via_pick_id` = the owner's pick and `via_user_id` = the owner (no `saved_pick` activities); when at least one was saved, one `saved_from_list` activity (`actor_id` = caller, `list_id`); returns how many were saved
  - `public.get_my_notifications`: `drop function` and recreate with the same body and grants, adding `list_slug text` (from the existing `shared_lists` join) as the last column.
- **API (`lists.ts`, `notifications.ts`):**
  - `interface SharedListView { id: string; slug: string; title: string; note: string | null; isActive: boolean; updatedAt: string; owner: PersonSummary & { isPrivate: boolean }; pickCount: number; placeCount: number; finalCount: number; honorableCount: number; viewerIsOwner: boolean; followState: FollowState | null; filter: ListFilter | null }`
  - `type SharedListPick = Pick & { canOpen: boolean; saved: boolean }` (built with `toPickFromColumns`)
  - `getSharedList(client, slug: string): Promise<{ list: SharedListView; picks: SharedListPick[] } | null>` — both rpcs in parallel (GET, `.retry(false)`); `list_not_found` resolves `null`; other errors throw
  - `interface SharedListHit { slug: string; title: string; ownerId: string; ownerUsername: string; pickCount: number }`; `searchSharedLists(client, q: string, limit = 20): Promise<SharedListHit[]>` (blank resolves `[]` without a call)
  - `saveList(client, slug: string): Promise<number>`
  - `ActivityItem.listSlug: string | null`

- [ ] **Step 1: Write the failing tests.**
  - **`shared_list_reads.test.sql`** (seed):
    - as `anon`, `get_shared_list('josies-vancouver')`: title `Josie’s Vancouver`, note `Kin Kao first. Trust me.`, owner `josiehamilton`, 8 / 6 / 1 / 7, `filter` null, follow state null; `get_shared_list('JOSIES-VANCOUVER')` finds it too
    - as `anon`, `get_shared_list_picks('josies-vancouver')`: 8 rows, the first Pork Gyro (`final`, slot 1, Skewers), then Tonkotsu Ramen and Pork Gyoza (Marutama); every `note` null; Pork Gyro's tags contain `greek` but not `late-night`; `saved` all false
    - as `anon` and as Mike, `priyas-vancouver` opens (owner `priyashah`, `owner_is_private`, 2 picks) and every `can_open` is false; after Priya approves a follow from Mike, Mike's rows are `can_open`
    - `josies-old-list` raises `list_not_found` for `anon` and Mike; as Josie it returns `is_active = false` with its picks; `no-such-list` raises `list_not_found`
    - Josie blocks Ari: as Ari, both functions raise `list_not_found`; Ari blocks Mike: as Mike, Ari's lists (make one in the test) raise it too
    - **live:** as Josie, `remove_pick(<Khao Soi>)` → `josies-vancouver` has 7 picks at 6 spots; `demote_pick(<Pork Gyro>)` → a `final_five` list Josie shares has 3 picks and `josies-vancouver` has `final_count = 0`; tagging Pork Gyoza `ramen` through `update_pick` adds it to `josies-ramen`
    - as Mike, `get_shared_list`'s `viewer_follow_state` for Josie's list is `active`; as Sam for Priya's, `requested`
    - `search_shared_lists('vancouver')` as Mike: `josies-vancouver` and `josies-ramen`, never `priyas-vancouver` or `josies-old-list`; `('ramen')` starts with `josies-ramen`; blank returns nothing; a list by a fresh `new` account is found by itself and by someone who follows it, not by Mike; Josie blocks Mike: Mike finds none of Josie's lists; `anon` can't execute it
    - `save_list('josies-vancouver')` as Mike returns 7 (he already saved Pork Gyro), writes one `saved_from_list` activity and a notification for Josie; again returns 0 with no new activity; as Josie returns 0; Ari (blocked) gets `list_not_found`
    - `get_my_notifications()` as Josie: the seeded `saved_from_list` row has `list_slug = 'josies-vancouver'`
  - **`lists.test.ts` (unit):** the two rows map to `SharedListView` and `SharedListPick` (avatar and photo URLs, `isPrivate`, `canOpen`, `saved`); `getSharedList` resolves `null` on `list_not_found` and rethrows `network`; `searchSharedLists('  ')` makes no call; `listSlug` maps in `notifications.test.ts`
  - **Integration:** with a fresh owner's shared list, an `anon` client (no session) `getSharedList` sees the right counts; the owner adds a pick and the next `getSharedList` has it; removes one and it's gone; a second fresh user `saveList` saves them and `getMySaves` shows them; `searchSharedLists('<the title>')` by a follower finds it
- [ ] **Step 2: Run the tests.** Same commands as Task 2 (`-- lists`). Expected: FAIL.
- [ ] **Step 3: Implement**, regenerate the types, add the doc and spec lines.
- [ ] **Step 4: Run the tests again,** plus `pnpm --filter @finalmeal/api test:integration -- social` (notifications) and `pnpm lint && pnpm typecheck`. Expected: PASS. Run `pnpm db:reset </dev/null` afterwards.
- [ ] **Step 5: Commit.** `Read shared lists live for anyone with the link, search them and save them all`

### Task 4: The Share hub and Share a list (app), and the profile share controls

**Files:**
- Create: `apps/mobile/app/(app)/share/index.tsx` (ShareHub), `apps/mobile/app/(app)/share/list.tsx` (ShareList), `apps/mobile/src/lib/link-origin.ts` (+ test), `apps/mobile/src/state/share-list.ts` (`useShareList`, + test), and in `apps/mobile/src/components/`: `ShareOptionCard.tsx`, `ShareOptionChip.tsx`, `LivePill.tsx`, `LinkRow.tsx`, `RestaurantGroup.tsx`, `TierToggles.tsx` (+ tests); `apps/mobile/src/screens/share.test.tsx`
- Modify: `apps/mobile/package.json` (via `expo install expo-clipboard`), `apps/mobile/jest.setup.js` (mock `expo-clipboard`), `apps/mobile/app/(app)/(tabs)/you.tsx` (header share icon, `Share a list`, `Share these`), `apps/mobile/src/components/ProfileHeader.tsx` (an `onShare` prop: the `Share a list` button beside `Edit profile`, and the header icon), `apps/mobile/src/components/ProfileMapPanel.tsx` (an optional `onShareThese` that adds `Share these` to its summary row), `apps/mobile/src/screens/you.test.tsx` (replace "never shows Share a list or Share these before Phase 6"), `scripts/write-local-env.mjs` (adds `EXPO_PUBLIC_LINK_ORIGIN=http://localhost:3000` to `apps/mobile/.env.local` and `NEXT_PUBLIC_LINK_ORIGIN=http://localhost:3000` to `apps/web/.env.local`), `apps/mobile/.env.example` and `apps/web/.env.example` (the same names, commented), `docs/known-gaps.md` (remove "Share a list on You (Phase 6)" from "Hidden until their phase")

**Interfaces and copy** (boards ShareHub, ShareList, Profile, ProfileHM, ProfileMap):
- **Consumes:** Task 1 (`parseListFilter`, `filterForChip`, `encodeListFilter`/`decodeListFilter`, `matchesListFilter`, `slugifyListTitle`, `defaultListTitle`, `firstName`, `everythingLabel`, `listCountsLabel`, `joinsAutomatically`, `linkOrigin`, `listUrl`, `displayLink`), Task 2 (`shareList`, `getMyLists`, `OwnedList`), `getMyPicks`, `chipOptions`, `groupPicksByPlace`, `sortPicks`, `cityKey`.
- **Produces:** `RestaurantGroup` and `LivePill` (Tasks 5 and 6 use them), `useShareList`, `appLinkOrigin()`.
- **`link-origin.ts`:** `appLinkOrigin(): string` = `linkOrigin(process.env.EXPO_PUBLIC_LINK_ORIGIN)` with, on Android, `localhost`/`127.0.0.1` replaced by `10.0.2.2` (generalise `resolveSupabaseUrl`'s rule into `resolveLocalUrl(url)` in `src/lib/supabase.ts` and use it for both).
- **`RestaurantGroup({ place, picks, mode: 'check' | 'view' | 'save', onOpenPick?, renderSave?, onDirections? })`** (the board's `rgroup`): head = a 40 px radius-12 `ashRaised` tile with the pin icon (`emberGlow`), the name (16 px, weight 800), `<area or address> · <city>` (12 px `smoke`) plus ` · <n> dishes` in bold `bone` when there are 2+; on the right a check tile (`check`), a chevron (`view`) or a 36 px round outline directions button (aria `Directions to <name>`; `save`). Dishes are indented 19 + 32 px behind a 1 px `lineStrong` rule: a 42 px radius-10 photo or placeholder, the dish (Newsreader 18), the mark (`Final Meal #<slot>` with an 11 px skull in `emberGlow`, or `Honorable` in `bone`, both 11 px bold uppercase, 0.06em) and global tag chips (`TagChips`; hidden in `check` mode); in `save` mode a 36 px round outline bookmark from `renderSave`.
- **`LivePill`:** 24 px tall, `emberWash` fill, `emberGlow` 11 px weight-800 uppercase `Live` after a 6 px dot.
- **ShareHub (`/share`):**
  - `ScreenHeader` title `Share`, back
  - `What are you sharing?` (Newsreader italic 300, 34 px) and `Send a link to the list that fits. Links stay live, so new picks show up for whoever has it.` (14 px `smoke`)
  - two `ShareOptionCard`s in a 2-column grid (`ash`, radius 18, `line` border, padding 16): the skull, `Final Meal`, `Your five`; the list icon, `Everything`, `everythingLabel(picks)`
  - sections `By city`, `By food type`, `By tag` (label style; `See all` on the right, 13 px bold `emberGlow`, opens `/lists`), each a wrap of `ShareOptionChip`s (42 px, radius 12, `ash`, `line` border, name 14 px semibold and the count in `emberGlow` weight 800): the top 3 cities, the top 4 food types, or the top 3 tags (dietary and personal together) by count then name, then `+<n> more` (no count; opens `/lists`) when there are more; a section with no options is hidden
  - the dashed row `Build a custom list` / `Mix a city, food type and tags, e.g. vegan in Tokyo` (sliders icon, chevron) opens `/share/list` in custom mode
  - `Final Meal` opens `/share/list` with `{scope:'final_five'}` (no image card: story images are not in the MVP); `Everything` with `{scope:'everything'}`; a chip with `filterForChip(chip, picks)`
  - **No picks:** the header and title stay; instead of the options, `Add a dish first, then share it.` (15 px `smoke`) and the `Add a dish` button (opens the Add flow)
- **ShareList (`/share/list`)** with params `f` (an encoded filter) or `mode=custom`:
  - `ScreenHeader` title `Share a list`, back
  - `List name` (11 px bold uppercase label) over an underlined input (Newsreader italic 300, 30 px; max 80), prefilled with the existing list's title when `getMyLists` has an active list with an equal filter, else `defaultListTitle`; while the person hasn't typed, the default follows filter changes
  - the meta line (13 px `smoke`): for a one-city filter the pin icon and `<city label> · <listCountsLabel>` (city label = `city, region`, as the board's `Vancouver, BC`), otherwise `<listCountsLabel>`
  - **chips** (horizontal): `TierToggles` (`Final Meal`, `Honorable`, both on; at least one stays on; hidden for `final_five`), then up to 6 global or personal tag chips from the matching picks (ember-wash selected style, as `AddDishTags`); a chip narrows the filter (any-of within a kind) and turns it into `custom`
  - **custom mode:** above the chips, chip groups `Cities`, `Food types`, `Dietary`, `Your tags` (each the person's own options from `chipOptions`, label style headers), all-optional; the preview follows
  - the preview: the first 3 `RestaurantGroup`s (`check` mode) of the matching picks (`matchesListFilter`, `sortPicks`, `groupPicksByPlace`), then `+ <remaining place names>. <joinsAutomatically(…)>` (13 px `dim`; when more than 5 remain, the first 4 and ` and <n> more`; without remaining places, just the sentence). No matches: `No picks match yet. New ones join automatically.`
  - the footer (padding 14/20/34): `LinkRow` (12 radius, `ash`, `line` border: `LivePill`, then `displayLink(url)` 13 px `smoke`, one line) where `url` is the existing list's link, or until a list exists the preview `listUrl(appLinkOrigin(), slugifyListTitle(title))`; then `Copy link` (ghost, link icon) and `Send` (ember, share icon), side by side. No `Link` / `Story image` toggle.
  - `Copy link` and `Send` call `useShareList().share(title, filter)` (= `shareList`), then: Copy writes the returned link with `Clipboard.setStringAsync` and the button reads `Copied` for 2 seconds; Send opens `Share.share({ message: '<title> on Final Meal: <url>', url })`. The link row then shows the real link (a private owner's ends in its random part).
  - errors (`list_limit`, `invalid_list_title`, network) show under the buttons as friendly copy; the buttons stay usable
- **Profile controls:**
  - You header: the share icon (aria `Share`) at the top right opens `/share`
  - beside `Edit profile` (ghost, flex 1), `Share a list` (ember, share icon, flex 1, 40 px) opens `/share`
  - `Share these` (13 px bold `emberGlow`, share icon) at the right of the filter summary row whenever a chip is selected, on Honorable and Final Meal (summary row) and on Map (`ProfileMapPanel`'s row), opens `/share/list?f=<filterForChip(chip, picks)>`
  - other people's profiles: no Share (Global Constraints)

- [ ] **Step 1: Write the failing tests:**
  - ShareHub with the seed-shaped Josie fixture: `What are you sharing?`, `Your five`, `17 picks · 7 cities`; `By city` chips `Vancouver 8`, `Tokyo 3`, `New York 2`, `+4 more`; `By food type` `Sushi 4`, `Noodles 3`, …; `By tag` `Gluten-free 6`, …; `See all` and `+4 more` open `/lists`; `Final Meal` opens `/share/list` with `final_five`; with no picks, `Add a dish first, then share it.`
  - ShareList for Vancouver: title `Josie’s Vancouver`, `Vancouver, BC · 8 picks at 6 spots`, three groups `Skewers`, `Marutama` (`2 dishes`), `Kin Kao`, then `+ Miku, Lotus Noodle Bar, Hearth Bakery. New Vancouver picks join automatically.`; the link row `finalmeal.example/l/josies-vancouver`; turning off `Final Meal` leaves 7 picks and `Honorable` can't be turned off too; choosing `Vegan` shows 1 pick
  - with an existing equal list from `getMyLists`, its title and link are used
  - `Copy link` calls `shareList` with the normal filter and the typed title, copies `https://finalmeal.example/l/josies-vancouver` and shows `Copied`; `Send` opens `Share.share` with `Josie’s Vancouver on Final Meal: https://finalmeal.example/l/josies-vancouver`; `list_limit` shows `You’ve made a lot of lists today. Try again tomorrow.`
  - custom mode: choosing `Tokyo` and `Vegan` sets the title `Vegan in Tokyo` until the person types; typing keeps their title
  - `appLinkOrigin()` with the env set, unset, and on Android (`10.0.2.2`)
  - You: the header icon and `Share a list` open `/share`; a `Sushi` chip shows `Share these` on all three tabs and it opens `/share/list` with the Sushi filter; no chip, no `Share these`
  - `RestaurantGroup` in each mode; `LivePill` reads `Live`
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement** (install `expo-clipboard` with `expo install`; update `write-local-env.mjs` and the examples).
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && node --test scripts/*.test.mjs && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Add the Share hub and Share a list, with live links you can copy or send`

### Task 5: Your lists, Your list, and managing your links (app)

**Files:**
- Create: `apps/mobile/app/(app)/lists/index.tsx` (MyLists), `apps/mobile/app/(app)/lists/view.tsx` (MyList), `apps/mobile/app/(app)/lists/[id]/edit.tsx`, and in `apps/mobile/src/components/`: `AutoListCard.tsx`, `SharedLinkRow.tsx`, `ViewToggle.tsx` (+ tests); `apps/mobile/src/screens/lists.test.tsx`
- Modify: none outside these (ShareHub's `See all` already routes here)

**Interfaces and copy** (boards MyLists, MyList; the Shared links section and the edit screen have no board):
- **Consumes:** Task 4 (`RestaurantGroup`, `LivePill`, `TierToggles`, `appLinkOrigin`), Task 2 (`getMyLists`, `updateSharedList`, `OwnedList`), Task 1 helpers, `ProfileMapPanel`, `getMyPicks`, `chipOptions`.
- **Produces:** `ViewToggle({ value: 'list' | 'map'; onChange })` (Task 6 uses it): a 4 px-padded `ash` pill with `line` border, two 38 px halves `List` (list icon) and `Map` (map icon), the selected half `ashRaised` with `bone` text, the other `smoke`; `accessibilityRole="tab"`, selected state.
- **Your lists (`/lists`):**
  - `ScreenHeader` `Your lists`, back
  - `Built automatically from your picks and tags. Open any list, or share it as a live link.` (14 px `smoke`)
  - **`Shared links`** (new section, first, hidden when there are none): `SharedLinkRow`s from `getMyLists()` in the DiscoverSearch list-row style: a 40 px radius-12 `ashRaised` tile with the list icon in `emberGlow`, the title (15 px bold), `<n> picks · Live` or `<n> picks · Link off` (13 px `smoke`), a chevron; it opens `/l/<slug>`
  - sections `Cities`, `Food types`, `Tags` (dietary and personal), each a 2-column grid of `AutoListCard`s from `chipOptions(myPicks)`: up to 3 overlapping 30 px radius-8 photos (−10 px overlap, 2 px `ash` ring; a placeholder tile without a photo), the name (Newsreader 21), `<n> picks · <sub>` (12 px `smoke`) with `sub` = `<m> spots` for a city, `<k> cities` or the single city's name for a food type or dietary tag, `Your tag` for a personal tag; then `Share` (12 px bold `emberGlow`, share icon) opening `/share/list?f=…`. The card opens `/lists/view?f=<filterForChip>&title=<chip label>`.
  - no picks and no links: `Your lists fill in as you add dishes.`
- **Your list (`/lists/view`):** params `f`, `title`
  - header: back; right, the share icon (aria `Share this list`) opening `/share/list?f=<current filter>`
  - `Your list` (label), the title (Newsreader italic 300, 40 px), `<listCountsLabel> · <tierBreakdown>` (13 px `smoke`)
  - `ViewToggle`; chips: `TierToggles` and up to 3 tag chips narrowing the view (as ShareList)
  - **List:** `RestaurantGroup`s (`view` mode); a dish opens `/pick/<id>`
  - **Map:** `ProfileMapPanel` with the filtered picks (`chipLabel` = the title, `emptyText` = `No picks on the map yet.`)
  - footer: `Share this list` (ember, share icon) → `/share/list?f=<current filter>`
- **Edit a link (`/lists/[id]/edit`):** opened from the shared-list screen (Task 6)
  - `ScreenHeader` `Edit list`, back
  - `List name` (as ShareList, max 80), `Note` (multi-line `TextField`, max 280, placeholder `Add a note (optional)`, a counter at 240+)
  - `ToggleRow` `Link on` with the sub `Anyone with the link can see this list.` (on) / `The link shows “This list isn’t available.”` (off)
  - the link itself, read-only (`LinkRow` with `LivePill` only when on)
  - `Save` (ember) calls `updateSharedList` with what changed and goes back; errors as friendly copy under it

- [ ] **Step 1: Write the failing tests:**
  - Your lists with the Josie fixture and three `OwnedList`s: `Shared links` lists `Josie’s Vancouver` with `8 picks · Live` and `Josie’s old list` with `17 picks · Link off`; tapping one opens `/l/josies-vancouver`
  - the Cities cards `Vancouver` (`8 picks · 6 spots`) and `Tokyo` (`3 picks · 2 spots`), Food types `Sushi` (`4 picks · 3 cities`) and `Noodles` (`3 picks · Vancouver`), Tags `Gluten-free` (`6 picks · 4 cities`) and a personal tag with `Your tag`; a card's `Share` opens `/share/list` with its filter; with nothing, `Your lists fill in as you add dishes.`
  - Your list for Vancouver: `Your list`, `Vancouver`, `8 picks at 6 spots · 1 Final Meal · 7 Honorable`, six groups; turning off `Honorable` leaves `Skewers`; `Map` shows the map panel; `Share this list` opens ShareList with the narrowed filter
  - Edit: renaming and adding a note calls `updateSharedList(id, { title, note })`; switching `Link on` off calls it with `isActive: false`; clearing the note sends `note: null`; an error keeps the screen open with the copy
  - `ViewToggle` switches and reports its state
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Add Your lists, Your list and link editing`

### Task 6: The shared list in the app, links that open it, Discover search and Activity

**Files:**
- Create: `apps/mobile/app/(app)/l/[slug].tsx`, `apps/mobile/src/components/SharedListHeader.tsx`, `apps/mobile/src/components/SharedListRow.tsx` (the search row) (+ tests), `apps/mobile/src/screens/shared-list.test.tsx`, `apps/mobile/src/screens/list-links.test.tsx`
- Modify: `apps/mobile/app/(app)/search.tsx` (the Shared lists section), `apps/mobile/src/screens/search.test.tsx` (replace "no `Shared lists`"), `apps/mobile/app/(app)/notifications.tsx` (`saved_from_list` opens the list) and `src/screens/notifications.test.tsx` (replace "opens nothing (lists are Phase 6)"), `apps/mobile/src/screens/add-flow-no-location.test.ts` (covers the new files), `docs/known-gaps.md` (remove the "Phase 6: sharing" section; add the Phase 8 items in Step 3)

**Interfaces and copy** (boards SharedList, DiscoverSearch):
- **Consumes:** Task 3 (`getSharedList`, `saveList`, `searchSharedLists`, `SharedListView`, `SharedListPick`, `ActivityItem.listSlug`), Tasks 4–5 (`RestaurantGroup`, `LivePill`, `ViewToggle`, `appLinkOrigin`), Phase 4–5 (`useSave`, `useFollow`, `FollowButton` labels, `PicksMap`, `pinsForPicks`, `openDirections`), core (`updatedAgo`, `listCountsLabel`, `firstName`, `listOwnerLine`).
- **Route** `/l/[slug]` inside `(app)`, so `finalmeal://l/<slug>` and Expo Go's `exp://<host>:8081/--/l/<slug>` open it. A signed-out person is sent to Welcome by the existing guard (returning to the list after sign-in is a Phase 8 gap).
- **Screen** (non-owner):
  - header: back; right, the share icon (aria `Share this list`) opening `Share.share` with `<title> on Final Meal: <url>`
  - `SharedListHeader`: a 26 px avatar and `Shared by @<username>` (the handle bold `bone`, a link to `/u/<owner id>`), 13 px `smoke`; the title (Newsreader italic 300, 38 px); `LivePill` + `<listCountsLabel> · <updatedAgo>` (13 px `smoke`); the note, when there is one, in quotes (`“…”`) on an `ash` card (radius 14, `line` border, Newsreader italic 17, `bone`)
  - `ViewToggle`; **List:** a 110 px radius-16 non-interactive `PicksMap` (`pinsForPicks`, `fitOnFirstPins`; tapping it switches to Map), then `RestaurantGroup`s in `save` mode: directions per place (`openDirections`), a bookmark per dish (`useSave(dish.id, pick.id, pick.saved)`); a dish with `canOpen` opens `/pick/<id>`, one without is not a link
  - **Map:** a full-height interactive `PicksMap` with the list's pins; a pin tap shows that place's `RestaurantGroup` in a bottom card; a map tap clears it
  - footer (padding 12/20/34, `night`, `line` top border): `Follow <first>` (ghost, flex 1; `useFollow`, labels `Following` / `Requested`; hidden when the viewer already follows) and `Save all <n>` (ember, bookmark, flex 1.4) calling `saveList`; when every dish is saved, or after it succeeds, `All saved` (disabled); `n` = picks not yet saved
  - **Owner:** no Follow / Save all; the footer is `Edit list` (ghost, opens `/lists/<id>/edit`) and `Share` (ember, the share sheet). A turned-off list shows under the header `This link is off. Only you can see this list.` (13 px `smoke`) with `Turn link on` (outline), which calls `updateSharedList(id, { isActive: true })`.
  - **Empty** (0 picks): `No picks here yet.` / `New picks join automatically.`
  - **Not available** (`null`): `This list isn’t available.` (Newsreader italic 28) / `The link may have been turned off.` (15 px `smoke`) and `Back`
  - **Error:** the friendly copy and `Try again`
- **Discover search:** in Discover mode, a `Shared lists` section between `Dishes` and `Spots` (board order; `People` stays last), up to 3 `SharedListRow`s from `searchSharedLists(q, 3)` (40 px radius-12 `ashRaised` tile with the list icon in `emberGlow`, title 15 px bold, `listOwnerLine` 13 px `smoke`, chevron), each opening `/l/<slug>`; hidden when empty; included in the "No matches" check. Feed mode is unchanged.
- **Activity:** a `saved_from_list` row with `listSlug` opens `/l/<listSlug>`; without one, nothing.

- [ ] **Step 1: Write the failing tests:**
  - non-owner, Josie's Vancouver fixture: `Shared by @josiehamilton`, `Josie’s Vancouver`, `Live`, `8 picks at 6 spots · updated 2 days ago` (with a fixed clock), `“Kin Kao first. Trust me.”`; groups `Skewers`, `Marutama`, `Kin Kao`, … each with `Directions to <name>`; a dish's bookmark toggles `saveDish(dishId, pickId)`; `Follow Josie` follows; `Save all 7` (one already saved) calls `saveList('josies-vancouver')` and becomes `All saved`
  - Priya's list for a non-follower: rows aren't buttons; `Follow Priya` becomes `Requested`
  - `Map` shows the full map with 6 pins; a pin shows its place; the mini map in List mode is not interactive
  - owner: `Edit list` and `Share`, no `Save all`; a turned-off list shows `This link is off. Only you can see this list.` and `Turn link on` calls `updateSharedList`
  - `null` shows `This list isn’t available.`; an error then `Try again` recovers; 0 picks shows `No picks here yet.`
  - **links** (`list-links.test.tsx`, `expo-router/testing-library` `renderRouter` with initial URLs): `/l/josies-vancouver` and `/l/Josies-Vancouver` render the shared list screen
  - Discover search `ramen`: sections `Dishes`, `Shared lists` (`Ramen in Vancouver`, `@josiehamilton · 1 pick`), `Spots`, in that order; a list row opens `/l/josies-ramen`; Feed mode has no list rows
  - Activity: the `saved_from_list` row opens `/l/josies-vancouver`
  - no `expo-location` in any new file (the extended scan)
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `docs/known-gaps.md` add under Phase 8: "Universal Links and App Links: set `ios.bundleIdentifier`, `ios.associatedDomains: ['applinks:<domain>']`, `android.package` and an `intentFilters` entry with `autoVerify` for `https://<domain>/l/*` in `app.config.ts`; put the real Team ID, bundle ID, package name and signing SHA-256 in the web's `.well-known` files; test on development builds" and "A list link opened while signed out goes to Welcome; after sign-in, return to the list".
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Open shared lists in the app, find them in Discover search, and save them all`

### Task 7: The web list page: list and map, link previews and app-link files

**Files:**
- Create in `apps/web/src/`:
  - `app/l/[slug]/page.tsx`, `app/l/[slug]/not-found.tsx`, `app/l/[slug]/opengraph-image.tsx`
  - `app/.well-known/apple-app-site-association/route.ts`, `app/.well-known/assetlinks.json/route.ts`
  - `lib/supabase-server.ts` (`serverClient(): FinalMealClient | null` from the `NEXT_PUBLIC_*` env, anon, no session), `lib/shared-list.ts` (+ test), `lib/app-links.ts` (+ test), `lib/og.ts` (+ test)
  - `components/list/WebHeader.tsx`, `ListHeader.tsx`, `TagFilterRow.tsx`, `WebRestaurantGroup.tsx`, `ListBody.tsx` (client: tag filter, view, selection), `JoinBanner.tsx`, `ListFooter.tsx`, and `*.module.css` beside them
  - `map/recolour.ts` (+ test), `map/markers.ts` (+ test), `map/ListMap.tsx` (client)
  - `no-raw-colours.test.ts`
- Create: `apps/web/e2e/shared-list.spec.ts`, `apps/web/e2e/support/stub-map.ts` (routes `tiles.openfreemap.org` to a one-layer background style)
- Modify: `apps/web/package.json` (`@finalmeal/core`, `maplibre-gl@5.24.0`, the three `@expo-google-fonts/*` packages), `apps/web/src/app/layout.tsx` (`metadataBase: new URL(linkOrigin(process.env.NEXT_PUBLIC_LINK_ORIGIN))`), `apps/web/playwright.config.ts` (Chromium `launchOptions.args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader']` so WebGL works headless), `apps/mobile/src/map/map-page.ts` (re-export `OPENFREEMAP_STYLE_URL` from `@finalmeal/ui-tokens`; one line), `packages/ui-tokens/src/map.ts` (+ `tokens.test.ts`: export `OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'`), the spec §3.1 (web routes) and §7 (the web map is maplibre-gl 5.24.0 with the same recoloured OpenFreeMap style)

**Interfaces and copy** (boards WebList, WebMap, WebDesktop):
- **Consumes:** `getSharedList` and the types (Task 3), core helpers (Task 1), `@finalmeal/ui-tokens` (`colors`, `map`, `skull`, `cssVariables`).
- **Produces** for Task 8: `ListBody` props `onSave(pick: SharedListPick)`, `onJoin()`, `onFollow()`. In this task they are no-ops (Task 8 wires them to the sign-up sheet before the branch is pushed for review), and Task 7's e2e asserts only what renders.
- **`lib/shared-list.ts`:** `loadSharedList(slug: string, client: FinalMealClient | null): Promise<{ status: 'ok'; list: SharedListView; picks: SharedListPick[] } | { status: 'not_found' } | { status: 'unavailable' }>` — `slugFromPath` rules first (a bad slug is `not_found` without a call); `null` client or a `network`/`timeout` error is `unavailable`; never throws.
- **Page (`/l/[slug]`)**, `export const dynamic = 'force-dynamic'`:
  - `not_found` → `notFound()`; `unavailable` → the page shell (header and footer) with `Can’t reach the kitchen right now.` and no list, and `robots: { index: false }` in its metadata (the same behaviour as the foundation page; a Next page can't pick a 5xx status without throwing)
  - `generateMetadata`: `title` = the list title; `description` = `<listCountsLabel>, shared by @<username> on Final Meal.`; `openGraph` `{ title, description, type: 'website', url: listUrl(origin, slug) }`; `twitter: { card: 'summary_large_image' }`; not found: `{ title: 'Final Meal' }`
  - `?view=map` selects the Map view on narrow screens (the toggle is two links, `List` → `/l/<slug>`, `Map` → `/l/<slug>?view=map`)
- **Narrow layout (< 1024 px; WebList / WebMap boards):**
  - `WebHeader` (60 px, `line` bottom border): the ember skull and the `Final Meal` wordmark (Instrument Serif); on the right `Open in app` (36 px ember pill)
  - `ListHeader`: a 26 px avatar and `<strong>@josiehamilton</strong> shared a list` (13 px `smoke`); the title (Newsreader italic 300, 38 px); `LivePill` + `<listCountsLabel> · <updatedAgo>`; the note in quotes (Newsreader italic 17, `bone`)
  - the view toggle (`List` / `Map`, board style); `TagFilterRow`: `All` then up to 4 global tags of the list's picks by count (food types first), single choice, filtering the rows on the client
  - **List:** `WebRestaurantGroup`s (the board's `websave`: the head with a 36 px round directions link, aria `Directions to <name>`, to `https://www.google.com/maps/search/?api=1&query=<encoded name, address, city>`, opening in a new tab; dishes with photo, name, mark, global tags and a 36 px round bookmark, aria `Save <dish>`, that calls `onSave`). Rows never open a pick.
  - `JoinBanner` floating at the bottom (left/right 12, bottom 16, `ashRaised`, radius 20, `lineStrong` border): `What would your five be?` (Newsreader italic 300, 24), `Save <first>’s picks, follow this list and build your own Final Meal. Free.` (13 px `smoke`), and `Create your Final Meal` (ember, 48 px, white skull) calling `onJoin`
  - **Map:** the map fills the page under a `night`-glass top block (the header, the title at 26 px with `LivePill`, the toggle); a selected pin shows a card above the bottom bar (64 px photo, the dish in Newsreader 20, `<place name> · <area or address>` and ` · <n> dishes` when there are more, global tags, a 44 px round bookmark calling `onSave` for that dish — no distance); the bottom bar `Save these to your own list` (13 px `bone`) and `Join free` (ember) calling `onJoin`
- **Wide layout (≥ 1024 px; WebDesktop board):** header with `Log in` (14 px bold) and `Create your list` (40 px ember pill), both `onJoin`; two columns (list section flex 1 1 380 px, map section flex 999 1 520 px, 640 px tall, radius 24, `line` border); `<strong>Josie Hamilton</strong> shared a list` (the display name, 32 px avatar); title clamp(40px, 5vw, 60px); meta `<listCountsLabel> · <n> Final Meal(s) · <updatedAgo>` (the Final part left out at 0); the note at 20 px; the map legend bottom-left (`Final Meal`, `Honorable` dots); then the full-width section `What would your five be?` / `Save <first>’s picks, follow live lists, and choose your own Final Meal. Free.` with `Create your Final Meal` (ember) and no `Get the app` (Phase 8). No view toggle and no floating banner.
- **`ListFooter`** (both layouts): `© Final Meal` and `Places from Foursquare Open Source Places (Apache 2.0).` (13 px `dim`). No Terms, Privacy or Report links.
- **Empty list:** under the header, `No picks here yet.` / `New picks join automatically.`; the map is hidden.
- **`map/recolour.ts`:** `paintFor(layer: { id: string; type: string; 'source-layer'?: string; filter?: unknown; paint?: Record<string, unknown> }): Array<[property: string, value: unknown]>` — exactly the mobile `recolourLayer` rules (`apps/mobile/src/map/map-page.ts`) with `map` tokens; `recolour(map)` applies it to every layer of `map.getStyle()`, ignoring a layer that throws.
- **`map/markers.ts`:** `markerElement(pin: { tier: 'final' | 'honorable'; label: string }, selected: boolean): HTMLButtonElement` — the mobile sizes (Final 38 px ember with a 2 px `night` border and the white skull, 44 px with `0 0 0 4px <emberRing>` when selected; Honorable 18 px `honorable` with a 3 px `night` border, 26 px with `0 0 0 5px <honorableRing>`), `aria-label` `Final Meal pick` / `Honorable Mention pick` (`, selected`), and the selected callout (the place name; `bone` background, `night` 12 px bold text, radius 10).
- **`map/ListMap.tsx`** (client, loaded with `next/dynamic` and `ssr: false`; imports `maplibre-gl/dist/maplibre-gl.css`): `maplibregl.Map` with `OPENFREEMAP_STYLE_URL` from `@finalmeal/ui-tokens`, `attributionControl: { compact: true }`, `dragRotate: false`; `recolour` on `style.load`; one marker per place with `place.onMap` (Final if any pick there is Final); fits the pins (padding 48, max zoom 14); a marker click selects, a map click clears; WebGL or style failure shows `The map didn’t load.` with `Try again` (remounts); no pins: `None of these spots are on the map yet.`; never adds `GeolocateControl` or reads `navigator.geolocation`.
- **Preview image (`opengraph-image.tsx`)**, `runtime = 'nodejs'`, `size = { width: 1200, height: 630 }`, `contentType = 'image/png'`, `alt` = `<title> on Final Meal`:
  - `lib/og.ts`: `ogContent(list: SharedListView, picks: SharedListPick[], origin: string): { eyebrow: string; title: string; meta: string; rows: Array<{ mark: string | null; dish: string; place: string }>; link: string }` — eyebrow `@<username> shared a list`, the title cut to 60 characters with `…`, meta `listCountsLabel`, the first 5 picks (`mark` = the slot number for a Final, null for Honorable; `place` = the place name), `link` = `displayLink(listUrl(origin, slug))`
  - the image follows the ShareCard board's card: `night` background, padding 64; top-left the ember skull and the wordmark; the eyebrow (Manrope 700, 20 px uppercase, 0.14em, `dim`); the title (Newsreader italic 300, 76 px, `bone`, two lines at most); the meta (Manrope 28, `smoke`); on the right half the rows (the slot number in Newsreader italic 34 `emberGlow`, the dish in Newsreader 34, the place in Manrope 16 uppercase 0.08em `dim`, `line` rules between); bottom-left the link (Manrope 20, `smoke`)
  - fonts: the TTFs from the `@expo-google-fonts/*` packages, read with `fs` (Instrument Serif 400, Newsreader 300 italic and 400, Manrope 400 and 700); every element with more than one child sets `display: flex` (Satori's rule)
  - not found or unavailable: the brand card (skull, wordmark, `Five dishes. That’s it. Choose.`)
- **`lib/app-links.ts`** (placeholders until Phase 8; one place to change them):
  - `APPLE_APP_ID = process.env.APPLE_APP_ID ?? 'TEAMID0000.example.finalmeal.app'`, `ANDROID_PACKAGE = process.env.ANDROID_PACKAGE ?? 'example.finalmeal.app'`, `ANDROID_CERT_SHA256 = process.env.ANDROID_CERT_SHA256 ?? '00:00:…:00'` (32 zero bytes)
  - `appleAppSiteAssociation()` → `{ applinks: { details: [{ appIDs: [APPLE_APP_ID], components: [{ '/': '/l/*', comment: 'Shared lists' }] }] } }`
  - `assetLinks()` → `[{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: [ANDROID_CERT_SHA256] } }]`
  - both route handlers `GET` → `Response.json(…)` with `content-type: application/json`, status 200, no redirect, `dynamic = 'force-static'`
- **Styling:** CSS Modules using only `var(--fm-*)` (and `--fm-font-*`); `no-raw-colours.test.ts` fails on any hex, `rgb(` or `rgba(` in `apps/web/src` outside `@finalmeal/ui-tokens` imports (the OG image takes colours from `colors`).

- [ ] **Step 1: Write the failing tests.**
  - **Unit:** `loadSharedList` for ok, `null` (not found), a `network` error (unavailable), a `null` client (unavailable) and a bad slug (`../x`, 61 characters: not found with no call); `paintFor` gives `background-color` `#141210` for the background, `#0F1A1F` for a water fill, `map.park` for landcover wood, `map.roadMajor` for a motorway line, label and halo for a symbol, nothing for a fill on `building`; `markerElement` sizes, ring and aria labels; `ogContent` (title cut at 60 with `…`, 5 rows, slot marks, the link); `appleAppSiteAssociation()` and `assetLinks()` shapes; `no-raw-colours`
  - **e2e (`shared-list.spec.ts`,** seed, `stub-map` routed in a `beforeEach`):
    - `/l/josies-vancouver` at 390×844: heading `Josie’s Vancouver`, `@josiehamilton shared a list`, `Live`, `8 picks at 6 spots`, `“Kin Kao first. Trust me.”`; the first group is `Skewers` with `Final Meal #1`; `Directions to Skewers` links to Google Maps in a new tab; `Noodles` in the tag row leaves `Marutama`, `Kin Kao` and `Lotus Noodle Bar`; `Create your Final Meal` is visible
    - `/l/Josies-Vancouver` renders the same list
    - `Map` → `?view=map`: the map region and 6 pin buttons (`Final Meal pick` ×1, `Honorable Mention pick` ×5); clicking one shows its card with no `km`; `Join free` is visible
    - at 1280×900: both columns at once, `Josie Hamilton shared a list`, `Log in`, `Create your list`, the legend, no view toggle
    - `og:title` = `Josie’s Vancouver`, `og:description` = `8 picks at 6 spots, shared by @josiehamilton on Final Meal.`, and `og:image` (absolute) answers 200 `image/png`
    - `/l/josies-old-list` and `/l/no-such-list` answer 404 with `This list isn’t available.`
    - `/l/priyas-vancouver` renders Priya's list with `@priyashah shared a list`
    - `/.well-known/apple-app-site-association` → 200 `application/json` with `/l/*`; `/.well-known/assetlinks.json` → 200 with `delegate_permission/common.handle_all_urls`
    - on the broken-API server (`BROKEN_API_URL`), `/l/josies-vancouver` answers within 3 seconds with `Can’t reach the kitchen right now.`, no list and not the 404 copy
    - with the tile host aborted (`page.route(…, r => r.abort())`), the Map view shows `The map didn’t load.` and List still works
    - a title containing `<script>` (a fresh list made through the API in the test) renders as text
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/web test`; with the stack and `pnpm env:local`, `pnpm --filter @finalmeal/web test:e2e -- shared-list`. Expected: FAIL. (If the cloud session can't download Playwright's browser, run the unit tests here and leave e2e to CI; say so in the report.)
- [ ] **Step 3: Implement.** `not-found.tsx` copy: `This list isn’t available.` (Newsreader italic 300, 38) / `The link may have been turned off, or the list was removed.` (15 px `smoke`) and `Get Final Meal` (ember) → `/join`.
- [ ] **Step 4: Run the checks.** The two commands again, plus `pnpm --filter @finalmeal/web build && pnpm lint && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `Serve shared lists on the web with a live map, link previews and app-link files`

### Task 8: Sign-up prompts and joining on the web

**Files:**
- Create in `apps/web/src/`: `components/list/SignupSheet.tsx` (+ module CSS), `app/join/page.tsx`, `app/join/JoinFlow.tsx` (client), `lib/browser-client.ts`, `lib/pending-action.ts` (+ test), `lib/use-web-session.ts`
- Create: `apps/web/e2e/join.spec.ts`, `apps/web/e2e/support/accounts.ts` (fresh people and lists through `@finalmeal/api` and Mailpit, as `packages/api/src/test-support/mailpit.ts` does)
- Modify: `apps/web/src/components/list/ListBody.tsx`, `WebHeader.tsx`, `JoinBanner.tsx` (wire `onSave`, `onJoin`, `onFollow`), `apps/web/src/components/list/ListHeader.tsx` (the `Follow` link), the spec §5.3 (what web sign-up does)

**Interfaces and copy** (board WebSignup; the join steps reuse the OnbEmail, OnbOtp, OnbName and OnbUsername copy):
- **Consumes:** Task 7's components; `sendEmailCode`, `verifyEmailCode`, `getMyProfile`, `createMyProfile`, `isUsernameAvailable`, `saveDish`, `unsaveDish`, `followUser`, `getSharedList`, `signOut`, `friendlyMessage` (`@finalmeal/api`); `USERNAME_PATTERN`, `firstName` (core).
- **`lib/browser-client.ts`:** `browserClient(): FinalMealClient` — one client per tab, `persistSession: true`, `storage: window.localStorage`, `detectSessionInUrl: false`.
- **`lib/pending-action.ts`:**
  - `type PendingAction = { kind: 'save'; dishId: string; pickId: string } | { kind: 'follow'; userId: string } | { kind: 'join' }`
  - `encodeAction(a): string` (`save.<dishId>.<pickId>`, `follow.<userId>`, `join`) / `parseAction(s: string | null): PendingAction` (anything malformed is `join`; ids must be UUIDs)
  - `safeNext(next: string | null): string` → the path when `slugFromPath(next)` accepts it, else `/`
  - `runPendingAction(client, a): Promise<'saved' | 'followed' | 'requested' | 'none'>`
- **`lib/use-web-session.ts`:** `useWebSession(): { status: 'loading' | 'signed_out' | 'signed_in'; profile: MyProfile | null; signOut(): Promise<void> }` (signed in only with a profile).
- **On the list page** (client side, after hydration):
  - signed out: every `Save <dish>`, `Create your Final Meal`, `Join free`, `Open in app`, `Log in`, `Create your list` and `Follow` opens the `SignupSheet` with the matching action (`save` for a dish, `follow` for Follow, `join` for the rest)
  - signed in: the page re-reads the list with the browser client (for `saved`); `Save <dish>` toggles `saveDish` / `unsaveDish` (filled bookmark when saved); `Follow` follows (`Following` / `Requested`, hidden for your own list); the header's right side becomes `Log out` (14 px bold), which signs out and reloads
- **`ListHeader` Follow (not on the board):** after `shared a list`, ` · ` and `Follow` (13 px bold `emberGlow`; hidden for the owner and when already following).
- **`SignupSheet`** (a dialog over a `scrim` backdrop; `ash`, top radius 28, `lineStrong` top border, padding 10/24/34, gap 16; focus trapped; `Escape`, the backdrop and Close dismiss it):
  - the 40×5 handle; the ember skull (40) and a Close button (aria `Close`)
  - heading (Newsreader italic 300, 34): `Save <first>’s picks to your own list.` for `save` and `join`; `Follow <first> on Final Meal.` for `follow`
  - `A free Final Meal account lets you save picks, follow live lists like this one, and choose your own five.` (15 px `smoke`)
  - `Continue with email` (ember, mail icon) → `/join?next=/l/<slug>&do=<encodeAction>`; no Apple or Google buttons (Phase 8)
  - `Have an account? Log in` (the `Log in` bold `bone`) → the same `/join` link
  - no "or get the app" row and no store buttons (Phase 8)
- **`/join`** (`JoinFlow`; reads `next` and `do`; the onboarding layout: back button, a 4-segment progress bar `aria-label="Sign-up progress"`, `Step <n> of 4`, the heading in Newsreader italic 300 36, the sub in 15 px `smoke`, the ember button at the bottom):
  1. `What’s your email?` / `We’ll send a code to sign you in. No passwords to remember.`; field `Email` (placeholder `you@example.com`); `Send code`; footer `We never share your email.`
  2. `Check your email.` / `Enter the 6-digit code we sent to <email>.`; six digit boxes (aria `Digit 1`…`Digit 6`, paste fills all); `Resend in 0:30` counting down, then `Resend code`; `Change email`; `Verify`. After verifying: with a profile, skip to the action; without, step 3.
  3. `What should we call you?` / `This shows on your profile and on every pick.`; `First name`, `Last name` (display name = both, trimmed, ≤ 60); `Continue`
  4. `Claim your handle.` / `This is how friends find your Final Meal.`; `Username` with an `@` prefix, a live check (`isUsernameAvailable`, 300 ms debounce) showing `Available` with a check, or `That handle’s taken. Try another.`; under it `Letters, numbers and underscores. You can change it later.`; `Continue` calls `createMyProfile`
  - then `runPendingAction` and `router.replace(<safeNext(next)>?joined=<result>)`; with `next` = `/`, the done card below on `/join` itself
  - errors under the button with `friendlyMessage` (e.g. `That code didn’t work. Check it and try again.`)
- **After joining** (`?joined=` on the list page, then removed from the URL): a notice at the top (`ash`, radius 14, `line` border): `Saved to your list.` / `You’re following <first>.` / `Request sent to <first>.` / `You’re in.`, then `Open Final Meal on your phone to choose your five.` (13 px `smoke`). Home city and photo are finished in the app (its onboarding resumes at Home city).

- [ ] **Step 1: Write the failing tests.**
  - **Unit:** `parseAction` / `encodeAction` round-trips and rejects (`save.x.y`, `follow.`, `drop.table`) to `join`; `safeNext('/l/josies-vancouver')`, `safeNext('https://evil.example/l/x')`, `safeNext('//evil.example')`, `safeNext('/l/../admin')` (the last three give `/`); `runPendingAction` with a fake client for each kind
  - **e2e (`join.spec.ts`):**
    - signed out on `/l/josies-vancouver`: `Save Pork Gyro` opens the dialog `Save Josie’s picks to your own list.` with `Continue with email` and `Have an account? Log in`, and no `Continue with Apple`, `Continue with Google`, `App Store` or `Google Play`; `Escape` closes it; `Follow` opens `Follow Josie on Final Meal.`
    - **join and save:** a fresh email goes through the four steps (code from Mailpit), lands on `/l/josies-vancouver` with `Saved to your list.`, the Pork Gyro bookmark is filled, and `getMySaves` (through the API, signed in as that person) has Pork Gyro saved via Josie's pick; `Log out` brings back the signed-out page
    - **log in:** an existing fresh account skips the name and handle steps
    - a taken handle (`josiehamilton`) shows `That handle’s taken. Try another.`
    - `/join?next=https://evil.example&do=join` finishes on `/join` with `You’re in.` (never leaves the site)
    - **live across views:** a fresh owner (made in `support/accounts.ts`) shares a list with two picks; the page shows `2 picks at 2 spots`; the owner removes one through the API; a reload shows `1 pick at 1 spot` and its preview image still answers 200
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/web test && pnpm --filter @finalmeal/web test:e2e -- join`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** The same commands, the Task 7 e2e again, `pnpm --filter @finalmeal/web build && pnpm lint && pnpm typecheck`. Run `pnpm db:reset </dev/null` afterwards (the join tests leave people behind).
- [ ] **Step 5: Commit.** `Open the sign-up sheet from shared lists and join on the web to save or follow`

### Task 9: Device checklist, docs, CI

The Mac is often busy, so the device steps may be deferred. If so, mark them "pending an idle Mac" in the ledger and in README's device checklist, and say so in the report. Everything else in this task still happens.

- [ ] **Step 1: iPhone 17 run** (may be deferred). `pnpm db:reset </dev/null && pnpm env:local`, then `pnpm dev` (web on 3000, one Expo server). Screenshot every step. Sign in as `josiehamilton@example.com` (code from Mailpit):
  1. You: the header share icon and `Share a list` open the Share hub with `Your five`, `17 picks · 7 cities`, the city, food-type and tag chips.
  2. Tap `Vancouver`: Share a list shows `Josie’s Vancouver`, the three groups and the `+ Miku…` line; `Copy link` reads `Copied`; `Send` opens the share sheet.
  3. In the simulator's Safari, open `http://localhost:3000/l/josies-vancouver`: the list, the tag row, `Map` with pins on the dark map, `Save` opens the sign-up sheet.
  4. Open the list in the app: `xcrun simctl openurl booted "exp://127.0.0.1:8081/--/l/josies-vancouver"`. The owner view shows `Edit list` and `Share`. Edit: rename, add a note, turn the link off; reload Safari: `This list isn’t available.`; turn it back on.
  5. Your lists: `Shared links`, the city, food-type and tag cards, a card's Your list with List / Map.
  6. Discover → Search `ramen`: `Shared lists` shows `Ramen in Vancouver`; open it.
  7. Sign in as Mike (`mikebrennan@example.com`), open Josie's list, `Save all`, then as Josie, Activity shows the save and opens the list.
  8. In Safari, join from a list with a new email; then sign in with it in the app: onboarding resumes at Home city.
  9. With `Share these` on You → Map (Sushi chip), share a Sushi list.
- [ ] **Step 2: Pixel_10 run** (may be deferred). Repeat 1, 2, 3 (Chrome at `http://10.0.2.2:3000/l/josies-vancouver`), 4 (`adb shell am start -W -a android.intent.action.VIEW -d "exp://10.0.2.2:8081/--/l/josies-vancouver" host.exp.exponent`) and 6, and confirm `Copy link` works.
- [ ] **Step 3: Run every local check.** `pnpm db:test`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm --filter @finalmeal/web build`, then `pnpm db:reset </dev/null`.
- [ ] **Step 4: Update the docs.**
  - README "Try the app": sharing a list, opening it on the web (`http://localhost:3000/l/josies-vancouver`), opening a link in the app (`exp://…/--/l/<slug>`), and that links say `finalmeal.example` outside a local stack; the device checklist gets the Phase 6 items (pending an idle Mac where deferred).
  - `CLAUDE.md` status: Phase 6 built on its branch (based on `phase-5-discover`).
  - `docs/known-gaps.md`: confirm Task 4 and 6 edits; add under Phase 8: "Set `LINK_DOMAIN` (`packages/core/src/links.ts`) to the real domain, and `NEXT_PUBLIC_LINK_ORIGIN` on Vercel", "`Open in app` on the web opens the sign-up sheet; once the app is in the stores it should try the app first", "Show Apple / Google sign-in and the App Store / Google Play buttons in the web sign-up sheet", "Cache the preview image at the CDN if crawlers load it heavily"; under Phase 7: "Report this list (the web footer and the app)", "A flagged owner's shared lists: decide whether they stay live", "Lists made while an account was public keep their guessable slug after it goes private"; under Later: "One recolour rule set for the app's WebView map and the web map (today `apps/mobile/src/map/map-page.ts` and `apps/web/src/map/recolour.ts` repeat it, with matching tests)", "Story-image sharing (ShareImage, ShareCard)", "Share a pick or a profile by link".
  - `docs/needs-from-josie.md`: item 2 (domain) now reads "Needed by Phase 8 (Phase 6 uses `finalmeal.example`; changing it is one line)"; add each Decision below as one Decisions row with its default.
  - Copy the ledger's rulings to `docs/build-log/phase-6.md`, as Phases 4 and 5 did.
  - Commit `Phase 6: device checklist, status, known gaps and open decisions`.
- [ ] **Step 5: Push and check CI.** Push `phase-6-sharing` and confirm CI is green (give the URL). Don't merge.

## Phase 6 done means

On the iPhone 17 and Pixel 10 (or with the device run marked pending an idle Mac), a person can:
- share their five, everything, a city, a food type, a tag or a custom mix as a live link, and copy or send it
- see and manage their links in Your lists: rename, add a note, turn a link off and on
- open a list in the app from a link, save its dishes one by one or all at once, and follow its owner
- find shared lists in Discover search

and anyone can open the link on the web (list, map and a link preview), with sign-up prompts that lead to a small web sign-up that finishes the save or follow. Every view is live. App-link files are served with placeholder IDs until Phase 8. All tests and CI are green.

## Decisions for Josie

Each has a default that this plan builds. Change any of them and Claude updates the app.

1. **Private accounts' links (spec conflict).** The spec says both "lists they share by link show their name to anyone with the link" (5.5, and the Privacy board's "Lists you share by link still show you") and "making the account private updates the list" (5.3). Default: a link works for anyone who has it and shows the owner, public or private; a private account's lists never appear in Search, its rows don't open picks for people it hasn't approved, and its new links get a short random ending (`priyas-vancouver-3f9a`) so they can't be guessed. The alternative is that going private turns off existing links for everyone but approved followers.
2. **Your lists (canvas vs. request).** The MyLists board shows lists "built automatically from your picks and tags", not your shared links. Default: keep the board's Cities / Food types / Tags cards and add a **Shared links** section at the top (no board) where each link opens and can be renamed, given a note, and turned off or on. Links are never deleted.
3. **Link addresses:** made from the list name (`josies-vancouver`), with `-2`, `-3` on a clash; renaming a list never changes its link; an old link is never given to someone else. Mixed case works (`/l/Josies-Vancouver`).
4. **Web sign-up:** saving, following, `Join free`, `Create your Final Meal` and `Open in app` on the web open the sign-up sheet; `Continue with email` (or `Log in`) runs a four-step web sign-up (email, code, name, handle), then finishes the save or follow and returns to the list. Home city and photo are finished in the app. Apple / Google sign-in and the store buttons stay hidden until Phase 8.
5. **"Your five" without an image:** story images aren't in the MVP, so the Share hub's `Final Meal` card opens the same link screen as the others (ShareCard's image and `Story` / `Save image` aren't built), and ShareList has no `Link` / `Story image` toggle.
6. **Default list names:** `Josie’s Final Meal`, `Josie’s picks` (everything), `Josie’s Vancouver`, `Josie’s Sushi` (one tag), `Vegan in Tokyo` (a city and a tag in a custom list), otherwise `Josie’s list`. Anyone can rename before sharing.
7. **What "Everything" includes:** every pick, Final and Honorable, in every city. Lists show both tiers unless you turn one off; the web shows Honorable Mentions too.
8. **Sharing the same list twice** gives the same link (and updates its name), instead of making a new one. A turned-off list isn't reused: sharing that filter again makes a new link.
9. **A turned-off or missing link** shows `This list isn’t available.` / `The link may have been turned off, or the list was removed.` (web, with `Get Final Meal`) and `The link may have been turned off.` (app). Someone you've blocked, or who has blocked you, sees the same.
10. **Limit:** 30 new lists a day per person (`You’ve made a lot of lists today. Try again tomorrow.`). Re-sharing an existing list doesn't count.
11. **Preview image:** styled like the ShareCard board (night card, skull and wordmark, `@josiehamilton shared a list`, the list name, `8 picks at 6 spots`, the first five dishes with their restaurants, the link). A missing list gets the brand card.
12. **Save all** (SharedList board) is built: it saves every dish you haven't saved and tells the owner once ("saved picks from your list"). Saving one dish from a list tells them as a normal save.
13. **No distances on lists or the web** (the WebMap board shows "1.8 km"; there's no position to measure from). Directions open Google Maps on the web and the phone's map app in the app.
14. **The web banner** says `Save Josie’s picks, follow this list and build your own Final Meal. Free.` (the board says "follow her list"; we don't know anyone's pronouns). The web also gets a small `Follow` link after "shared a list" (no board), since the spec says following from the web opens the sign-up sheet.
15. **Search:** Discover's Shared lists section shows lists from public accounts that are trusted, that you follow, or yours, matched by name, with the busiest first. The Feed's search has no lists.
16. **Not shared:** single picks and other people's profiles have no Share button (there's no web page for them in the MVP); you can't change what a shared list includes after sharing (make a new one); notes are added in Edit list, not on the Share screen.
17. **New copy** (not on the canvas): `Add a dish first, then share it.`, `No picks match yet. New ones join automatically.`, the `joins automatically` lines (`New Sushi picks join automatically.`, `New picks join automatically.`, `Swap a dish and the list changes too.`, `New picks that match join automatically.`), `Copied`, `<title> on Final Meal: <link>` (the Send message), `Shared links`, `<n> picks · Live` / `Link off`, `Your lists fill in as you add dishes.`, `Edit list`, `Note`, `Add a note (optional)`, `Link on`, `Anyone with the link can see this list.`, `The link shows “This list isn’t available.”`, `This link is off. Only you can see this list.`, `Turn link on`, `All saved`, `No picks here yet.` / `New picks join automatically.`, `updated just now` … `updated on 3 Nov`, `Give the list a name (up to 80 characters).`, `Follow Josie on Final Meal.`, `Step 1 of 4` (web sign-up), `Saved to your list.`, `You’re following Josie.`, `Request sent to Josie.`, `You’re in.`, `Open Final Meal on your phone to choose your five.`, `Log out` (web), `Places from Foursquare Open Source Places (Apache 2.0).`
18. **Link domain:** links say `finalmeal.example` until you buy a domain (changing it is one line); on a local stack they point at `http://localhost:3000` so they open in the simulator. Opening a link straight into the installed app (Universal Links / App Links) needs the Apple and Google developer accounts and test builds (Phase 8); until then the web serves the files with placeholder IDs, and in Expo Go a link opens the app through `exp://…/--/l/<slug>`.
