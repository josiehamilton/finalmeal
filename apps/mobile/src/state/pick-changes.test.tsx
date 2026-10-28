import { act, renderHook } from '@testing-library/react-native';
import {
  announcePicksChanged,
  dismissPhotoNotice,
  resetPickChanges,
  usePhotoNotice,
  usePicksVersion,
} from './pick-changes';

describe('pick changes', () => {
  beforeEach(() => resetPickChanges());

  it('bumps the version on every announcement', async () => {
    const { result } = await renderHook(() => usePicksVersion());
    expect(result.current).toBe(0);
    await act(async () => announcePicksChanged());
    expect(result.current).toBe(1);
  });

  it('raises the photo notice only when the photo failed, until dismissed', async () => {
    const { result } = await renderHook(() => usePhotoNotice());
    expect(result.current).toBe(false);
    await act(async () => announcePicksChanged());
    expect(result.current).toBe(false);
    await act(async () => announcePicksChanged({ photoFailed: true }));
    expect(result.current).toBe(true);
    await act(async () => dismissPhotoNotice());
    expect(result.current).toBe(false);
  });
});
