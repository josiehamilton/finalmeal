# Phase 4: Social & Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Model rule (Josie):** Sonnet 5.5 subagents implement; Opus 5.5 plans and reviews. Without the plugin, follow `CLAUDE.md` "How we build".

**Goal:** Final Meal becomes social. People follow each other (private accounts approve requests), see a Following feed and a Nearby feed, open other people's profiles and picks, save dishes to try, and get an Activity inbox with notification settings. Push tokens and preferences are stored and a log-only sender stands in until real push in Phase 8.

**Architecture:**
- **Data:**
  - Every social write is a security-definer SQL function: follow, unfollow, approve/decline, save, unsave, mark read, register a push token. Clients lose direct writes on `follows`, `saves`, `notifications` and `push_tokens`.
  - One deferred trigger on `activities` fans each activity out to the people who should hear about it: in-app `notifications` rows and `push_outbox` rows, filtered by `notification_preferences`.
  - Feeds, profiles, people lists, pick detail and saves are read through security-definer functions that already apply the spec 5.5 privacy rules (private accounts only to approved followers; blocks hide both ways), so Phase 7 tightens table policies without changing what the app sees.
- **Push:** an Edge Function, `push-dispatch`, drains `push_outbox` through a pluggable `PushSender`. Phase 4 ships `log` (default) and `noop` senders; Phase 8 adds the Expo sender.
- **Clients:**
  - `@finalmeal/api` wraps the new functions.
  - `@finalmeal/core` holds the shared copy rules (activity sentences, relative times, count labels).
  - The mobile app gets the real Feed tab (Following and Nearby), other people's profiles, followers and following lists, Find people, pick detail for anyone's pick, Save to try, the Saved tab, Activity, and Notification settings.
  - It all runs in Expo Go: no custom native modules, and no maps (Phase 5).

**Tech Stack:** The Phase 1–3 stack, plus:
- `expo-notifications` (loaded lazily, only when push is available; see Global Constraints)
- Supabase Edge Functions (Deno 2, served by `supabase start`)
- Supabase Realtime for the unread dot

**Spec:** `docs/superpowers/specs/2026-10-26-final-meal-mvp-design.md`: sections 1.1, 4, 5.4, 5.5, 5.6 and 11 (Phase 4 row). **Canvas:** Feed, FeedEmpty, FirstLand (Nearby section), PickDetail, OtherProfile, Followers, Notifications, NotificationSettings, Saved and Settings, in `design/canvas/project/`. FeedAd is not in the MVP; skip it. **Carry-forward:** `docs/known-gaps.md` (the Phase 4 items: server-side duplicate detection, Add returning to where it opened, and the Settings Notifications row) and the follows/notifications policy gaps listed there.

## Global Constraints

- **All Phase 1–3 constraints and `CLAUDE.md` rules apply:**
  - tokens only; Instrument Serif, Newsreader and Manrope; ember `#C04B28` and ember glow `#E8693F` are the only accents
  - Supabase is codified: new migrations only (never edit an applied one), `security definer` functions with `set search_path = ''`, execute revoked from `public`/`anon` unless stated, and every change recorded in `docs/ops/supabase.md` in the same commit
  - use the pinned CLI via `pnpm exec supabase` / `db:*`
  - never commit `.env*` files or keys
  - commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
- **Branch:** `phase-4-social-feed`. No merge into `main` without Josie's OK.
- **No current location, ever.** "Nearby" means within **25 000 m of the viewer's `profiles.home_location`** (their home city's point), never the phone's position. A viewer with no home city gets an empty Nearby with a prompt to choose one. Nothing in this phase imports `expo-location`.
- **Privacy (spec 5.5) in every new read function**, even though table policies are tightened in Phase 7:
  - A private account's picks, bio, home city and lists are returned only to the owner and to **active** followers. Name, @username, photo and follower counts are always visible.
  - Blocks (either direction) hide the other person completely: no profile, no feed items, no notifications, and they can't follow.
  - Nearby and suggestions include only `trust_level = 'trusted'` and `visibility = 'public'` accounts.
  - `show_home_city = false` hides the home city from everyone else.
  - Another person's **personal tags are never shown**; only food-type and dietary tags appear on others' picks.
