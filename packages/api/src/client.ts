import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type FinalMealClient = SupabaseClient<Database>;

export interface FinalMealClientOptions {
  /** Supabase API URL. */
  url: string;
  /** Publishable key (or legacy anon key). Never the service-role key. */
  key: string;
  /** Upper bound for each database (PostgREST) read, in milliseconds. Defaults to 2500. */
  timeoutMs?: number;
  /** Passed straight to supabase-js `auth`, for example React Native session storage. */
  auth?: {
    storage?: SupportedStorage;
    persistSession?: boolean;
    autoRefreshToken?: boolean;
    detectSessionInUrl?: boolean;
  };
}

export const DEFAULT_TIMEOUT_MS = 2500;

const POSTGREST_PATH = '/rest/v1/';

/** True for a database (PostgREST) read: the URL path starts with /rest/v1/ and the method is GET or HEAD. */
function isPostgrestRead(
  input: string | URL | { url: string; method?: string },
  init?: RequestInit,
): boolean {
  const fromRequest = typeof input === 'object' && 'method' in input ? input.method : undefined;
  const method = (
    init?.method ?? (typeof fromRequest === 'string' ? fromRequest : 'GET')
  ).toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return false;
  try {
    return new URL(requestUrl(input)).pathname.startsWith(POSTGREST_PATH);
  } catch {
    return false;
  }
}

/** The URL of a fetch input, whichever form it takes (kept structural so it type-checks against both Node and React Native fetch types). */
function requestUrl(input: string | URL | { url: string; method?: string }): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function createFinalMealClient(opts: FinalMealClientOptions): FinalMealClient {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // A PostgREST read that hangs (black-holed host) must not hang its caller: bound it,
  // combined with any signal the caller passes. Writes are left alone (a timed-out write could
  // still commit on the server), as are Auth, Storage and Functions requests, which can
  // legitimately take longer (for example sending a sign-in email).
  const boundedFetch: typeof fetch = (input, init) => {
    if (!isPostgrestRead(input, init)) return fetch(input, init);
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  };
  return createClient<Database>(opts.url, opts.key, {
    global: { fetch: boundedFetch },
    ...(opts.auth ? { auth: opts.auth } : {}),
  });
}
