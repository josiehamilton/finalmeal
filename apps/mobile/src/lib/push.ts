import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken, unregisterPushToken } from '@finalmeal/api';
import type { FinalMealClient } from '@finalmeal/api';

/**
 * Push needs an Expo project (Phase 8 creates the accounts). Until `extra.eas.projectId` is in
 * the app config nothing asks for permission, nothing is registered, and `expo-notifications` is
 * never imported (importing it in Android Expo Go logs an error).
 */
function projectId(): string | undefined {
  const id: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

export function isPushAvailable(): boolean {
  return projectId() !== undefined;
}

/** The token stored for this device in this session, so sign-out can forget it. */
let registeredToken: string | null = null;

/**
 * Asks for permission (when push is available), gets this device's Expo push token and stores it
 * for the signed-in person. Never throws: any failure, including a refusal, resolves `'denied'`.
 */
export async function registerForPushIfAvailable(
  client: FinalMealClient,
): Promise<'unavailable' | 'denied' | 'registered'> {
  const id = projectId();
  if (!id) return 'unavailable';
  try {
    // Loaded only here, so nothing imports it while push is unavailable.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return 'denied';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await registerPushToken(client, token, Platform.OS === 'ios' ? 'ios' : 'android');
    registeredToken = token;
    return 'registered';
  } catch (e) {
    console.warn(e);
    return 'denied';
  }
}

/** How long sign-out waits for the server to forget the token before it goes ahead anyway. */
export const UNREGISTER_TIMEOUT_MS = 3000;

/**
 * Forgets this device's token before signing out (it needs the session, so call it first).
 * Never throws and never waits longer than `UNREGISTER_TIMEOUT_MS`, so a bad network cannot hold
 * Log out up. If it fails or times out the server keeps the token until Phase 8's cleanup of
 * tokens whose person has no live session (docs/known-gaps.md).
 * Sign-out is not observed in SessionProvider on purpose: by then the session is gone and the
 * call could no longer be made.
 */
export async function unregisterPushOnSignOut(client: FinalMealClient): Promise<void> {
  const token = registeredToken;
  if (!token) return;
  registeredToken = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      unregisterPushToken(client, token),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, UNREGISTER_TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    console.warn(e);
  } finally {
    clearTimeout(timer);
  }
}

/** For tests. */
export function resetPushForTests(): void {
  registeredToken = null;
}