- **Push delivery is Phase 8.** There are no Expo or Apple accounts yet. Phase 4:
  - stores tokens and preferences
  - queues pushes in `push_outbox`
  - delivers them through the `log` sender (writes to the function's log)
  - In the app, `isPushAvailable()` is true only when `Constants.expoConfig?.extra?.eas?.projectId` is set. Until then nothing asks for permission or registers a token, and `expo-notifications` is never imported, since importing it in Android Expo Go logs an error. Use a lazy `require` inside the available branch.
- **Not built this phase** (hide the controls; never show dead buttons):
  - feed ads (FeedAd)
  - Trending tab
  - every Share button (Phase 6)
  - the Saved "Map view" button and "See the map" (Phase 5)
  - card and profile "More options" menus (report and block are Phase 7)
  - "More filters"
  - the Email section and "Picks near you" in Notification settings
  - milestone ("is now on 8 Final Meals") and invite ("joined from your invite") notifications
  - the "+ More" people list behind "On 23 Final Meals"
- **The Search icon in the Feed header opens Find people** (Task 5) until Phase 5 builds Search.
- **Paging:** feeds, notifications and people lists load 20 at a time (cap any `p_limit` at 50).
- **Friendly copy:** new error codes and their exact strings (exported from `@finalmeal/api`):
  - `request_not_found`: `That request isn’t there any more.`
  - `dish_not_found`: `That dish isn’t there any more.`
  - `profile_unavailable`: `This profile isn’t available.`
  - `cannot_follow_self` and `invalid_push_token` map to the `unknown` copy (the app never triggers them).
- **Copy:** quote canvas copy exactly, with typographic punctuation. Where the canvas shows sample data (counts, names, "2h"), render real data. Copy not on the canvas is pinned in the task that uses it and listed under Decisions for Josie.
- **Time labels** (`relativeTime` in `@finalmeal/core`):
  - under 1 minute: `now`
  - under 60 minutes: `<n>m`
  - under 24 hours: `<n>h`
  - under 48 hours: `Yesterday`
  - under 7 days: `<n>d`
  - otherwise `<d> <Mon>` (e.g. `12 Oct`)

## Review Focus

1. **Following a private account:** Follow becomes `Requested`. The person sees only the header and `This account is private` (no picks, bio or home city, and not in feeds or pick detail) until the owner approves. Cancelling a request or unfollowing works. A private account that switches to public approves its pending requests. Pinned in Tasks 1, 3 and 5.
2. **Rapid or repeated taps** on Follow/Unfollow and Save/Unsave: never duplicate rows, never stack notifications (unfollowing removes the "started following you" notification, and re-following within 24 hours doesn't queue a second push), and the button always ends in the server's state. Pinned in Tasks 1, 2, 5 and 7.
3. **A swap shows once.** `add_pick`/`promote_pick` with a replace slot write `added_final`/`promoted` *and* `dethroned` for the same pick in one transaction. The Following feed shows one card (the dethroned one), and followers get one push. Pinned in Tasks 2 and 3.
4. **Things that disappear:**
   - A removed pick vanishes from feeds and notifications (cascade), and opening it from a stale screen shows `That pick isn’t there any more.`
   - A saved dish stays in Saved after the pick it was saved from is removed; it just loses its `via @…` line.
   - Someone who goes private disappears from Nearby and from non-followers' feeds.
   Pinned in Tasks 3 and 7.
5. **No home city** (skipped in onboarding or cleared in Settings): Nearby, the suggestions and First landing's Nearby section show friendly empty states with a way to choose a city. Nothing ever asks for location. Pinned in Tasks 3 and 6.

---

### Task 1: Follows: request/approve, profiles and people (database)

**Files:**
- Create: migration `<ts>_activity_types_social.sql` (enum values only; it must be its own file so later migrations can use the values), migration `<ts>_follows.sql`, `supabase/tests/database/follows.test.sql`, `supabase/tests/database/people.test.sql`
- Modify: `supabase/tests/database/rls.test.sql` (follows now read and written only through functions; explain each changed assertion), `docs/ops/supabase.md`, `docs/known-gaps.md` (remove the `follows.status` column-protection gap), the spec §4 (`activities.type` gains the two values; note that follows are written only through functions)

**Interfaces:**
- **Enum:** `alter type public.activity_type add value 'follow_requested'; … add value 'follow_accepted';`
- **Grants and policies:**
  - revoke `insert, update, delete, truncate` on `follows` from `anon, authenticated`
  - drop `follows_insert_as_follower` and `follows_delete_either_party`
  - replace `follows_select` with `follows_select_own`: a row is visible only when `follower_id` or `followee_id` is the caller (counts and lists come from functions)
  - replace `activities_select` with `activities_select_own` (`actor_id` is the caller), and revoke `truncate` on `activities`
  - `getMyProfile`'s follower/following counts must count `status = 'active'` only; fix it in Task 4 if it doesn't
- **Internal helpers** (execute revoked from clients):
  - `public._is_blocked(a uuid, b uuid) returns boolean`: a block in either direction.
  - `public._can_see(p_viewer uuid, p_owner uuid) returns boolean`: false if blocked; true if the viewer is the owner, the owner is public, or the viewer actively follows the owner.
- **`public.follow_user(p_user_id uuid) returns public.follow_status`** (`authenticated`):
  - Raises `not_authenticated` (42501), `cannot_follow_self`, or `profile_unavailable` (no such profile, or blocked either way).
  - Idempotent: an existing row returns its status unchanged and writes nothing.
  - Otherwise it inserts `active` for a public target and writes a `followed` activity (`actor_id` = caller, `target_user_id` = target), or `requested` for a private target and writes `follow_requested`.
  - A per-follower advisory lock serialises concurrent calls.
- **`public.unfollow_user(p_user_id uuid) returns void`:** deletes the caller's row (active or requested) and the caller's `followed`/`follow_requested` activities that target that user (their notifications go by cascade). It's a no-op when there's nothing to delete.
- **`public.respond_follow_request(p_follower_id uuid, p_accept boolean) returns void`:** the caller is the followee.
  - Raises `request_not_found` unless a `requested` row exists.
  - **Accept:** the status becomes `active`, and a `follow_accepted` activity is written (`actor_id` = caller, `target_user_id` = follower).
  - **Decline:** the row and its `follow_requested` activity are deleted.
- **Trigger `profiles_approve_requests_on_public`:** after update of `visibility` from `private` to `public`, every `requested` row for that profile becomes `active`, with no activities. Going public → private leaves existing followers active.
- **`public.get_profile(p_user_id uuid) returns table (id uuid, username text, display_name text, avatar_path text, bio text, home_city text, visibility public.profile_visibility, followers_count int, following_count int, dishes_count int, viewer_follow text, follows_viewer boolean, can_see_picks boolean, is_me boolean)`** (`authenticated`, stable):
  - No row when the profile is missing or blocked.
  - `bio` and `home_city` (= `home_place_text`) are null unless `can_see_picks`. `home_city` is also null when `show_home_city` is false and the caller isn't the owner.
  - Counts are of active follows only. `dishes_count` is null unless `can_see_picks`.
  - `viewer_follow` is `'none' | 'requested' | 'active'`. `follows_viewer` is true when the target actively follows the caller.
- **`public.list_followers(p_user_id uuid, p_q text default null, p_offset int default 0, p_limit int default 20)` and `public.list_following(...)`:**
  - Both return `table (id uuid, username text, display_name text, avatar_path text, viewer_follow text, follows_viewer boolean, is_me boolean)`.
  - Active follows only, newest follow first.
  - `p_q` matches the start of the username or of any word of the display name, case- and accent-insensitive.
  - Empty when `_can_see(caller, p_user_id)` is false. Blocked people are left out.
- **`public.search_people(p_q text, p_limit int default 20)`:** the same columns.
  - Prefix match on username, then on display-name words, ordered by active-follower count then username.
  - Blocked people and the caller are excluded. A blank query returns nothing.
  - Private accounts are included (name and photo are always visible).
- **`public.suggested_people(p_limit int default 5)`:** the same columns plus `top_dish text` (the dish name of their slot-1 Final Meal, else null).
  - Trusted public accounts the caller doesn't follow (no row at all), excluding the caller and blocks.
  - Order: home within 25 km of the caller's `home_location` first, then active-follower count descending, then username.
  - A caller without a home city just gets the second ordering.

- [ ] **Step 1: Write the failing pgTAP tests**, as `authenticated` with JWT claims set as in `picks.test.sql`.
  - **`follows.test.sql`:**
    - following a public user gives `active` plus one `followed` activity; calling again returns `active` with still one row and one activity
    - following a private user gives `requested` plus `follow_requested`
    - `respond_follow_request(…, true)` gives `active` plus `follow_accepted`
    - `false` deletes the row and its activity
    - a missing request raises `request_not_found`
    - unfollow removes the row and the `followed` activity
    - following self raises `cannot_follow_self`
    - a block either way raises `profile_unavailable`
    - switching private → public approves pending requests
    - direct `insert`/`update`/`delete` on `follows` throw `42501`
    - a third user can't see a follow row between two others
    - `select * from activities` as a user returns only their own
  - **`people.test.sql`:**
    - `get_profile` of a private user as a stranger has null `bio`/`home_city`/`dishes_count` and `can_see_picks = false`; as an active follower they're filled
    - `show_home_city = false` hides the city from others but not from the owner
    - blocked gives no row
    - `list_followers` of a private user is empty for a stranger and full for a follower
    - `search_people('ar')` finds `arimitchell`
    - `suggested_people` for Josie starts with the Vancouver trusted public people she doesn't follow and never includes Sam (`new`), Priya (private, from Task 3's seed; until then create a private fixture user in the test) or Josie
- [ ] **Step 2: Run the tests.** `pnpm db:reset </dev/null && pnpm db:test`. Expected: FAIL (functions missing).
- [ ] **Step 3: Implement** both migrations and the rls test updates. Record each function, the policy changes and the trigger in `docs/ops/supabase.md`. Update the spec §4 lines.
- [ ] **Step 4: Run the tests again.** Same command. Expected: PASS, including the earlier suites.
- [ ] **Step 5: Commit.** `Add follows with request and approval, profiles and people lookups`

### Task 2: Activity fan-out, notifications, preferences, push queue and sender

**Files:**
- Create: migration `<ts>_notifications.sql`, `supabase/functions/_shared/push-sender.ts`, `supabase/functions/push-dispatch/index.ts`, `supabase/tests/database/notifications.test.sql`, `packages/api/src/push.integration.test.ts`, `scripts/push-dispatch.mjs`
- Modify: `supabase/config.toml` (`[functions.push-dispatch] verify_jwt = true`), `scripts/write-local-env.mjs` (also write `SUPABASE_SERVICE_ROLE_KEY`, from `status.SECRET_KEY || status.SERVICE_ROLE_KEY`, to `packages/api/.env.test.local` **only**; never to an app env file), `packages/api/src/test-support/env.ts` (`serviceRoleKey(): string`), root `package.json` (`"push:dispatch": "node scripts/push-dispatch.mjs"`), `docs/ops/supabase.md` (also fill in the "Edge Functions" and "Secrets" sections: `PUSH_SENDER`), `docs/known-gaps.md` (remove the `notifications_update_own` gap; add "Phase 8: Expo push sender, schedule `push-dispatch` (cron or database webhook), prune old `push_outbox` rows"), the spec §4 (new tables `notification_preferences`, `push_outbox`)

**Interfaces:**
- **`notification_preferences`:**
  - `user_id uuid primary key references profiles on delete cascade`
  - `push_dethroned boolean not null default true`, `push_new_followers … default true`, `push_saves … default true`, `push_friends_finals … default true`
  - `created_at`, `updated_at` (trigger)
  - **RLS:** select and update own. Column grant: `update (push_dethroned, push_new_followers, push_saves, push_friends_finals)` to `authenticated`; no insert or delete.
  - A row is created by an `after insert` trigger on `profiles`, and the migration backfills existing profiles.
- **`push_outbox`:**
  - `id uuid pk`, `user_id uuid not null references profiles on delete cascade`, `activity_id uuid not null references activities on delete cascade`, `title text not null`, `body text not null`, `data jsonb not null default '{}'`
  - `status text not null default 'pending' check (status in ('pending','sending','sent','failed'))`, `sender text`, `attempts int not null default 0`
  - `created_at`, `sent_at timestamptz`
  - RLS on with no policies; all privileges revoked from `anon` and `authenticated`.
- **`push_tokens`:**
  - Add `updated_at`.
  - Revoke `insert, update, delete, truncate` from clients; replace `push_tokens_own` with select-own.
- **`public.register_push_token(p_token text, p_platform text) returns void`:**
  - The token must match `^Expo(nent)?PushToken\[[^\]]+\]$`, otherwise it raises `invalid_push_token`. `p_platform` is `ios` or `android`.
  - Upserts on `expo_token`. A token seen under another user moves to the caller (the same phone signed into a new account).
- **`public.unregister_push_token(p_token text) returns void`:** deletes the caller's row; a no-op otherwise.
- **Notifications:**
  - Revoke `update, insert, delete, truncate` on `notifications` from clients and drop `notifications_update_own`.
  - Add `notifications (activity_id)` index.
  - `alter publication supabase_realtime add table public.notifications`.
- **`public.mark_notifications_read(p_ids uuid[] default null) returns void`:** sets `read_at = now()` on the caller's unread rows (all of them when `p_ids` is null).
- **`public.unread_notification_count() returns int`:** the caller's unread rows.
- **`public.get_my_notifications(p_before timestamptz default null, p_limit int default 20)`** returns `table (id uuid, created_at timestamptz, read_at timestamptz, type public.activity_type, actor_id uuid, actor_username text, actor_display_name text, actor_avatar_path text, pick_id uuid, dish_name text, photo_path text, other_dish_name text, list_title text, viewer_follow text, request_pending boolean)`:
  - newest first, `created_at < p_before`
  - `request_pending` is true when a `follow_requested` row's follow is still `requested`
  - rows whose actor is now blocked either way are left out
- **Fan-out:** `public._fan_out_activity()`, as a **constraint trigger** `activities_fan_out after insert on activities deferrable initially deferred for each row`. At commit it skips an `added_final` or `promoted` row when a `dethroned` row for the same `pick_id` with the same `created_at` exists. Recipients, never the actor and never across a block:

| Activity | Recipients | In-app row | Push preference |
|---|---|---|---|
| `followed`, `follow_requested`, `follow_accepted` | `target_user_id` | yes | `push_new_followers` |
| `saved_pick` | the owner of `pick_id` | yes | `push_saves` |
| `saved_from_list` | the owner of `list_id` | yes | `push_saves` |
| `dethroned` | the actor's active followers | yes | `push_dethroned` |
| `added_final`, `promoted` | the actor's active followers | no (the feed covers them) | `push_friends_finals` |
| `added_honorable` | nobody | no | none |

  - A `push_outbox` row is queued only when the preference is on **and** the recipient has at least one push token.
  - A `followed` push is skipped when the same actor already queued one to the same recipient in the last 24 hours.
  - The notification's `created_at` equals the activity's `created_at`.
- **Push text:** `public._push_text(type, actor_name, dish, other_dish, list_title) returns table(title text, body text)`. Title `Final Meal`; bodies:
  - `followed`: `<Name> started following you.`
  - `follow_requested`: `<Name> wants to follow you.`
  - `follow_accepted`: `<Name> approved your follow request.`
  - `saved_pick`: `<Name> saved your <Dish>.`
  - `saved_from_list`: `<Name> saved picks from your list <Title>.`
  - `dethroned`: `<Name> dethroned <Old> with <New> on their Final Meal.`
  - `added_final`: `<Name> added <Dish> to their Final Meal.`
  - `promoted`: `<Name> promoted <Dish> to their Final Meal.`
  - `data` = `{ "type": …, "pickId"?: …, "userId": <actor id> }`.
- **`public.claim_push_batch(p_limit int default 100) returns setof public.push_outbox`** (service_role only): `pending` rows oldest first, `for update skip locked`, set to `sending` with `attempts + 1`.
- **`public.finish_push_batch(p_ids uuid[], p_status text, p_sender text) returns void`** (service_role only): sets `status`, `sender` and `sent_at`.
- **`supabase/functions/_shared/push-sender.ts`:**
  - `export interface PushMessage { to: string; title: string; body: string; data: Record<string, unknown> }`
  - `export interface PushSender { name: string; send(messages: PushMessage[]): Promise<{ ok: number; failed: number }> }`
  - `logSender` (logs one line per message, `[push:log] <to> <title>: <body>`) and `noopSender`
  - `senderFromEnv(value: string | undefined): PushSender`: `log` (also the default for unknown values or `expo`, with a one-time warning `Expo sender arrives in Phase 8; using log`) or `noop`. No Deno APIs in this file.
- **`push-dispatch`** (POST):
  - Rejects anything but a service-role JWT with 401.
  - Claims a batch, joins each row's user to their tokens (one message per token), sends through `senderFromEnv(Deno.env.get('PUSH_SENDER'))`, then marks the rows `sent` (or `failed` when the sender reports failures for every token of a row).
  - Responds `{ claimed, sent, failed, sender }`.
- **`scripts/push-dispatch.mjs`:** reads `supabase status -o json` the same way `write-local-env.mjs` does, POSTs to `<API_URL>/functions/v1/push-dispatch` with the service key, and prints the JSON. The key is never printed.

- [ ] **Step 1: Write the failing tests.**
  - **`notifications.test.sql`** (commit-time behaviour: run the inserts, then `set constraints all immediate` to fire the deferred trigger inside the test transaction):
    - a new profile gets a preferences row with the four defaults
    - A follows public B gives B one unread notification and, once B has a token, one outbox row with body `Alice started following you.`
    - with B's `push_new_followers` off: notification yes, outbox no
    - a re-follow within 24 h queues no second push
    - `saved_pick` notifies the pick owner, never the actor
    - `add_pick` with a replace slot by A, followed by C: C gets one `dethroned` notification and one push (`dethroned`), and no `added_final` push
    - a plain `added_final` by A: C gets no notification and one push if `push_friends_finals` is on
    - blocked recipients get nothing
    - `mark_notifications_read(null)` sets every `read_at`; `unread_notification_count()` goes to 0
    - direct `update notifications set activity_id = …` throws `42501`
    - `register_push_token('ExponentPushToken[abc]','ios')` twice gives one row, and from another user the row moves
    - a bad token raises `invalid_push_token`
    - `authenticated` can't select `push_outbox` or execute `claim_push_batch`
    - `get_my_notifications` returns `dish_name`/`other_dish_name` for the dethroned row and `request_pending` for a pending request
  - **`push.integration.test.ts`** (local stack):
    - two fresh users; B registers `ExponentPushToken[test-<suffix>]`; A follows B
    - POST `/functions/v1/push-dispatch` with `serviceRoleKey()` gives 200 with `sender: 'log'` and `claimed >= 1`
    - a second POST claims 0 for that row
    - POST with B's user JWT gives 401
- [ ] **Step 2: Run the tests.** `pnpm db:reset </dev/null && pnpm db:test`, then `pnpm env:local && pnpm --filter @finalmeal/api test:integration -- push`. Expected: FAIL.
- [ ] **Step 3: Implement.** If `supabase start` doesn't serve the function after a restart (`pnpm db:stop && pnpm db:start`), document `pnpm exec supabase functions serve` in `docs/ops/supabase.md` and in the test's skip message. Don't silently skip.
- [ ] **Step 4: Run the tests again.** Same commands. Expected: PASS. Also run `pnpm push:dispatch` once and paste its output in the report.
- [ ] **Step 5: Commit.** `Fan activities out to notifications and a push queue with a log-only sender`

### Task 3: Saves, feeds, pick detail, server-side duplicates, and a livelier seed

**Files:**
- Create: migration `<ts>_feeds_and_saves.sql`, `supabase/tests/database/feed.test.sql`, `supabase/tests/database/saves.test.sql`
- Modify: `supabase/seed.sql`, `supabase/tests/database/seed.test.sql` (new counts, with the reason for each), `supabase/tests/database/picks.test.sql` (duplicate detail), `docs/ops/supabase.md`, the spec §4 (`saves.via_pick_id`, `saves.via_user_id`) and §5.4 (Nearby, as defined below)

**Interfaces:**
- **`saves`:**
  - Add `via_pick_id uuid references picks on delete set null` and `via_user_id uuid references profiles on delete set null`.
  - Revoke `insert, update, delete, truncate` from clients; replace `saves_own` with select-own.
- **`public.save_dish(p_dish_id uuid, p_via_pick_id uuid default null) returns void`:**
  - `dish_not_found` for an unknown or merged dish.
  - A via pick must be of that dish and visible (`_can_see`) and not the caller's own, otherwise it's treated as null.
  - Idempotent: if the row exists, nothing changes.
  - A new save with a via pick writes `saved_pick` (`actor_id` = caller, `pick_id` = via pick).
- **`public.unsave_dish(p_dish_id uuid) returns void`:** deletes the row and the caller's `saved_pick` activity for that save's via pick.
- **`public.get_my_saves()`** returns `table (dish_id uuid, dish_name text, place public.places, via_pick_id uuid, via_tier public.pick_tier, via_user_id uuid, via_username text, photo_path text, saved_at timestamptz, distance_m double precision)`:
  - newest first
  - `place` passes through `mask_place`
  - `via_*` is null when the via pick is gone or no longer visible
  - `photo_path` is the via pick's photo
  - `distance_m` is measured from the caller's `home_location` (null without one)
- **Feed row shape** (both feeds return it):

  ```
  table (item_key text, kind text, at timestamptz, actor_id uuid, actor_username text,
         actor_display_name text, actor_avatar_path text, pick_id uuid, tier public.pick_tier,
         slot smallint, note text, photo_path text, dish_id uuid, dish_name text,
         place public.places, tags jsonb, other_dish_name text, list_count int, saved_by_me boolean)
  ```

  - `tags`: global tags only, as `[{id, kind, name, slug, is_featured}]`
  - `tier`/`slot` are the pick's **current** values
  - `list_count` comes from `dish_stats`
  - `saved_by_me` reports whether the caller saved the dish
- **`public.following_feed(p_before timestamptz default null, p_before_key text default null, p_limit int default 20)`:**
  - Activities of type `added_final`, `added_honorable`, `promoted` or `dethroned` by people the caller **actively** follows. Never the caller's own; never across a block.
  - An `added_final`/`promoted` row is hidden when a `dethroned` row for the same `pick_id` and the same `created_at` exists.
  - `kind` = the activity type; `item_key` = the activity id; `other_dish_name` = the dethroned pick's dish (null when it's gone).
  - Order: `created_at desc, id desc`, with keyset paging on `(p_before, p_before_key)`.
