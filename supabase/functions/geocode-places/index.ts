// geocode-places: gives custom spots a real map point (public.places, geocode_status 'pending').
// Called with the service-role key by a schedule or `pnpm geocode` (Phase 8 sets up the
// schedule). The geocoder comes from the GEOCODER secret; see _shared/geocoder.ts. With `none` it
// claims nothing, so spots stay queued until a provider is chosen. Talks to the database through
// PostgREST with plain fetch, so it has no imports from the network.
import { geocoderFromEnv } from '../_shared/geocoder.ts';
import type { GeocodeResult } from '../_shared/geocoder.ts';
import { isServiceRequest } from '../_shared/service-auth.ts';

interface ClaimedPlace {
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'not_configured' }, 500);
  if (!isServiceRequest(request, serviceKey)) return json({ error: 'unauthorized' }, 401);

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    });
    if (!response.ok)
      throw new Error(`${name} failed: ${response.status} ${await response.text()}`);
    return response.status === 204 ? null : await response.json();
  };

  try {
    const geocoder = geocoderFromEnv({
      GEOCODER: Deno.env.get('GEOCODER'),
      GEOAPIFY_API_KEY: Deno.env.get('GEOAPIFY_API_KEY'),
      SUPABASE_URL: url,
    });
    const reply = { claimed: 0, found: 0, notFound: 0, retried: 0, geocoder: geocoder.name };
    // With no geocoder nothing is claimed, so no spot burns an attempt.
    if (geocoder.name === 'none') return json(reply);

    const rows: ClaimedPlace[] = await rpc('claim_geocode_batch', { p_limit: 20 });
    reply.claimed = rows.length;
    // One at a time, so a provider's rate limit is never exceeded by the function itself. A
    // failure on one spot returns it to the queue and does not stop the rest of the batch.
    for (const row of rows) {
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
    }
    return json(reply);
  } catch (error) {
    console.error('geocode-places failed', error);
    return json({ error: 'geocode_failed' }, 500);
  }
});
