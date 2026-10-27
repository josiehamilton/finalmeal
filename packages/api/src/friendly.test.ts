import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { friendlyMessage } from './friendly';

const COPY: Array<[string, string]> = [
  ['invalid_email', 'That doesn’t look like an email address.'],
  ['invalid_code', 'That code didn’t work. Check it and try again.'],
  ['code_expired', 'That code has expired. Tap “Resend code” for a new one.'],
  ['rate_limited', 'Too many tries. Wait a minute and try again.'],
  ['username_taken', 'That handle’s taken. Try another.'],
  ['invalid_username', 'Letters, numbers and underscores, 3–30 characters.'],
  ['timeout', 'Can’t reach the kitchen right now.'],
  ['network', 'Can’t reach the kitchen right now.'],
  ['unknown', 'Something went wrong. Try again.'],
  ['profile_exists', 'Something went wrong. Try again.'],
  ['city_not_found', 'Something went wrong. Try again.'],
  ['profile_not_found', 'Something went wrong. Try again.'],
];

describe('friendlyMessage', () => {
  it.each(COPY)('gives %s its exact copy', (code, copy) => {
    expect(friendlyMessage(new ApiError('raw backend text', code))).toBe(copy);
  });

  it('falls back to the unknown copy for backend codes it does not know', () => {
    expect(friendlyMessage(new ApiError('permission denied', '42501'))).toBe(
      'Something went wrong. Try again.',
    );
    expect(friendlyMessage(new ApiError('no code', ''))).toBe('Something went wrong. Try again.');
  });

  it('treats a raw fetch TypeError as a network failure', () => {
    expect(friendlyMessage(new TypeError('fetch failed'))).toBe(
      'Can’t reach the kitchen right now.',
    );
  });

  it.each(['Network request failed', 'Failed to fetch', 'Load failed', 'fetch failed'])(
    'treats a fetch TypeError (%s) as a network failure',
    (message) => {
      expect(friendlyMessage(new TypeError(message))).toBe('Can’t reach the kitchen right now.');
    },
  );

  it('does not hide a programming TypeError as a network failure', () => {
    expect(friendlyMessage(new TypeError('undefined is not a function'))).toBe(
      'Something went wrong. Try again.',
    );
    expect(
      friendlyMessage(new TypeError("Cannot read properties of undefined (reading 'x')")),
    ).toBe('Something went wrong. Try again.');
  });

  it('treats a raw timeout as a timeout', () => {
    expect(friendlyMessage(new DOMException('timed out', 'TimeoutError'))).toBe(
      'Can’t reach the kitchen right now.',
    );
  });

  it.each([new Error('boom'), 'a string', null, undefined, 42])('never leaks %s', (thrown) => {
    expect(friendlyMessage(thrown)).toBe('Something went wrong. Try again.');
  });
});