- **`public.nearby_feed(p_offset int default 0, p_limit int default 20)`:**
  - Picks (not activities) by `trusted`, `public`, non-blocked accounts other than the caller, at places within 25 000 m of the caller's `home_location`.
  - `kind` = `added_final` or `added_honorable` from the current tier; `item_key` = the pick id; `at` = the pick's `created_at`.
  - Rank: `extract(epoch from created_at) + 86400 * ln(1 + list_count)` descending, then pick id. Each e-fold of list count is worth one day of recency.
  - Empty when the caller has no home city. Offset paging; at most 200 rows in total.
- **`public.get_pick_detail(p_pick_id uuid)`** returns `table (pick_id uuid, tier public.pick_tier, slot smallint, note text, photo_path text, original_dish_name text, created_at timestamptz, dish_id uuid, dish_name text, place public.places, tags jsonb, owner_id uuid, owner_username text, owner_display_name text, owner_avatar_path text, is_mine boolean, final_count int, list_count int, pickers jsonb, saved_by_me boolean)`:
  - `tags` includes personal tags only when `is_mine`
  - `pickers` = up to 4 `{id, username, display_name, avatar_path}` of trusted **public** accounts with this dish as a Final Meal, the owner first if they qualify
  - no row when the pick is missing or `_can_see` is false
