import { Alert } from 'react-native';
import type { AlertButton } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { followUser, unfollowUser } from '@finalmeal/api';
import type { FollowState } from '@finalmeal/api';
import { useFollow } from './follow';
import { resetFollowStore, setFollowState, syncFollowStates } from './follow-store';
import type { FollowTarget } from './follow';

jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockFollow = jest.mocked(followUser);
const mockUnfollow = jest.mocked(unfollowUser);

function person(overrides: Partial<FollowTarget> = {}): FollowTarget {
  return {
    id: 'u4',
    username: 'allimercer',
    viewerFollow: 'none',
    followsViewer: false,
    visibility: 'public',
    ...overrides,
  };
}

/** A promise the test settles by hand, to look at the screen while a call is in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let alertSpy: jest.SpyInstance;

function alertCall() {
  const call = alertSpy.mock.calls[0];
  const buttons: AlertButton[] = call?.[2] ?? [];
  return { title: call?.[0], message: call?.[1], buttons };
}

describe('useFollow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    resetFollowStore();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockFollow.mockResolvedValue('active');
    mockUnfollow.mockResolvedValue(undefined);
  });

  it('shows Follow as active straight away, then keeps the state the server returns', async () => {
    const call = deferred<FollowState>();
    mockFollow.mockReturnValue(call.promise);
    const { result } = await renderHook(() => useFollow(person()));
    expect(result.current.state).toBe('none');
    let done!: Promise<void>;
    await act(async () => {
      done = result.current.toggle();
    });
    expect(result.current.state).toBe('active');
    expect(result.current.busy).toBe(true);
    await act(async () => {
      call.resolve('active');
      await done;
    });
    expect(mockFollow).toHaveBeenCalledWith({ fake: 'client' }, 'u4');
    expect(result.current.state).toBe('active');
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('asks a private account: Requested at once, and Requested after', async () => {
    const call = deferred<FollowState>();
    mockFollow.mockReturnValue(call.promise);
    const { result } = await renderHook(() => useFollow(person({ visibility: 'private' })));
    let done!: Promise<void>;
    await act(async () => {
      done = result.current.toggle();
    });
    expect(result.current.state).toBe('requested');
    await act(async () => {
      call.resolve('requested');
      await done;
    });
    expect(result.current.state).toBe('requested');
  });

  it('follows what the server says when it differs from the guess', async () => {
    mockFollow.mockResolvedValue('requested');
    const { result } = await renderHook(() => useFollow(person()));
    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.state).toBe('requested');
  });

  it('makes one call for a double tap', async () => {
    const call = deferred<FollowState>();
    mockFollow.mockReturnValue(call.promise);
    const { result } = await renderHook(() => useFollow(person()));
    let first!: Promise<void>;
    await act(async () => {
      first = result.current.toggle();
      void result.current.toggle();
      void result.current.toggle();
    });
    await act(async () => {
      call.resolve('active');
      await first;
    });
    expect(mockFollow).toHaveBeenCalledTimes(1);
    expect(mockUnfollow).not.toHaveBeenCalled();
    expect(result.current.state).toBe('active');
  });

  it('puts the button back and shows friendly copy when the call fails', async () => {
    mockFollow.mockRejectedValue(new Error('boom: internal detail'));
    const { result } = await renderHook(() => useFollow(person()));
    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.state).toBe('none');
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBe('Something went wrong. Try again.');
    // The next try clears the old message.
    mockFollow.mockResolvedValue('active');
    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.state).toBe('active');
  });

  it('cancels a pending request without asking first', async () => {
    const { result } = await renderHook(() => useFollow(person({ viewerFollow: 'requested' })));
    await act(async () => {
      await result.current.toggle();
    });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockUnfollow).toHaveBeenCalledWith({ fake: 'client' }, 'u4');
    expect(result.current.state).toBe('none');
  });

  it('asks before unfollowing and only calls the API on Unfollow', async () => {
    const { result } = await renderHook(() => useFollow(person({ viewerFollow: 'active' })));
    let done!: Promise<void>;
    await act(async () => {
      done = result.current.toggle();
    });
    const { title, message, buttons } = alertCall();
    expect(title).toBe('Unfollow @allimercer?');
    expect(message).toBeUndefined();
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Unfollow']);
    expect(buttons[1]?.style).toBe('destructive');
    expect(mockUnfollow).not.toHaveBeenCalled();
    expect(result.current.state).toBe('active');
    await act(async () => {
      buttons[1]?.onPress?.();
      await done;
    });
    expect(mockUnfollow).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('none');
  });

  it('says they will need to request again when the account is private', async () => {
    const { result } = await renderHook(() =>
      useFollow(person({ viewerFollow: 'active', visibility: 'private' })),
    );
    await act(async () => {
      void result.current.toggle();
    });
    expect(alertCall().message).toBe('You’ll need to request again to see their picks.');
  });

  it('does nothing when Cancel is chosen, and can be tried again', async () => {
    const { result } = await renderHook(() => useFollow(person({ viewerFollow: 'active' })));
    let done!: Promise<void>;
    await act(async () => {
      done = result.current.toggle();
    });
    await act(async () => {
      alertCall().buttons[0]?.onPress?.();
      await done;
    });
    expect(mockUnfollow).not.toHaveBeenCalled();
    expect(result.current.state).toBe('active');
    expect(result.current.busy).toBe(false);
    alertSpy.mockClear();
    await act(async () => {
      void result.current.toggle();
    });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('puts the state back when unfollowing fails', async () => {
    mockUnfollow.mockRejectedValue(new Error('nope'));
    const { result } = await renderHook(() => useFollow(person({ viewerFollow: 'active' })));
    let done!: Promise<void>;
    await act(async () => {
      done = result.current.toggle();
    });
    await act(async () => {
      alertCall().buttons[1]?.onPress?.();
      await done;
    });
    expect(result.current.state).toBe('active');
    expect(result.current.error).toBe('Something went wrong. Try again.');
  });

  it('takes a fresh state from its person once idle', async () => {
    const { result, rerender } = await renderHook((p: FollowTarget) => useFollow(p), {
      initialProps: person(),
    });
    await rerender(person({ viewerFollow: 'active' }));
    expect(result.current.state).toBe('active');
  });
  describe('shared between buttons', () => {
    it('keeps every button for a person in step', async () => {
      const first = await renderHook(() => useFollow(person()));
      const second = await renderHook(() => useFollow(person()));
      await act(async () => {
        await first.result.current.toggle();
      });
      expect(first.result.current.state).toBe('active');
      expect(second.result.current.state).toBe('active');
    });

    it('does not mix up two different people', async () => {
      const first = await renderHook(() => useFollow(person()));
      const other = await renderHook(() =>
        useFollow(person({ id: 'u9', username: 'someoneelse' })),
      );
      await act(async () => {
        await first.result.current.toggle();
      });
      expect(other.result.current.state).toBe('none');
    });

    it('shows what was done elsewhere in place of a stale state it was handed', async () => {
      setFollowState('u4', 'active');
      const { result } = await renderHook(() => useFollow(person({ viewerFollow: 'none' })));
      expect(result.current.state).toBe('active');
    });

    it('takes fresh server answers from syncFollowStates', async () => {
      setFollowState('u4', 'requested');
      const { result } = await renderHook(() => useFollow(person()));
      await act(async () => {
        syncFollowStates([{ id: 'u4', viewerFollow: 'active' }]);
      });
      expect(result.current.state).toBe('active');
    });

    it('ignores a tap on one button while another has a call in flight', async () => {
      const call = deferred<FollowState>();
      mockFollow.mockReturnValue(call.promise);
      const first = await renderHook(() => useFollow(person()));
      const second = await renderHook(() => useFollow(person()));
      let done!: Promise<void>;
      await act(async () => {
        done = first.result.current.toggle();
      });
      await act(async () => {
        await second.result.current.toggle();
      });
      expect(mockFollow).toHaveBeenCalledTimes(1);
      await act(async () => {
        call.resolve('active');
        await done;
      });
      expect(second.result.current.state).toBe('active');
    });

    it('puts every button back when the call fails', async () => {
      mockFollow.mockRejectedValue(new Error('boom'));
      const first = await renderHook(() => useFollow(person()));
      const second = await renderHook(() => useFollow(person()));
      await act(async () => {
        await first.result.current.toggle();
      });
      expect(first.result.current.state).toBe('none');
      expect(second.result.current.state).toBe('none');
    });
  });
});
