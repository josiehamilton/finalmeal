import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { followUser, friendlyMessage, unfollowUser } from '@finalmeal/api';
import type { FollowState } from '@finalmeal/api';
import { getSupabase } from '../lib/supabase';

/** Who a Follow button is for, and how the signed-in person follows them now. */
export interface FollowTarget {
  id: string;
  username: string;
  viewerFollow: FollowState;
  followsViewer: boolean;
  /** Known on a profile, not in a list. A private account answers a follow with a request. */
  visibility?: 'public' | 'private';
}

export interface FollowControl {
  state: FollowState;
  /** A call is in flight; taps are ignored until it ends. */
  busy: boolean;
  /** Friendly copy for the last failure, cleared by the next try. */
  error: string | null;
  /** Follow, ask, cancel a request, or (after confirming) unfollow. Never rejects. */
  toggle: () => Promise<void>;
}

/** Resolves true on Unfollow and false on Cancel (or when the alert is dismissed). */
function confirmUnfollow(username: string, isPrivate: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      `Unfollow @${username}?`,
      isPrivate ? 'You’ll need to request again to see their picks.' : undefined,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Unfollow', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * The follow state of one person, changed optimistically: the button moves at once, one call is in
 * flight at a time (extra taps are ignored), the state the server returns wins, and a failure puts
 * the old state back with friendly copy. Unfollowing someone you follow asks first.
 */
export function useFollow(person: FollowTarget): FollowControl {
  const [state, setState] = useState<FollowState>(person.viewerFollow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref as well as the state: two taps in one frame both see the same render's `busy`.
  const inFlight = useRef(false);

  // A fresh answer from the screen (a reload) replaces ours, unless a call is mid-flight.
  useEffect(() => {
    if (!inFlight.current) setState(person.viewerFollow);
  }, [person.viewerFollow]);

  const { id, username, visibility } = person;
  const toggle = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const before = state;
    try {
      if (before === 'active' && !(await confirmUnfollow(username, visibility === 'private'))) {
        return;
      }
      setBusy(true);
      setError(null);
      if (before === 'none') {
        setState(visibility === 'private' ? 'requested' : 'active');
        setState(await followUser(getSupabase(), id));
      } else {
        setState('none');
        await unfollowUser(getSupabase(), id);
      }
    } catch (e) {
      setState(before);
      setError(friendlyMessage(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [id, username, visibility, state]);

  return { state, busy, error, toggle };
}
