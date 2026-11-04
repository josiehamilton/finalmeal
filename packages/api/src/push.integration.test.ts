import { beforeAll, describe, expect, it } from 'vitest';
import { createMyProfile } from './index';
import type { FinalMealClient } from './index';
import {
  apiUrl,
  newTestClient,
  randomSuffix,
  serviceRoleKey,
  signUpFreshUser,
} from './test-support/env';

// The generated database types do not know the Phase 4 functions yet, so call them loosely.
type Rpc = (
  name: string,
  args?: Record<string, unknown>,
) => Promise<{ error: { message: string } | null }>;
const rpc = (client: FinalMealClient): Rpc => (client.rpc as unknown as Rpc).bind(client);

interface DispatchReply {
  claimed: number;
  sent: number;
  failed: number;
  sender: string;
}

const SKIP_HINT =
  'The push-dispatch function is not being served. Restart the stack (pnpm db:stop && pnpm db:start) so it picks up supabase/functions, or run: pnpm exec supabase functions serve';

async function dispatch(token: string): Promise<Response> {
  return fetch(`${apiUrl()}/functions/v1/push-dispatch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
}

describe('push-dispatch (local Supabase)', () => {
  const alice = newTestClient();
  const bob = newTestClient();
  const suffix = randomSuffix();
  let bobId = '';

  beforeAll(async () => {
    await signUpFreshUser(alice);
    await signUpFreshUser(bob);
    await createMyProfile(alice, { displayName: 'Alice Push', username: `pa_${suffix}` });
    await createMyProfile(bob, { displayName: 'Bob Push', username: `pb_${suffix}` });
    bobId = (await bob.auth.getUser()).data.user?.id ?? '';
    expect(bobId).not.toBe('');
  });

  it('sends a queued push through the log sender, once', async () => {
    expect(
      (
        await rpc(bob)('register_push_token', {
          p_token: `ExponentPushToken[test-${suffix}]`,
          p_platform: 'ios',
        })
      ).error,
    ).toBeNull();
    expect((await rpc(alice)('follow_user', { p_user_id: bobId })).error).toBeNull();

    const first = await dispatch(serviceRoleKey());
    expect(first.status, SKIP_HINT).toBe(200);
    const firstBody = (await first.json()) as DispatchReply;
    expect(firstBody.sender).toBe('log');
    expect(firstBody.claimed).toBeGreaterThanOrEqual(1);
    expect(firstBody.sent).toBeGreaterThanOrEqual(1);
    expect(firstBody.failed).toBe(0);

    const second = await dispatch(serviceRoleKey());
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as DispatchReply;
    expect(secondBody.claimed).toBe(0);
  });

  it('refuses anyone but the service role', async () => {
    const session = (await bob.auth.getSession()).data.session;
    expect(session).not.toBeNull();
    const response = await dispatch(session?.access_token ?? '');
    expect(response.status, SKIP_HINT).toBe(401);
  });
});
