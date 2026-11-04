import { describe, expect, it } from 'vitest';
import { ApiError, throwIfError } from './errors';

describe('throwIfError', () => {
  it('does nothing without an error', () => {
    expect(() => throwIfError(null)).not.toThrow();
  });

  it('keeps the backend code', () => {
    expect(() => throwIfError({ message: 'denied', code: '42501' })).toThrow(
      expect.objectContaining({ name: 'ApiError', code: '42501' }),
    );
  });

  it.each(['TimeoutError: The operation was aborted due to timeout', 'AbortError: aborted'])(
    'maps "%s" to code timeout',
    (message) => {
      expect(() => throwIfError({ message, code: '' })).toThrow(
        expect.objectContaining({ code: 'timeout' }),
      );
      expect(() => throwIfError({ message, code: '' })).toThrow(ApiError);
    },
  );

  it.each([
    'TypeError: fetch failed',
    'TypeError: Failed to fetch',
    'TypeError: Network request failed',
    'fetch failed',
  ])('maps the fetch failure "%s" to code network', (message) => {
    expect(() => throwIfError({ message, code: '' })).toThrow(
      expect.objectContaining({ name: 'ApiError', code: 'network' }),
    );
  });

  it('maps an auth-js retryable fetch error to network', () => {
    expect(() =>
      throwIfError({ name: 'AuthRetryableFetchError', message: 'oops', status: 0 }),
    ).toThrow(expect.objectContaining({ code: 'network' }));
  });

  it.each(['The request timed out after 15000 ms', 'The operation was aborted due to timeout'])(
    'maps an auth-js retryable fetch error saying "%s" to timeout',
    (message) => {
      expect(() => throwIfError({ name: 'AuthRetryableFetchError', message, status: 0 })).toThrow(
        expect.objectContaining({ code: 'timeout' }),
      );
    },
  );

  it('keeps an empty code for other unnamed failures', () => {
    expect(() => throwIfError({ message: 'something odd', code: '' })).toThrow(
      expect.objectContaining({ code: '' }),
    );
  });

  it('keeps the message and tolerates a missing code', () => {
    expect(() => throwIfError({ message: 'boom' })).toThrow(
      expect.objectContaining({ message: 'boom', code: '' }),
    );
  });

  it.each([
    [{ code: 'otp_expired', status: 403 }, 'code_expired'],
    [{ code: 'invalid_credentials', status: 400 }, 'invalid_code'],
    [{ code: 'otp_disabled', status: 400 }, 'invalid_code'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 'rate_limited'],
    [{ code: 'over_request_rate_limit', status: 429 }, 'rate_limited'],
    [{ code: undefined, status: 429 }, 'rate_limited'],
    [{ code: 'validation_failed', status: 400 }, 'validation_failed'],
  ])('maps the auth error %j to %s', (fields, expected) => {
    expect(() => throwIfError({ message: 'auth says no', ...fields })).toThrow(
      expect.objectContaining({ code: expected }),
    );
  });

  it.each([
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
  ])('maps the P0001 message %s to the same-named code', (message) => {
    expect(() => throwIfError({ message, code: 'P0001' })).toThrow(
      expect.objectContaining({ code: message }),
    );
  });

  it('keeps P0001 for any other message', () => {
    expect(() => throwIfError({ message: 'something else', code: 'P0001' })).toThrow(
      expect.objectContaining({ code: 'P0001' }),
    );
  });

  it('does not treat a domain message as a code unless the code is P0001', () => {
    expect(() => throwIfError({ message: 'username_taken', code: '42501' })).toThrow(
      expect.objectContaining({ code: '42501' }),
    );
  });

  describe('duplicate_pick detail', () => {
    const duplicate = (details: string | null | undefined) => {
      try {
        throwIfError({ message: 'duplicate_pick', code: 'P0001', details });
      } catch (e) {
        return e as ApiError;
      }
      throw new Error('expected a throw');
    };

    it('parses the existing pick from the PostgREST details', () => {
      const error = duplicate(
        '{"pick_id" : "0b1c2d3e-0000-4000-8000-000000000001", "tier" : "final"}',
      );
      expect(error.code).toBe('duplicate_pick');
      expect(error.existingPick).toEqual({
        id: '0b1c2d3e-0000-4000-8000-000000000001',
        tier: 'final',
      });
    });

    it.each([
      ['nothing', undefined],
      ['null', null],
      ['an empty string', ''],
      ['garbage', 'not json at all'],
      ['a JSON string', '"final"'],
      ['JSON null', 'null'],
      ['a missing id', '{"tier":"final"}'],
      ['an unknown tier', '{"pick_id":"abc","tier":"gold"}'],
      ['a non-string id', '{"pick_id":7,"tier":"final"}'],
    ])('gives null for %s', (_label, details) => {
      expect(duplicate(details).existingPick).toBeNull();
    });

    it('is null for every other error, even with details', () => {
      try {
        throwIfError({
          message: 'pick_not_found',
          code: 'P0001',
          details: '{"pick_id":"abc","tier":"final"}',
        });
      } catch (e) {
        expect((e as ApiError).existingPick).toBeNull();
        return;
      }
      throw new Error('expected a throw');
    });

    it('defaults to null when an ApiError is built by hand', () => {
      expect(new ApiError('x', 'y').existingPick).toBeNull();
    });
  });
});
