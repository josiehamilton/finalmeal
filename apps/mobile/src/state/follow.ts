import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { followUser, friendlyMessage, unfollowUser } from '@finalmeal/api';
import type { FollowState } from '@finalmeal/api';
import { getSupabase } from '../lib/supabase';
import {
  announceFollowed,
  beginFollowCall,
  endFollowCall,
  hasFollowCall,
  setFollowState,
  useFollowState,
} from './follow-store';

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
 * The follow state of one person, kept in a store shared by every Follow button, and changed
 * optimistically: the button moves at once, one call per person is in flight at a time (extra
 * taps, from any button, are ignored), the state the server returns wins, and a failure puts the
 * old state back with friendly copy. Unfollowing someone you follow asks first.
 */
export function useFollow(person: FollowTarget): FollowControl {
  const { id, username, visibility, viewerFollow } = person;
  const state = useFollowState(id, viewerFollow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh answer from the screen (a reload) replaces the store's, unless a call is mid-flight.
  const seen = useRef(viewerFollow);
  useEffect(() => {
    if (seen.current === viewerFollow) return;
    seen.current = viewerFollow;
    if (!hasFollowCall(id)) setFollowState(id, viewerFollow);
  }, [id, viewerFollow]);

  const toggle = useCallback(async () => {
    if (!beginFollowCall(id)) return;
    const before = state;
    try {
      if (before === 'active' && !(await confirmUnfollow(username, visibility === 'private'))) {
        return;
      }
      setBusy(true);
      setError(null);
      if (before === 'none') {
        setFollowState(id, visibility === 'private' ? 'requested' : 'active');
        const result = await followUser(getSupabase(), id);
        setFollowState(id, result);
        if (result === 'active') announceFollowed();
      } else {
        setFollowState(id, 'none');
        await unfollowUser(getSupabase(), id);
      }
    } catch (e) {
      setFollowState(id, before);
      setError(friendlyMessage(e));
    } finally {
      endFollowCall(id);
      setBusy(false);
    }
  }, [id, username, visibility, state]);

  return { state, busy, error, toggle };
}
