// The production geocoder adapter (Geoapify). It stays off until Josie has chosen a provider:
// geocoderFromEnv only returns it when the GEOCODER secret is `geoapify` and GEOAPIFY_API_KEY is
// set. No Deno APIs in this file, so it can be imported and tested anywhere.
import type { Geocoder } from './geocoder.ts';

const ENDPOINT = 'https://api.geoapify.com/v1/geocode/search';
const CIRCLE_RADIUS_M = 50_000;
const MIN_CONFIDENCE = 0.7;
const TIMEOUT_MS = 10_000;

/**
 * Looks one address up, only within 50 km of the spot's city (a filter, and a proximity bias).
 * The first result with confidence 0.7 or more is `found`; no such result is `not_found`. HTTP 429,
 * 5xx and network errors are `retry`; any other HTTP error is `not_found`. The API key is in the
 * request URL only: it is never logged, and error text is never passed on, because it may hold
 * the URL.
 */
export function geoapifyGeocoder(apiKey: string, fetchImpl: typeof fetch = fetch): Geocoder {
  return {
    name: 'geoapify',
    async geocode(q) {
      const text = [q.address, q.postcode, q.city, q.region, q.country]
        .map((part) => (part ?? '').trim())
        .filter((part) => part !== '')
        .join(', ');
      const { lat, lng } = q.near;
      const params = new URLSearchParams({
        text,
        filter: `circle:${lng},${lat},${CIRCLE_RADIUS_M}`,
        bias: `proximity:${lng},${lat}`,
        limit: '1',
        format: 'json',
        apiKey,
      });

      let response: Response;
      try {
        response = await fetchImpl(`${ENDPOINT}?${params}`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        return { status: 'retry', reason: 'network error' };
      }
      if (response.status === 429 || response.status >= 500) {
        return { status: 'retry', reason: `geoapify answered ${response.status}` };
      }
      if (!response.ok) return { status: 'not_found' };

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return { status: 'retry', reason: 'unreadable reply' };
      }
      const results = (body as { results?: unknown } | null)?.results;
      const first = Array.isArray(results)
        ? (results[0] as Record<string, unknown> | undefined)
        : undefined;
      const confidence = (first?.rank as { confidence?: unknown } | undefined)?.confidence;
      if (
        typeof first?.lat === 'number' &&
        typeof first.lon === 'number' &&
        typeof confidence === 'number' &&
        confidence >= MIN_CONFIDENCE
      ) {
        return { status: 'found', lat: first.lat, lng: first.lon };
      }
      return { status: 'not_found' };
    },
  };
}