- **`public.place_pickers(p_place_id uuid, p_limit int default 3)`** returns `table (other_count int, people jsonb)`:
  - `other_count` = distinct trusted accounts other than the caller with any pick at the place (private accounts count, as in Discover)
  - `people` = up to `p_limit` public ones
- **`add_pick` duplicate detail (known gap M5):** `create or replace public.add_pick` with the same signature and body. The only change is `raise exception 'duplicate_pick' using detail = json_build_object('pick_id', <existing id>, 'tier', <existing tier>)::text`. Restate grants.
- **Seed** (`seed.sql`, dev only):
  - **New person:** `('00000000-0000-4000-8000-000000000007', 'priyashah', 'Priya Shah', 'Dumplings are a personality.', 6173331, 'trusted')`, with `visibility = 'private'`.
  - **New dishes:** `Chicken Karaage` (Marutama), `Pad See Ew` (Kin Kao), `Butter Chicken` (Spicy Time), `Spicy Tuna Roll` (Nami), `Xiao Long Bao` (Lotus Noodle Bar).
  - **Picks and times:** keep Josie's picks and minutes. Change the others' minutes, and add new picks, to:

| Person | Dish | Tier/slot | Note | mins |
|---|---|---|---|---|
| mike | Smash Burger | final 1 | | 4300 |
| mike | Wagyu Beef Don | final 2 | (keep) | 300 |
| mike | Spicy Tuna Roll | honorable | | 2900 |
| ari | Pork Gyro | final 1 | (keep) | 120 |
| ari | Smash Burger | final 2 | | 2 |
| ari | Tacos Al Pastor | honorable | | 5000 |
| ari | Chicken Karaage | honorable | `Crunchiest in the city.` | 180 |
| alli | Plain Biryani / Khao Soi / Tacos Al Pastor | final 1/2/3 | (keep) | 1000/1100/1200 |
| alli | Butter Chicken | honorable | `Order it hot. Then hotter.` | 1500 |
| dev | Tonkotsu Ramen | final 1 | (keep) | 170 |
| dev | Pad See Ew | final 2 | | 600 |
| dev | Khao Soi | honorable | (keep) | 2000 |
| sam | Omakase | honorable | | 900 |
| priya | Xiao Long Bao | final 1 | `Worth the burnt tongue.` | 240 |
| priya | Cardamom Bun | honorable | | 4000 |

  - **Activities:**
    - one `added_final`/`added_honorable` per pick at the pick's time; Ari's Tacos as `added_final`, since it was dethroned later
    - the existing Ari `dethroned` (Smash Burger replaced Tacos) at 2 minutes, with the same `created_at` as Ari's Smash Burger `added_final`
    - Alli `followed` Josie at 14 minutes
    - Mike `saved_pick` Josie's Pork Gyro at 60 minutes
    - Mike `saved_from_list` `josies-vancouver` at 2880 minutes
    - Josie and Sam `follow_requested` Priya at 30 and 50 minutes
    - set every `created_at` explicitly
  - **Follows:** keep the existing ones; add Josie → Priya and Sam → Priya as `requested`.
  - **Saves:** Josie saves Chicken Karaage via Ari's pick (30 min ago), Pad See Ew via Dev's (60), Butter Chicken via Alli's (90) and Spicy Tuna Roll via Mike's (120), each with its `saved_pick` activity at that time. Mike's existing save gets `via_pick_id` = Josie's Pork Gyro.
  - **Notifications:**
    - remove the hand-written `insert into notifications`; the fan-out trigger now creates them
    - the trigger is deferred, so run `set constraints all immediate;` after the activity inserts, so the notifications exist before the next step
    - then mark read every notification older than 30 minutes, so Josie's Activity opens with two unread (Ari's dethroning, Alli's follow) as on the board
    - the seed adds no push tokens, so no outbox rows

- [ ] **Step 1: Write the failing pgTAP tests.**
  - **`feed.test.sql`**, as Josie:
    - `following_feed()` starts with Ari's `dethroned` row (`other_dish_name = 'Tacos Al Pastor'`), with no `added_final` row for that pick, then Ari's Pork Gyro, then Dev's Tonkotsu Ramen
    - it never contains Josie's, Alli's, Sam's or Priya's activities
    - a second page with the last row's key continues without overlap
    - after `respond_follow_request` as Priya approves Josie, Priya's activities appear
    - `nearby_feed()` contains only Vancouver-area picks by Ari, Alli and Dev, never Sam (`new`), Priya (private), Mike (no Vancouver picks), Josie, or Tokyo places
    - with Josie's home city cleared, Nearby is empty
    - with Ari made private, Ari leaves Nearby
    - tags never include personal tags
    - `get_pick_detail` of Mike's Wagyu Beef Don as Josie has `is_mine = false` and `final_count` matching `dish_stats`; of Priya's pick as a stranger, no row; as Josie after approval, a row
    - a removed pick gives no row and its feed and notification rows are gone
    - `place_pickers(Skewers)` as Josie counts Ari and not Josie
  - **`saves.test.sql`:**
    - `save_dish` twice gives one row and one `saved_pick` activity, and notifies the via owner once
    - `unsave_dish` removes both
    - saving through your own pick stores a null via
    - an unknown dish raises `dish_not_found`
    - direct insert into `saves` throws `42501`
    - `get_my_saves()` as Josie returns the four seeded saves newest first, with `via_username` set
    - after Ari removes Chicken Karaage, the save remains with a null via
  - **`picks.test.sql`:** the duplicate case now asserts the error detail JSON names the existing pick's id and tier.
  - **`seed.test.sql`:** Josie has 4 notifications (2 unread), Priya has 2 pending requests, and the profile/pick/save counts are updated.
- [ ] **Step 2: Run the tests.** `pnpm db:reset </dev/null && pnpm db:test`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration, the seed and the doc updates.
- [ ] **Step 4: Run the tests again.** Same command. Expected: PASS, all suites.
- [ ] **Step 5: Commit.** `Add saves, Following and Nearby feeds, pick detail and a social dev seed`

### Task 4: API and core: social, feed, saves, notifications, push tokens

**Files:**
- Create in `packages/api/src/`: `people.ts`, `feed.ts`, `saves.ts`, `notifications.ts`, `push.ts` (+ unit tests each), `social.integration.test.ts`
- Modify in `packages/api/src/`: `picks.ts` (`getPickDetail`, `getProfilePicks`), `profile.ts` (active-only counts), `errors.ts` / `friendly.ts` (new codes, `ApiError.existingPick`), `index.ts`, `database.types.ts` (regenerate)
- Create in `packages/core/src/`: `social.ts` (+ `social.test.ts`); export it from `index.ts`

