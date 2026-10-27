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

  it('keeps an empty code for other fetch failures', () => {
    expect(() => throwIfError({ message: 'TypeError: fetch failed', code: '' })).toThrow(
      expect.objectContaining({ code: '' }),
    );
  });
});
