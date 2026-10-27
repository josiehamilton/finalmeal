import { createFinalMealClient, getFoundationStats } from '@finalmeal/api';
import type { FinalMealClient, FoundationStats } from '@finalmeal/api';

let client: FinalMealClient | undefined;

/** Built on first use so a missing env never crashes the app at import time. */
function getClient(): FinalMealClient {
  // Expo only inlines EXPO_PUBLIC_* values written as literal `process.env.EXPO_PUBLIC_X`.
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY must be set (run `pnpm env:local`).',
    );
  }
  client ??= createFinalMealClient({ url, key });
  return client;
}

/** Rejects (never throws synchronously) when the env is missing or the API cannot be reached. */
export async function loadStats(): Promise<FoundationStats> {
  return getFoundationStats(getClient());
}
