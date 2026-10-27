import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, friendlyMessage, isUsernameAvailable } from '@finalmeal/api';
import { isValidUsername } from '@finalmeal/core';
import { getSupabase } from './supabase';

export const USERNAME_DEBOUNCE_MS = 400;

export type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'failed';

const copy = (code: 'username_taken' | 'invalid_username') =>
  friendlyMessage(new ApiError(code, code));

/**
 * Live "is this handle free?" for a username field: format check at once, then a server check
 * after a pause in typing. A slow answer for an older value never overwrites a newer one.
 * `enabled: false` (for example an unchanged handle) turns the check off and reports 'idle'.
 */
export function useUsernameAvailability(username: string, enabled = true) {
  const [status, setStatus] = useState<Availability>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    setMessage(null);
    if (!enabled || username === '') {
      setStatus('idle');
      return;
    }
    if (!isValidUsername(username)) {
      setStatus('invalid');
      return;
    }
    setStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const free = await isUsernameAvailable(getSupabase(), username);
        if (request === latest.current) setStatus(free ? 'available' : 'taken');
      } catch (e) {
        if (request !== latest.current) return;
        setStatus('failed');
        setMessage(friendlyMessage(e));
      }
    }, USERNAME_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [username, enabled]);

  /** The server said no when saving, even though the check said yes. */
  const reject = useCallback((verdict: 'taken' | 'invalid') => {
    latest.current++;
    setStatus(verdict);
  }, []);

  const error =
    status === 'taken'
      ? copy('username_taken')
      : status === 'invalid'
        ? copy('invalid_username')
        : message;

  return { status, error, setMessage, reject };
}
