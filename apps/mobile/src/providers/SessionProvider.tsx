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
import { friendlyMessage, getMyProfile } from '@finalmeal/api';
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
  /** Reloads the profile; resolves to it (null when there is none yet or loading failed). */
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
  const userIdRef = useRef<string | null>(null);
  const requestRef = useRef(0);

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
      return null;
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
  userIdRef.current = userId ?? null;

  useEffect(() => {
    if (userId === undefined) return;
    if (userId === null) {
      requestRef.current++;
      setResult(null);
      return;
    }
    void loadProfile(userId);
  }, [userId, loadProfile]);

  const refreshProfile = useCallback(async () => {
    const id = userIdRef.current;
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
