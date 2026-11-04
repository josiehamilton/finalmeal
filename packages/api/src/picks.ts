import { looksLikeJpeg } from './avatar';
import type { FinalMealClient } from './client';
import { ApiError, throwIfError } from './errors';
import type { ErrorLike } from './errors';
import { getProfile, toPersonSummary } from './people';
import type { PersonSummary } from './people';
import { PLACE_COLUMNS, toPlace } from './places';
import type { Place, PlaceRow } from './places';
import { requireUserId } from './profile';
import { toTag } from './tags';
import type { Tag, TagRow } from './tags';

export const PICK_PHOTO_BUCKET = 'pick-photos';

/** How long a photo upload may take before the pick is saved without it. */
export const DEFAULT_PHOTO_TIMEOUT_MS = 20000;

export interface Pick {
  id: string;
  tier: 'final' | 'honorable';
  /** 1-5 for a Final Meal pick, null for an honorable mention. */
  slot: number | null;
  dish: { id: string; name: string };
  /** The dish as the person typed it. */
  originalDishName: string;
  place: Place;
  note: string | null;
  photoUrl: string | null;
  tags: Tag[];
  createdAt: string;
}

/** What `getMyPicks` selects: the pick, its dish, the dish's place (named columns) and its tags. */
const PICK_SELECT = `id, tier, slot, note, photo_path, original_dish_name, created_at, dish:dishes!inner(id, name, place:places!inner(${PLACE_COLUMNS})), pick_tags(tag:tags(id, kind, name, slug, is_featured))`;

export interface PickRow {
  id: string;
  tier: 'final' | 'honorable';
  slot: number | null;
  note: string | null;
  photo_path: string | null;
  original_dish_name: string;
  created_at: string;
  dish: { id: string; name: string; place: PlaceRow };
  pick_tags: Array<{ tag: TagRow | null }>;
}

const TAG_KIND_ORDER = { food_type: 0, dietary: 1, personal: 2 } as const;

export function toPick(row: PickRow, photoUrl: (path: string) => string): Pick {
  const tags = row.pick_tags
    .map((pt) => pt.tag)
    .filter((t): t is TagRow => t !== null)
    .map(toTag)
    .sort(
      (a, b) => TAG_KIND_ORDER[a.kind] - TAG_KIND_ORDER[b.kind] || a.name.localeCompare(b.name),
    );
  return {
    id: row.id,
    tier: row.tier,
    slot: row.slot,
    dish: { id: row.dish.id, name: row.dish.name },
    originalDishName: row.original_dish_name,
    place: toPlace(row.dish.place),
    note: row.note,
    photoUrl: row.photo_path ? photoUrl(row.photo_path) : null,
    tags,
    createdAt: row.created_at,
  };
}

/** The flat columns the feed and pick-detail functions return for a pick, its dish, place and tags. */
export interface PickColumns {
  pick_id: string;
  tier: 'final' | 'honorable';
  slot: number | null;
  note: string | null;
  photo_path: string | null;
  original_dish_name: string;
  created_at: string;
  dish_id: string;
  dish_name: string;
  /** A `places` row as JSON. */
  place: unknown;
  /** `[{id, kind, name, slug, is_featured}]`: global tags only, except for the owner's own detail. */
  tags: unknown;
}

/** A `Pick` from those columns (the same shape `getMyPicks` builds from its embedded select). */
export function toPickFromColumns(c: PickColumns, photoUrl: (path: string) => string): Pick {
  return toPick(
    {
      id: c.pick_id,
      tier: c.tier,
      slot: c.slot,
      note: c.note,
      photo_path: c.photo_path,
      original_dish_name: c.original_dish_name,
      created_at: c.created_at,
      dish: { id: c.dish_id, name: c.dish_name, place: c.place as PlaceRow },
      pick_tags: ((c.tags ?? []) as TagRow[]).map((tag) => ({ tag })),
    },
    photoUrl,
  );
}

/** Finals by slot, then honorable mentions newest first. */
export function sortPicks(picks: readonly Pick[]): Pick[] {
  return [...picks].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === 'final' ? -1 : 1;
    if (a.tier === 'final') return (a.slot ?? 0) - (b.slot ?? 0);
    return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  });
}

