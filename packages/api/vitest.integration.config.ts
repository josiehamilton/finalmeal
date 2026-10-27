import { defineConfig } from 'vitest/config';

// Integration tests run against the local Supabase (pnpm db:start, pnpm env:local).
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    // Signing a person in goes through the email code flow, which can be slow on a busy machine.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
