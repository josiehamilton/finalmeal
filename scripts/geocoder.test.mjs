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
const { runGeocodeBatch } = await import(shared('geocode-batch.ts'));

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

describe('runGeocodeBatch', () => {
  const spot = (n, extra = {}) => ({
    place_id: `place-${n}`,
    name: `Spot ${n}`,
    address: `${n} Main St`,
    postcode: null,
    city: 'Vancouver',
    region: 'BC',
    country: 'CA',
    city_lat: near.lat,
    city_lng: near.lng,
    ...extra,
  });

  /** A fake PostgREST: claim returns `rows`; finish_geocode answers like the database would. */
  function fakeRpc(rows, { failOn } = {}) {
    const calls = [];
    const rpc = async (name, args) => {
      calls.push({ name, args });
      if (name === 'claim_geocode_batch') return rows;
      if (failOn && failOn(name, args)) throw new Error('finish_geocode failed: 500');
      if (args.p_result === 'found') return args.p_lat > 50 ? 'not_found' : 'done';
      return args.p_result === 'retry' ? 'pending' : args.p_result;
    };
    return { rpc, calls };
  }
  const fixed = (result, name = 'fixed') => ({ name, geocode: async () => result });

  test('with the none geocoder nothing is claimed', async () => {
    const { noneGeocoder } = await load();
    const { rpc, calls } = fakeRpc([spot(1)]);
    const reply = await runGeocodeBatch(rpc, noneGeocoder);
    assert.deepEqual(reply, { claimed: 0, found: 0, notFound: 0, retried: 0, geocoder: 'none' });
    assert.deepEqual(calls, []);
  });

  test('counts found, not found, retried, and an answer the database refuses as not found', async () => {
    const { mockGeocoder } = await load();
    const rows = [spot(1), spot(2, { address: 'Nowhere Rd' })];
    const { rpc, calls } = fakeRpc(rows);
    const reply = await runGeocodeBatch(rpc, mockGeocoder);
    assert.deepEqual(reply, { claimed: 2, found: 1, notFound: 1, retried: 0, geocoder: 'mock' });
    const finishes = calls.filter((c) => c.name === 'finish_geocode');
    assert.equal(finishes[0].args.p_result, 'found');
    assert.equal(finishes[0].args.p_geocoder, 'mock');
    assert.equal(finishes[1].args.p_result, 'not_found');

    const far = fakeRpc([spot(3)]);
    const farReply = await runGeocodeBatch(far.rpc, fixed({ status: 'found', lat: 60, lng: 0 }));
    assert.equal(farReply.found, 0);
    assert.equal(farReply.notFound, 1);

    const retry = fakeRpc([spot(4)]);
    const retryReply = await runGeocodeBatch(retry.rpc, fixed({ status: 'retry', reason: 'busy' }));
    assert.equal(retryReply.retried, 1);
  });

  test('a geocoder that throws is a retry and does not stop the batch', async () => {
    const { rpc, calls } = fakeRpc([spot(1), spot(2)]);
    let n = 0;
    const geocoder = {
      name: 'flaky',
      geocode: async () => {
        if (n++ === 0) throw new Error('boom');
        return { status: 'found', lat: 49.3, lng: -123.1 };
      },
    };
    const reply = await runGeocodeBatch(rpc, geocoder);
    assert.deepEqual(reply, { claimed: 2, found: 1, notFound: 0, retried: 1, geocoder: 'flaky' });
    assert.equal(calls.filter((c) => c.name === 'finish_geocode').length, 2);
  });

  test('when a finish fails, the spots not yet finished are released and the error is thrown', async () => {
    const rows = [spot(1), spot(2), spot(3)];
    const { rpc, calls } = fakeRpc(rows, {
      failOn: (name, args) => args.p_place_id === 'place-2' && args.p_result !== 'release',
    });
    await assert.rejects(
      runGeocodeBatch(rpc, fixed({ status: 'found', lat: 49.3, lng: -123.1 })),
      /finish_geocode failed/,
    );
    const released = calls
      .filter((c) => c.name === 'finish_geocode' && c.args.p_result === 'release')
      .map((c) => c.args.p_place_id);
    assert.deepEqual(released, ['place-2', 'place-3']);
  });

  test('a release that fails does not hide the original error', async () => {
    const { rpc } = fakeRpc([spot(1), spot(2)], { failOn: () => true });
    await assert.rejects(
      runGeocodeBatch(rpc, fixed({ status: 'found', lat: 49.3, lng: -123.1 })),
      /finish_geocode failed/,
    );
  });
});