export function photoUrlFor(client: FinalMealClient): (path: string) => string {
  return (path) => client.storage.from(PICK_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Errors from the pick functions: a raw check or not-null failure (a note that is too long) is `unknown`. */
function throwPickError(error: ErrorLike | null): void {
  if (!error) return;
  if (error.code === '23514' || error.code === '23502') {
    throw new ApiError(error.message, 'unknown');
  }
  throwIfError(error);
}

/**
 * True when the server definitely refused a write (it answered with an error code that is not a
 * lost connection or a timeout). Writes are not bounded or retried, so a dropped connection or a
 * timeout is ambiguous: the write may have been saved and its response lost.
 */
function isDefiniteRefusal(error: ErrorLike): boolean {
  try {
    throwIfError(error);
  } catch (e) {
    return e instanceof ApiError && e.code !== '' && e.code !== 'network' && e.code !== 'timeout';
  }
  return false;
}

function requireJpeg(bytes: ArrayBuffer): void {
  if (!looksLikeJpeg(bytes)) throw new ApiError('Not a JPEG image', 'invalid_photo');
}

async function fetchPickRow(client: FinalMealClient, id: string): Promise<PickRow | null> {
  const { data, error } = await client
    .from('picks')
    .select(PICK_SELECT)
    .eq('id', id)
    .maybeSingle()
    .retry(false);
  throwIfError(error);
  return data as unknown as PickRow | null;
}

/** The signed-in person's picks: finals by slot, then honorable mentions newest first. */
export async function getMyPicks(client: FinalMealClient): Promise<Pick[]> {
  const uid = await requireUserId(client);
  const { data, error } = await client
    .from('picks')
    .select(PICK_SELECT)
    .eq('user_id', uid)
    .retry(false);
  throwIfError(error);
  const url = photoUrlFor(client);
  return sortPicks(((data ?? []) as unknown as PickRow[]).map((row) => toPick(row, url)));
}

/**
 * Another person's picks, in the same order as `getMyPicks`. It checks the profile first and
 * returns nothing, without reading any picks, when the person is gone, hidden by a block, or
 * private and not followed by the signed-in person (the table itself stays open until the
 * Phase 7 policies). Their personal tags are never returned.
 */
export async function getProfilePicks(client: FinalMealClient, userId: string): Promise<Pick[]> {
  const profile = await getProfile(client, userId);
  if (!profile?.canSeePicks) return [];
  const { data, error } = await client
    .from('picks')
    .select(PICK_SELECT)
    .eq('user_id', userId)
    .retry(false);
  throwIfError(error);
  const url = photoUrlFor(client);
  return sortPicks(
    ((data ?? []) as unknown as PickRow[]).map((row) => {
      const pick = toPick(row, url);
      return profile.isMe
        ? pick
        : { ...pick, tags: pick.tags.filter((t) => t.kind !== 'personal') };
    }),
  );
}

export interface PickDetail {
  pick: Pick;
  owner: PersonSummary;
  isMine: boolean;
  /** How many trusted, public people have this dish as a Final Meal. */
  finalCount: number;
  /** How many people have it on their list at all. */
  listCount: number;
  /** Up to four of the people who have it as a Final Meal (the owner first). */
  pickers: PersonSummary[];
  savedByMe: boolean;
}

interface PickDetailRow extends PickColumns {
  owner_id: string;
  owner_username: string;
  owner_display_name: string;
  owner_avatar_path: string | null;
  is_mine: boolean;
  final_count: number;
  list_count: number;
  pickers: unknown;
  saved_by_me: boolean;
}

interface PickerJson {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
}

/**
 * One pick with its owner and who else has the dish, or null when it is gone or the viewer may
 * not see its owner (a private account they do not follow, or a block). Only the owner sees
 * their own personal tags.
 */
export async function getPickDetail(
  client: FinalMealClient,
  id: string,
): Promise<PickDetail | null> {
  const { data, error } = await client
    .rpc('get_pick_detail', { p_pick_id: id }, { get: true })
    .retry(false);
  throwIfError(error);
  const row = (data ?? [])[0] as unknown as PickDetailRow | undefined;
  if (!row) return null;
  return {
    pick: toPickFromColumns(row, photoUrlFor(client)),
    owner: toPersonSummary(client, {
      id: row.owner_id,
      username: row.owner_username,
      display_name: row.owner_display_name,
      avatar_path: row.owner_avatar_path,
    }),
    isMine: row.is_mine,
    finalCount: row.final_count,
    listCount: row.list_count,
    pickers: ((row.pickers ?? []) as PickerJson[]).map((p) => toPersonSummary(client, p)),
    savedByMe: row.saved_by_me,
  };
}

/** One pick by id, or null when there is none. */
export async function getPick(client: FinalMealClient, id: string): Promise<Pick | null> {
  const row = await fetchPickRow(client, id);
  return row ? toPick(row, photoUrlFor(client)) : null;
}

async function requirePick(client: FinalMealClient, id: string): Promise<Pick> {
  const pick = await getPick(client, id);
  if (!pick) throw new ApiError('Pick not found', 'pick_not_found');
  return pick;
}

type UploadResult = { path: string } | { error: ApiError };

/**
 * Uploads a JPEG to `pick-photos/<uid>/pick-<ms>.jpg`. Gives up after `timeoutMs`; an upload that
 * finishes after that is deleted again, so no orphan is left behind.
 */
async function uploadPickPhoto(
  client: FinalMealClient,
  uid: string,
  bytes: ArrayBuffer,
  timeoutMs: number,
): Promise<UploadResult> {
  const path = `${uid}/pick-${Date.now()}.jpg`;
  const bucket = client.storage.from(PICK_PHOTO_BUCKET);
  const upload: Promise<ErrorLike | null> = Promise.resolve(
    bucket.upload(path, bytes, { contentType: 'image/jpeg', upsert: false }),
  ).then(
    ({ error }) => error,
    (thrown: unknown) => ({ message: String(thrown), code: '' }),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  const outcome = await Promise.race([upload, timeout]);
  clearTimeout(timer);

  if (outcome === null) return { path };
  if (outcome === 'timeout') {
    void upload.then((error) => {
      if (error === null) void removePhoto(client, path);
    });
    return { error: new ApiError('The photo upload timed out', 'timeout') };
  }
  let code = 'invalid_photo';
  try {
    throwIfError(outcome);
  } catch (e) {
    if (e instanceof ApiError && (e.code === 'timeout' || e.code === 'network')) code = e.code;
  }
  return { error: new ApiError(outcome.message, code) };
}

/** Best effort: a photo file that cannot be deleted is left behind, never an error for the caller. */
async function removePhoto(client: FinalMealClient, path: string): Promise<void> {
  try {
    await client.storage.from(PICK_PHOTO_BUCKET).remove([path]);
  } catch {
    // nothing to do
  }
}

export interface AddPickInput {
  placeId: string;
  /** The suggested dish, when the person picked one; otherwise the name is matched to the place's dishes. */
  dishId?: string;
  dishName: string;
  tier: 'final' | 'honorable';
  note?: string;
  /** Global tag ids (food type, dietary). */
  tagIds?: string[];
  /** The person's own tags, by name; new names are created. */
  personalTags?: string[];
  /** A JPEG. */
  photo?: ArrayBuffer;
  /** With five finals already, a final replaces the one in this slot (1-5), which becomes honorable. */
  replaceSlot?: number;
  /** How long the photo upload may take before the pick is saved without it. */
  photoTimeoutMs?: number;
}

/**
 * Adds a pick. A photo is uploaded first; if that fails or takes too long the pick is still
 * added, without a photo, and `photoFailed` is true (the person can add it later from the pick).
 * A photo that is not a JPEG is rejected (`invalid_photo`) before any request. If the pick
 * itself is definitely refused (a duplicate, a full five), the uploaded photo is deleted again;
 * after a lost connection or a timeout it is kept, because the pick may have been saved.
 */
export async function addPick(
  client: FinalMealClient,
  input: AddPickInput,
): Promise<{ pick: Pick; photoFailed: boolean }> {
  if (input.photo) requireJpeg(input.photo);

  let photoPath: string | undefined;
  let photoFailed = false;
  if (input.photo) {
    const uid = await requireUserId(client);
    const result = await uploadPickPhoto(
      client,
      uid,
      input.photo,
      input.photoTimeoutMs ?? DEFAULT_PHOTO_TIMEOUT_MS,
    );
    if ('path' in result) photoPath = result.path;
    else photoFailed = true;
  }

  const { data, error } = await client.rpc('add_pick', {
    p_place_id: input.placeId,
    p_dish_id: (input.dishId ?? null) as string,
    p_dish_name: input.dishName,
    p_tier: input.tier,
    p_note: input.note,
    p_tag_ids: input.tagIds,
    p_personal_tags: input.personalTags,
    p_photo_path: photoPath,
    p_replace_slot: input.replaceSlot,
  });
  if (error) {
    // Only a definite refusal leaves the photo unused; after a lost response the pick may point at it.
    if (photoPath && isDefiniteRefusal(error)) await removePhoto(client, photoPath);
    throwPickError(error);
  }
  return { pick: await requirePick(client, (data as { id: string }).id), photoFailed };
}

/** Moves an honorable mention into the Final Meal (replacing `replaceSlot` when the five are full). */
export async function promotePick(
  client: FinalMealClient,
  id: string,
  replaceSlot?: number,
): Promise<Pick> {
  const { error } = await client.rpc('promote_pick', {
    p_pick_id: id,
    p_replace_slot: replaceSlot,
  });
  throwPickError(error);
  return requirePick(client, id);
}

/** Moves a final to the honorable mentions; the finals after it move up a slot. */
export async function demotePick(client: FinalMealClient, id: string): Promise<Pick> {
  const { error } = await client.rpc('demote_pick', { p_pick_id: id });
  throwPickError(error);
  return requirePick(client, id);
}

/** Deletes a pick (the finals after it move up) and, best effort, its photo file. */
export async function removePick(client: FinalMealClient, id: string): Promise<void> {
  const { data, error: readError } = await client
    .from('picks')
    .select('photo_path')
    .eq('id', id)
    .maybeSingle()
    .retry(false);
  throwIfError(readError);
  const { error } = await client.rpc('remove_pick', { p_pick_id: id });
  throwPickError(error);
  if (data?.photo_path) await removePhoto(client, data.photo_path);
}

export interface PickPatch {
  /** Null or blank clears the note. Left out keeps it. */
  note?: string | null;
  /** Replaces the global tags. Left out keeps them. */
  tagIds?: string[];
  /** Replaces the personal tags, by name. Left out keeps them. */
  personalTags?: string[];
  /** A JPEG replaces the photo, null removes it. Left out keeps it. */
  photo?: ArrayBuffer | null;
  /** How long a photo upload may take before the update fails. */
  photoTimeoutMs?: number;
}

/**
 * Changes a pick's note, tags or photo; what the patch leaves out stays as it is. Unlike
 * `addPick`, a photo that cannot be uploaded fails the whole update (nothing changes).
 */
export async function updatePick(
  client: FinalMealClient,
  id: string,
  patch: PickPatch,
): Promise<Pick> {
  if (patch.photo) requireJpeg(patch.photo);
  const current = await fetchPickRow(client, id);
  if (!current) throw new ApiError('Pick not found', 'pick_not_found');

  const currentTags = current.pick_tags.map((pt) => pt.tag).filter((t): t is TagRow => t !== null);
  const tagIds = patch.tagIds ?? currentTags.filter((t) => t.kind !== 'personal').map((t) => t.id);
  const personalTags =
    patch.personalTags ?? currentTags.filter((t) => t.kind === 'personal').map((t) => t.name);

  let photoPath = current.photo_path;
  let uploaded: string | null = null;
  if (patch.photo === null) {
    photoPath = null;
  } else if (patch.photo) {
    const uid = await requireUserId(client);
    const result = await uploadPickPhoto(
      client,
      uid,
      patch.photo,
      patch.photoTimeoutMs ?? DEFAULT_PHOTO_TIMEOUT_MS,
    );
    if ('error' in result) throw result.error;
    uploaded = result.path;
    photoPath = result.path;
  }

  const { error } = await client.rpc('update_pick', {
    p_pick_id: id,
    p_note: (patch.note === undefined ? current.note : patch.note) as string,
    p_tag_ids: tagIds,
    p_personal_tags: personalTags,
    p_photo_path: photoPath as string,
  });
  if (error) {
    // As in addPick: after an ambiguous failure the update may have been saved, so keep the file.
    if (uploaded && isDefiniteRefusal(error)) await removePhoto(client, uploaded);
    throwPickError(error);
  }
  if (current.photo_path && current.photo_path !== photoPath) {
    await removePhoto(client, current.photo_path);
  }
  return requirePick(client, id);
}

/** Moves a final to another slot (1 to the number of finals); the ones in between shift. Returns all the person's picks. */
export async function moveFinal(
  client: FinalMealClient,
  id: string,
  toSlot: number,
): Promise<Pick[]> {
  const { error } = await client.rpc('move_final', { p_pick_id: id, p_to_slot: toSlot });
  throwPickError(error);
  return getMyPicks(client);
}
