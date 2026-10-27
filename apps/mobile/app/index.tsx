import { Redirect } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { WelcomeScreen } from '../src/components/WelcomeScreen';
import { routeFor } from '../src/lib/route-for';
import { useSession } from '../src/providers/SessionProvider';

/**
 * The sign-in gate. It decides where to go once, on launch, and does not watch the profile
 * afterwards: the onboarding screens move forward themselves (see routeFor).
 */
export default function Index() {
  const { session, profile, loading, error, refreshProfile } = useSession();
  const [retrying, setRetrying] = useState(false);

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.night }} />;

  if (error) {
    return (
      <WelcomeScreen
        notice={error}
        retrying={retrying}
        onRetry={() => {
          setRetrying(true);
          void refreshProfile().finally(() => setRetrying(false));
        }}
      />
    );
  }

  const href = routeFor({ session: session !== null, profile, loading });
  return href ? <Redirect href={href} /> : null;
}
