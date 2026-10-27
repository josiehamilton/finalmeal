import { createServer } from 'node:net';
import type { AddressInfo, Server, Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, createFinalMealClient, getFoundationStats } from './index';

let server: Server | undefined;
const sockets = new Set<Socket>();

afterEach(() => {
  // Destroy open connections first so no socket outlives its test.
  sockets.forEach((socket) => socket.destroy());
  sockets.clear();
  server?.close();
  server = undefined;
});

/** A host that accepts connections but never answers, like a black-holed or half-dead backend. */
async function listenAndNeverRespond(): Promise<string> {
  server = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
  });
  const s = server;
  await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
}

describe('createFinalMealClient request timeout', () => {
  it('rejects a hanging request with an ApiError coded "timeout"', async () => {
    const url = await listenAndNeverRespond();
    const client = createFinalMealClient({ url, key: 'unused', timeoutMs: 300 });
    const started = Date.now();
    const attempt = getFoundationStats(client);
    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({ code: 'timeout' });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('does not retry a refused connection', async () => {
    const client = createFinalMealClient({ url: 'http://127.0.0.1:1', key: 'unused' });
    const started = Date.now();
    await expect(getFoundationStats(client)).rejects.toBeInstanceOf(ApiError);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('only bounds PostgREST reads: an /auth/v1/ request is not aborted at the read timeout', async () => {
    const url = await listenAndNeverRespond();
    const client = createFinalMealClient({ url, key: 'unused', timeoutMs: 200 });
    // Auth calls (for example signInWithOtp waiting on SMTP) can legitimately take longer.
    const request = client.auth.signInWithOtp({ email: 'someone@example.com' });
    const settledEarly = await Promise.race([
      request.then(
        () => true,
        () => true,
      ),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 800)),
    ]);
    // The test's own wait ended first, so the request was still pending well past 200 ms.
    expect(settledEarly).toBe(false);
  });

  it('does not bound a PostgREST write: a POST to /rest/v1/ is not aborted at the read timeout', async () => {
    const url = await listenAndNeverRespond();
    const client = createFinalMealClient({ url, key: 'unused', timeoutMs: 200 });
    // A timed-out write could still commit on the server, so it must be left to finish.
    const request = client
      .from('profiles')
      .insert({ id: '00000000-0000-0000-0000-000000000000', username: 'abc', display_name: 'Abc' });
    expect(await settlesWithin(request, 600)).toBe(false);
  });

  it('only looks at the URL path: /rest/v1/ in a query string does not bound a GET', async () => {
    const url = await listenAndNeverRespond();
    const client = createFinalMealClient({ url, key: 'unused', timeoutMs: 200 });
    const request = client.functions.invoke('x?next=/rest/v1/', { method: 'GET' });
    expect(await settlesWithin(request, 600)).toBe(false);
  });
});

/** True if the promise settles within `ms`; false if the wait ends first. */
async function settlesWithin(promise: PromiseLike<unknown>, ms: number): Promise<boolean> {
  return Promise.race([
    Promise.resolve(promise).then(
      () => true,
      () => true,
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);
}
