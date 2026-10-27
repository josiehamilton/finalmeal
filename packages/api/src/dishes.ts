import type { FinalMealClient } from './client';
import { throwIfError } from './errors';

export interface DishSuggestion {
  id: string;
  name: string;
  /** How many trusted people have this dish on their list. */
  pickCount: number;
}

/**
 * Dishes already known at a place, for a typed name (existing dishes first, so the same dish
 * typed differently lands on one). A blank query returns the most-picked dishes.
 */
export async function suggestDishes(
  client: FinalMealClient,
  placeId: string,
  q: string,
  limit = 6,
): Promise<DishSuggestion[]> {
  // GET, so the client's read timeout still bounds this call.
  const { data, error } = await client
    .rpc('suggest_dishes', { p_place_id: placeId, p_q: q.trim(), p_lim: limit }, { get: true })
    .retry(false);
  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.dish.id,
    name: row.dish.name,
    pickCount: row.pick_count,
  }));
}
