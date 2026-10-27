import { Platform } from 'react-native';
import { getSupabase, resolveSupabaseUrl } from './supabase';

describe('resolveSupabaseUrl', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rewrites 127.0.0.1 and localhost to the emulator host on Android', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    expect(resolveSupabaseUrl('http://127.0.0.1:54321')).toBe('http://10.0.2.2:54321');
    expect(resolveSupabaseUrl('http://localhost:54321')).toBe('http://10.0.2.2:54321');
    expect(resolveSupabaseUrl('https://localhost')).toBe('https://10.0.2.2');
  });

  it('leaves other hosts alone on Android', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    expect(resolveSupabaseUrl('https://abc.supabase.co')).toBe('https://abc.supabase.co');
    expect(resolveSupabaseUrl('http://192.168.1.20:54321')).toBe('http://192.168.1.20:54321');
    expect(resolveSupabaseUrl('http://localhost.example.com')).toBe('http://localhost.example.com');
  });

  it('leaves the URL untouched on iOS', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    expect(resolveSupabaseUrl('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321');
    expect(resolveSupabaseUrl('http://localhost:54321')).toBe('http://localhost:54321');
  });
});

describe('getSupabase', () => {
  it('throws a clear error when the env is missing, not at import', () => {
    const saved = { ...process.env };
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_KEY;
    try {
      expect(() => getSupabase()).toThrow('EXPO_PUBLIC_SUPABASE_URL');
    } finally {
      process.env = saved;
    }
  });
});
