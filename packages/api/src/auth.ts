import { isPlausibleEmail, normalizeEmail } from '@finalmeal/core';
import { ApiError, throwIfError } from './errors';
import type { ErrorLike } from './errors';
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
  throwIfError(error && forVerify(error));
}

/**
 * The auth server answers a wrong code and an expired one identically (403 otp_expired,
 * "Token has expired or is invalid"), so a 403 here is always shown as "that code didn't work".
 */
function forVerify(error: ErrorLike): ErrorLike {
  return error.status === 403 ? { ...error, code: 'invalid_credentials' } : error;
}

export async function signOut(client: FinalMealClient): Promise<void> {
  const { error } = await client.auth.signOut();
  throwIfError(error);
}
