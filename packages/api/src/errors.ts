/** An error from the backend. `code` is the Postgres or PostgREST error code (e.g. '42501'). */
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
  if (error) throw new ApiError(error.message, error.code);
}
