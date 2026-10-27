-- Row-level security: Phase 1 baseline.
--
-- This is deliberately simple. It answers "who owns this row" and nothing more.
-- Phase 3 (feeds, follows) and Phase 7 (private profiles, blocks, moderation)
-- will add SQL functions and tighten privacy: for example, hiding picks of
-- private profiles, hiding blocked users, and follow-request approval. Until
-- then, profiles and picks are readable by everyone, including signed-out
-- visitors.
--
-- Conventions
--   * `anon` = signed-out visitor, `authenticated` = signed in.
--   * "own" = the row's user column equals auth.uid().
--   * auth.uid() is wrapped in (select ...) so Postgres evaluates it once per
--     statement instead of once per row.
--   * Every update policy has a `with check` that keeps the row owned by the
--     caller, so a row can never be handed to someone else through an update.
--   * No policy means no access: places, dishes and activities have no write
--     policies (only the service role writes them), and reports has no select
--     policy (write-only for users).

-- places, dishes: public read, no direct writes
create policy places_select on public.places
  for select to anon, authenticated
  using (true);

create policy dishes_select on public.dishes
  for select to anon, authenticated
  using (true);

-- profiles: public read, write own
create policy profiles_select on public.profiles
  for select to anon, authenticated
  using (true);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- picks: public read, write own
create policy picks_select on public.picks
  for select to anon, authenticated
  using (true);

create policy picks_insert_own on public.picks
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy picks_update_own on public.picks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy picks_delete_own on public.picks
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- tags: global tags and own personal tags are visible; only own personal tags are writable
create policy tags_select on public.tags
  for select to anon, authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

create policy tags_insert_own_personal on public.tags
  for insert to authenticated
  with check (kind = 'personal' and owner_id = (select auth.uid()));

create policy tags_update_own_personal on public.tags
  for update to authenticated
  using (kind = 'personal' and owner_id = (select auth.uid()))
  with check (kind = 'personal' and owner_id = (select auth.uid()));

create policy tags_delete_own_personal on public.tags
  for delete to authenticated
  using (kind = 'personal' and owner_id = (select auth.uid()));

-- pick_tags: visible when the tag is visible (the subquery runs under the
-- caller's own tags policy, so it follows any later change to that rule);
-- insert/delete when the pick is own. There is no update policy: re-tag by
-- deleting and inserting. Personal-tag ownership is enforced by the
-- pick_tags_check_owner trigger.
create policy pick_tags_select on public.pick_tags
  for select to anon, authenticated
  using (exists (select 1 from public.tags t where t.id = pick_tags.tag_id));

create policy pick_tags_insert_own_pick on public.pick_tags
  for insert to authenticated
  with check (exists (
    select 1 from public.picks p
    where p.id = pick_tags.pick_id and p.user_id = (select auth.uid())
  ));

create policy pick_tags_delete_own_pick on public.pick_tags
  for delete to authenticated
  using (exists (
    select 1 from public.picks p
    where p.id = pick_tags.pick_id and p.user_id = (select auth.uid())
  ));

-- follows: signed-in read; follow as yourself; either party may remove
create policy follows_select on public.follows
  for select to authenticated
  using (true);

create policy follows_insert_as_follower on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()));

create policy follows_delete_either_party on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

-- saves, blocks, push_tokens: all operations, own rows only
create policy saves_own on public.saves
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy blocks_own on public.blocks
  for all to authenticated
  using (blocker_id = (select auth.uid()))
  with check (blocker_id = (select auth.uid()));

create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- device_attestations: read own; written only by the service role
create policy device_attestations_select_own on public.device_attestations
  for select to authenticated
  using (user_id = (select auth.uid()));

-- shared_lists: active lists are public; owners also see their inactive ones
create policy shared_lists_select on public.shared_lists
  for select to anon, authenticated
  using (is_active or owner_id = (select auth.uid()));

create policy shared_lists_insert_own on public.shared_lists
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy shared_lists_update_own on public.shared_lists
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy shared_lists_delete_own on public.shared_lists
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- activities: signed-in read, no direct writes
create policy activities_select on public.activities
  for select to authenticated
  using (true);

-- notifications: read own; update own (to set read_at)
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- reports: file as yourself; no select policy, so no one can read them back
create policy reports_insert_as_reporter on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));
