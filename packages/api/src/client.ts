import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type FinalMealClient = SupabaseClient<Database>;

export interface FinalMealClientOptions {
  /** Supabase API URL. */
  url: string;
  /** Publishable key (or legacy anon key). Never the service-role key. */
  key: string;
  /** Upper bound for each database (PostgREST) read, in milliseconds. Defaults to 2500. */
  timeoutMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 2500;

const POSTGREST_PATH = '/rest/v1/';

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function createFinalMealClient(opts: FinalMealClientOptions): FinalMealClient {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // A PostgREST read that hangs (black-holed host) must not hang its caller: bound it,
  // combined with any signal the caller passes. Auth, Storage and Functions requests are left
  // alone because they can legitimately take longer (for example sending a sign-in email).
  const boundedFetch: typeof fetch = (input, init) => {
    if (!requestUrl(input).includes(POSTGREST_PATH)) return fetch(input, init);
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  };
  return createClient<Database>(opts.url, opts.key, { global: { fetch: boundedFetch } });
}
