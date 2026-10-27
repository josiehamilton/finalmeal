import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { LargeSecureStore } from './secure-storage';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

describe('LargeSecureStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('round-trips a large value, keeping the key in secure storage and ciphertext in AsyncStorage', async () => {
    const store = new LargeSecureStore();
    const value = JSON.stringify({ token: 'x'.repeat(5000), emoji: '🍜 ramen' });
    await store.setItem('sb-auth-token', value);

    const stored = await AsyncStorage.getItem('sb-auth-token');
    expect(stored).not.toBeNull();
    expect(stored).not.toContain('ramen');
    expect(await SecureStore.getItemAsync('sb-auth-token')).toMatch(/^[0-9a-f]{64}$/);
    expect(await store.getItem('sb-auth-token')).toBe(value);
  });

  it('returns null for a missing key', async () => {
    expect(await new LargeSecureStore().getItem('nothing-here')).toBeNull();
  });

  it('returns null, rather than throwing, when the stored value cannot be decrypted', async () => {
    const store = new LargeSecureStore();
    await store.setItem('k', 'hello');
    await SecureStore.deleteItemAsync('k');
    expect(await store.getItem('k')).toBeNull();
  });

  it('removes both halves', async () => {
    const store = new LargeSecureStore();
    await store.setItem('k2', 'hello');
    await store.removeItem('k2');
    expect(await AsyncStorage.getItem('k2')).toBeNull();
    expect(await SecureStore.getItemAsync('k2')).toBeNull();
  });
});
