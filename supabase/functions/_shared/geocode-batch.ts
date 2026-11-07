// One geocode-places run: claim a batch, geocode it, record each answer. Separate from the Edge
// Function so Node's test runner can exercise it with a fake database. No Deno APIs in this file.
import type { Geocoder, GeocodeResult } from './geocoder.ts';

export interface ClaimedPlace {
  place_id: string;
  name: string;
  address: string | null;
  postcode: string | null;
  city: string;
  region: string | null;
  country: string;
  city_lat: number;
  city_lng: number;
}

/** Calls a database function through PostgREST and returns its JSON reply. */
export type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export interface GeocodeBatchReply {
  claimed: number;
  found: number;
  notFound: number;
  retried: number;
  geocoder: string;
}

/**
 * With the `none` geocoder nothing is claimed, so no spot spends an attempt. Otherwise claims up
 * to 20 spots and geocodes them one at a time, so a provider's rate limit is never exceeded by the
 * function itself. A geocoder that throws counts as a retry for that spot only. If recording an
 * answer fails (the database is unreachable), the spots not yet finished are released, which
 * refunds their attempt, and the error is thrown.
 */
export async function runGeocodeBatch(rpc: Rpc, geocoder: Geocoder): Promise<GeocodeBatchReply> {
  const reply: GeocodeBatchReply = {
    claimed: 0,
    found: 0,
    notFound: 0,
    retried: 0,
    geocoder: geocoder.name,
  };
  if (geocoder.name === 'none') return reply;

  const rows = (await rpc('claim_geocode_batch', { p_limit: 20 })) as ClaimedPlace[];
  reply.claimed = rows.length;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      let result: GeocodeResult;
      try {
        result = await geocoder.geocode({
          address: row.address ?? '',
          postcode: row.postcode,
          city: row.city,
          region: row.region,
          country: row.country,
          near: { lat: row.city_lat, lng: row.city_lng },
        });
      } catch {
        result = { status: 'retry', reason: 'the geocoder threw' };
      }
      if (result.status === 'found') {
        const status = await rpc('finish_geocode', {
          p_place_id: row.place_id,
          p_result: 'found',
          p_lat: result.lat,
          p_lng: result.lng,
          p_geocoder: geocoder.name,
        });
        // finish_geocode refuses an answer too far from the spot's city as not found.
        if (status === 'done') reply.found++;
        else reply.notFound++;
      } else if (result.status === 'not_found') {
        await rpc('finish_geocode', { p_place_id: row.place_id, p_result: 'not_found' });
        reply.notFound++;
      } else {
        await rpc('finish_geocode', { p_place_id: row.place_id, p_result: 'retry' });
        reply.retried++;
      }
    } catch (error) {
      // Give back this spot and the ones after it. Best effort: whatever is left is reclaimed
      // after 10 minutes.
      for (const rest of rows.slice(i)) {
        try {
          await rpc('finish_geocode', { p_place_id: rest.place_id, p_result: 'release' });
        } catch {
          // The original error is the one worth reporting.
        }
      }
      throw error;
    }
  }
  return reply;
}
