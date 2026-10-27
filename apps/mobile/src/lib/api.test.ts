import { loadStats } from './api';

describe('loadStats', () => {
  it('rejects, rather than throwing at import, when the env is not set', async () => {
    const saved = { ...process.env };
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_KEY;
    try {
      await expect(loadStats()).rejects.toThrow('EXPO_PUBLIC_SUPABASE_URL');
    } finally {
      process.env = saved;
    }
  });
});