**Interfaces:**
- **Consumes:** the Task 1–3 SQL functions, as named there.
- **Types:**
  - `PersonSummary = { id: string; username: string; displayName: string; avatarUrl: string | null }`
  - `FollowState = 'none' | 'requested' | 'active'`
  - `PersonRow = PersonSummary & { viewerFollow: FollowState; followsViewer: boolean; isMe: boolean }`
  - `SuggestedPerson = PersonRow & { topDish: string | null }`
  - `ProfileView = PersonSummary & { bio: string | null; homeCity: string | null; visibility: 'public' | 'private'; counts: { followers: number; following: number; dishes: number | null }; viewerFollow: FollowState; followsViewer: boolean; canSeePicks: boolean; isMe: boolean }`
  - `FeedKind = 'added_final' | 'added_honorable' | 'promoted' | 'dethroned'`
  - `FeedItem = { key: string; kind: FeedKind; at: string; actor: PersonSummary; pick: Pick; otherDishName: string | null; listCount: number; savedByMe: boolean }`. `pick.tags` are global only; `pick.originalDishName` = the dish name.
  - `FeedCursor = { before: string; beforeKey: string }`
  - `PickDetail = { pick: Pick; owner: PersonSummary; isMine: boolean; finalCount: number; listCount: number; pickers: PersonSummary[]; savedByMe: boolean }`
  - `SavedDish = { dish: { id: string; name: string }; place: Place; via: PersonSummary | null; viaPickId: string | null; viaTier: 'final' | 'honorable' | null; photoUrl: string | null; savedAt: string; distanceM: number | null }`. `via` has only `id` and `username`; `displayName` = username and `avatarUrl` = null. That is all the Saved card shows.
  - `ActivityType` = the enum.
  - `ActivityItem = { id: string; type: ActivityType; at: string; readAt: string | null; actor: PersonSummary; pickId: string | null; dishName: string | null; otherDishName: string | null; listTitle: string | null; photoUrl: string | null; viewerFollow: FollowState; requestPending: boolean }`
  - `NotificationSettings = { dethroned: boolean; newFollowers: boolean; saves: boolean; friendsFinals: boolean }`
- **Functions** (each wraps the same-named SQL; avatar and photo paths become public URLs as in Phase 2–3):
  - `getProfile(client, id): Promise<ProfileView | null>`
  - `getProfilePicks(client, userId): Promise<Pick[]>`: the `getMyPicks` query for another user, sorted with `sortPicks`. Call it only when `canSeePicks`; Phase 7 enforces this in RLS.
  - `followUser(client, id): Promise<FollowState>`, `unfollowUser(client, id): Promise<void>`, `respondToFollowRequest(client, followerId, accept: boolean): Promise<void>`
  - `listFollowers(client, userId, opts?: { q?: string; offset?: number; limit?: number }): Promise<PersonRow[]>` and `listFollowing(…)`
  - `searchPeople(client, q, limit?)`, `getSuggestedPeople(client, limit?)`
  - `getFollowingFeed(client, cursor?: FeedCursor, limit = 20): Promise<{ items: FeedItem[]; next: FeedCursor | null }>`
  - `getNearbyFeed(client, offset = 0, limit = 20): Promise<{ items: FeedItem[]; nextOffset: number | null }>`. `next` is null when fewer than `limit` come back.
  - `getPickDetail(client, id): Promise<PickDetail | null>`
  - `getPlacePickers(client, placeId): Promise<{ otherCount: number; people: PersonSummary[] }>`
  - `saveDish(client, dishId, viaPickId?)`, `unsaveDish(client, dishId)`, `getMySaves(client): Promise<SavedDish[]>`
  - `getMyNotifications(client, opts?: { before?: string; limit?: number }): Promise<ActivityItem[]>`, `getUnreadCount(client): Promise<number>`, `markNotificationsRead(client, ids?: string[]): Promise<void>`
  - `subscribeToMyNotifications(client, userId, onChange: () => void): () => void`: a Realtime `postgres_changes` insert subscription on `notifications` filtered by `user_id`; returns the unsubscribe.
  - `getMyNotificationSettings(client)`, `updateMyNotificationSettings(client, patch: Partial<NotificationSettings>): Promise<NotificationSettings>`
  - `registerPushToken(client, token, platform: 'ios' | 'android')`, `unregisterPushToken(client, token)`
- **Errors:** the new codes join `FriendlyCode`, `DOMAIN_MESSAGES` and the copy (Global Constraints). For `duplicate_pick`, `throwIfError` parses the PostgREST `details` JSON into `ApiError.existingPick: { id: string; tier: 'final' | 'honorable' } | null`. It's null for other errors, or when the details don't parse.
- **`@finalmeal/core` `social.ts`:**
  - `relativeTime(iso: string, now: Date): string` (rules in Global Constraints)
  - `isSameLocalDay(iso: string, now: Date): boolean`
  - `feedCaption(kind: FeedKind, otherDishName: string | null): string`:
    - `added_final` → `added to their Final Meal`
    - `added_honorable` → `added an Honorable Mention`
    - `promoted` → `promoted to their Final Meal`
    - `dethroned` → `dethroned <other> from their Final Meal`, or `added to their Final Meal` when `otherDishName` is null
  - `countLabel(n: number, unit: 'list' | 'finalMeal'): string | null` → `On 1 list` / `On 8 lists` / `On 1 Final Meal` / `On 23 Final Meals`; null at 0
  - `othersAtPlaceLabel(n: number, city: string, place: string): string | null` → `1 other in Vancouver has Skewers on their list` / `8 others in Vancouver have Skewers on their list`; null at 0
  - `activitySentence(a: { type; actorName; dishName; otherDishName; listTitle; requestPending }): Array<{ text: string; style: 'name' | 'dish' | 'plain' }>`. The sentences match Task 2's push bodies, with the name segment `name` and dish/list segments `dish`. A `follow_requested` that is no longer pending reads `<Name> started following you.`
  - `SaveFilter = 'all' | 'final' | 'honorable' | 'nearby'`; `filterSaves(saves, f)`, where nearby means `distanceM !== null && distanceM <= 25000`
  - `NEARBY_RADIUS_M = 25000`

