import { defineConfig } from 'vitest/config';

// Integration tests run against the local Supabase (pnpm db:start, pnpm env:local).
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
  },
});
