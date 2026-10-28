import type { Pick } from '@finalmeal/api';
import { PLACE } from './add-dish';

/** A pick with sensible defaults; tests override what they care about. */
export function makePick(overrides: Partial<Pick> = {}): Pick {
  return {
    id: 'pk1',
    tier: 'final',
    slot: 1,
    dish: { id: 'd1', name: 'Tonkotsu Ramen' },
    originalDishName: 'tonkotsu ramen',
    place: PLACE,
    note: null,
    photoUrl: null,
    tags: [],
    createdAt: '2026-10-27T00:00:00Z',
    ...overrides,
  };
}

/** `n` Final Meal picks in slots 1..n (ids f1..fn, dishes "Dish 1".."Dish n"). */
export function makeFinals(n: number): Pick[] {
  return Array.from({ length: n }, (_, i) =>
    makePick({
      id: `f${i + 1}`,
      slot: i + 1,
      dish: { id: `fd${i + 1}`, name: `Dish ${i + 1}` },
      originalDishName: `Dish ${i + 1}`,
    }),
  );
}
