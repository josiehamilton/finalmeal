/**
 * The set of failures the apps know how to talk about. Every `ApiError` code is either one of
 * these or a raw backend code (for example '42501'), which the apps treat as `unknown`.
 */
export type FriendlyCode =
  | 'invalid_email'
  | 'invalid_code'
  | 'code_expired'
  | 'rate_limited'
  | 'username_taken'
  | 'invalid_username'
  | 'profile_exists'
  | 'city_not_found'
  | 'profile_not_found'
  | 'final_full'
  | 'duplicate_pick'
  | 'place_not_found'
  | 'invalid_dish_name'
  | 'invalid_place_name'
  | 'pick_not_found'
  | 'invalid_photo'
  | 'invalid_slot'
  | 'invalid_tag'
  | 'invalid_tag_name'
  | 'address_required'
  | 'custom_place_limit'
  | 'request_not_found'
  | 'dish_not_found'
  | 'profile_unavailable'
  | 'cannot_follow_self'
  | 'invalid_push_token'
  | 'timeout'
  | 'network'
  | 'unknown';

const FRIENDLY_CODES: ReadonlySet<string> = new Set<FriendlyCode>([
  'invalid_email',
  'invalid_code',
  'code_expired',
  'rate_limited',
  'username_taken',
  'invalid_username',
  'profile_exists',
  'city_not_found',
  'profile_not_found',
  'final_full',
  'duplicate_pick',
  'place_not_found',
  'invalid_dish_name',
  'invalid_place_name',
  'pick_not_found',
  'invalid_photo',
  'invalid_slot',
  'invalid_tag',
  'invalid_tag_name',
  'address_required',
  'custom_place_limit',
  'request_not_found',
  'dish_not_found',
  'profile_unavailable',
  'cannot_follow_self',
  'invalid_push_token',
  'timeout',
  'network',
  'unknown',
]);

export function isFriendlyCode(code: string): code is FriendlyCode {
  return FRIENDLY_CODES.has(code);
}

/**
 * An error from the backend. `code` is a `FriendlyCode` when the failure is one the apps
 * explain, otherwise the Postgres, PostgREST or Auth code (e.g. '42501'), or '' when there is none.
 */
export class ApiError extends Error {
  readonly code: string;
  /**
   * For `duplicate_pick`: the pick that is already on the person's list, so the app can offer to
   * move it instead of looking it up. Null for every other error, or when the backend sent no
   * readable detail.
   */
  readonly existingPick: ExistingPick | null;

  constructor(message: string, code: string, existingPick: ExistingPick | null = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.existingPick = existingPick;
  }
}

/** The pick a `duplicate_pick` error points at. */
export interface ExistingPick {
  id: string;
  tier: 'final' | 'honorable';
}

/** Reads the `{"pick_id", "tier"}` JSON the backend puts in a duplicate_pick error's detail. */
function parseExistingPick(details: string | null | undefined): ExistingPick | null {
  if (!details) return null;
  try {
    const parsed: unknown = JSON.parse(details);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { pick_id: id, tier } = parsed as { pick_id?: unknown; tier?: unknown };
    if (typeof id !== 'string' || id === '') return null;
    if (tier !== 'final' && tier !== 'honorable') return null;
    return { id, tier };
  } catch {
    return null;
  }
}

/** The fields of a Postgrest, Auth or Storage error that `throwIfError` reads. */
export interface ErrorLike {
  message: string;
  code?: string | null;
  status?: number | null;
  name?: string;
  /** Postgres' DETAIL text, for the errors that carry one. */
  details?: string | null;
}

/** Messages the onboarding functions raise (SQLSTATE P0001); each is also a `FriendlyCode`. */
const DOMAIN_MESSAGES: ReadonlySet<string> = new Set([
  'profile_exists',
  'username_taken',
  'invalid_username',
  'city_not_found',
  'profile_not_found',
  'rate_limited',
  'final_full',
  'duplicate_pick',
  'place_not_found',
  'invalid_dish_name',
  'invalid_place_name',
  'pick_not_found',
  'invalid_photo',
  'invalid_slot',
  'invalid_tag',
  'invalid_tag_name',
  'address_required',
  'custom_place_limit',
  'request_not_found',
  'dish_not_found',
  'profile_unavailable',
  'cannot_follow_self',
  'invalid_push_token',
]);

const RATE_LIMIT_CODES: ReadonlySet<string> = new Set([
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'over_sms_send_rate_limit',
]);

/** What fetch rejects with when the network is down (Node, browsers, React Native). */
const FETCH_FAILURE =
  /^(TypeError: )?(fetch failed|Failed to fetch|Network request failed|Load failed)/i;

/** True when a message is what fetch rejects with on a network failure. */
export function isFetchFailure(message: string): boolean {
  return FETCH_FAILURE.test(message);
}

function codeFor(error: ErrorLike): string {
  const code = error.code ?? '';
  if (code === '') {
    // postgrest-js reports a timed-out or aborted fetch with an empty code and the DOMException name.
    if (/^(TimeoutError|AbortError)\b/.test(error.message)) return 'timeout';
    if (FETCH_FAILURE.test(error.message)) return 'network';
  }
  // auth-js wraps a failed fetch (status 0) in this error: a timeout we raised, or a lost network.
  if (error.name === 'AuthRetryableFetchError') {
    return /^(TimeoutError|AbortError)\b|timed out|aborted due to timeout/.test(error.message)
      ? 'timeout'
      : 'network';
  }
  if (code === 'otp_expired') return 'code_expired';
  if (code === 'invalid_credentials' || code === 'otp_disabled') return 'invalid_code';
  if (RATE_LIMIT_CODES.has(code) || error.status === 429) return 'rate_limited';
  if (code === 'P0001' && DOMAIN_MESSAGES.has(error.message)) return error.message;
  return code;
}

/** Throws an `ApiError` when a Supabase response carries an error; does nothing otherwise. */
export function throwIfError(error: ErrorLike | null): void {
  if (!error) return;
  const code = codeFor(error);
  throw new ApiError(
    error.message,
    code,
    code === 'duplicate_pick' ? parseExistingPick(error.details) : null,
  );
}
