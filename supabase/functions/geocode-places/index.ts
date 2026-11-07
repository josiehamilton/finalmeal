// geocode-places: gives custom spots a real map point (public.places, geocode_status 'pending').
// Called with the service-role key by a schedule or `pnpm geocode` (Phase 8 sets up the
// schedule). The geocoder comes from the GEOCODER secret; see _shared/geocoder.ts, and the batch
// logic is in _shared/geocode-batch.ts. Talks to the database through PostgREST with plain
// fetch, so it has no imports from the network.
import { runGeocodeBatch } from '../_shared/geocode-batch.ts';
import { geocoderFromEnv } from '../_shared/geocoder.ts';
import { isServiceRequest } from '../_shared/service-auth.ts';

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
    return json(await runGeocodeBatch(rpc, geocoder));
  } catch (error) {
    console.error('geocode-places failed', error);
    return json({ error: 'geocode_failed' }, 500);
  }
});
