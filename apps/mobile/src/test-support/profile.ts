import type { MyProfile } from '@finalmeal/api';

/** A complete profile for tests; override only what a test cares about. */
export function makeProfile(overrides: Partial<MyProfile> = {}): MyProfile {
  return {
    id: 'u1',
    username: 'josiehamilton',
    displayName: 'Josie Hamilton',
    bio: 'Chasing the perfect meal.',
    avatarUrl: null,
    homeCity: { id: 'c1', label: 'Vancouver, BC, Canada' },
    showHomeCity: true,
    visibility: 'public',
    onboarded: true,
    counts: { followers: 0, following: 1, dishes: 0 },
    ...overrides,
  };
}