- [ ] **Step 1: Write the failing tests.**
  - **Unit (core):**
    - `relativeTime` at 30 s, 2 m, 59 m, 5 h, 30 h (`Yesterday`), 3 d and 9 d (`25 Oct` for a fixed `now`)
    - every `feedCaption`
    - `countLabel` singular, plural and 0
    - `othersAtPlaceLabel` singular and plural
    - `activitySentence` for each type, including the dethroned segments `['Ari Mitchell'(name), ' dethroned ', 'Tacos Al Pastor'(dish), ' with ', 'Smash Burger'(dish), ' on their Final Meal.']`
    - `filterSaves` for each filter
  - **Unit (api):** each new error code's copy; `existingPick` parsed from a fake PostgREST error, and null for garbage; row-to-type mapping for a feed row (avatar and photo URLs, global tags).
  - **Integration** (`social.integration.test.ts`, fresh users plus the seed):
    - a fresh user follows `arimitchell` and gets `active`, and `getProfile` shows `viewerFollow: 'active'`
    - follows `priyashah` and gets `requested`; `getProfile(priya)` has `canSeePicks: false` and `bio: null`
    - `getFollowingFeed` after following Ari starts with Ari's dethroned item; paging with `next` doesn't repeat
    - `getNearbyFeed` for a Vancouver-home user is non-empty; for a user without a home city it's empty
    - `saveDish` twice, then `getMySaves` has one entry; `unsaveDish` empties it
    - `getPickDetail` of a public pick has `isMine: false`
    - adding the same dish twice rejects with `existingPick.id` equal to the first pick
    - `registerPushToken` resolves; a bad token rejects
    - `updateMyNotificationSettings({ saves: false })` round-trips
    - `markNotificationsRead()` makes `getUnreadCount()` 0
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/core test && pnpm --filter @finalmeal/api test`, then `pnpm env:local && pnpm --filter @finalmeal/api test:integration`. Expected: FAIL.
- [ ] **Step 3: Implement.** Regenerate `database.types.ts` with the pinned CLI.
- [ ] **Step 4: Run the tests again.** Expected: green, plus root `pnpm lint && pnpm typecheck`. Run `pnpm db:reset </dev/null` afterwards.
- [ ] **Step 5: Commit.** `Add people, follows, feeds, saves, notifications and push tokens to the API`

### Task 5: Mobile: other profiles, followers and following, Find people

**Files:**
- Create in `apps/mobile/app/(app)/`: `u/[id].tsx`, `u/[id]/follows.tsx`, `people.tsx`
- Create in `apps/mobile/src/components/`: `FollowButton.tsx`, `PersonRow.tsx`, `OtherProfileHeader.tsx`, `SharedTaste.tsx` (+ tests)
- Create: `src/state/follow.ts` (`useFollow`) with tests
- Modify: `src/components/ProfileHeader.tsx` (followers and following stats become links to `/u/<me>/follows`), `app/(app)/(tabs)/you.tsx` (passes the handlers)

**Interfaces and copy** (boards OtherProfile, Followers, FeedEmpty):
- **`useFollow(person: { id; viewerFollow; followsViewer; visibility? })`** returns `{ state: FollowState; busy; toggle(): Promise<void> }`:
  - optimistic, with one call in flight at a time; extra taps while busy are ignored
  - reconciles to the state the server returned
  - on failure, reverts and exposes `error` (friendly copy)
  - when going from `active` to unfollow, asks first through `Alert.alert`:
    - title `Unfollow @<username>?`
    - message, for a private account only: `You’ll need to request again to see their picks.`
    - buttons `Cancel` and `Unfollow` (destructive)
  - cancelling a request (`requested`) needs no confirmation
- **`FollowButton`:**
  - `none` → `Follow` (ember), or `Follow back` (ember) when `followsViewer`
  - `requested` → `Requested` (outline)
  - `active` → `Following` (outline)
  - hidden for yourself
- **`/u/[id]`** (pushed over the tabs like Settings):
  - Header: Back and `@<username>`; no More options this phase.
  - Identity: Avatar 64 and name (Newsreader 26), then a line of `<home city> · <bio>` (either part may be missing; nothing when both are), rendered like the You header's city.
  - Stats: `<n> followers`, `<n> following` (links to `/u/[id]/follows?tab=followers|following` when `canSeePicks`), and `<n> dishes` (hidden when null).
  - A full-width `FollowButton` (Share is Phase 6).
  - `SharedTaste`: dishes both people have picked (either tier), computed from the two pick lists.
    - Copy: `You both love <b>Dish</b>`, plus ` + <n> more` when there are more.
    - Hidden when there are none or when it's your own profile.
  - Tabs: `Final Meal <n>` and `Honorable <n>`. **No Map tab on other profiles until Phase 5.**
  - A `FilterChips` row (`chipOptions` over the visible picks; no personal tags reach it).
  - `FinalMealList` (no empty-seat rows for other people) and `HonorableList`, opening `/pick/<id>`.
  - **Private and not approved:** the header, stats and FollowButton, then a centred block: title `This account is private` and body `Follow to see their picks.` (or `Your request is waiting for approval.` when `requested`).
  - Missing or blocked: `This profile isn’t available.`
  - Your own id redirects to the You tab.
- **`/u/[id]/follows`:**
  - Header: Back and `@<username>`.
  - Segmented tabs `<n> Followers` / `<n> Following` (selected underline in ember glow).
  - Search field: `Search followers` / `Search following` (300 ms debounce, passed as `q`).
  - `PersonRow` list: avatar 44, display name (bold), `@username`, and a `FollowButton`; tapping the row opens `/u/<id>`.
  - Infinite scroll, 20 at a time.
  - Empty states: `No followers yet.` / `Not following anyone yet.`, or `No one matches “<q>”.`
- **`/people`** (Find people):
  - title `Find people`; search field `Search people`
  - with an empty query: the section `Popular near <home city name>` (or `Popular on Final Meal` without a home city), listing `getSuggestedPeople(20)` as `PersonRow` with the subtitle `#1 · <topDish>` when set (otherwise `@username`)
  - typing runs `searchPeople`

- [ ] **Step 1: Write the failing tests:**
  - `useFollow`: optimistic Follow becomes `active`; a private target resolves to `requested`; a double tap makes one call; failure reverts and shows the copy; unfollow shows the confirm and only calls the API on `Unfollow`
  - `FollowButton` labels for all four states
  - the other profile renders the seed-shaped Alli fixture: name, `Saskatoon, SK · Spice level: nuclear.`, stats, tabs `Final Meal 3` / `Honorable 1`, and the chips
  - a private, not-approved fixture shows `This account is private` and never calls `getProfilePicks`
  - `SharedTaste` gives `You both love Plain Biryani + 1 more` for two shared dishes, and is hidden for none
  - follows list: switching tabs and searching pass the right args; empty copy
  - Find people: empty query shows the Popular section, typing calls `searchPeople`
  - You tab: the stats link to the follows screen
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Add other people's profiles, follower lists and Find people`

### Task 6: Mobile: the Feed tab, First landing's Nearby, and Add returning to where it opened

**Files:**
- Create in `apps/mobile/src/components/`: `FeedCard.tsx`, `FeedList.tsx`, `FeedEmpty.tsx`, `FeedHeader.tsx` (+ tests)
- Create: `src/state/landing.ts` (the in-session First-landing flag) with tests
- Modify:
  - `app/(app)/(tabs)/feed.tsx`
  - `src/components/FirstLanding.tsx` (the others-at-place line, the Nearby section)
  - `src/components/TabBar.tsx` (switching tabs clears the landing flag)
  - `app/(onboarding)/loading.tsx` (sets the flag)
  - `app/(app)/(tabs)/_layout.tsx`, `app/(app)/(tabs)/you.tsx` and `src/components/FirstLanding.tsx` (Add openers pass `from`)
  - `src/state/add-flow-base.ts` (`closeAddFlow`), `app/(app)/add/index.tsx` and `app/(app)/add/swap.tsx` (use `closeAddFlow`)
  - `docs/known-gaps.md` (remove "saving from the Add modal always ends on the You tab")

**Interfaces and copy** (boards Feed, FeedEmpty, FirstLand):
- **`FeedHeader`:**
  - the skull and the `Final Meal` wordmark (Instrument Serif 28)
  - a Search button (aria `Search`), which opens `/people` for now
  - a Notifications bell (aria `Notifications`) with an 8 px ember-glow dot when `getUnreadCount() > 0`. The count reloads on focus and on `subscribeToMyNotifications` events; unsubscribe on unmount.
- **Tabs:** `Following` | `Nearby` (Trending is not built), with the selected underline in ember glow.
- **`FeedCard`** (`item: FeedItem`):
  - Header:
    - Avatar 34 and `@username` (bold; tapping opens `/u/<actor id>`)
    - underneath, `feedCaption(kind, otherDishName) · relativeTime(at)`
  - Photo: 230 px, the pick photo or the placeholder tile (`ashRaised` with an image glyph). The badge sits top-left: `Final Meal · #<slot>` (ember, with skull) or `Honorable` (outline style).
  - Dish: Newsreader 26.
  - Place: pin icon and the place label `<name> · <city>`.
  - Tag chips, then the note in quotes (Newsreader italic 16).
  - Action row:
    - `Save` / `Saved` with a bookmark (filled when saved), calling `saveDish(dish.id, pick.id)` / `unsaveDish`; optimistic, with one call in flight
    - `countLabel(listCount, 'list')`
    - no Share
  - Tapping the photo or dish name opens `/pick/<pick id>`.
  - Your own picks never appear, so Save is always shown.
- **`FeedList`:**
  - pull to refresh, infinite scroll (20), and a footer spinner
  - load error: the friendly copy and a `Try again` button
  - `PhotoNotice` at the top, as on You
  - Following uses keyset `next`; Nearby uses `nextOffset`
- **`FeedEmpty`:**
  - **Following, following nobody:**
    - title `An empty table.`
    - body `Follow a few people and their picks show up here. Better yet, bring your friends.`
    - buttons `Invite friends` (ember, opens the React Native `Share` sheet with the message `I’m choosing my Final Meal: five dishes, forever. Come pick yours: https://finalmeal.example`, the link domain from the existing config value) and `Find people` (outline, opens `/people`)
    - section `Popular near <home city name>` (or `Popular on Final Meal`) with `getSuggestedPeople(5)` rows: avatar, display name, `#1 · <topDish>`, and a `FollowButton`
  - **Following, follows people but no items:** title `Nothing new yet.`, body `When people you follow add dishes, they show up here.`, and the same Popular section.
  - **Nearby, no home city:** title `Set your home city to see picks near you.` and the button `Choose home city` (opens `/settings/home-city`).
  - **Nearby, empty:** title `Nothing nearby yet.` and body `When people near <city> add dishes, they show up here.`
