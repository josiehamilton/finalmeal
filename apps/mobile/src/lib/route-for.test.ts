import type { MyProfile } from '@finalmeal/api';
import { routeFor } from './route-for';

function profile(onboarded: boolean): MyProfile {
  return {
    id: 'u1',
    username: 'josie',
    displayName: 'Josie',
    bio: null,
    avatarUrl: null,
    homeCity: null,
    showHomeCity: true,
    visibility: 'public',
    onboarded,
    counts: { followers: 0, following: 0, dishes: 0 },
  };
}

describe('routeFor', () => {
  it('is null while loading', () => {
    expect(routeFor({ session: true, profile: null, loading: true })).toBeNull();
    expect(routeFor({ session: false, profile: null, loading: true })).toBeNull();
  });

  it('sends a signed-out visitor to Welcome', () => {
    expect(routeFor({ session: false, profile: null, loading: false })).toBe('/welcome');
  });

  it('sends a session without a profile to the name step', () => {
    expect(routeFor({ session: true, profile: null, loading: false })).toBe('/name');
  });

  it('sends a profile that is not onboarded and has neither city nor photo to the city step', () => {
    expect(routeFor({ session: true, profile: profile(false), loading: false })).toBe('/city');
  });

  it('resumes at the first pick once the person has a home city', () => {
    const withCity = { ...profile(false), homeCity: { id: 'c1', label: 'Vancouver, BC, Canada' } };
    expect(routeFor({ session: true, profile: withCity, loading: false })).toBe('/first-pick');
  });

  it('resumes at the first pick once the person has a photo (even with the city skipped)', () => {
    const withPhoto = { ...profile(false), avatarUrl: 'https://example.test/me.jpg' };
    expect(routeFor({ session: true, profile: withPhoto, loading: false })).toBe('/first-pick');
  });

  it('sends an onboarded profile to the Feed tab, which shows First landing', () => {
    expect(routeFor({ session: true, profile: profile(true), loading: false })).toBe('/(app)/feed');
  });
});
