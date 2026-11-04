import type { PersonRow, ProfileView, SuggestedPerson } from '@finalmeal/api';

/** Alli Mercer as supabase/seed.sql makes her (public, 3 finals and 1 honorable), seen by Josie. */
export function makeAlli(overrides: Partial<ProfileView> = {}): ProfileView {
  return {
    id: 'u4',
    username: 'allimercer',
    displayName: 'Alli Mercer',
    avatarUrl: null,
    bio: 'Spice level: nuclear.',
    homeCity: 'Saskatoon, SK',
    visibility: 'public',
    counts: { followers: 567, following: 203, dishes: 4 },
    viewerFollow: 'none',
    followsViewer: false,
    canSeePicks: true,
    isMe: false,
    ...overrides,
  };
}

/** A person in a list, with sensible defaults. */
export function makePerson(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id: 'u4',
    username: 'allimercer',
    displayName: 'Alli Mercer',
    avatarUrl: null,
    viewerFollow: 'none',
    followsViewer: false,
    isMe: false,
    ...overrides,
  };
}

export function makeSuggested(overrides: Partial<SuggestedPerson> = {}): SuggestedPerson {
  return { ...makePerson(overrides), topDish: null, ...overrides };
}
