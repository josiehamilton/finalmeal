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
  /**
   * Upper bound for each sign-in (Auth, /auth/v1/) request, in milliseconds. Defaults to 15000.
   * Longer than a read because sending a sign-in email can legitimately take a few seconds.
   */
  authTimeoutMs?: number;
  /** Passed straight to supabase-js `auth`, for example React Native session storage. */
  auth?: {
    storage?: SupportedStorage;
    persistSession?: boolean;
    autoRefreshToken?: boolean;
    detectSessionInUrl?: boolean;
  };
}

export const DEFAULT_TIMEOUT_MS = 2500;
export const DEFAULT_AUTH_TIMEOUT_MS = 15000;

const POSTGREST_PATH = '/rest/v1/';
const AUTH_PATH = '/auth/v1/';

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

/** True for any request to Auth: the URL path starts with /auth/v1/. */
function isAuthRequest(input: string | URL | { url: string; method?: string }): boolean {
  try {
    return new URL(requestUrl(input)).pathname.startsWith(AUTH_PATH);
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
  const authTimeoutMs = opts.authTimeoutMs ?? DEFAULT_AUTH_TIMEOUT_MS;
  // A request to a black-holed host must not hang its caller. PostgREST reads are bounded at
  // `timeoutMs` and Auth requests (sending or checking a sign-in code) at the longer `authTimeoutMs`,
  // each combined with any signal the caller passes. Writes are left alone (a timed-out write could
  // still commit on the server), as are Storage and Functions requests, which can legitimately take
  // longer (an upload of a photo).
  const boundedFetch: typeof fetch = (input, init) => {
    const limit = isPostgrestRead(input, init)
      ? timeoutMs
      : isAuthRequest(input)
        ? authTimeoutMs
        : undefined;
    if (limit === undefined) return fetch(input, init);
    const timeout = AbortSignal.timeout(limit);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    // Our own timer firing is reported as a TimeoutError whatever message the platform's fetch uses
    // for an abort (React Native says only "Aborted"), so the error mapping can tell it from a lost network.
    return fetch(input, { ...init, signal }).catch((error: unknown) => {
      if (timeout.aborted && !init?.signal?.aborted) {
        throw Object.assign(new Error(`The request timed out after ${limit} ms`), {
          name: 'TimeoutError',
        });
      }
      throw error;
    });
  };
  return createClient<Database>(opts.url, opts.key, {
    global: { fetch: boundedFetch },
    ...(opts.auth ? { auth: opts.auth } : {}),
  });
}
