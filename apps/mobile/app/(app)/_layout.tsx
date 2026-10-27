import { Redirect, Stack } from 'expo-router';
import { colors } from '@finalmeal/ui-tokens';
import { useSession } from '../../src/providers/SessionProvider';

/**
 * The signed-in app: the tab bar (the (tabs) group) with the Settings screens pushed on top of
 * it, so the tab bar hides while you are in Settings. If the session disappears while someone is
 * in here (sign-out, expiry), send them back to Welcome.
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
