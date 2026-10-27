import { describe, expect, it } from 'vitest';
import { loadStatsLine } from './stats-line';

describe('loadStatsLine', () => {
  it('returns null when the env is missing', async () => {
    expect(await loadStatsLine(undefined, undefined)).toBeNull();
    expect(await loadStatsLine('http://127.0.0.1:54321', '')).toBeNull();
  });

  // supabase-js retries refused connections with backoff (about 7s) before giving up.
  it(
    'returns null instead of throwing when the API is unreachable',
    { timeout: 20_000 },
    async () => {
      expect(await loadStatsLine('http://127.0.0.1:1', 'not-a-real-key')).toBeNull();
    },
  );
});
