import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type FinalMealClient = SupabaseClient<Database>;

export interface FinalMealClientOptions {
  /** Supabase API URL. */
  url: string;
  /** Publishable key (or legacy anon key). Never the service-role key. */
  key: string;
  /** Upper bound for each request, in milliseconds. Defaults to 2500. */
  timeoutMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 2500;

export function createFinalMealClient(opts: FinalMealClientOptions): FinalMealClient {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // A request that hangs (black-holed host) must not hang its caller: bound every request,
  // combined with any signal the caller passes.
  const boundedFetch: typeof fetch = (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  };
  return createClient<Database>(opts.url, opts.key, { global: { fetch: boundedFetch } });
}
