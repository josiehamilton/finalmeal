import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useSession } from '../providers/SessionProvider';

// Screens a signed-out person is expected to be on.
const SIGNED_OUT_SCREENS = ['welcome', 'email', 'code'];

/**
 * Renders nothing. When a session that existed disappears (sign-out, failed refresh, revoked
 * token), sends the person to Welcome wherever they are, unless they are already in the
 * sign-in screens. It reacts only to the session ending, never to profile changes, so it does
 * not skip any onboarding screen.
 */
export function SignedOutGuard() {
  const { session } = useSession();
  const router = useRouter();
  const segments = useSegments();
  const hadSession = useRef(false);
  const last = segments[segments.length - 1];

  useEffect(() => {
    const signedOutNow = hadSession.current && !session;
    hadSession.current = !!session;
    if (signedOutNow && !SIGNED_OUT_SCREENS.includes(last ?? '')) router.replace('/welcome');
  }, [session, last, router]);

  return null;
}