- **First landing** (`src/state/landing.ts`: `markJustOnboarded()`, `clearJustOnboarded()`, `useJustOnboarded(): boolean`; in memory only):
  - The loading screen calls `markJustOnboarded()` before it routes to Feed. Feed renders `FirstLanding` while the flag is set, otherwise the feed. TabBar calls `clearJustOnboarded()` when the person switches to another tab. A restart clears it too.
  - `FirstLanding` adds:
    - **Under the hero card:** up to 3 avatars, then `othersAtPlaceLabel(otherCount, place.city, place.name)` from `getPlacePickers(hero place)`; hidden at 0.
    - **Below the CTA:** the heading `Nearby in <home city name>`, then the first 3 Nearby items as `FeedCard`s. With no home city or no items, the section is hidden. `See the map` is Phase 5.
- **Add returns to where it opened (known gap):**
  - Every Add opener passes `from: usePathname()`: the tab bar `+`, You's empty seats, First landing's CTA and Swap's promote path from pick detail.
  - `closeAddFlow(router, from: string | undefined)` calls `router.dismissTo(from ?? '/(app)/you')`.
  - `add/index.tsx` and `add/swap.tsx` read `from` with `useLocalSearchParams` (the add layout forwards it to child screens) and call `closeAddFlow` instead of `dismissTo('/(app)/you')`.

