import type { FinalMealClient } from '../client';

export interface RpcCall {
  name: string;
  args: Record<string, unknown> | undefined;
  options: { get?: boolean } | undefined;
}

/**
 * A stand-in for the Supabase client for unit tests: `rpc` records each call and answers from
 * `answer`, Storage builds URLs like `https://files.test/<bucket>/<path>`, and `.retry` exists
 * because the wrappers call it on reads. Anything else the code touches throws.
 */
export function fakeClient(
  answer: (call: RpcCall) => { data?: unknown; error?: { message: string; code: string } | null },
) {
  const calls: RpcCall[] = [];
  const client = {
    rpc: (name: string, args?: Record<string, unknown>, options?: { get?: boolean }) => {
      const call = { name, args, options };
      calls.push(call);
      const reply = answer(call);
      const result = Promise.resolve({ data: reply.data ?? null, error: reply.error ?? null });
      return Object.assign(result, { retry: () => result });
    },
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://files.test/${bucket}/${path}` },
        }),
      }),
    },
  } as unknown as FinalMealClient;
  return { client, calls };
}
