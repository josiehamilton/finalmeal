// Service-key check shared by the Edge Functions that only scheduled jobs and scripts may call
// (push-dispatch, geocode-places). No Deno APIs in this file, so it can be imported and tested
// anywhere.

/** Compares two strings in time that depends only on their length. */
function sameSecret(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < given.length; i++) {
    difference |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}

/**
 * True only when the request carries the service key itself (an exact match), not any token that
 * claims the service role, so a function stays safe even if the gateway's verify_jwt check is
 * ever switched off.
 */
export function isServiceRequest(request: Request, serviceKey: string | undefined): boolean {
  if (!serviceKey) return false;
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return token !== '' && sameSecret(token, serviceKey);
}