- [ ] **Step 1: Write the failing tests:**
  - `FeedCard` renders the Feed-board fixture: `@arimitchell`, `added to their Final Meal · 2h`, `Final Meal · #1`, `Pork Gyro`, `Skewers · Vancouver`, the note in quotes and `On 8 lists`
  - the dethroned caption
  - Save calls `saveDish` once on a double tap and flips to `Saved`
  - `FeedList` paging requests the next page with the cursor; error and `Try again`
  - each `FeedEmpty` variant's copy; Invite opens Share with the exact message
  - Nearby without a home city shows the prompt and never calls `getNearbyFeed`; no `expo-location` import anywhere in the feed files (extend `add-flow-no-location.test.ts` to cover `src/components/Feed*.tsx` and `app/(app)/(tabs)/feed.tsx`)
  - the bell dot shows at count 1 and hides at 0
  - landing flag: Feed shows First landing after `markJustOnboarded()` and the feed after a tab switch
  - First landing renders `8 others in Vancouver have Skewers on their list` (fixture count 8) and the `Nearby in Vancouver` section
  - `closeAddFlow` with `from: '/feed'` dismisses to `/feed`, and without `from` to `/(app)/you`
  - Add saved from First landing returns to Feed
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Build the Following and Nearby feed and return Add to where it opened`

### Task 7: Mobile: pick detail for anyone, Save to try, Saved tab, server-side duplicates

**Files:**
- Modify:
  - `app/(app)/pick/[id].tsx` (loads `getPickDetail`; your own picks keep the Phase 3 view and actions)
  - `app/(app)/(tabs)/saved.tsx`
  - `app/(app)/add/index.tsx` and `src/state/save-pick.ts` (use `ApiError.existingPick`)
  - `src/state/add-dish.ts` (delete `findExistingPick` and `dishKey` with their tests)
  - `docs/known-gaps.md` (remove the Phase 4 duplicate-detection item)
- Create in `apps/mobile/src/components/`: `OtherPickView.tsx`, `PickersRow.tsx`, `SaveButton.tsx`, `SavedGrid.tsx` (+ tests); `src/state/save.ts` (`useSave`) with tests

**Interfaces and copy** (boards PickDetail, Saved):
- **`useSave(dishId, viaPickId, initial: boolean)`** returns `{ saved; busy; toggle() }`: optimistic, one call in flight, reverts with the friendly copy on failure, and calls `announceSavesChanged()` (a version store like `pick-changes.ts`, in `src/state/save.ts`) so Saved reloads.
- **Pick detail, someone else's pick** (`OtherPickView`):
  - **Hero (400 px):**
    - the photo or placeholder
    - Back (top left)
    - a bookmark button (aria `Save`, filled when saved, same toggle) on the right; no Share
    - the badge bottom-left: `Final Meal · #<slot>` or `Honorable`
  - Dish name (Newsreader 40), then the pin with the place label `<name> · <area or street>, <city>` (the Phase 3 detail label), then the tag chips.
  - **Buttons:** `Directions` (outline, the Phase 3 `openDirections`) and `SaveButton`: `Save to try` (ember, bookmark), or once saved `Saved` (outline, filled bookmark); tapping again unsaves.
  - **Quote figure** (only when there's a note): the note in quotes (Newsreader italic 19). The caption is an Avatar 28, then `@username` (bold link to `/u/<owner>`), then ` · #<slot> on their Final Meal` or ` · Honorable Mention`. Without a note, the caption row still shows, without the quote.
  - **`PickersRow`:** up to 4 overlapping avatars, then `countLabel(finalCount, 'finalMeal')`. Hidden when null. Not tappable this phase (no chevron).
  - Missing or not allowed: `That pick isn’t there any more.` and a Back button.
- **Your own pick:** the Phase 3 screen, unchanged, plus `PickersRow` (the "On 23 Final Meals" row that was hidden until Phase 4).
- **Saved tab:**
  - Header `Saved to try` (Newsreader italic 32); no Map view button.
  - Chips `All`, `Final Meals`, `Honorable`, `Nearby` (single select; `filterSaves`).
  - A 2-column grid of `SavedGrid` cards: a 168 px photo or placeholder tile with the badge `Final Meal` / `Honorable` (by `viaTier`; no badge when `via` is gone), the dish (Newsreader 19), `<place name> · <city>`, and `via @<username>` when `via` is set.
  - Tapping opens `/pick/<viaPickId>`, or when that's gone, does nothing but show the card. A long press offers `Remove from Saved` (`Alert` with `Cancel` / `Remove`).
  - Reloads on focus and on `announceSavesChanged`.
  - Empty: title `Nothing saved yet.` and body `Tap Save on a dish you want to try and it lands here.`
  - Filter empty: `Nothing here with this filter.`
  - Nearby with no home city: `Set your home city to see saves near you.`
- **Duplicates (known gap M5):**
  - `add/index.tsx` offers `Make it a Final Meal instead` when `e.existingPick?.tier === 'honorable'` and Final Meal was chosen; it fetches that pick with `getPick(existingPick.id)` for `promoteWithDraft`.
  - `save-pick.ts`'s retry path treats `duplicate_pick` with `existingPick.tier === draft.tier` after an unsure attempt as saved, re-reading the pick by id for `photoFailed`.
  - No client-side name matching remains.

- [ ] **Step 1: Write the failing tests:**
  - `OtherPickView` with the PickDetail-board fixture: `Wagyu Beef Don`, `Sushi Itto · Shibuya, Tokyo`, the chips, `Directions`, `Save to try`, `“God tier. I still dream about it.”`, `@mikebrennan · #2 on their Final Meal` and `On 23 Final Meals`
  - Save toggles to `Saved` and back; double tap makes one call; the hero bookmark mirrors it
  - no Share control is rendered
  - a null detail shows `That pick isn’t there any more.`
  - your own pick still shows the Phase 3 actions and the pickers row
  - Saved: the Saved-board fixture renders four cards with `via @mikebrennan` etc.; each chip filters (Nearby by `distanceM`); empty and filter-empty copy; long-press remove calls `unsaveDish`
  - a duplicate refusal carrying `existingPick` (honorable) offers promote, using that id, with a fuzzy-typed name the old client check missed ("Tonkotsu Ramen (extra chashu)")
  - the retry-after-timeout path counts a same-tier duplicate as saved
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Open anyone's pick, save dishes to try, and use the server's duplicate detail`

### Task 8: Mobile: Activity, Notification settings, push registration

**Files:**
- Create in `apps/mobile/app/(app)/`: `notifications.tsx`, `settings/notifications.tsx`
- Create in `apps/mobile/src/components/`: `ActivityRow.tsx`, `ToggleRow.tsx` (+ tests)
- Create in `apps/mobile/src/lib/`: `push.ts` (+ test)
- Modify: `app/(app)/settings/index.tsx` (the `Notifications` row first under Preferences, bell icon), `src/providers/SessionProvider.tsx` (calls `registerForPushIfAvailable` after sign-in and `unregisterPushToken` before sign-out), `apps/mobile/package.json` (`expo-notifications` via `pnpm --filter @finalmeal/mobile exec expo install expo-notifications`), `docs/known-gaps.md` (remove the Settings Notifications row from "Hidden until their phase")

**Interfaces and copy** (boards Notifications, NotificationSettings, Settings):
- **Activity** (`/notifications`, opened from the bell):
  - Header: Back, `Activity`, and the link `Mark all read` (calls `markNotificationsRead()`; disabled when nothing is unread).
  - Sections `Today` (`isSameLocalDay`) and `Earlier`; label style uppercase, 11 px, letter-spaced.
  - Infinite scroll (20).
- **`ActivityRow`:**
  - Unread rows have the ember-wash background and an 8 px ember-glow dot (aria `Unread`).
  - Avatar 46, then the `activitySentence` segments (`name` bold, `dish` Newsreader italic 15), then `relativeTime` (12 px dim).
  - **Trailing:**
    - pick-related rows show a 44 px rounded-10 thumbnail (photo or placeholder)
    - `followed` (and an approved `follow_requested`) show a `FollowButton` (`Follow back` / `Following`)
    - a pending `follow_requested` shows `Approve` (ember) and `Decline` (outline), calling `respondToFollowRequest`. After Approve the row reads `<Name> started following you.` with a FollowButton; after Decline it's removed from the list.
  - Tapping a row marks it read (`markNotificationsRead([id])`) and opens the pick for pick-related types, the actor's profile for follow types, and nothing for `saved_from_list` (lists are Phase 6).
  - Empty: title `No activity yet.` and body `When people follow you or save your picks, it shows up here.`
- **Notification settings** (`/settings/notifications`):
  - Header: Back and `Notifications`. Section label `Push`.
  - `ToggleRow`s (`role="switch"`; ember track on, `#3A3530` off):
    - `Dethronings`, with sub `When someone you follow swaps a dish out of their five.`
    - `New followers`
    - `Saves of your picks`
    - `Friends’ new Final Meals`
  - Each toggle saves straight away (`updateMyNotificationSettings`) and is optimistic, reverting with the friendly copy on failure.
  - The footer note when `!isPushAvailable()`: `Push notifications start with the first test build. Your choices are saved for then.`
  - The canvas's `Picks near you` and the Email section aren't shown.
- **`src/lib/push.ts`:**
  - `isPushAvailable(): boolean` (rule in Global Constraints)
  - `registerForPushIfAvailable(client): Promise<'unavailable' | 'denied' | 'registered'>`. Only when available: lazily `require('expo-notifications')`, request permission, get the Expo push token with the projectId, and call `registerPushToken`. It never throws; failures resolve `'denied'`.
  - Sign-out unregisters the last registered token (kept in memory).

- [ ] **Step 1: Write the failing tests:**
  - `ActivityRow` for each type with the Notifications-board fixtures:
    - `Ari Mitchell dethroned Tacos Al Pastor with Smash Burger on their Final Meal.` · `2m`
    - `Alli Mercer started following you.` with `Follow back`
    - `Mike Brennan saved your Pork Gyro.`
  - a pending request shows Approve/Decline; Approve calls `respondToFollowRequest(id, true)` and swaps to the follow row; Decline removes the row
  - Today/Earlier grouping
  - `Mark all read` clears the dots and is disabled with nothing unread
  - tapping marks read and routes correctly
  - the settings toggles' labels and defaults (four on), a toggle calls the update with the right key, failure reverts
  - the footer note shows when push is unavailable
  - `isPushAvailable()` is false without a projectId, and `registerForPushIfAvailable` then resolves `'unavailable'` without requiring `expo-notifications` (assert the module mock was never loaded)
  - the Settings screen lists `Notifications` before `Privacy & safety`
- [ ] **Step 2: Run the tests.** `pnpm --filter @finalmeal/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks.** `pnpm --filter @finalmeal/mobile test && pnpm lint && pnpm typecheck` green.
- [ ] **Step 5: Commit.** `Add Activity, Notification settings and push registration for later`

### Task 9: Device checklist, docs, CI

The Mac is often overloaded, so the device steps may be deferred. If so, mark them "pending Mac" in the ledger and in README's device checklist, and say so in the report. Everything else in this task still happens.

- [ ] **Step 1: iPhone 17 run** (may be deferred). `pnpm db:reset </dev/null && pnpm env:local`, one Expo server. Screenshot every step. Sign in as `josiehamilton@example.com` (code from Mailpit):
  1. Feed › Following shows Ari's dethroning first (one card), then Pork Gyro and Tonkotsu Ramen. Save a card and see `Saved`.
  2. Nearby shows Vancouver picks only, with no Sam or Priya.
  3. Open Mike's Wagyu Beef Don: `On n Final Meals`; Save to try, then Unsave.
  4. Open @allimercer from a card: `Follow back`, follow, then check followers/following lists and search.
  5. Open @priyashah: `Requested` and `This account is private`.
  6. The bell dot shows; Activity shows two unread with `Follow back`; `Mark all read`.
  7. Settings › Notifications: toggle Saves off, leave and come back, and it's still off.
  8. Saved shows the four seeded saves; try each chip, and long-press remove.
  9. Sign out and sign in as `priyashah@example.com`: approve Josie in Activity. Back as Josie, Priya's profile and pick now show.
  10. Sign up a new user: First landing shows Nearby in Vancouver. Add a dish from it and land back on First landing. Switch tabs, then Feed shows `An empty table.` with Popular people.
- [ ] **Step 2: Pixel_10 run** (may be deferred). Repeat 1, 4, 6 and 10 in Expo Go, and confirm there's no red error from `expo-notifications` at startup.
- [ ] **Step 3: Run every local check.** `pnpm db:test`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm push:dispatch` (after following a user who has a token), then `pnpm db:reset </dev/null`.
- [ ] **Step 4: Update the docs.**
  - README "Try the app" gets the social steps and the seeded logins (`priyashah@example.com` for approvals); the device checklist gets the Phase 4 items (pending Mac where deferred).
  - `CLAUDE.md` status: Phase 4 built on its branch.
  - `docs/known-gaps.md`:
    - remove the closed items: follows.status, notifications_update_own, M5, Add return, the Settings Notifications row
    - add: "Phase 7: table policies for picks/profiles/activities still allow reading private accounts' rows directly; the new functions already hide them"
    - add: "Phase 5: Search replaces Find people behind the Feed's search icon; a Map tab on other profiles"
    - add: "Later: people list behind On n Final Meals; milestone and invite notifications; Trending tab"
  - Add each Decision for Josie below to `docs/needs-from-josie.md` with its default.
  - Commit `Phase 4: device checklist, status, known gaps and open decisions`.
- [ ] **Step 5: Push and check CI.** Push `phase-4-social-feed` and confirm CI is green (give the URL). Don't merge.

## Phase 4 done means

On the iPhone 17 and Pixel 10 (or with the device run marked pending Mac), a person can:
- follow seeded people (and request to follow a private one, who can approve)
- see a lively Following feed and a Nearby feed for their home city
- open anyone's pick and profile, and save dishes to try in Saved
- see Activity with unread markers, and choose notification settings

Push tokens and preferences are stored and pushes are queued and logged; real delivery comes in Phase 8. All tests and CI are green.

## Decisions for Josie

Each has a default that this plan builds. Change any of them and Claude updates the app.

1. **Nearby:** picks at spots within 25 km of your home city, by trusted public accounts wherever they live. The alternative is people who live within 25 km.
2. **Trending tab** (on the Feed board): not built, since it isn't in the spec. Feed has Following and Nearby only.
3. **First landing vs feed:** First landing shows on Feed right after onboarding, until you switch tabs or restart the app; after that Feed is the real feed (`An empty table.` if you follow no one).
4. **Follow requests:** they appear in Activity as "<Name> wants to follow you." with Approve / Decline (no canvas board for this).
5. **Changing privacy:** going Private keeps existing followers; going Public approves all pending requests.
6. **Notification settings:** show only the four push toggles. "Picks near you" and the Email section (weekly digest, product news) are hidden until they do something.
7. **Notifications in Activity:** follows, requests, approvals, saves and dethronings. Friends' new Final Meals arrive as push only (the feed already shows them).
8. **Milestone ("Your Pork Gyro is now on 8 Final Meals") and invite ("joined from your invite") notifications:** not built in the MVP.
9. **Pick detail caption:** says "#2 on their Final Meal" (the board's "his" needs a gender we don't collect).
10. **Other people's profiles:** no Map tab until Discover maps arrive (Phase 5), and no Share or More options yet.
11. **Find people:** the Feed's search icon opens a simple Find people screen (popular people near you plus name search) until Phase 5 Search.
12. **New copy** (not on the canvas):
    - Invite message: `I’m choosing my Final Meal: five dishes, forever. Come pick yours: <link>`
    - Empty states: `Nothing new yet.`, `Nothing nearby yet.`, `No activity yet.`, `Nothing saved yet.`
    - Private profile: `This account is private` / `Follow to see their picks.`
    - Unfollow confirm: `Unfollow @<username>?`
    - Push-not-yet note: `Push notifications start with the first test build. Your choices are saved for then.`
13. **Saved:** long-press a card to remove it, and Save on a pick toggles (tap again to unsave). A saved dish stays after the friend removes their pick; it just loses "via @…".
14. **"On 23 Final Meals" row:** not tappable yet (the full list of people comes later).
15. **Personal tags:** they stay private, so they never show on your picks in other people's feeds (the Feed board's "Late night" chip would only show to its owner).
