import type { Pick, Place, SavedDish } from '@finalmeal/api';
import { makePick } from '../test-support/picks';
import { makeSavedDish } from '../test-support/saves';
import { PLACE } from '../test-support/add-dish';
import type { DiscoverPlace } from './api-stand-ins';
import { pinsForDiscover, pinsForPicks, pinsForSaves } from './pins';

const MARUTAMA = { ...PLACE, id: 'p-marutama', name: 'Marutama', lat: 49.2827, lng: -123.1207 };

/** A place with the `onMap` flag Task 3 adds to `Place` (true unless its precision is `city`). */
function withOnMap(place: Place, onMap: boolean): Place {
  return { ...place, onMap } as Place;
}

function pickAt(id: string, tier: 'final' | 'honorable', place: Place = MARUTAMA): Pick {
  return makePick({ id, tier, slot: tier === 'final' ? 1 : null, place });
}

describe('pinsForDiscover', () => {
  it('makes a pin per place, labelled with its lists', () => {
    const place: DiscoverPlace = {
      id: 'p1',
      name: 'Marutama',
      label: 'Gastown · Vancouver',
      city: 'Vancouver',
      lat: 49.28,
      lng: -123.12,
      bestTier: 'final',
      pickCount: 3,
      listCount: 14,
      topDishName: 'Tonkotsu Ramen',
    };
    const none = { ...place, id: 'p2', name: 'Skewers', bestTier: 'honorable' as const, listCount: 0 };
    expect(pinsForDiscover([place, none])).toEqual([
      { id: 'p1', lat: 49.28, lng: -123.12, tier: 'final', label: 'Marutama · 14 lists' },
      { id: 'p2', lat: 49.28, lng: -123.12, tier: 'honorable', label: 'Skewers' },
    ]);
  });
});

describe('pinsForPicks', () => {
  it('makes one Final pin for two picks at Marutama, labelled with the count', () => {
    const pins = pinsForPicks([pickAt('a', 'honorable'), pickAt('b', 'final')]);
    expect(pins).toEqual([
      { id: 'p-marutama', lat: 49.2827, lng: -123.1207, tier: 'final', label: 'Marutama · 2 picks' },
    ]);
  });

  it('says 1 pick for a single pick, and an Honorable pin when none is Final', () => {
    expect(pinsForPicks([pickAt('a', 'honorable')])).toEqual([
      { id: 'p-marutama', lat: 49.2827, lng: -123.1207, tier: 'honorable', label: 'Marutama · 1 pick' },
    ]);
  });

  it('keeps places apart, in the order they first appear', () => {
    const skewers = { ...PLACE, id: 'p-skewers', name: 'Skewers', lat: 49.3, lng: -123.1 };
    const pins = pinsForPicks([pickAt('a', 'final', skewers), pickAt('b', 'honorable'), pickAt('c', 'final', skewers)]);
    expect(pins.map((p) => [p.id, p.label])).toEqual([
      ['p-skewers', 'Skewers · 2 picks'],
      ['p-marutama', 'Marutama · 1 pick'],
    ]);
  });

  it('makes no pin for a city-precision place', () => {
    expect(pinsForPicks([pickAt('a', 'final', withOnMap(MARUTAMA, false))])).toEqual([]);
  });

  it('counts a place without an onMap flag as exact', () => {
    expect(pinsForPicks([pickAt('a', 'final')])).toHaveLength(1);
  });
});

describe('pinsForSaves', () => {
  function save(overrides: Partial<SavedDish>): SavedDish {
    return makeSavedDish({ place: MARUTAMA, ...overrides });
  }

  it('takes the tier from the pick it was saved from', () => {
    expect(pinsForSaves([save({ viaTier: 'final' })])[0]).toMatchObject({
      id: 'p-marutama',
      tier: 'final',
      label: 'Marutama · 1 pick',
    });
  });

  it('treats a save without viaTier as Honorable', () => {
    expect(pinsForSaves([save({ viaTier: null })])[0]?.tier).toBe('honorable');
  });

  it('makes a Final pin when any save at the place is Final, and skips city-precision places', () => {
    const pins = pinsForSaves([
      save({ viaTier: null }),
      save({ viaTier: 'final' }),
      save({ place: withOnMap({ ...MARUTAMA, id: 'p-city' }, false) }),
    ]);
    expect(pins).toEqual([
      { id: 'p-marutama', lat: 49.2827, lng: -123.1207, tier: 'final', label: 'Marutama · 2 picks' },
    ]);
  });
});
