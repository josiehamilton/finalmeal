import { describe, expect, it, vi } from 'vitest';
import { checkSession, sendEmailCode, signOut, verifyEmailCode } from './auth';
import { ApiError } from './errors';
import type { FinalMealClient } from './client';

function fakeClient(auth: Record<string, unknown>): FinalMealClient {
  return { auth } as unknown as FinalMealClient;
}

describe('sendEmailCode', () => {
  it.each(['', 'nobody', 'a@b', 'a b@c.com', 'a@@b.com'])(
    'rejects "%s" with invalid_email and never calls the backend',
    async (email) => {
      const signInWithOtp = vi.fn();
      await expect(sendEmailCode(fakeClient({ signInWithOtp }), email)).rejects.toMatchObject({
        name: 'ApiError',
        code: 'invalid_email',
      });
      expect(signInWithOtp).not.toHaveBeenCalled();
    },
  );

  it('normalises the address and allows sign-up', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    await sendEmailCode(fakeClient({ signInWithOtp }), '  New.Person@Example.COM ');
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'new.person@example.com',
      options: { shouldCreateUser: true },
    });
  });

  it('maps a rate-limit response to rate_limited', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({
      data: {},
      error: {
        name: 'AuthApiError',
        message: 'slow down',
        code: 'over_email_send_rate_limit',
        status: 429,
      },
    });
    await expect(
      sendEmailCode(fakeClient({ signInWithOtp }), 'a@example.com'),
    ).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('maps a validation failure to invalid_email', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({
      data: {},
      error: { name: 'AuthApiError', message: 'bad', code: 'validation_failed', status: 400 },
    });
    await expect(
      sendEmailCode(fakeClient({ signInWithOtp }), 'a@example.com'),
    ).rejects.toMatchObject({
      code: 'invalid_email',
    });
  });
});

describe('verifyEmailCode', () => {
  it('verifies with the normalised address and the email type', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    await verifyEmailCode(fakeClient({ verifyOtp }), ' A@Example.com ', ' 123456 ');
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'a@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('maps the backend 403 (wrong or expired code) to invalid_code', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {},
      error: {
        name: 'AuthApiError',
        message: 'Token has expired or is invalid',
        code: 'otp_expired',
        status: 403,
      },
    });
    await expect(
      verifyEmailCode(fakeClient({ verifyOtp }), 'a@example.com', '000000'),
    ).rejects.toMatchObject({
      code: 'invalid_code',
    });
  });

  it('keeps the original message when it re-maps a real AuthApiError instance', async () => {
    // auth-js errors are Error subclasses: their message is not an own enumerable property.
    class FakeAuthApiError extends Error {
      status = 403;
      code = 'otp_expired';
      constructor(message: string) {
        super(message);
        this.name = 'AuthApiError';
      }
    }
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {},
      error: new FakeAuthApiError('Token has expired or is invalid'),
    });
    const rejection = await verifyEmailCode(
      fakeClient({ verifyOtp }),
      'a@example.com',
      '000000',
    ).catch((e: unknown) => e);
    expect(rejection).toBeInstanceOf(ApiError);
    expect(rejection).toMatchObject({
      code: 'invalid_code',
      message: 'Token has expired or is invalid',
    });
  });

  it('keeps a rate limit as rate_limited', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {},
      error: { name: 'AuthApiError', message: 'x', code: 'over_request_rate_limit', status: 429 },
    });
    await expect(
      verifyEmailCode(fakeClient({ verifyOtp }), 'a@example.com', '000000'),
    ).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });
});

describe('signOut', () => {
  it('signs out everywhere by default', async () => {
    const out = vi.fn().mockResolvedValue({ error: null });
    await signOut(fakeClient({ signOut: out }));
    expect(out).toHaveBeenCalledWith({ scope: 'global' });
  });

  it('can sign out of this device only', async () => {
    const out = vi.fn().mockResolvedValue({ error: null });
    await signOut(fakeClient({ signOut: out }), 'local');
    expect(out).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('checkSession', () => {
  const user = (result: unknown) => fakeClient({ getUser: vi.fn().mockResolvedValue(result) });

  it('says valid when the server knows the person', async () => {
    await expect(checkSession(user({ data: { user: { id: 'u1' } }, error: null }))).resolves.toBe(
      'valid',
    );
  });

  it.each([
    [403, 'user_not_found'],
    [401, 'bad_jwt'],
    [404, 'user_not_found'],
    [400, 'refresh_token_not_found'],
  ])('says gone for a %s (%s) from the server', async (status, code) => {
    const error = { name: 'AuthApiError', message: 'x', status, code };
    await expect(checkSession(user({ data: { user: null }, error }))).resolves.toBe('gone');
  });

  it('says gone when there is no session to check', async () => {
    const error = { name: 'AuthSessionMissingError', message: 'x', status: 400 };
    await expect(checkSession(user({ data: { user: null }, error }))).resolves.toBe('gone');
  });

  it.each([
    [{ name: 'AuthRetryableFetchError', message: 'fetch failed', status: 0 }],
    [{ name: 'AuthApiError', message: 'boom', status: 500, code: 'unexpected_failure' }],
    [{ name: 'AuthApiError', message: 'slow down', status: 429, code: 'over_request_rate_limit' }],
  ])('says unknown, and so keeps the session, for %j', async (error) => {
    await expect(checkSession(user({ data: { user: null }, error }))).resolves.toBe('unknown');
  });

  it('says unknown when the call throws', async () => {
    const throws = fakeClient({
      getUser: vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    });
    await expect(checkSession(throws)).resolves.toBe('unknown');
  });
});
