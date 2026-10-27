import { Redirect, Stack } from 'expo-router';
import { colors } from '@finalmeal/ui-tokens';
import { useSession } from '../../src/providers/SessionProvider';

/**
 * The signed-in app (Task 8 turns this into the tab bar). If the session disappears while
 * someone is in here (sign-out, expiry), send them back to Welcome.
 */
export default function AppLayout() {
  const { session, loading } = useSession();
  if (!loading && !session) return <Redirect href="/welcome" />;
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }}
    />
  );
}
