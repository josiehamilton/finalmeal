import type { FinalMealClient } from './client';
import { throwIfError } from './errors';
import type { Database } from './database.types';
import { readPoint } from './places';

export interface City {
  id: string;
  name: string;
  regionCode: string | null;
  regionName: string | null;
  country: string;
  countryName: string;
  /** e.g. "Vancouver, BC, Canada" */
  label: string;
}

/** The columns of a `cities` row that the app reads (an RPC row also carries a computed `city_label`). */
export type CityRow = Pick<
  Database['public']['Tables']['cities']['Row'],
  'id' | 'name' | 'region_code' | 'region_name' | 'country' | 'country_name'
>;

/**
 * Same rule as SQL `public.city_label`: name, region code (US, CA, AU) or region name, country.
 * A region that equals the city name or starts with it (any case) is left out: "Tokyo, Japan".
 */
export function formatCityLabel(
  c: Pick<City, 'name' | 'regionCode' | 'regionName' | 'country' | 'countryName'>,
): string {
  const region = ['US', 'CA', 'AU'].includes(c.country) ? c.regionCode : c.regionName;
  const repeated = !!region && region.toLowerCase().startsWith(c.name.toLowerCase());
  return [c.name, repeated ? null : region, c.countryName].filter((part) => part).join(', ');
}

export function toCity(row: CityRow): City {
  const city = {
    id: row.id,
    name: row.name,
    regionCode: row.region_code,
    regionName: row.region_name,
    country: row.country,
    countryName: row.country_name,
  };
  return { ...city, label: formatCityLabel(city) };
}

/** Type-ahead search over world cities. A blank query returns nothing, without asking the backend. */
export async function searchCities(
  client: FinalMealClient,
  query: string,
  limit = 8,
): Promise<City[]> {
  const q = query.trim();
  if (q === '') return [];
  // GET, so the client's read timeout still bounds this call.
  const { data, error } = await client
    .rpc('search_cities', { q, lim: limit }, { get: true })
    .retry(false);
  throwIfError(error);
  return (data ?? []).map(toCity);
}

/** The closest known city to a position, or null when there is none. */
export async function nearestCity(
  client: FinalMealClient,
  lat: number,
  lng: number,
): Promise<City | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const { data, error } = await client
    .rpc('nearest_city', { lat, lng }, { get: true })
    .retry(false);
  throwIfError(error);
  // A function returning a row type answers with an all-null row when nothing matched.
  if (!data || data.id == null) return null;
  return toCity(data);
}

export type CityWithPoint = City & { lat: number; lng: number };

/**
 * One city by id with its map point, or null when there is no such city. The point is only for
 * ranking place search around a chosen city; it is never the person's own location.
 */
export async function getCity(client: FinalMealClient, id: string): Promise<CityWithPoint | null> {
  const { data, error } = await client
    .from('cities')
    .select('id, name, region_code, region_name, country, country_name, location')
    .eq('id', id)
    .maybeSingle()
    .retry(false);
  throwIfError(error);
  if (!data) return null;
  return { ...toCity(data), ...readPoint(data.location) };
}
