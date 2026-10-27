import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFinalMealClient } from '../client';
import type { FinalMealClient } from '../client';
import { readLatestCode } from './mailpit';
import { sendEmailCode, verifyEmailCode } from '../auth';

const ENV_FILE = fileURLToPath(new URL('../../.env.test.local', import.meta.url));

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    throw new Error(
      'Missing packages/api/.env.test.local. Start Supabase (pnpm db:start) and run pnpm env:local first.',
    );
  }
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match?.[1] && match[2] !== undefined) values[match[1]] = match[2];
  }
  return values;
}

/** A client with its own in-memory session, so several people can be signed in at once. */
export function newTestClient(): FinalMealClient {
  const env = readEnvFile(ENV_FILE);
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      'packages/api/.env.test.local is missing SUPABASE_URL or SUPABASE_KEY. Run pnpm env:local with Supabase running.',
    );
  }
  return createFinalMealClient({
    url,
    key,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Short random lowercase hex, for fresh emails and usernames on every run. */
export function randomSuffix(): string {
  return Math.random().toString(16).slice(2, 12);
}

/** Signs a brand-new person in through the real email-code flow. Costs one email. */
export async function signUpFreshUser(
  client: FinalMealClient,
  email = `user_${randomSuffix()}@example.com`,
): Promise<string> {
  const sentAt = Date.now() - 2000;
  await sendEmailCode(client, email);
  await verifyEmailCode(client, email, await readLatestCode(email, sentAt));
  return email;
}
