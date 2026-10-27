import { ApiError, isFetchFailure, isFriendlyCode } from './errors';
import type { FriendlyCode } from './errors';

/** Spec 5.6 copy. Apps show these and never a raw error. */
const COPY = {
  invalid_email: 'That doesn’t look like an email address.',
  invalid_code: 'That code didn’t work. Check it and try again.',
  code_expired: 'That code has expired. Tap “Resend code” for a new one.',
  rate_limited: 'Too many tries. Wait a minute and try again.',
  username_taken: 'That handle’s taken. Try another.',
  invalid_username: 'Letters, numbers and underscores, 3–30 characters.',
  final_full: 'Your five are full. Choose one to replace.',
  duplicate_pick: 'That dish is already on your list.',
  place_not_found: 'We couldn’t find that spot. Try searching again.',
  invalid_dish_name: 'Give the dish a name (up to 80 characters).',
  invalid_place_name: 'Give the spot a name (up to 80 characters).',
  pick_not_found: 'That pick isn’t there any more.',
  invalid_photo: 'That photo didn’t work. Try another.',
  invalid_slot: 'That spot in your five doesn’t exist.',
  address_required: 'Add the street address, or mark it as a food truck or pop-up.',
  invalid_tag_name: 'Tags can be up to 40 characters.',
  network: 'Can’t reach the kitchen right now.',
  unknown: 'Something went wrong. Try again.',
} as const;

/** The friendly code for anything thrown; anything unrecognised is `unknown`. */
export function friendlyCode(e: unknown): FriendlyCode {
  if (e instanceof ApiError) return isFriendlyCode(e.code) ? e.code : 'unknown';
  // A fetch that rejected before reaching our wrappers. Other TypeErrors are bugs, not outages.
  if (e instanceof TypeError) return isFetchFailure(e.message) ? 'network' : 'unknown';
  if (e instanceof Error && /^(TimeoutError|AbortError)$/.test(e.name)) return 'timeout';
  return 'unknown';
}

export function friendlyMessage(e: unknown): string {
  const code = friendlyCode(e);
  switch (code) {
    case 'timeout':
    case 'network':
      return COPY.network;
    case 'profile_exists':
    case 'city_not_found':
    case 'profile_not_found':
    case 'invalid_tag':
      return COPY.unknown;
    default:
      return COPY[code];
  }
}
