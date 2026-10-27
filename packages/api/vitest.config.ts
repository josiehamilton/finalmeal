import { defineConfig } from 'vitest/config';

// Unit tests only: these must pass with Supabase stopped.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'src/**/*.integration.test.ts'],
  },
});
