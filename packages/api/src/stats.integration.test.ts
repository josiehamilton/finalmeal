import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { ApiError, createFinalMealClient, getFoundationStats, throwIfError } from './index';
import type { FinalMealClient } from './index';

const ENV_FILE = fileURLToPath(new URL('../.env.test.local', import.meta.url));

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    throw new Error(
      `Missing packages/api/.env.test.local. Start Supabase (pnpm db:start) and run pnpm env:local first.`,
    );
  }
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match?.[1] && match[2] !== undefined) values[match[1]] = match[2];
  }
  return values;
}

describe('against local Supabase (seeded)', () => {
  let client: FinalMealClient;

  beforeAll(() => {
    const env = readEnvFile(ENV_FILE);
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_KEY;
    if (!url || !key) {
      throw new Error(
        'packages/api/.env.test.local is missing SUPABASE_URL or SUPABASE_KEY. Run pnpm env:local with Supabase running.',
      );
    }
    client = createFinalMealClient({ url, key });
  });

  it('counts the seeded people, places, dishes and picks', async () => {
    expect(await getFoundationStats(client)).toEqual({
      people: 6,
      places: 14,
      dishes: 17,
      picks: 28,
    });
  });

  it('rejects an anonymous insert into picks with the RLS error code', async () => {
    const attempt = client
      .from('picks')
      .insert({
        user_id: '00000000-0000-4000-8000-000000000001',
        dish_id: '00000000-0000-4000-8000-000000000001',
        tier: 'final',
        slot: 1,
        original_dish_name: 'Anonymous attempt',
      })
      .then(({ error }) => throwIfError(error));
    await expect(attempt).rejects.toMatchObject({ name: 'ApiError', code: '42501' });
  });
});

describe('when the backend is unreachable', () => {
  it('rejects with an ApiError within 3s instead of retrying for several seconds', async () => {
    const client = createFinalMealClient({ url: 'http://127.0.0.1:1', key: 'unused' });
    const started = Date.now();
    await expect(getFoundationStats(client)).rejects.toBeInstanceOf(ApiError);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
