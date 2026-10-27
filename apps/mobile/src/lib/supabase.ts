import { AppState, Platform } from 'react-native';
import { createFinalMealClient } from '@finalmeal/api';
import type { FinalMealClient } from '@finalmeal/api';
import { LargeSecureStore } from './secure-storage';

/** The Android emulator reaches the computer's localhost at 10.0.2.2, not 127.0.0.1. */
export function resolveSupabaseUrl(url: string): string {
  if (Platform.OS !== 'android') return url;
  return url.replace(
    /^(https?:\/\/)(?:127\.0\.0\.1|localhost)(?=[:/]|$)/,
    (_match, scheme: string) => `${scheme}10.0.2.2`,
  );
}

let client: FinalMealClient | undefined;

/**
 * The app's one Supabase client, built on first use so a missing env never crashes the app at
 * import time. Throws a clear error when the env is missing; SessionProvider catches it.
 */
export function getSupabase(): FinalMealClient {
  if (client) return client;
  // Expo only inlines EXPO_PUBLIC_* values written as literal `process.env.EXPO_PUBLIC_X`.
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY must be set (run `pnpm env:local`).',
    );
  }
  const created = createFinalMealClient({
    url: resolveSupabaseUrl(url),
    key,
    auth: {
      storage: new LargeSecureStore(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  // Refresh tokens only while the app is in the foreground (Supabase's Expo guide).
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void created.auth.startAutoRefresh();
    else void created.auth.stopAutoRefresh();
  });
  client = created;
  return created;
}

/** The same client as getSupabase(), for call sites that want a plain value. It builds on first use. */
export const supabase: FinalMealClient = new Proxy({} as FinalMealClient, {
  get(_target, prop) {
    const real = getSupabase();
    const value: unknown = Reflect.get(real, prop, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
