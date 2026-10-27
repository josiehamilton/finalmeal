-- Phase 3: dishes and picks are written through functions only, and a person's Final Meal
-- stays contiguous.
--
-- 1. Direct writes to picks and pick_tags are closed. The Phase 1 own-row insert, update and
--    delete policies are dropped and INSERT / UPDATE / DELETE / TRUNCATE are revoked from anon
--    and authenticated. Reads are unchanged (picks and pick_tags are still public-read).
--    Every change now goes through add_pick, promote_pick, demote_pick, remove_pick,
--    update_pick and move_final, which are security definer, take one lock per person, and run
--    in a single transaction, so a failure part-way changes nothing.
-- 2. Slots stay exactly 1..n. The rule lives in those functions; the table keeps its checks.
--    How a slot shifts without tripping the unique (user_id, slot) rule:
--      * The Phase 1 rule was a partial unique INDEX, which Postgres cannot defer and checks
--        row by row, so "slot = slot - 1" could collide with a neighbour part-way through the
--        statement. It is replaced by a DEFERRABLE INITIALLY IMMEDIATE unique CONSTRAINT on
--        the same columns. Postgres checks a deferrable constraint at the end of the
--        statement, not row by row, so one UPDATE can move a whole run of slots and only the
--        final state must be unique. (Honorable picks have a null slot, and nulls are
--        distinct, so the old "where tier = 'final'" filter is not needed: the existing check
--        already says final <=> slot is not null.)
--      * The constraint stays "immediate", never deferred to commit, so a mistake still
--        raises inside the function that made it.
--      * A swap does not need this: the occupant is made honorable (slot null) first, then
--        the new pick takes the slot.
-- 3. Dish resolution (_resolve_dish) keeps "the same dish typed differently" on one dish.
-- 4. suggest_dishes and the dish_stats view count only trusted accounts, so a brand-new
--    account cannot push a dish up the suggestions.
--
-- Error codes are the message of a P0001 exception, as in Phases 1-2: final_full,
-- duplicate_pick, place_not_found, invalid_dish_name, pick_not_found, invalid_photo (the
-- friendly copy in the plan) plus invalid_slot (a replace or target slot that does not
-- apply) and invalid_tag (a global tag id that does not exist or is not global). Personal
-- tag names are checked by create_personal_tag (invalid_tag_name).

-- ---------------------------------------------------------------- close direct writes
drop policy picks_insert_own on public.picks;
drop policy picks_update_own on public.picks;
drop policy picks_delete_own on public.picks;
drop policy pick_tags_insert_own_pick on public.pick_tags;
drop policy pick_tags_delete_own_pick on public.pick_tags;
revoke insert, update, delete, truncate on public.picks from anon, authenticated;
revoke insert, update, delete, truncate on public.pick_tags from anon, authenticated;

-- ---------------------------------------------------------------- the slot rule, deferrable
drop index public.picks_user_slot_unique;
alter table public.picks
  add constraint picks_user_slot_unique unique (user_id, slot) deferrable initially immediate;

-- ---------------------------------------------------------------- internal helpers
-- Not callable by clients. The public functions below are security definer and call them.

-- Who is writing, and one write at a time per person (so the count of finals and the
-- duplicate check cannot race).
create function public._begin_pick_write()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_not_found';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('picks:' || v_uid::text, 0));
  return v_uid;
end;
$$;

-- A photo path is <uid>/pick-<digits>.jpg in the caller's own folder (null is fine).
create function public._check_pick_photo(p_uid uuid, p_path text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_path is not null and p_path !~ ('^' || p_uid::text || '/pick-[0-9]+\.jpg$') then
    raise exception 'invalid_photo';
  end if;
end;
$$;

-- Replaces a pick's tags: global tag ids (which must exist and be global) and personal tag
-- names (created for the caller if new, through create_personal_tag). Null means none.
create function public._set_pick_tags(p_pick_id uuid, p_tag_ids uuid[], p_personal_tags text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_name text;
  v_tag public.tags;
begin
  select coalesce(array_agg(distinct t), '{}') into v_ids
  from unnest(coalesce(p_tag_ids, '{}')) as t
  where t is not null;
  -- A tag with no owner is a global one (the tags table forbids a personal tag without an owner).
  if cardinality(v_ids) > 0
     and (select count(*) from public.tags where id = any (v_ids) and owner_id is null) <> cardinality(v_ids)
  then
    raise exception 'invalid_tag';
  end if;

  delete from public.pick_tags where pick_id = p_pick_id;
  insert into public.pick_tags (pick_id, tag_id) select p_pick_id, unnest(v_ids);

  foreach v_name in array coalesce(p_personal_tags, '{}') loop
    if v_name is null or btrim(v_name) = '' then
      continue;
    end if;
    v_tag := public.create_personal_tag(v_name);
    insert into public.pick_tags (pick_id, tag_id) values (p_pick_id, v_tag.id)
    on conflict do nothing;
  end loop;
end;
$$;

-- The dish a person means. A dish id is used if it is an unmerged dish at that place;
-- otherwise the name is matched: exact normalised key, then the closest unmerged dish at 0.85
-- trigram similarity or more, otherwise a new dish. All failures raise before anything is
-- written; a new dish is only created when the pick that wants it is about to be.
create function public._resolve_dish(p_place_id uuid, p_dish_id uuid, p_dish_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_dish_name, ''), '\s+', ' ', 'g'));
  v_key text;
  v_id uuid;
