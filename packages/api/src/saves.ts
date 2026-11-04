import type { FinalMealClient } from './client';
import { throwIfError } from './errors';
import type { PersonSummary } from './people';
import { PICK_PHOTO_BUCKET } from './picks';
import { toPlace } from './places';
import type { Place, PlaceRow } from './places';

/** A dish the signed-in person saved for later. */
export interface SavedDish {
  dish: { id: string; name: string };
  place: Place;
  /**
   * Who it was saved from, when the pick still exists and its owner is still visible. Only `id`
   * and `username` are known: `displayName` repeats the username and `avatarUrl` is null.
   */
  via: PersonSummary | null;
  viaPickId: string | null;
  viaTier: 'final' | 'honorable' | null;
  /** The photo on the pick it was saved from. */
  photoUrl: string | null;
  savedAt: string;
  /** Metres from the person's chosen home city; null without one. */
  distanceM: number | null;
}

interface SavedRow {
  dish_id: string;
  dish_name: string;
  place: PlaceRow;
  via_pick_id: string | null;
  via_tier: 'final' | 'honorable' | null;
  via_user_id: string | null;
  via_username: string | null;
  photo_path: string | null;
  saved_at: string;
  distance_m: number | null;
}

export function toSavedDish(client: FinalMealClient, row: SavedRow): SavedDish {
  return {
    dish: { id: row.dish_id, name: row.dish_name },
    place: toPlace(row.place),
    via:
      row.via_user_id && row.via_username
        ? {
            id: row.via_user_id,
            username: row.via_username,
            displayName: row.via_username,
            avatarUrl: null,
          }
        : null,
    viaPickId: row.via_pick_id,
    viaTier: row.via_tier,
    photoUrl: row.photo_path
      ? client.storage.from(PICK_PHOTO_BUCKET).getPublicUrl(row.photo_path).data.publicUrl
      : null,
    savedAt: row.saved_at,
    distanceM: row.distance_m,
  };
}

/** Saves a dish. `viaPickId` is the pick it was found through (remembered, and its owner is told). Safe to repeat. */
export async function saveDish(
  client: FinalMealClient,
  dishId: string,
  viaPickId?: string,
): Promise<void> {
  const { error } = await client.rpc('save_dish', { p_dish_id: dishId, p_via_pick_id: viaPickId });
  throwIfError(error);
}

/** Removes a save (and the owner's "saved your pick" notification). Safe to repeat. */
export async function unsaveDish(client: FinalMealClient, dishId: string): Promise<void> {
  const { error } = await client.rpc('unsave_dish', { p_dish_id: dishId });
  throwIfError(error);
}

/** The signed-in person's saves, newest first. */
export async function getMySaves(client: FinalMealClient): Promise<SavedDish[]> {
  const { data, error } = await client.rpc('get_my_saves', undefined, { get: true }).retry(false);
  throwIfError(error);
  return ((data ?? []) as unknown as SavedRow[]).map((row) => toSavedDish(client, row));
}
