import { promotePick, updatePick } from '@finalmeal/api';
import type { Pick, PickPatch } from '@finalmeal/api';
import { preparePickPhoto } from '../lib/prepare-pick-photo';
import { getSupabase } from '../lib/supabase';
import { personalKey } from './add-dish';
import type { AddDishDraft } from './add-dish';

/**
 * Makes an existing honorable pick a Final Meal pick and folds in what the person had just entered
 * in the Add form for the same dish, so choosing "Make it a Final Meal instead" never throws that
 * away. The draft only adds to the existing pick:
 *
 * - tags are the union of the pick's and the draft's;
 * - the draft's note is used only when the pick has none;
 * - the draft's photo is uploaded only when the pick has none.
 *
 * An existing note or photo is never replaced. A photo that cannot be prepared or uploaded does not
 * undo the promotion: the rest of the draft is still applied and `photoFailed` is true, so the
 * caller can show the usual "saved without the photo" notice. A `promotePick` failure is thrown
 * (nothing else has happened by then); a failure of the merge itself after a successful promote
 * is not, because the pick is already a Final Meal pick and the person can edit it from there.
 */
export async function promoteWithDraft(
  existing: Pick,
  draft: AddDishDraft,
  slot?: number,
): Promise<{ photoFailed: boolean }> {
  const client = getSupabase();
  await (slot === undefined
    ? promotePick(client, existing.id)
    : promotePick(client, existing.id, slot));

  const globalIds = existing.tags.filter((t) => t.kind !== 'personal').map((t) => t.id);
  const personalNames = existing.tags.filter((t) => t.kind === 'personal').map((t) => t.name);
  const newGlobal = draft.tags.map((t) => t.id).filter((id) => !globalIds.includes(id));
  const seen = new Set(personalNames.map(personalKey));
  const newPersonal: string[] = [];
  for (const name of draft.personalTags) {
    const key = personalKey(name);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    newPersonal.push(name.trim().replace(/\s+/g, ' '));
  }
  const draftNote = draft.note.trim();
  const fillNote = draftNote !== '' && (existing.note ?? '').trim() === '';
  const wantsPhoto = draft.photoUri !== null && existing.photoUrl === null;
  const tagsChanged = newGlobal.length > 0 || newPersonal.length > 0;
  if (!tagsChanged && !fillNote && !wantsPhoto) return { photoFailed: false };

  const patch: PickPatch = {
    tagIds: [...globalIds, ...newGlobal],
    personalTags: [...personalNames, ...newPersonal],
    ...(fillNote ? { note: draftNote } : {}),
  };
  const hasNonPhotoChanges = tagsChanged || fillNote;

  let photoFailed = false;
  let photo: ArrayBuffer | undefined;
  if (wantsPhoto && draft.photoUri !== null) {
    try {
      photo = await preparePickPhoto(draft.photoUri);
    } catch {
      photoFailed = true;
    }
  }
  if (photo === undefined && !hasNonPhotoChanges) return { photoFailed };

  try {
    await updatePick(client, existing.id, photo === undefined ? patch : { ...patch, photo });
  } catch {
    if (photo !== undefined) {
      // An upload that fails fails the whole update, so apply the rest without it.
      photoFailed = true;
      if (hasNonPhotoChanges) {
        try {
          await updatePick(client, existing.id, patch);
        } catch {
          // Already promoted; the person can add the tags or note from Edit.
        }
      }
    }
    // A failed tags-or-note-only update leaves the (promoted) pick as it was.
  }
  return { photoFailed };
}