begin
  if not exists (select 1 from public.places where id = p_place_id and merged_into_id is null) then
    raise exception 'place_not_found';
  end if;

  if p_dish_id is not null then
    select id into v_id from public.dishes
    where id = p_dish_id and place_id = p_place_id and merged_into_id is null;
    if v_id is null then
      raise exception 'place_not_found';
    end if;
    return v_id;
  end if;

  if char_length(v_name) not between 1 and 80 then
    raise exception 'invalid_dish_name';
  end if;
  v_key := public.normalize_dish_name(v_name);
  if v_key = '' then
    raise exception 'invalid_dish_name';
  end if;

  select id into v_id from public.dishes
  where place_id = p_place_id and name_key = v_key and merged_into_id is null;
  if v_id is not null then
    return v_id;
  end if;

  select id into v_id from public.dishes
  where place_id = p_place_id and merged_into_id is null
    and extensions.similarity(name_key, v_key) >= 0.85
  order by extensions.similarity(name_key, v_key) desc, created_at, id
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  -- Two people adding the same new dish at once: the loser's insert does nothing and finds
  -- the winner's row.
  insert into public.dishes (place_id, name)
  values (p_place_id, v_name)
  on conflict (place_id, name_key) where merged_into_id is null do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.dishes
    where place_id = p_place_id and name_key = v_key and merged_into_id is null;
  end if;
  return v_id;
end;
$$;

