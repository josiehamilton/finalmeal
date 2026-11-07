// Geocoders for the geocode-places Edge Function: they turn a custom spot's address into a map
// point. No Deno APIs in this file, so it can be imported and tested anywhere. Locally and in
// tests the `mock` geocoder answers; in production nothing geocodes (`none`) until Josie has
// chosen a provider and the `geoapify` adapter (geocoder-geoapify.ts) is switched on with the
// GEOCODER and GEOAPIFY_API_KEY secrets.
import { geoapifyGeocoder } from './geocoder-geoapify.ts';

export interface GeocodeQuery {
  address: string;
  postcode: string | null;
  city: string;
  region: string | null;
  country: string;
  /** The spot's city point; answers are expected to be near it. */
  near: { lat: number; lng: number };
}

export type GeocodeResult =
  | { status: 'found'; lat: number; lng: number }
  | { status: 'not_found' }
  | { status: 'retry'; reason: string };

export interface Geocoder {
  name: string;
  geocode(q: GeocodeQuery): Promise<GeocodeResult>;
}

const MIN_DISTANCE_M = 300;
const MAX_DISTANCE_M = 2500;
const METRES_PER_DEGREE = 111_320;

/** 32-bit FNV-1a. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Deterministic stand-in for a real geocoder (local development and tests only). An address that
 * starts with `Nowhere` is not found (a documented test hook). Any other address lands 300-2500 m
 * from the city point, in a direction and at a distance taken from a hash of the address and city.
 */
export const mockGeocoder: Geocoder = {
  name: 'mock',
  async geocode(q) {
    if (q.address.trim().toLowerCase().startsWith('nowhere')) return { status: 'not_found' };
    const hash = fnv1a(`${q.address.toLowerCase()}|${q.city.toLowerCase()}`);
    const bearing = ((hash % 36_000) / 100) * (Math.PI / 180);
    const distance =
      MIN_DISTANCE_M + (Math.floor(hash / 36_000) % (MAX_DISTANCE_M - MIN_DISTANCE_M + 1));
    const lat = q.near.lat + (distance * Math.cos(bearing)) / METRES_PER_DEGREE;
    const lng =
      q.near.lng +
      (distance * Math.sin(bearing)) / (METRES_PER_DEGREE * Math.cos((q.near.lat * Math.PI) / 180));
    return { status: 'found', lat, lng };
  },
};

/** Geocodes nothing. The function claims no spots with it, so `retry` is never acted on. */
export const noneGeocoder: Geocoder = {
  name: 'none',
  async geocode() {
    return { status: 'retry', reason: 'no geocoder is configured' };
  },
};

const LOCAL_HOSTS = new Set(['kong', 'localhost', '127.0.0.1', 'host.docker.internal']);

/** True when the Supabase URL points at the local Docker stack (never a hosted project). */
export function isLocalStack(supabaseUrl: string | undefined): boolean {
  if (!supabaseUrl) return false;
  try {
    return LOCAL_HOSTS.has(new URL(supabaseUrl).hostname);
  } catch {
    return false;
  }
}

const warned = new Set<string>();
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/**
 * Picks a geocoder from the GEOCODER secret. Unset or empty: `mock` on a local stack, `none`
 * elsewhere. `none` is none. `mock` only runs on a local stack, even when asked for elsewhere.
 * `geoapify` needs GEOAPIFY_API_KEY. Anything else is `none`. Each fallback warns once.
 */
export function geocoderFromEnv(
  env: { GEOCODER?: string; GEOAPIFY_API_KEY?: string; SUPABASE_URL?: string },
  fetchImpl?: typeof fetch,
): Geocoder {
  const local = isLocalStack(env.SUPABASE_URL);
  const raw = (env.GEOCODER ?? '').trim();
  const name = raw.toLowerCase();
  if (name === '') return local ? mockGeocoder : noneGeocoder;
  if (name === 'none') return noneGeocoder;
  if (name === 'mock') {
    if (local) return mockGeocoder;
    warnOnce('The mock geocoder only runs on a local stack; using none');
    return noneGeocoder;
  }
  if (name === 'geoapify') {
    const key = (env.GEOAPIFY_API_KEY ?? '').trim();
    if (key !== '') return geoapifyGeocoder(key, fetchImpl);
    warnOnce('GEOAPIFY_API_KEY is not set; using none');
    return noneGeocoder;
  }
  warnOnce(`Unknown GEOCODER "${raw}"; using none`);
  return noneGeocoder;
}
