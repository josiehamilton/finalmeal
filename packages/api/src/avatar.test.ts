import { describe, expect, it, vi } from 'vitest';
import { uploadMyAvatar } from './avatar';
import type { FinalMealClient } from './client';

/** A client that fails the test on any call, so a rejection that never touched the network is provable. */
function untouchedClient() {
  const touched = vi.fn();
  const client = new Proxy(
    {},
    {
      get: (_target, property) => {
        touched(String(property));
        throw new Error(`client.${String(property)} must not be used`);
      },
    },
  ) as unknown as FinalMealClient;
  return { client, touched };
}

function jpeg(length: number): ArrayBuffer {
  const bytes = new Uint8Array(length);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  return bytes.buffer;
}

describe('uploadMyAvatar validation', () => {
  it('rejects the 14-byte "File not found" body without any network call', async () => {
    const { client, touched } = untouchedClient();
    const body = new TextEncoder().encode('File not found').buffer as ArrayBuffer;
    expect(body.byteLength).toBe(14);
    await expect(uploadMyAvatar(client, body)).rejects.toMatchObject({
      name: 'ApiError',
      code: 'unknown',
    });
    expect(touched).not.toHaveBeenCalled();
  });

  it('rejects text that is long enough but is not a JPEG', async () => {
    const { client, touched } = untouchedClient();
    const body = new TextEncoder().encode('x'.repeat(500)).buffer as ArrayBuffer;
    await expect(uploadMyAvatar(client, body)).rejects.toMatchObject({ code: 'unknown' });
    expect(touched).not.toHaveBeenCalled();
  });

  it('rejects a JPEG that is under 100 bytes', async () => {
    const { client, touched } = untouchedClient();
    await expect(uploadMyAvatar(client, jpeg(99))).rejects.toMatchObject({ code: 'unknown' });
    expect(touched).not.toHaveBeenCalled();
  });

  it('rejects an empty buffer', async () => {
    const { client, touched } = untouchedClient();
    await expect(uploadMyAvatar(client, new ArrayBuffer(0))).rejects.toMatchObject({
      code: 'unknown',
    });
    expect(touched).not.toHaveBeenCalled();
  });

  it('lets a real JPEG through to the upload (the first backend call is the user lookup)', async () => {
    const { client, touched } = untouchedClient();
    await expect(uploadMyAvatar(client, jpeg(100))).rejects.toThrow('client.auth must not be used');
    expect(touched).toHaveBeenCalledWith('auth');
  });
});
