import { act, renderHook } from '@testing-library/react-native';
import { ApiError, saveDish, unsaveDish } from '@finalmeal/api';
import {
  announceSavesChanged,
  getSavesVersion,
  clearSaveStates,
  setSavedState,
  useSave,
  useSavesVersion,
} from './save';

jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  saveDish: jest.fn(),
  unsaveDish: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));

const CLIENT = { fake: 'client' };
const mockSave = jest.mocked(saveDish);
const mockUnsave = jest.mocked(unsaveDish);

describe('saves version', () => {
  beforeEach(() => clearSaveStates());

  it('counts up on every announcement', async () => {
    const { result } = await renderHook(() => useSavesVersion());
    expect(result.current).toBe(0);
    await act(async () => announceSavesChanged());
    expect(result.current).toBe(1);
    expect(getSavesVersion()).toBe(1);
  });
});

describe('useSave', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSaveStates();
    mockSave.mockResolvedValue(undefined);
    mockUnsave.mockResolvedValue(undefined);
  });

  it('saves through the pick it was found on, and tells Saved to reload', async () => {
    const { result } = await renderHook(() => useSave('d1', 'pk1', false));
    expect(result.current.saved).toBe(false);
    await act(async () => result.current.toggle());
    expect(mockSave).toHaveBeenCalledWith(CLIENT, 'd1', 'pk1');
    expect(result.current.saved).toBe(true);
    expect(getSavesVersion()).toBe(1);
  });

  it('unsaves a saved dish', async () => {
    const { result } = await renderHook(() => useSave('d1', 'pk1', true));
    await act(async () => result.current.toggle());
    expect(mockUnsave).toHaveBeenCalledWith(CLIENT, 'd1');
    expect(result.current.saved).toBe(false);
    expect(getSavesVersion()).toBe(1);
  });

  it('flips at once and keeps one call in flight', async () => {
    let finish: () => void = () => {};
    mockSave.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const { result } = await renderHook(() => useSave('d1', 'pk1', false));
    await act(async () => {
      void result.current.toggle();
      void result.current.toggle();
    });
    expect(result.current.saved).toBe(true);
    expect(result.current.busy).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockUnsave).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(result.current.busy).toBe(false);
    expect(result.current.saved).toBe(true);
  });

  it('puts the old state back, with friendly copy, when the call fails', async () => {
    mockSave.mockRejectedValue(new ApiError('gone', 'dish_not_found'));
    const { result } = await renderHook(() => useSave('d1', 'pk1', false));
    await act(async () => result.current.toggle());
    expect(result.current.saved).toBe(false);
    expect(result.current.error).toBe('That dish isn’t there any more.');
    expect(getSavesVersion()).toBe(0);
    // The next try clears the message.
    mockSave.mockResolvedValue(undefined);
    await act(async () => result.current.toggle());
    expect(result.current.error).toBeNull();
    expect(result.current.saved).toBe(true);
  });

  it('takes a fresh answer from the screen unless a call is in flight', async () => {
    const { result, rerender } = await renderHook(
      ({ initial }: { initial: boolean }) => useSave('d1', 'pk1', initial),
      { initialProps: { initial: false } },
    );
    await rerender({ initial: true });
    expect(result.current.saved).toBe(true);
  });

  it('shares the answer between every holder of the same dish, and a store entry beats a stale initial', async () => {
    const a = await renderHook(() => useSave('d1', 'pk1', false));
    const b = await renderHook(() => useSave('d1', 'pk2', false));
    await act(async () => a.result.current.toggle());
    expect(b.result.current.saved).toBe(true);
    // Another screen (the Saved tab) says it is gone.
    await act(async () => setSavedState('d1', false));
    expect(a.result.current.saved).toBe(false);
    expect(b.result.current.saved).toBe(false);
    // Re-mounted from a fetch made before the change: the session's answer still wins.
    const c = await renderHook(() => useSave('d1', 'pk1', true));
    expect(c.result.current.saved).toBe(false);
  });

  it('lets only one holder of a dish have a call in flight', async () => {
    let finish: () => void = () => {};
    mockSave.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const a = await renderHook(() => useSave('d1', 'pk1', false));
    const b = await renderHook(() => useSave('d1', 'pk2', false));
    await act(async () => {
      void a.result.current.toggle();
      void b.result.current.toggle();
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockUnsave).not.toHaveBeenCalled();
    await act(async () => finish());
  });
});
