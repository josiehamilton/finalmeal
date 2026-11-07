import { beforeAll, describe, expect, it } from 'vitest';
import { createCustomPlace, createMyProfile, getCity, getPlace, searchCities } from './index';
import type { FinalMealClient } from './index';
import {
  apiUrl,
  newTestClient,
  randomSuffix,
  serviceRoleKey,
  signUpFreshUser,
} from './test-support/env';

interface GeocodeReply {
  claimed: number;
  found: number;
  notFound: number;
  retried: number;
  geocoder: string;
}

const SKIP_HINT =
  'The geocode-places function is not being served. Restart the stack (pnpm db:stop && pnpm db:start) so it picks up supabase/functions, or run: pnpm exec supabase functions serve';

async function geocode(token: string): Promise<Response> {
  return fetch(`${apiUrl()}/functions/v1/geocode-places`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
}

/** A spot's geocode_status, which clients cannot read (service role only). */
async function geocodeStatus(placeId: string): Promise<string | undefined> {
  const key = serviceRoleKey();
  const response = await fetch(
    `${apiUrl()}/rest/v1/places?id=eq.${placeId}&select=geocode_status`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    },
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { geocode_status: string }[])[0]?.geocode_status;
}

/** Vancouver, BC (the dev seed has a Vancouver, WA too). */
async function vancouver(client: FinalMealClient) {
  const found = (await searchCities(client, 'Vancouver')).find((c) => c.regionCode === 'BC');
  expect(found, 'the dev seed should have Vancouver, BC').toBeDefined();
  const city = await getCity(client, found?.id ?? '');
  expect(city).not.toBeNull();
  return city as NonNullable<typeof city>;
}

/** Straight-line distance in km (haversine). */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

describe('geocode-places (local Supabase)', () => {
  const user = newTestClient();
  const suffix = randomSuffix();

  beforeAll(async () => {
    await signUpFreshUser(user);
    await createMyProfile(user, { displayName: 'Geo Coder', username: `geo_${suffix}` });
  });

  it('moves a new custom spot off its city point, and leaves a not-found one there', async () => {
    const city = await vancouver(user);
    const tacos = await createCustomPlace(user, {
      name: `${suffix} Test Tacos`,
      cityId: city.id,
      address: '12 Main St',
    });
    const nowhere = await createCustomPlace(user, {
      name: `${suffix} Test Nowhere`,
      cityId: city.id,
      address: 'Nowhere Rd',
    });
    // Nothing is pinned until the function has run.
    expect(tacos.lat).toBeCloseTo(city.lat, 4);

    // Other pending spots may be older than ours (the queue is shared and a call takes 20), so
    // call until the queue is empty.
    let found = 0;
    let notFound = 0;
    let geocoder = '';
    for (let call = 0; call < 25; call++) {
      const response = await geocode(serviceRoleKey());
      expect(response.status, SKIP_HINT).toBe(200);
      const body = (await response.json()) as GeocodeReply;
      geocoder = body.geocoder;
      found += body.found;
      notFound += body.notFound;
      if (body.claimed === 0) break;
    }
    expect(geocoder).toBe('mock');
    expect(found).toBeGreaterThanOrEqual(1);
    expect(notFound).toBeGreaterThanOrEqual(1);
    // The bookkeeping is server-side, so read it as the service role.
    expect(await geocodeStatus(tacos.id)).toBe('done');
    expect(await geocodeStatus(nowhere.id)).toBe('not_found');

    const placed = await getPlace(user, tacos.id);
    expect(placed).not.toBeNull();
    const distance = km(city, placed as NonNullable<typeof placed>);
    expect(distance).toBeGreaterThan(0.2);
    expect(distance).toBeLessThan(3);

    const missing = await getPlace(user, nowhere.id);
    expect(missing?.lat).toBeCloseTo(city.lat, 4);
    expect(missing?.lng).toBeCloseTo(city.lng, 4);
  });

  it('refuses anyone but the service role', async () => {
    const session = (await user.auth.getSession()).data.session;
    expect(session).not.toBeNull();
    const response = await geocode(session?.access_token ?? '');
    expect(response.status, SKIP_HINT).toBe(401);
  });
});
