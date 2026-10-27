/**
 * An error from the backend. `code` is the Postgres or PostgREST error code (e.g. '42501'),
 * or 'timeout' when the request timed out or was aborted.
 */
export class ApiError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/** Throws an `ApiError` when a Supabase response carries an error; does nothing otherwise. */
export function throwIfError(error: { message: string; code: string } | null): void {
  if (!error) return;
  // postgrest-js reports a timed-out or aborted fetch with an empty code and the DOMException name.
  const timedOut = error.code === '' && /^(TimeoutError|AbortError)\b/.test(error.message);
  throw new ApiError(error.message, timedOut ? 'timeout' : error.code);
}
