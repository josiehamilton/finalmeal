// Tests for supabase/functions/_shared/geocoder.ts, geocoder-geoapify.ts and service-auth.ts
// (no Deno APIs, so Node can run them; Node 22.18+ strips the types itself).
// Run with: node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { describe, mock, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shared = (name) => pathToFileURL(join(root, 'supabase/functions/_shared', name)).href;

// A fresh copy of geocoder.ts per test, because its warnings are shown once per module.
let copy = 0;
const load = () => import(`${shared('geocoder.ts')}?copy=${copy++}`);
const { geoapifyGeocoder } = await import(shared('geocoder-geoapify.ts'));
const { isServiceRequest } = await import(shared('service-auth.ts'));

const LOCAL = 'http://kong:8000';
const REMOTE = 'https://abc.supabase.co';
const near = { lat: 49.24966, lng: -123.11934 };
const query = {
  address: '12 Main St',
  postcode: null,
  city: 'Vancouver',
  region: 'BC',
  country: 'CA',
  near,
};

/** Distance in metres between two points (haversine). */
function metres(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

/** Runs `fn` with console.warn/log/error/info recorded, and returns what was printed. */
async function withConsole(fn) {
  const printed = [];
  const methods = ['warn', 'log', 'error', 'info'].map((name) =>
    mock.method(console, name, (...args) => printed.push(args.join(' '))),
  );
  try {
    await fn();
  } finally {
    for (const method of methods) method.mock.restore();
  }
  return printed;
}

describe('isLocalStack', () => {
  test('recognises the local hostnames only', async () => {
    const { isLocalStack } = await load();
    for (const url of [
      'http://kong:8000',
      'http://localhost:54321',
      'http://127.0.0.1:54321',
      'http://host.docker.internal:54321',
    ]) {
      assert.equal(isLocalStack(url), true, url);
    }
    for (const url of [
      REMOTE,
      'https://kong.example.com',
      'http://localhost.evil.com',
      'not a url',
      '',
      undefined,
    ]) {
      assert.equal(isLocalStack(url), false, String(url));
    }
  });
});

describe('geocoderFromEnv', () => {
  test('unset or empty: mock on a local stack, none elsewhere, silently', async () => {
    const { geocoderFromEnv } = await load();
    const printed = await withConsole(() => {
      for (const value of [undefined, '', '  ']) {
        assert.equal(geocoderFromEnv({ GEOCODER: value, SUPABASE_URL: LOCAL }).name, 'mock');
        assert.equal(geocoderFromEnv({ GEOCODER: value, SUPABASE_URL: REMOTE }).name, 'none');
      }
      assert.equal(geocoderFromEnv({ SUPABASE_URL: LOCAL }).name, 'mock');
    });
    assert.deepEqual(printed, []);
  });

  test('none is none everywhere', async () => {
    const { geocoderFromEnv } = await load();
    assert.equal(geocoderFromEnv({ GEOCODER: 'none', SUPABASE_URL: LOCAL }).name, 'none');
    assert.equal(geocoderFromEnv({ GEOCODER: 'NONE', SUPABASE_URL: REMOTE }).name, 'none');
  });

  test('mock runs only on a local stack; elsewhere it is none, with one warning', async () => {
    const { geocoderFromEnv } = await load();
    const printed = await withConsole(() => {
      assert.equal(geocoderFromEnv({ GEOCODER: 'mock', SUPABASE_URL: LOCAL }).name, 'mock');
      assert.equal(geocoderFromEnv({ GEOCODER: 'mock', SUPABASE_URL: REMOTE }).name, 'none');
      assert.equal(geocoderFromEnv({ GEOCODER: 'mock', SUPABASE_URL: REMOTE }).name, 'none');
      assert.equal(geocoderFromEnv({ GEOCODER: 'mock' }).name, 'none');
    });
    assert.deepEqual(printed, ['The mock geocoder only runs on a local stack; using none']);
  });

  test('geoapify uses the key; without one it is none, with one warning', async () => {
    const { geocoderFromEnv } = await load();
    const printed = await withConsole(() => {
      assert.equal(
        geocoderFromEnv({ GEOCODER: 'geoapify', GEOAPIFY_API_KEY: 'k', SUPABASE_URL: REMOTE }).name,
        'geoapify',
      );
      assert.equal(geocoderFromEnv({ GEOCODER: 'geoapify', SUPABASE_URL: REMOTE }).name, 'none');
      assert.equal(
        geocoderFromEnv({ GEOCODER: 'geoapify', GEOAPIFY_API_KEY: ' ', SUPABASE_URL: LOCAL }).name,
        'none',
      );
    });
    assert.deepEqual(printed, ['GEOAPIFY_API_KEY is not set; using none']);
  });

  test('an unknown value is none, with one warning per value', async () => {
    const { geocoderFromEnv } = await load();
    const printed = await withConsole(() => {
      assert.equal(geocoderFromEnv({ GEOCODER: 'pigeon', SUPABASE_URL: LOCAL }).name, 'none');
      assert.equal(geocoderFromEnv({ GEOCODER: 'pigeon', SUPABASE_URL: LOCAL }).name, 'none');
    });
    assert.deepEqual(printed, ['Unknown GEOCODER "pigeon"; using none']);
  });

  test('the none geocoder answers retry', async () => {
    const { noneGeocoder } = await load();
    const result = await noneGeocoder.geocode(query);
    assert.equal(result.status, 'retry');
  });
});

describe('mockGeocoder', () => {
  test('is deterministic and lands 300-2500 m from the city point', async () => {
    const { mockGeocoder } = await load();
    const first = await mockGeocoder.geocode(query);
    const second = await mockGeocoder.geocode({
      ...query,
      address: '12 MAIN ST',
      city: 'vancouver',
    });
    assert.equal(first.status, 'found');
    assert.deepEqual(second, first);
    const distance = metres(near, first);
    assert.ok(distance >= 300 && distance <= 2500, `distance ${distance}`);
  });

  test('different addresses land on different points, all within range', async () => {
    const { mockGeocoder } = await load();
    const seen = new Set();
    for (let i = 1; i <= 25; i++) {
      const result = await mockGeocoder.geocode({ ...query, address: `${i} Main St` });
      assert.equal(result.status, 'found');
      const distance = metres(near, result);
      assert.ok(distance >= 300 && distance <= 2500, `distance ${distance}`);
      seen.add(`${result.lat},${result.lng}`);
    }
    assert.equal(seen.size, 25);
  });

  test('an address starting with Nowhere is not found', async () => {
    const { mockGeocoder } = await load();
    assert.deepEqual(await mockGeocoder.geocode({ ...query, address: 'Nowhere Rd' }), {
      status: 'not_found',
    });
    assert.deepEqual(await mockGeocoder.geocode({ ...query, address: 'nowhere at all' }), {
      status: 'not_found',
    });
  });
});

describe('geoapifyGeocoder', () => {
  const reply = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const hit = (confidence) => ({
    results: [{ lat: 49.269, lon: -123.069, rank: { confidence } }],
  });

  test('builds the request from the query', async () => {
    const calls = [];
    const geocoder = geoapifyGeocoder('secret-key', async (url) => {
      calls.push(String(url));
      return reply(hit(0.9));
    });
    assert.equal(geocoder.name, 'geoapify');
    await geocoder.geocode({ ...query, postcode: 'V5L 3W8' });
    assert.equal(calls.length, 1);
    const url = new URL(calls[0]);
    assert.equal(url.origin + url.pathname, 'https://api.geoapify.com/v1/geocode/search');
    assert.equal(url.searchParams.get('text'), '12 Main St, V5L 3W8, Vancouver, BC, CA');
    assert.equal(url.searchParams.get('filter'), 'circle:-123.11934,49.24966,50000');
    assert.equal(url.searchParams.get('bias'), 'proximity:-123.11934,49.24966');
    assert.equal(url.searchParams.get('limit'), '1');
    assert.equal(url.searchParams.get('format'), 'json');
    assert.equal(url.searchParams.get('apiKey'), 'secret-key');
  });

  test('drops blank parts from the text', async () => {
    const calls = [];
    const geocoder = geoapifyGeocoder('k', async (url) => {
      calls.push(String(url));
      return reply(hit(0.9));
    });
    await geocoder.geocode({ ...query, postcode: ' ', region: null });
    assert.equal(new URL(calls[0]).searchParams.get('text'), '12 Main St, Vancouver, CA');
  });

  test('confidence 0.7 or more is found; less is not found; no result is not found', async () => {
    const answer = (body) => geoapifyGeocoder('k', async () => reply(body)).geocode(query);
    assert.deepEqual(await answer(hit(0.9)), { status: 'found', lat: 49.269, lng: -123.069 });
    assert.deepEqual(await answer(hit(0.7)), { status: 'found', lat: 49.269, lng: -123.069 });
    assert.deepEqual(await answer(hit(0.5)), { status: 'not_found' });
    assert.deepEqual(await answer({ results: [] }), { status: 'not_found' });
    assert.deepEqual(await answer({}), { status: 'not_found' });
  });

  test('429, 5xx and network errors retry; other HTTP errors are not found', async () => {
    const status = (code) => geoapifyGeocoder('k', async () => reply({}, code)).geocode(query);
    assert.equal((await status(429)).status, 'retry');
    assert.equal((await status(500)).status, 'retry');
    assert.equal((await status(503)).status, 'retry');
    assert.deepEqual(await status(400), { status: 'not_found' });
    assert.deepEqual(await status(401), { status: 'not_found' });
    const thrown = await geoapifyGeocoder('k', async () => {
      throw new TypeError('fetch failed: https://api.geoapify.com/?apiKey=secret-key');
    }).geocode(query);
    assert.equal(thrown.status, 'retry');
  });

  test('the key never appears in a result reason or in any console output', async () => {
    const results = [];
    const printed = await withConsole(async () => {
      for (const fetchImpl of [
        async () => {
          throw new TypeError('fetch failed: https://api.geoapify.com/?apiKey=secret-key');
        },
        async () => reply({}, 500),
        async () => reply({}, 429),
        async () => reply({}, 400),
        async () => reply(hit(0.9)),
      ]) {
        results.push(await geoapifyGeocoder('secret-key', fetchImpl).geocode(query));
      }
    });
    assert.equal(JSON.stringify(results).includes('secret-key'), false);
    assert.equal(printed.join('\n').includes('secret-key'), false);
  });
});

describe('isServiceRequest', () => {
  const key = 'eyJ.service-role.key';
  const request = (authorization) =>
    new Request('http://kong:8000/functions/v1/x', {
      method: 'POST',
      headers: authorization === undefined ? {} : { Authorization: authorization },
    });

  test('accepts the exact key', () => {
    assert.equal(isServiceRequest(request(`Bearer ${key}`), key), true);
  });

  test('rejects a different key, a user token, a missing header and a missing service key', () => {
    assert.equal(isServiceRequest(request('Bearer eyJ.service-role.kez'), key), false);
    assert.equal(isServiceRequest(request('Bearer eyJ.user.token'), key), false);
    assert.equal(isServiceRequest(request(`Bearer ${key}x`), key), false);
    assert.equal(isServiceRequest(request(undefined), key), false);
    assert.equal(isServiceRequest(request(key), key), false);
    assert.equal(isServiceRequest(request('Bearer '), key), false);
    assert.equal(isServiceRequest(request('Bearer '), ''), false);
    assert.equal(isServiceRequest(request(`Bearer ${key}`), undefined), false);
  });
});
