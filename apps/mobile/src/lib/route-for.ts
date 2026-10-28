import type { MyProfile } from '@finalmeal/api';

export type GateRoute = '/welcome' | '/name' | '/city' | '/first-pick' | '/(app)/feed';

export interface GateState {
  session: boolean;
  profile: MyProfile | null;
  loading: boolean;
}

/**
 * Where a person belongs right now, or null while we cannot tell yet.
 * An onboarded person lands on the Feed tab, which shows First landing until Phase 4 builds the feed.
 * Someone who is not onboarded resumes at the first pick once they have got past the city and photo
 * steps (a home city or a photo is set; both steps can be skipped), and at the city step before that.
 * Used once at launch by app/index.tsx and by the onboarding code step after sign-in;
 * it is deliberately not run on every profile change (that would skip the loading screen).
 */
export function routeFor({ session, profile, loading }: GateState): GateRoute | null {
  if (loading) return null;
  if (!session) return '/welcome';
  if (!profile) return '/name';
  if (!profile.onboarded) {
    return profile.homeCity !== null || profile.avatarUrl !== null ? '/first-pick' : '/city';
  }
  return '/(app)/feed';
}
