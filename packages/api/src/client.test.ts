import { createServer } from 'node:net';
import type { AddressInfo, Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, createFinalMealClient, getFoundationStats } from './index';

let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

/** A host that accepts connections but never answers, like a black-holed or half-dead backend. */
async function listenAndNeverRespond(): Promise<string> {
  const sockets = new Set<import('node:net').Socket>();
  server = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
  });
  const s = server;
  s.on('close', () => sockets.forEach((socket) => socket.destroy()));
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
});
