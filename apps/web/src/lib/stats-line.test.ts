import { describe, expect, it } from 'vitest';
import { loadStatsLine } from './stats-line';

describe('loadStatsLine', () => {
  it('returns null when the env is missing', async () => {
    expect(await loadStatsLine(undefined, undefined)).toBeNull();
    expect(await loadStatsLine('http://127.0.0.1:54321', '')).toBeNull();
  });

  it('returns null, quickly, instead of throwing when the API is unreachable', async () => {
    const started = Date.now();
    expect(await loadStatsLine('http://127.0.0.1:1', 'not-a-real-key')).toBeNull();
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
