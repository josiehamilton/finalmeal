import type { FinalMealClient } from './client';
import { ApiError, throwIfError } from './errors';

export interface Place {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  city: string;
  region: string | null;
  country: string;
  source: 'fsq' | 'custom';
  lat: number;
  lng: number;
  /** "<area or street> · <city>", or just "<city>" when there is neither. */
  label: string;
}

/**
 * The columns of a `places` row that the app reads. Clients can never read `created_by`
 * (column grants), so a select or an embed of places must name these columns, never `*`.
 */
export const PLACE_COLUMNS = 'id, source, name, area, address, city, region, country, location';

export interface PlaceRow {
  id: string;
  source: 'fsq' | 'custom';
  name: string;
  area: string | null;
  address: string | null;
  city: string;
  region: string | null;
  country: string;
  /** A GeoJSON point: PostgREST serialises the geography column that way. */
  location: unknown;
}

/** "<area or street> · <city>": the street is the address up to the first comma. */
export function formatPlaceLabel(p: {
  area: string | null;
  address: string | null;
  city: string;
}): string {
  const area = p.area?.trim();
  const street = p.address?.split(',')[0]?.trim();
  const where = area || street;
  return where ? `${where} · ${p.city}` : p.city;
}

/**
 * Reads a point from what PostgREST sends for a geography column: an (E)WKB hex string
 * (PostGIS's default text form) or, in case the column is ever cast, a GeoJSON point.
 */
export function readPoint(location: unknown): { lat: number; lng: number } {
  if (typeof location === 'string') {
    const point = readWkbPoint(location);
    if (point) return point;
  } else if (typeof location === 'object' && location !== null && 'coordinates' in location) {
    const [lng, lat] = (location as { coordinates: unknown }).coordinates as unknown[];
    if (typeof lng === 'number' && typeof lat === 'number') return { lat, lng };
  }
  throw new ApiError('A place came back without a readable point', 'unknown');
}

const WKB_POINT = 1;
const EWKB_HAS_SRID = 0x20000000;

/** Decodes a hex (E)WKB 2D point, or returns null for anything else. */
function readWkbPoint(hex: string): { lat: number; lng: number } | null {
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const view = new DataView(bytes.buffer);
  if (bytes.length < 21) return null;
  const little = bytes[0] === 1;
  const type = view.getUint32(1, little);
  if ((type & 0xff) !== WKB_POINT || (type & 0x40000000) !== 0 || (type & 0x80000000) !== 0) {
    return null; // not a plain 2D point (Z or M ordinates)
  }
  const start = 5 + ((type & EWKB_HAS_SRID) !== 0 ? 4 : 0);
  if (bytes.length < start + 16) return null;
  const lng = view.getFloat64(start, little);
  const lat = view.getFloat64(start + 8, little);
  return Number.isFinite(lng) && Number.isFinite(lat) ? { lat, lng } : null;
}

export function toPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    address: row.address,
    city: row.city,
    region: row.region,
    country: row.country,
    source: row.source,
    ...readPoint(row.location),
    label: formatPlaceLabel(row),
  };
}

/**
 * Type-ahead search over places. `inCity` is the city's point (not the person's location): when
 * given, nearby places rank first. A blank query with no point returns nothing, without asking
 * the backend.
 */
export async function searchPlaces(
  client: FinalMealClient,
  q: string,
  inCity?: { lat: number; lng: number },
  limit = 12,
): Promise<Place[]> {
  const text = q.trim();
  if (text === '' && !inCity) return [];
  // GET, so the client's read timeout still bounds this call.
  const { data, error } = await client
    .rpc(
      'search_places',
      { p_q: text, p_lat: inCity?.lat, p_lng: inCity?.lng, p_lim: limit },
      { get: true },
    )
    .retry(false);
  throwIfError(error);
  return (data ?? []).map((row) => toPlace(row.place as PlaceRow));
}

/**
 * Adds a spot that is not in the place data (a food truck, a pop-up, a friend's place). It is a
 * public business: an address is required unless `noFixedAddress` is set.
 */
export async function createCustomPlace(
  client: FinalMealClient,
  input: { name: string; cityId: string; address?: string; noFixedAddress?: boolean },
): Promise<Place> {
  const { data, error } = await client.rpc('create_custom_place', {
    p_name: input.name,
    p_city_id: input.cityId,
    p_address: input.address,
    p_no_fixed_address: input.noFixedAddress ?? false,
  });
  throwIfError(error);
  return toPlace(data as PlaceRow);
}

/** One place by id, or null when there is no such place. */
export async function getPlace(client: FinalMealClient, id: string): Promise<Place | null> {
  const { data, error } = await client.rpc('get_place', { p_id: id }, { get: true }).retry(false);
  throwIfError(error);
  // A function returning a row type answers with an all-null row when nothing matched.
  if (!data || data.id == null) return null;
  return toPlace(data as PlaceRow);
}
