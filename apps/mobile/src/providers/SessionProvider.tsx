import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { checkSession, friendlyMessage, getMyProfile, signOut, throwIfError } from '@finalmeal/api';
import type { FinalMealClient, MyProfile } from '@finalmeal/api';
import { getSupabase } from '../lib/supabase';

export type Session = NonNullable<
  Awaited<ReturnType<FinalMealClient['auth']['getSession']>>['data']['session']
>;

export interface SessionState {
  session: Session | null;
  profile: MyProfile | null;
  /** True until we know whether there is a session and, if so, what its profile is. */
  loading: boolean;
  /** Friendly copy when the profile could not be loaded (or the app is misconfigured). */
  error: string | null;
  /**
   * Reloads the profile for whoever the client says is signed in. Resolves to the profile, or
   * null only when it is genuinely absent (signed out, or signed in with no profile row yet).
   * Rejects when the load fails (the friendly text is also in `error`), so callers must not
   * treat a failure as "no profile": use friendlyMessage(e) on the rejection.
   */
  refreshProfile(): Promise<MyProfile | null>;
}

interface ProfileResult {
  userId: string;
  profile: MyProfile | null;
  error: string | null;
}

const SessionContext = createContext<SessionState | null>(null);

interface SessionProviderProps {
  /** Tests pass a fake; the app uses the shared client. */
  client?: FinalMealClient;
  children: ReactNode;
}

export function SessionProvider({ client, children }: SessionProviderProps) {
  // undefined: not known yet. null: signed out.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const clientRef = useRef<FinalMealClient | null>(null);
  const requestRef = useRef(0);
  // The person whose stored sign-in the server has already vouched for (or could not be asked).
  const checkedRef = useRef<string | null>(null);

  /** Loads and stores the profile. On failure it stores the friendly error, then rethrows. */
  const loadProfile = useCallback(async (userId: string): Promise<MyProfile | null> => {
    const active = clientRef.current;
    if (!active) return null;
    const request = ++requestRef.current;
    try {
      const profile = await getMyProfile(active);
      if (request === requestRef.current) setResult({ userId, profile, error: null });
      return profile;
    } catch (e) {
      if (request === requestRef.current) {
        // Keep the last good profile for this person; only the error changes.
        setResult((prev) => ({
          userId,
          profile: prev?.userId === userId ? prev.profile : null,
          error: friendlyMessage(e),
        }));
      }
      throw e;
    }
  }, []);

  useEffect(() => {
    let active: FinalMealClient;
    try {
      active = client ?? getSupabase();
    } catch (e) {
      console.warn(e);
      setSetupError(friendlyMessage(e));
      setSession(null);
      return;
    }
    clientRef.current = active;
    const { data } = active.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [client]);

  const userId = session === undefined ? undefined : (session?.user.id ?? null);

  useEffect(() => {
    if (userId === undefined) return;
    if (userId === null) {
      requestRef.current++;
      setResult(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const active = clientRef.current;
      // A stored session says nothing about whether the account still exists (for example after
      // the backend was reset). Ask the server once; only a clear "gone" signs the person out,
      // a network failure keeps the session and the profile load below reports it.
      if (active && checkedRef.current !== userId) {
        const verdict = await checkSession(active);
        if (cancelled) return;
        checkedRef.current = userId;
        if (verdict === 'gone') {
          try {
            await signOut(active, 'local');
            return;
          } catch (e) {
            // Could not sign out; fall through so the person sees the profile error, not a blank.
            console.warn(e);
          }
        }
      }
      // A failure is already stored as `error` by loadProfile.
      loadProfile(userId).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loadProfile]);

  const refreshProfile = useCallback(async () => {
    const active = clientRef.current;
    if (!active) return null;
    // Ask the client, not React state: right after verifyOtp resolves, the auth event that
    // updates our state may not have been rendered yet.
    const { data, error } = await active.auth.getSession();
    throwIfError(error);
    const id = data.session?.user.id;
    return id ? loadProfile(id) : null;
  }, [loadProfile]);

  const value = useMemo<SessionState>(() => {
    const forUser = result && userId && result.userId === userId ? result : null;
    return {
      session: session ?? null,
      profile: forUser?.profile ?? null,
      loading: setupError ? false : session === undefined || (session !== null && !forUser),
      error: setupError ?? forUser?.error ?? null,
      refreshProfile,
    };
  }, [session, result, userId, setupError, refreshProfile]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>.');
  return value;
}
