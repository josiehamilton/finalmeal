import { isPlausibleEmail, normalizeEmail } from '@finalmeal/core';
import { ApiError, throwIfError } from './errors';
import type { FinalMealClient } from './client';

/** Sends a 6-digit sign-in code to `email`, creating the account on first use. */
export async function sendEmailCode(client: FinalMealClient, email: string): Promise<void> {
  if (!isPlausibleEmail(email)) throw new ApiError('Invalid email address', 'invalid_email');
  const { error } = await client.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: { shouldCreateUser: true },
  });
  // The backend's own address check disagreeing with ours is still just "not an email".
  if (error?.code === 'validation_failed') throw new ApiError(error.message, 'invalid_email');
  throwIfError(error);
}

/** Signs in with the code from the email. */
export async function verifyEmailCode(
  client: FinalMealClient,
  email: string,
  code: string,
): Promise<void> {
  const { error } = await client.auth.verifyOtp({
    email: normalizeEmail(email),
    token: code.trim(),
    type: 'email',
  });
  // The auth server answers a wrong code and an expired one identically (403 otp_expired,
  // "Token has expired or is invalid"), so a 403 here is always shown as "that code didn't work".
  // A new ApiError, not a spread: an AuthApiError's message is not an own enumerable property.
  if (error?.status === 403) throw new ApiError(error.message, 'invalid_code');
  throwIfError(error);
}

/** Signs out everywhere by default, or on this device only (works without the network). */
export async function signOut(
  client: FinalMealClient,
  scope: 'global' | 'local' = 'global',
): Promise<void> {
  const { error } = await client.auth.signOut({ scope });
  throwIfError(error);
}

/**
 * Asks the server whether the stored sign-in still belongs to a real account. 'gone' only when the
 * server says so (the user was deleted, or the token was revoked or is invalid), never for a network
 * failure, a timeout or a server error: those return 'unknown' so the session is kept.
 */
export async function checkSession(client: FinalMealClient): Promise<'valid' | 'gone' | 'unknown'> {
  try {
    const { data, error } = await client.auth.getUser();
    if (!error) return data.user ? 'valid' : 'gone';
    if (error.name === 'AuthSessionMissingError') return 'gone';
    const status = error.status ?? 0;
    return status === 400 || status === 401 || status === 403 || status === 404
      ? 'gone'
      : 'unknown';
  } catch {
    return 'unknown';
  }
}
