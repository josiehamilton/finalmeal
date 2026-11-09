import { cityKey } from './group';
import type { PickLike } from './group';

export type DiscoverTier = 'all' | 'final' | 'honorable';

/** What narrows the Discover map and its sheet. */
export interface DiscoverFilters {
  tier: DiscoverTier;
  followingOnly: boolean;
  /** Kilometres from the map's centre, or null for any distance. */
  radiusKm: number | null;
  foodTypeIds: string[];
  dietaryIds: string[];
}

export const DEFAULT_DISCOVER_FILTERS: DiscoverFilters = {
  tier: 'all',
  followingOnly: false,
  radiusKm: null,
  foodTypeIds: [],
  dietaryIds: [],
};

/** The Distance slider runs 1 to 100; the last stop means "Any". */
export const RADIUS_SLIDER_MAX = 100;

export function radiusFromSlider(v: number): number | null {
  if (!Number.isFinite(v)) return null;
  const rounded = Math.round(v);
  if (rounded >= RADIUS_SLIDER_MAX) return null;
  return Math.max(rounded, 1);
}

export function sliderFromRadius(r: number | null): number {
  if (r === null || !Number.isFinite(r)) return RADIUS_SLIDER_MAX;
  return Math.min(Math.max(Math.round(r), 1), RADIUS_SLIDER_MAX - 1);
}

/** `Any` or `25 km`. */
export function radiusLabel(r: number | null): string {
  return r === null ? 'Any' : `${r} km`;
}

/** How many filters the Filters sheet holds: a radius, plus each tag. Tier and Following sit on the chip row. */
export function sheetFilterCount(f: DiscoverFilters): number {
  return (f.radiusKm === null ? 0 : 1) + f.foodTypeIds.length + f.dietaryIds.length;
}

/** `12 picks near Vancouver`, `1 pick near Vancouver`, `12 picks here` (no city). */
export function picksNearLabel(n: number, city: string | null): string {
  const picks = `${n} ${n === 1 ? 'pick' : 'picks'}`;
  return city ? `${picks} near ${city}` : `${picks} here`;
}

/** `850 m`, `1.2 km`, `12 km`; null for no distance or one of 100 km or more. */
export function formatDistance(m: number | null): string | null {
  if (m === null || !Number.isFinite(m) || m < 0) return null;
  const metres = Math.round(m);
  if (metres < 1000) return `${metres} m`;
  const km = metres / 1000;
  if (km < 9.95) return `${km.toFixed(1)} km`;
  const whole = Math.round(km);
  return whole >= 100 ? null : `${whole} km`;
}

/** `14 lists`, `1 list`; null at 0. */
export function listsLabel(n: number): string | null {
  if (n <= 0) return null;
  return `${n} ${n === 1 ? 'list' : 'lists'}`;
}

/** The map callout: `Marutama · 14 lists`, or just the name at 0. */
export function placeCallout(name: string, listCount: number): string {
  const lists = listsLabel(listCount);
  return lists ? `${name} · ${lists}` : name;
}

/**
 * `Honorable for 6 people · Final Meal for 2`: the lead tier first, a zero part left out, null when
 * both are zero.
 */
export function tierCountsLabel(
  finalCount: number,
  honorableCount: number,
  lead: 'final' | 'honorable',
): string | null {
  const parts =
    lead === 'final'
      ? ([
          ['Final Meal', finalCount],
          ['Honorable', honorableCount],
        ] as const)
      : ([
          ['Honorable', honorableCount],
          ['Final Meal', finalCount],
        ] as const);
  const shown = parts.filter(([, n]) => n > 0);
  // Only the first part names the people ("Honorable for 6 people · Final Meal for 2").
  return shown.length > 0
    ? shown
        .map(
          ([label, n], i) =>
            `${label} for ${n}${i === 0 ? ` ${n === 1 ? 'person' : 'people'}` : ''}`,
        )
        .join(' · ')
    : null;
}

/** `567 followers`, `1 follower`. */
export function followersLabel(n: number): string {
  return `${n} ${n === 1 ? 'follower' : 'followers'}`;
}

/** `Sushi · 4 picks in 3 cities`, or `4 picks in 3 cities` without a chip. */
export function mapSummary(picks: readonly PickLike[], chipLabel: string | null): string {
  const cities = new Set(picks.map((p) => cityKey(p.place))).size;
  const text = `${picks.length} ${picks.length === 1 ? 'pick' : 'picks'} in ${cities} ${cities === 1 ? 'city' : 'cities'}`;
  return chipLabel ? `${chipLabel} · ${text}` : text;
}

/** `Vancouver, Tokyo, New York`, then ` +2` for more; the cities with the most picks first. */
export function citiesLine(picks: readonly PickLike[], max = 3): string {
  const cities = new Map<string, { name: string; count: number }>();
  for (const p of picks) {
    const key = cityKey(p.place);
    const existing = cities.get(key);
    if (existing) existing.count += 1;
    else cities.set(key, { name: p.place.city, count: 1 });
  }
  // Array.sort is stable: equal counts keep the order they first appeared in.
  const sorted = [...cities.values()].sort((a, b) => b.count - a.count);
  const shown = sorted.slice(0, max).map((c) => c.name);
  const more = sorted.length - shown.length;
  return more > 0 ? `${shown.join(', ')} +${more}` : shown.join(', ');
}
