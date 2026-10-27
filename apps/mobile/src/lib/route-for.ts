import type { MyProfile } from '@finalmeal/api';

export type GateRoute = '/welcome' | '/name' | '/city' | '/(app)/you';

export interface GateState {
  session: boolean;
  profile: MyProfile | null;
  loading: boolean;
}

/**
 * Where a person belongs right now, or null while we cannot tell yet.
 * Used once at launch by app/index.tsx and by the onboarding code step after sign-in;
 * it is deliberately not run on every profile change (that would skip the loading screen).
 */
export function routeFor({ session, profile, loading }: GateState): GateRoute | null {
  if (loading) return null;
  if (!session) return '/welcome';
  if (!profile) return '/name';
  if (!profile.onboarded) return '/city';
  return '/(app)/you';
}
