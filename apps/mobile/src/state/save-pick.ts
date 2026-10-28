import { useCallback, useRef, useState } from 'react';
import { ApiError, addPick, friendlyCode, getMyPicks } from '@finalmeal/api';
import { preparePickPhoto } from '../lib/prepare-pick-photo';
import { getSupabase } from '../lib/supabase';
import { findExistingPick } from './add-dish';
import type { AddDishDraft } from './add-dish';

export type SaveOutcome =
  /** Saved. `photoFailed` means the pick is on the list without the photo the person chose. */
  | { status: 'saved'; photoFailed: boolean }
  | { status: 'failed'; error: unknown };

/** What makes two attempts "the same dish", for recognising our own earlier save. */
function attemptKey(draft: AddDishDraft): string {
  return [draft.place?.id, draft.dishId, draft.dishName.trim().toLowerCase(), draft.tier].join('|');
}

/**
 * Saves the Add-a-dish draft (optionally replacing a Final Meal slot), shared by the form and Swap.
 *
 * - A photo that cannot be prepared (resize, read) or uploaded never blocks the pick: it is saved
 *   without it and `photoFailed` says so.
 * - Only one save runs at a time (`busy`, and a ref for taps in the same frame), so a retry never
 *   double-adds.
 * - After a lost connection or a timeout the pick may have been saved. If the next attempt for the
 *   same dish is refused as a duplicate, the list is re-read and an existing pick of that tier
 *   counts as the save having worked.
 *
 * `save` resolves to null when a save is already running. After a successful save `busy` stays true
 * (the screen is closing); after a failure it goes back to false.
 */
export function useSavePick() {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const unsure = useRef<string | null>(null);

  const save = useCallback(
    async (draft: AddDishDraft, replaceSlot?: number): Promise<SaveOutcome | null> => {
      if (inFlight.current || !draft.place) return null;
      inFlight.current = true;
      setBusy(true);
      const key = attemptKey(draft);
      try {
        let photo: ArrayBuffer | undefined;
        let photoFailed = false;
        if (draft.photoUri) {
          try {
            photo = await preparePickPhoto(draft.photoUri);
          } catch {
            photoFailed = true;
          }
        }
        const result = await addPick(getSupabase(), {
          placeId: draft.place.id,
          dishId: draft.dishId ?? undefined,
          dishName: draft.dishName.trim(),
          tier: draft.tier,
          note: draft.note.trim() === '' ? undefined : draft.note.trim(),
          tagIds: draft.tags.map((t) => t.id),
          personalTags: draft.personalTags,
          photo,
          ...(replaceSlot === undefined ? {} : { replaceSlot }),
        });
        unsure.current = null;
        return { status: 'saved', photoFailed: photoFailed || result.photoFailed };
      } catch (e) {
        if (e instanceof ApiError && e.code === 'duplicate_pick' && unsure.current === key) {
          try {
            const existing = findExistingPick(await getMyPicks(getSupabase()), draft);
            if (existing && existing.tier === draft.tier) {
              unsure.current = null;
              return { status: 'saved', photoFailed: false };
            }
          } catch {
            // Without the re-read it is a plain refusal; the person can try again.
          }
        }
        const code = friendlyCode(e);
        if (code === 'network' || code === 'timeout') unsure.current = key;
        setBusy(false);
        return { status: 'failed', error: e };
      } finally {
        inFlight.current = false;
      }
    },
    [],
  );

  return { busy, save };
}
