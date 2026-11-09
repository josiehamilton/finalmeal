import type { DiscoverDish, DiscoverPlace } from '@finalmeal/api';
import type { MapRegion } from '../map/bridge';
import { PLACE } from './add-dish';

/** A Vancouver viewport, the way the map page reports it. */
export const VANCOUVER_REGION: MapRegion = {
  bounds: { west: -123.2, south: 49.2, east: -123.0, north: 49.35 },
  center: { lat: 49.275, lng: -123.1 },
  zoom: 12,
};

/** Three places in view: 5 + 4 + 3 = 12 picks. Marutama is the most listed. */
export function makeDiscoverPlaces(): DiscoverPlace[] {
  return [
    {
      id: 'pl-marutama',
      name: 'Marutama',
      label: 'Bidwell St · Vancouver',
      city: 'Vancouver',
      lat: 49.29,
      lng: -123.13,
      bestTier: 'final',
      pickCount: 5,
      listCount: 14,
      topDishName: 'Tonkotsu Ramen',
    },
    {
      id: 'pl-kinkao',
      name: 'Kin Kao',
      label: 'Main St · Vancouver',
      city: 'Vancouver',
      lat: 49.26,
      lng: -123.1,
      bestTier: 'honorable',
      pickCount: 4,
      listCount: 6,
      topDishName: 'Khao Soi',
    },
    {
      id: 'pl-skewers',
      name: 'Skewers',
      label: 'Davie St · Vancouver',
      city: 'Vancouver',
      lat: 49.28,
      lng: -123.12,
      bestTier: 'final',
      pickCount: 3,
      listCount: 8,
      topDishName: 'Pork Gyro',
    },
  ];
}

export function makeDiscoverDish(overrides: Partial<DiscoverDish> = {}): DiscoverDish {
  return {
    dishId: 'd-tonkotsu',
    dishName: 'Tonkotsu Ramen',
    place: { ...PLACE, id: 'pl-marutama', name: 'Marutama' },
    bestTier: 'final',
    finalCount: 9,
    honorableCount: 5,
    listCount: 14,
    pickId: 'pk-tonkotsu',
    photoUrl: null,
    distanceM: 900,
    people: [],
    ...overrides,
  };
}

/** The sheet's cards: a Final Meal card, an Honorable card, and one whose pick the viewer may not open. */
export function makeDiscoverDishes(): DiscoverDish[] {
  return [
    makeDiscoverDish(),
    makeDiscoverDish({
      dishId: 'd-khaosoi',
      dishName: 'Khao Soi',
      place: { ...PLACE, id: 'pl-kinkao', name: 'Kin Kao', area: 'Main St', lat: 49.26, lng: -123.1 },
      bestTier: 'honorable',
      finalCount: 2,
      honorableCount: 6,
      listCount: 6,
      pickId: 'pk-khaosoi',
      distanceM: 1800,
    }),
    makeDiscoverDish({
      dishId: 'd-gyro',
      dishName: 'Pork Gyro',
      place: { ...PLACE, id: 'pl-skewers', name: 'Skewers', area: 'Davie St' },
      listCount: 8,
      pickId: null,
      distanceM: 2600,
    }),
  ];
}

/** The DiscoverHM block: Khao Soi at Kin Kao, Honorable for 6 people, Final Meal for 2, two named people. */
export function makeKinKaoSelection(): DiscoverDish[] {
  return [
    {
      ...makeDiscoverDishes()[1]!,
      people: [
        { id: 'u-dev', username: 'devpatel', displayName: 'Dev Patel', avatarUrl: null },
        { id: 'u-sam', username: 'samo', displayName: 'Sam Ortiz', avatarUrl: null },
      ],
    },
  ];
}
