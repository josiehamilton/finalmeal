import type { DiscoverFilters } from '@finalmeal/core';
import type { FinalMealClient } from './client';
import { throwIfError } from './errors';
import { toPersonSummary } from './people';
import type { PersonSummary } from './people';
import { formatPlaceLabel, toPlace } from './places';
import type { Place, PlaceRow } from './places';
import { photoUrlFor } from './picks';

/** The visible part of the map. `west > east` means the box crosses the antimeridian. */
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

/** One pin on Discover: a place with at least one matching pick. */
export interface DiscoverPlace {
  id: string;
  name: string;
  /** "<area or street> · <city>". */
  label: string;
  city: string;
  lat: number;
  lng: number;
  bestTier: 'final' | 'honorable';
  pickCount: number;
  listCount: number;
  topDishName: string;
}

/** One dish card in Discover's sheet, or one dish result in Search. */
export interface DiscoverDish {
  dishId: string;
  dishName: string;
  place: Place;
  bestTier: 'final' | 'honorable';
  finalCount: number;
  honorableCount: number;
  listCount: number;
  /** The pick a card opens, or null when the viewer may not see any of the matching picks. */
  pickId: string | null;
  photoUrl: string | null;
  /** Metres from the centre (or search point); null when there was none. */
  distanceM: number | null;
  /** Up to three public people with a matching pick, people you follow first. Empty in Search. */
  people: PersonSummary[];
}

/** Picks per read, matching the database caps. */
const PINS_LIMIT = 300;
const DISHES_LIMIT = 50;
const SEARCH_LIMIT = 20;

function wrapLng(lng: number): number {
  return lng >= -180 && lng <= 180 ? lng : ((((lng + 180) % 360) + 360) % 360) - 180;
}

/**
 * Bounds the database accepts (-180..180, -90..90). A viewport that spans 360 degrees or more
 * (the world view) becomes the whole globe, -180..180, never a wrapped box; a box that merely
 * reaches past the date line is wrapped into range and so comes back with `west > east`.
 */
export function normalizeBounds(b: MapBounds): MapBounds {
  const south = Math.min(Math.max(b.south, -90), 90);
  const north = Math.min(Math.max(b.north, -90), 90);
  if (b.east - b.west >= 360) return { west: -180, south, east: 180, north };
  return { west: wrapLng(b.west), south, east: wrapLng(b.east), north };
}

type FilterArgs = {
  p_tier?: 'final' | 'honorable';
  p_following_only: boolean;
  p_food_type_ids?: string[];
  p_dietary_ids?: string[];
  p_center_lat?: number;
  p_center_lng?: number;
  p_radius_m?: number;
};

function filterArgs(f: DiscoverFilters, center: LatLng | null): FilterArgs {
  return {
    p_tier: f.tier === 'all' ? undefined : f.tier,
    p_following_only: f.followingOnly,
    p_food_type_ids: f.foodTypeIds.length > 0 ? f.foodTypeIds : undefined,
    p_dietary_ids: f.dietaryIds.length > 0 ? f.dietaryIds : undefined,
    p_center_lat: center?.lat,
    p_center_lng: center?.lng,
    p_radius_m: f.radiusKm === null ? undefined : Math.round(f.radiusKm * 1000),
  };
}

/**
 * The places with a matching pick in view, most-listed first (at most 300). `truncated` says the
 * limit was hit, so there are more places than pins. Distance filtering is from `center`, the
 * map's centre, never the person's location.
 */
export async function getPicksInView(
  client: FinalMealClient,
  bounds: MapBounds,
  filters: DiscoverFilters,
  center: LatLng,
): Promise<{ places: DiscoverPlace[]; truncated: boolean }> {
  const b = normalizeBounds(bounds);
  const { data, error } = await client
    .rpc(
      'picks_in_view',
      {
        p_west: b.west,
        p_south: b.south,
        p_east: b.east,
        p_north: b.north,
        ...filterArgs(filters, center),
        p_limit: PINS_LIMIT,
      },
      { get: true },
    )
    .retry(false);
  throwIfError(error);
  const rows = data ?? [];
  return {
    places: rows.map((r) => ({
      id: r.place_id,
      name: r.name,
      label: formatPlaceLabel({ area: r.area, address: r.address, city: r.city }),
      city: r.city,
      lat: r.lat,
      lng: r.lng,
      bestTier: r.best_tier,
      pickCount: r.pick_count,
      listCount: r.list_count,
      topDishName: r.top_dish_name,
    })),
    truncated: rows.length >= PINS_LIMIT,
  };
}

interface DishRow {
  dish_id: string;
  dish_name: string;
  place: unknown;
  best_tier: 'final' | 'honorable';
  final_count: number;
  honorable_count: number;
  list_count: number;
  pick_id: string | null;
  photo_path: string | null;
  distance_m: number | null;
  people: unknown;
}

interface PersonJson {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
}

function toDiscoverDish(client: FinalMealClient, row: DishRow): DiscoverDish {
  const photoUrl = photoUrlFor(client);
  const people = Array.isArray(row.people) ? (row.people as PersonJson[]) : [];
  return {
    dishId: row.dish_id,
    dishName: row.dish_name,
    place: toPlace(row.place as PlaceRow),
    bestTier: row.best_tier,
    finalCount: row.final_count,
    honorableCount: row.honorable_count,
    listCount: row.list_count,
    pickId: row.pick_id,
    photoUrl: row.photo_path ? photoUrl(row.photo_path) : null,
    distanceM: row.distance_m,
    people: people.map((p) => toPersonSummary(client, p)),
  };
}

/**
 * The dish cards for a viewport (at most 50, most-listed first), or for one place with
 * `opts.placeId` (then `bounds` may be null). Distances are from `center`.
 */
export async function getDishesInView(
  client: FinalMealClient,
  bounds: MapBounds | null,
  filters: DiscoverFilters,
  center: LatLng | null,
  opts: { placeId?: string; limit?: number } = {},
): Promise<DiscoverDish[]> {
  const b = bounds ? normalizeBounds(bounds) : null;
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? DISHES_LIMIT), 0), DISHES_LIMIT);
  const { data, error } = await client
    .rpc(
      'dishes_in_view',
      {
        p_west: b?.west,
        p_south: b?.south,
        p_east: b?.east,
        p_north: b?.north,
        ...filterArgs(filters, center),
        p_place_id: opts.placeId,
        p_limit: Number.isFinite(limit) ? limit : DISHES_LIMIT,
      },
      { get: true },
    )
    .retry(false);
  throwIfError(error);
  return ((data ?? []) as DishRow[]).map((row) => toDiscoverDish(client, row));
}

/**
 * Dishes anyone the viewer can see has picked, matched by name, anywhere in the world; dishes
 * within 50 km of `near` first. A blank query finds nothing and asks nothing.
 */
export async function searchDishes(
  client: FinalMealClient,
  q: string,
  near?: LatLng,
  limit = SEARCH_LIMIT,
): Promise<DiscoverDish[]> {
  const text = q.trim();
  if (text === '') return [];
  const capped = Math.min(Math.max(Math.floor(limit), 0), SEARCH_LIMIT);
  const { data, error } = await client
    .rpc(
      'search_dishes',
      {
        p_q: text,
        p_lat: near?.lat,
        p_lng: near?.lng,
        p_limit: Number.isFinite(capped) ? capped : SEARCH_LIMIT,
      },
      { get: true },
    )
    .retry(false);
  throwIfError(error);
  return ((data ?? []) as DishRow[]).map((row) => toDiscoverDish(client, row));
}
