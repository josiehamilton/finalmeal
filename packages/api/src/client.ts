import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type FinalMealClient = SupabaseClient<Database>;

export interface FinalMealClientOptions {
  /** Supabase API URL. */
  url: string;
  /** Publishable key (or legacy anon key). Never the service-role key. */
  key: string;
}

export function createFinalMealClient(opts: FinalMealClientOptions): FinalMealClient {
  return createClient<Database>(opts.url, opts.key);
}