-- The slot a new final takes. With fewer than 5 finals it is the next one (p_replace_slot is
-- ignored). With 5 it is p_replace_slot, and whoever holds it becomes honorable (slot null) in
-- the same step; that pick is returned as v_old, or null when nobody was replaced.
create function public._claim_final_slot(p_uid uuid, p_replace_slot integer, out v_slot integer, out v_old uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finals integer;
begin
  select count(*) into v_finals from public.picks where user_id = p_uid and tier = 'final';
  if v_finals < 5 then
    v_slot := v_finals + 1;
    v_old := null;
    return;
  end if;
  if p_replace_slot is null then
    raise exception 'final_full';
  end if;
  if p_replace_slot not between 1 and 5 then
    raise exception 'invalid_slot';
  end if;
  update public.picks set tier = 'honorable', slot = null
  where user_id = p_uid and tier = 'final' and slot = p_replace_slot
  returning id into v_old;
  if v_old is null then
    raise exception 'invalid_slot';
  end if;
  v_slot := p_replace_slot;
end;
$$;

-- The caller's pick, locked for the rest of the transaction, or pick_not_found.
create function public._own_pick(p_uid uuid, p_pick_id uuid)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pick public.picks;
begin
  select * into v_pick from public.picks where id = p_pick_id and user_id = p_uid for update;
  if not found then
    raise exception 'pick_not_found';
  end if;
  return v_pick;
end;
$$;

-- Close the gap left at slot p_slot: every later final moves up by one. One UPDATE: the
-- deferrable constraint is checked when it finishes (see the header).
create function public._close_slot_gap(p_uid uuid, p_slot integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.picks set slot = slot - 1
  where user_id = p_uid and tier = 'final' and slot > p_slot;
$$;

revoke all on function public._begin_pick_write() from public, anon, authenticated;
revoke all on function public._check_pick_photo(uuid, text) from public, anon, authenticated;
revoke all on function public._set_pick_tags(uuid, uuid[], text[]) from public, anon, authenticated;
revoke all on function public._resolve_dish(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public._claim_final_slot(uuid, integer) from public, anon, authenticated;
revoke all on function public._own_pick(uuid, uuid) from public, anon, authenticated;
revoke all on function public._close_slot_gap(uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------- add_pick
create function public.add_pick(
  p_place_id uuid,
  p_dish_id uuid,
  p_dish_name text,
  p_tier public.pick_tier,
  p_note text default null,
  p_tag_ids uuid[] default '{}',
  p_personal_tags text[] default '{}',
  p_photo_path text default null,
  p_replace_slot integer default null
)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._begin_pick_write();
  v_typed text := nullif(btrim(coalesce(p_dish_name, '')), '');
  v_dish_id uuid;
  v_original text;
  v_slot integer;
  v_old uuid;
  v_pick public.picks;
begin
  if char_length(coalesce(v_typed, '')) > 80 then
    raise exception 'invalid_dish_name';
  end if;
  perform public._check_pick_photo(v_uid, p_photo_path);

  v_dish_id := public._resolve_dish(p_place_id, p_dish_id, p_dish_name);
  if exists (select 1 from public.picks where user_id = v_uid and dish_id = v_dish_id) then
    raise exception 'duplicate_pick';
  end if;
  -- The person's own wording, kept as typed (trimmed); the dish's name when only an id was given.
  v_original := coalesce(v_typed, (select name from public.dishes where id = v_dish_id));

  if p_tier = 'final' then
    select s.v_slot, s.v_old into v_slot, v_old from public._claim_final_slot(v_uid, p_replace_slot) s;
  end if;

  insert into public.picks (user_id, dish_id, tier, slot, note, photo_path, original_dish_name)
  values (v_uid, v_dish_id, p_tier, v_slot, nullif(btrim(coalesce(p_note, '')), ''),
          p_photo_path, v_original)
  returning * into v_pick;

  perform public._set_pick_tags(v_pick.id, p_tag_ids, p_personal_tags);

  insert into public.activities (actor_id, type, pick_id)
  values (v_uid, case when p_tier = 'final' then 'added_final' else 'added_honorable' end::public.activity_type,
          v_pick.id);
  if v_old is not null then
    insert into public.activities (actor_id, type, pick_id, other_pick_id)
    values (v_uid, 'dethroned', v_pick.id, v_old);
  end if;

  return v_pick;
end;
$$;

-- ---------------------------------------------------------------- promote_pick
create function public.promote_pick(p_pick_id uuid, p_replace_slot integer default null)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._begin_pick_write();
  v_pick public.picks := public._own_pick(v_uid, p_pick_id);
  v_slot integer;
  v_old uuid;
begin
  -- Already a final: nothing to do (so a retry is harmless).
  if v_pick.tier = 'final' then
    return v_pick;
  end if;

  select s.v_slot, s.v_old into v_slot, v_old from public._claim_final_slot(v_uid, p_replace_slot) s;
  update public.picks set tier = 'final', slot = v_slot where id = v_pick.id
  returning * into v_pick;

  insert into public.activities (actor_id, type, pick_id) values (v_uid, 'promoted', v_pick.id);
  if v_old is not null then
    insert into public.activities (actor_id, type, pick_id, other_pick_id)
    values (v_uid, 'dethroned', v_pick.id, v_old);
  end if;
  return v_pick;
end;
$$;

-- ---------------------------------------------------------------- demote_pick
create function public.demote_pick(p_pick_id uuid)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._begin_pick_write();
  v_pick public.picks := public._own_pick(v_uid, p_pick_id);
  v_slot integer := v_pick.slot;
begin
  -- Already honorable: nothing to do.
  if v_pick.tier = 'honorable' then
    return v_pick;
  end if;
  update public.picks set tier = 'honorable', slot = null where id = v_pick.id
  returning * into v_pick;
  perform public._close_slot_gap(v_uid, v_slot);
  return v_pick;
end;
$$;

-- ---------------------------------------------------------------- remove_pick
-- Deletes the pick (its pick_tags go with it by cascade) and every activity about it: the ones
-- it wrote, and any "dethroned" that named it as the pick it replaced. Cleaning up the photo
-- object is the client's job (best effort), since the database cannot reach Storage.
create function public.remove_pick(p_pick_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._begin_pick_write();
  v_pick public.picks := public._own_pick(v_uid, p_pick_id);
begin
  delete from public.activities where pick_id = v_pick.id or other_pick_id = v_pick.id;
  delete from public.picks where id = v_pick.id;
  if v_pick.tier = 'final' then
    perform public._close_slot_gap(v_uid, v_pick.slot);
  end if;
end;
$$;

-- ---------------------------------------------------------------- update_pick
create function public.update_pick(
  p_pick_id uuid,
  p_note text,
  p_tag_ids uuid[],
  p_personal_tags text[],
  p_photo_path text
)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._begin_pick_write();
  v_pick public.picks := public._own_pick(v_uid, p_pick_id);
begin
  perform public._check_pick_photo(v_uid, p_photo_path);
  update public.picks
  set note = nullif(btrim(coalesce(p_note, '')), ''), photo_path = p_photo_path
  where id = v_pick.id
  returning * into v_pick;
  perform public._set_pick_tags(v_pick.id, p_tag_ids, p_personal_tags);
  return v_pick;
end;
$$;

-- ---------------------------------------------------------------- move_final
-- Reorders the finals; returns all of them, in slot order.
create function public.move_final(p_pick_id uuid, p_to_slot integer)
returns setof public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._begin_pick_write();
  v_pick public.picks := public._own_pick(v_uid, p_pick_id);
  v_finals integer;
begin
  select count(*) into v_finals from public.picks where user_id = v_uid and tier = 'final';
  if v_pick.tier <> 'final' or p_to_slot is null or p_to_slot not between 1 and v_finals then
    raise exception 'invalid_slot';
  end if;

  if p_to_slot <> v_pick.slot then
    -- Everything between the old and new slot shifts one step toward the old one.
    update public.picks
    set slot = case
      when id = v_pick.id then p_to_slot
      when v_pick.slot < p_to_slot then slot - 1
      else slot + 1
    end
    where user_id = v_uid and tier = 'final'
      and slot between least(v_pick.slot, p_to_slot) and greatest(v_pick.slot, p_to_slot);
  end if;

  return query select * from public.picks where user_id = v_uid and tier = 'final' order by slot;
end;
$$;

-- ---------------------------------------------------------------- suggest_dishes
-- Dishes at a place for a typed name. Order: name starts with the query, then trigram
-- similarity to it, then how many trusted people picked it (the first two only apply to a
-- non-empty query). An empty query returns the most-picked dishes. Merged dishes are skipped.
-- The query is normalised like dish names, so plurals and punctuation do not matter.
-- Normalised keys hold only letters, digits and single spaces, so need no LIKE escaping.
create function public.suggest_dishes(p_place_id uuid, p_q text, p_lim integer default 6)
returns table (dish public.dishes, pick_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text := public.normalize_dish_name(coalesce(p_q, ''));
  v_lim integer := least(greatest(coalesce(p_lim, 6), 0), 20);
begin
  return query
  select d, c.n::integer
  from public.dishes d
  cross join lateral (
    select count(*) as n
    from public.picks p
    join public.profiles u on u.id = p.user_id and u.trust_level = 'trusted'
    where p.dish_id = d.id
  ) c
  where d.place_id = p_place_id and d.merged_into_id is null
    and (v_key = '' or d.name_key like v_key || '%' or extensions.similarity(d.name_key, v_key) >= 0.3)
  order by
    case when v_key <> '' and d.name_key like v_key || '%' then 0 else 1 end,
    case when v_key = '' then 0 else extensions.similarity(d.name_key, v_key) end desc,
    c.n desc,
    d.name_key,
    d.id
  limit v_lim;
end;
$$;

-- ---------------------------------------------------------------- dish_stats
-- How many trusted people have each dish: on their Final Meal, as an honorable, and either
-- (list_count). Every dish has a row, with zeros when nobody trusted has picked it. A plain
-- view for now; making it a materialised view is a Phase 7 gap (docs/known-gaps.md).
create view public.dish_stats with (security_invoker = true) as
select
  d.id as dish_id,
  (count(p.dish_id) filter (where p.tier = 'final'))::integer as final_count,
  (count(p.dish_id) filter (where p.tier = 'honorable'))::integer as honorable_count,
  count(p.dish_id)::integer as list_count
from public.dishes d
left join (
  select pk.dish_id, pk.tier
  from public.picks pk
  join public.profiles u on u.id = pk.user_id and u.trust_level = 'trusted'
) p on p.dish_id = d.id
group by d.id;

-- ---------------------------------------------------------------- who can run what
-- Supabase grants new functions to anon by default; these are for signed-in people only.
revoke all on function public.add_pick(uuid, uuid, text, public.pick_tier, text, uuid[], text[], text, integer)
  from public, anon;
revoke all on function public.promote_pick(uuid, integer) from public, anon;
revoke all on function public.demote_pick(uuid) from public, anon;
revoke all on function public.remove_pick(uuid) from public, anon;
revoke all on function public.update_pick(uuid, text, uuid[], text[], text) from public, anon;
revoke all on function public.move_final(uuid, integer) from public, anon;
revoke all on function public.suggest_dishes(uuid, text, integer) from public, anon;
grant execute on function public.add_pick(uuid, uuid, text, public.pick_tier, text, uuid[], text[], text, integer)
  to authenticated;
grant execute on function public.promote_pick(uuid, integer) to authenticated;
grant execute on function public.demote_pick(uuid) to authenticated;
grant execute on function public.remove_pick(uuid) to authenticated;
grant execute on function public.update_pick(uuid, text, uuid[], text[], text) to authenticated;
grant execute on function public.move_final(uuid, integer) to authenticated;
grant execute on function public.suggest_dishes(uuid, text, integer) to authenticated;
