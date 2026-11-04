import type { PickDetail, SavedDish } from '@finalmeal/api';
import { PLACE } from './add-dish';
import { makePick } from './picks';

const person = (id: string, username: string, displayName = username) => ({
  id,
  username,
  displayName,
  avatarUrl: null,
});

/** The PickDetail board: @mikebrennan's Wagyu Beef Don at Sushi Itto, #2 on his Final Meal, on 23 Final Meals. */
export function makePickDetail(overrides: Partial<PickDetail> = {}): PickDetail {
  return {
    pick: makePick({
      id: 'pk-mike',
      tier: 'final',
      slot: 2,
      dish: { id: 'd-wagyu', name: 'Wagyu Beef Don' },
      place: { ...PLACE, id: 'p-itto', name: 'Sushi Itto', city: 'Tokyo', label: 'Sushi Itto · Shibuya, Tokyo' },
      note: 'God tier. I still dream about it.',
      tags: [
        { id: 't-rice', kind: 'food_type', name: 'Rice bowl', slug: 'rice-bowl', featured: false },
        { id: 't-jp', kind: 'food_type', name: 'Japanese', slug: 'japanese', featured: false },
        { id: 't-gf', kind: 'dietary', name: 'Gluten-free', slug: 'gluten-free', featured: false },
      ],
    }),
    owner: person('u-mike', 'mikebrennan', 'Mike Brennan'),
    isMine: false,
    finalCount: 23,
    listCount: 31,
    pickers: [
      person('u-a', 'alli', 'Alli Mercer'),
      person('u-b', 'ari', 'Ari Mitchell'),
      person('u-c', 'dev', 'Dev Patel'),
      person('u-d', 'sam', 'Sam Okafor'),
    ],
    savedByMe: false,
    ...overrides,
  };
}

/** One Saved board card, saved from @mikebrennan's Final Meal pick. */
export function makeSavedDish(overrides: Partial<SavedDish> = {}): SavedDish {
  return {
    dish: { id: 'd-wagyu', name: 'Wagyu Beef Don' },
    place: { ...PLACE, id: 'p-itto', name: 'Sushi Itto', city: 'Tokyo', label: 'Sushi Itto · Shibuya, Tokyo' },
    via: person('u-mike', 'mikebrennan'),
    viaPickId: 'pk-mike',
    viaTier: 'final',
    photoUrl: null,
    savedAt: '2026-11-01T00:00:00Z',
    distanceM: null,
    ...overrides,
  };
}

/** The Saved board's four cards. */
export function makeSavedBoard(): SavedDish[] {
  const place = (id: string, name: string, city: string) => ({ ...PLACE, id, name, city });
  return [
    makeSavedDish(),
    makeSavedDish({
      dish: { id: 'd-biryani', name: 'Plain Biryani' },
      place: place('p-spicy', 'Spicy Time', 'Saskatoon'),
      via: person('u-alli', 'allimercer'),
      viaPickId: 'pk-alli',
      viaTier: 'final',
      distanceM: 400_000,
    }),
    makeSavedDish({
      dish: { id: 'd-tacos', name: 'Tacos Al Pastor' },
      place: place('p-callejon', 'El Callejón', 'Mexico City'),
      via: person('u-ari', 'arimitchell'),
      viaPickId: 'pk-ari',
      viaTier: 'honorable',
      distanceM: 9_000_000,
    }),
    makeSavedDish({
      dish: { id: 'd-ramen', name: 'Tonkotsu Ramen' },
      place: place('p-maru', 'Marutama', 'Vancouver'),
      via: person('u-dev', 'devpatel'),
      viaPickId: 'pk-dev',
      viaTier: 'final',
      distanceM: 3_000,
    }),
  ];
}
