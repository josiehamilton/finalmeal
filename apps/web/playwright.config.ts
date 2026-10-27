import { defineConfig, devices } from '@playwright/test';

export const MAIN_URL = 'http://localhost:3000';
export const BROKEN_API_URL = 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: MAIN_URL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Uses apps/web/.env.local (pnpm env:local) for the real local Supabase.
      command: 'pnpm dev --port 3000',
      url: MAIN_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Same app, but the API URL points at a port nothing listens on.
      command: 'pnpm dev --port 3001',
      url: BROKEN_API_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1',
        NEXT_DIST_DIR: '.next-broken-api',
      },
    },
  ],
});
