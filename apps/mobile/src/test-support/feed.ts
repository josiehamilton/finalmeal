import type { FeedItem } from '@finalmeal/api';
import { PLACE } from './add-dish';
import { makePick } from './picks';

/** Hours ago, as the ISO time a feed item carries. */
export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

/** The Feed board's first card: @arimitchell's Pork Gyro at Skewers, 2h ago, on 8 lists. */
export function makeFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    key: 'act-1',
    kind: 'added_final',
    at: hoursAgo(2),
    actor: { id: 'u3', username: 'arimitchell', displayName: 'Ari Mitchell', avatarUrl: null },
    pick: makePick({
      id: 'pk-ari',
      tier: 'final',
      slot: 1,
      dish: { id: 'd-gyro', name: 'Pork Gyro' },
      place: { ...PLACE, id: 'p-skewers', name: 'Skewers', city: 'Vancouver' },
      note: 'Delicious. I’d fly back for it.',
      tags: [
        { id: 't-greek', kind: 'food_type', name: 'Greek', slug: 'greek', featured: false },
        { id: 't-late', kind: 'dietary', name: 'Late night', slug: 'late-night', featured: false },
      ],
    }),
    otherDishName: null,
    listCount: 8,
    savedByMe: false,
    ...overrides,
  };
}

/** `n` distinct feed items, keys `k1`..`kn`. */
export function makeFeedItems(n: number, from = 1): FeedItem[] {
  return Array.from({ length: n }, (_, i) =>
    makeFeedItem({
      key: `k${from + i}`,
      pick: makePick({
        id: `pk${from + i}`,
        dish: { id: `d${from + i}`, name: `Dish ${from + i}` },
      }),
    }),
  );
}
