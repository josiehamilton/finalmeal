import { registerPushToken, unregisterPushToken } from '@finalmeal/api';
import type { FinalMealClient } from '@finalmeal/api';
import {
  isPushAvailable,
  registerForPushIfAvailable,
  resetPushForTests,
  unregisterPushOnSignOut,
} from './push';

const mockConstants: { expoConfig: { extra?: { eas?: { projectId?: string } } } | null } = {
  expoConfig: { extra: {} },
};
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockConstants.expoConfig;
    },
  },
}));

// Records whether anything required the module at all: importing it in Android Expo Go logs an
// error, so with no project id it must never be loaded.
let mockNotificationsLoaded = false;
const mockNotifications = {
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
};
jest.mock('expo-notifications', () => {
  mockNotificationsLoaded = true;
  return mockNotifications;
});
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  registerPushToken: jest.fn(),
  unregisterPushToken: jest.fn(),
}));
const mockRegister = jest.mocked(registerPushToken);
const mockUnregister = jest.mocked(unregisterPushToken);
const client = { fake: 'client' } as unknown as FinalMealClient;

describe('push registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    resetPushForTests();
    mockConstants.expoConfig = { extra: {} };
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    mockRegister.mockResolvedValue(undefined);
    mockUnregister.mockResolvedValue(undefined);
  });

  describe('without an EAS project id', () => {
    it('is not available, for any shape of config', () => {
      expect(isPushAvailable()).toBe(false);
      mockConstants.expoConfig = null;
      expect(isPushAvailable()).toBe(false);
      mockConstants.expoConfig = { extra: { eas: {} } };
      expect(isPushAvailable()).toBe(false);
      mockConstants.expoConfig = { extra: { eas: { projectId: '' } } };
      expect(isPushAvailable()).toBe(false);
    });

    it('resolves unavailable and never loads expo-notifications or asks for anything', async () => {
      await expect(registerForPushIfAvailable(client)).resolves.toBe('unavailable');
      expect(mockNotificationsLoaded).toBe(false);
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('unregistering on sign-out does nothing', async () => {
      await unregisterPushOnSignOut(client);
      expect(mockNotificationsLoaded).toBe(false);
      expect(mockUnregister).not.toHaveBeenCalled();
    });
  });

  describe('with an EAS project id', () => {
    beforeEach(() => {
      mockConstants.expoConfig = { extra: { eas: { projectId: 'proj-1' } } };
    });

    it('is available', () => {
      expect(isPushAvailable()).toBe(true);
    });

    it('asks permission, gets the token for the project and stores it', async () => {
      await expect(registerForPushIfAvailable(client)).resolves.toBe('registered');
      expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
        projectId: 'proj-1',
      });
      expect(mockRegister).toHaveBeenCalledWith(client, 'ExponentPushToken[abc]', 'ios');
    });

    it('does not ask again when permission is already granted', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
      await expect(registerForPushIfAvailable(client)).resolves.toBe('registered');
      expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('resolves denied, storing nothing, when permission is refused', async () => {
      mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
      await expect(registerForPushIfAvailable(client)).resolves.toBe('denied');
      expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('never throws: any failure resolves denied', async () => {
      mockNotifications.getExpoPushTokenAsync.mockRejectedValue(new Error('no network'));
      await expect(registerForPushIfAvailable(client)).resolves.toBe('denied');
      mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
      mockRegister.mockRejectedValue(new Error('rpc failed'));
      await expect(registerForPushIfAvailable(client)).resolves.toBe('denied');
    });

    it('forgets the last registered token on sign-out, once', async () => {
      await registerForPushIfAvailable(client);
      await unregisterPushOnSignOut(client);
      expect(mockUnregister).toHaveBeenCalledWith(client, 'ExponentPushToken[abc]');
      await unregisterPushOnSignOut(client);
      expect(mockUnregister).toHaveBeenCalledTimes(1);
    });

    it('does not unregister a token that was never stored', async () => {
      mockRegister.mockRejectedValue(new Error('rpc failed'));
      await registerForPushIfAvailable(client);
      await unregisterPushOnSignOut(client);
      expect(mockUnregister).not.toHaveBeenCalled();
    });

    it('sign-out never throws when unregistering fails', async () => {
      await registerForPushIfAvailable(client);
      mockUnregister.mockRejectedValue(new Error('offline'));
      await expect(unregisterPushOnSignOut(client)).resolves.toBeUndefined();
    });
  });
});
