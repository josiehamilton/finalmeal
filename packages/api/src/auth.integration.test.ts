import { describe, expect, it } from 'vitest';
import {
  checkSession,
  finishOnboarding,
  getMyProfile,
  sendEmailCode,
  signOut,
  verifyEmailCode,
} from './index';
import { newTestClient, randomSuffix } from './test-support/env';
import { readLatestCode } from './test-support/mailpit';

// Local Supabase allows one email per address every 30 s and 30 per hour, so each test sends
// at most one code to a fresh random address.

describe('email code sign-in (local Supabase)', () => {
  it('rejects a wrong code with invalid_code, then signs in with the real one', async () => {
    const client = newTestClient();
    const email = `  New.Person+${randomSuffix()}@Example.com `;
    const sentAt = Date.now() - 2000;
    await sendEmailCode(client, email);
    const code = await readLatestCode(email, sentAt);
    expect(code).toMatch(/^\d{6}$/);

    const wrong = code === '000000' ? '111111' : '000000';
    await expect(verifyEmailCode(client, email, wrong)).rejects.toMatchObject({
      name: 'ApiError',
      code: 'invalid_code',
    });
    expect((await client.auth.getSession()).data.session).toBeNull();

    await verifyEmailCode(client, email, code);
    expect((await client.auth.getSession()).data.session).not.toBeNull();

    expect(await checkSession(client)).toBe('valid');

    // Signed in but no profile yet.
    expect(await getMyProfile(client)).toBeNull();
    await expect(finishOnboarding(client)).rejects.toMatchObject({ code: 'profile_not_found' });

    await signOut(client);
    expect((await client.auth.getSession()).data.session).toBeNull();
    expect(await getMyProfile(client)).toBeNull();
  });

  it('refuses a second code to the same address inside 30 seconds with rate_limited', async () => {
    const client = newTestClient();
    const email = `rate_${randomSuffix()}@example.com`;
    await sendEmailCode(client, email);
    await expect(sendEmailCode(client, email)).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('lets the seeded Josie sign in with an email code (known-gaps check)', async () => {
    const client = newTestClient();
    const email = 'josiehamilton@example.com';
    const sentAt = Date.now() - 2000;
    await sendEmailCode(client, email);
    await verifyEmailCode(client, email, await readLatestCode(email, sentAt));

    const me = await getMyProfile(client);
    expect(me).not.toBeNull();
    expect(me?.username).toBe('josiehamilton');
    expect(me?.displayName).toBe('Josie Hamilton');
    expect(me?.onboarded).toBe(true);
    expect(me?.homeCity?.label).toBe('Vancouver, BC, Canada');
    // Seeded follows and picks: counts are real numbers from the active follows and picks.
    expect(me?.counts.followers).toBeGreaterThan(0);
    expect(me?.counts.following).toBeGreaterThan(0);
    expect(me?.counts.dishes).toBeGreaterThan(0);
    await signOut(client);
  });
});
