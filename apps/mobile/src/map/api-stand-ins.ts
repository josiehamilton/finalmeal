/**
 * Stand-ins for what Phase 5 Task 3 adds to `@finalmeal/api` (`MapBounds`, `LatLng`,
 * `DiscoverPlace`) and `@finalmeal/core` (`placeCallout`). They have exactly the shapes and
 * strings Task 3 pins, so when Task 3 lands the swap is mechanical: delete this file and import
 * from the packages instead. Nothing else in `src/map` knows these are temporary.
 */

export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DiscoverPlace {
  id: string;
  name: string;
  label: string;
  city: string;
  lat: number;
  lng: number;
  bestTier: 'final' | 'honorable';
  pickCount: number;
  listCount: number;
  topDishName: string;
}

/** `Marutama · 14 lists`, or `Marutama` at 0 (core `placeCallout`). */
export function placeCallout(name: string, listCount: number): string {
  if (listCount <= 0) return name;
  return `${name} · ${listCount} ${listCount === 1 ? 'list' : 'lists'}`;
}
