import type { FinalMealClient } from './client';
import { throwIfError } from './errors';

/** Stores this device's Expo push token for the signed-in person. Repeating it, or moving it to another account, is fine. */
export async function registerPushToken(
  client: FinalMealClient,
  token: string,
  platform: 'ios' | 'android',
): Promise<void> {
  const { error } = await client.rpc('register_push_token', {
    p_token: token,
    p_platform: platform,
  });
  throwIfError(error);
}

/** Forgets this device's token (on sign-out). */
export async function unregisterPushToken(client: FinalMealClient, token: string): Promise<void> {
  const { error } = await client.rpc('unregister_push_token', { p_token: token });
  throwIfError(error);
}
