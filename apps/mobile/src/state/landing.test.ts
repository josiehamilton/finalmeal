import { act, renderHook } from '@testing-library/react-native';
import { clearJustOnboarded, markJustOnboarded, useJustOnboarded } from './landing';

describe('the First landing flag', () => {
  beforeEach(() => act(() => clearJustOnboarded()));

  it('is off until the loading screen marks it', async () => {
    const { result } = await renderHook(() => useJustOnboarded());
    expect(result.current).toBe(false);
    await act(async () => markJustOnboarded());
    expect(result.current).toBe(true);
  });

  it('turns off when cleared, and clearing twice is harmless', async () => {
    const { result } = await renderHook(() => useJustOnboarded());
    await act(async () => markJustOnboarded());
    await act(async () => clearJustOnboarded());
    expect(result.current).toBe(false);
    await act(async () => clearJustOnboarded());
    expect(result.current).toBe(false);
  });

  it('is shared by every screen that reads it', async () => {
    const a = await renderHook(() => useJustOnboarded());
    const b = await renderHook(() => useJustOnboarded());
    await act(async () => markJustOnboarded());
    expect(a.result.current).toBe(true);
    expect(b.result.current).toBe(true);
  });
});
