import type { Pick, Place, SavedDish } from '@finalmeal/api';
import { placeCallout } from './api-stand-ins';
import type { DiscoverPlace } from './api-stand-ins';
import type { MapPin } from './bridge';

/** `Marutama · 2 picks`, `Marutama · 1 pick`. */
function picksLabel(name: string, count: number): string {
  return `${name} · ${count} ${count === 1 ? 'pick' : 'picks'}`;
}

/** Whether a place has a fixed point: false only for `location_precision = 'city'` (`Place.onMap`). */
function isOnMap(place: Place): boolean {
  return (place as Place & { onMap?: boolean }).onMap !== false;
}

/** Discover's pins: one per place in view, in the order the server returned them. */
export function pinsForDiscover(places: DiscoverPlace[]): MapPin[] {
  return places.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    tier: p.bestTier,
    label: placeCallout(p.name, p.listCount),
  }));
}

/** One pin per on-map place; Final if any of its picks is. Places keep the order they first appear in. */
function pinsForEntries(entries: Array<{ place: Place; tier: 'final' | 'honorable' }>): MapPin[] {
  const byPlace = new Map<string, MapPin & { count: number; name: string }>();
  for (const { place, tier } of entries) {
    if (!isOnMap(place)) continue;
    const existing = byPlace.get(place.id);
    if (existing) {
      existing.count += 1;
      if (tier === 'final') existing.tier = 'final';
    } else {
      byPlace.set(place.id, {
        id: place.id,
        lat: place.lat,
        lng: place.lng,
        tier,
        label: '',
        count: 1,
        name: place.name,
      });
    }
  }
  return [...byPlace.values()].map(({ count, name, ...pin }) => ({
    ...pin,
    label: picksLabel(name, count),
  }));
}

/** The ProfileMap board's pins: someone's picks, grouped by place. */
export function pinsForPicks(picks: Pick[]): MapPin[] {
  return pinsForEntries(picks.map((p) => ({ place: p.place, tier: p.tier })));
}

/** The Saved map's pins: saved dishes grouped by place, in the tier of the pick each came from. */
export function pinsForSaves(saves: SavedDish[]): MapPin[] {
  return pinsForEntries(saves.map((s) => ({ place: s.place, tier: s.viaTier ?? 'honorable' })));
}
