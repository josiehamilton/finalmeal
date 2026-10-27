import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyMessage, signOut } from '@finalmeal/api';
import { colors, typeScale } from '@finalmeal/ui-tokens';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { SettingsRow } from '../../../src/components/SettingsRow';
import { fontFamily } from '../../../src/lib/fonts';
import { getSupabase } from '../../../src/lib/supabase';
import { useSession } from '../../../src/providers/SessionProvider';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const { profile } = useSession();
  const [error, setError] = useState<string | null>(null);
  const version = Constants.expoConfig?.version;

  async function logOut() {
    setError(null);
    try {
      // The sign-in gate sends a signed-out person to Welcome; nothing to navigate here.
      await signOut(getSupabase());
    } catch (e) {
      setError(friendlyMessage(e));
    }
  }

  function confirmLogOut() {
    Alert.alert('Log out of Final Meal?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logOut },
    ]);
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen} testID="settings-screen">
      <ScreenHeader title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="Account">
          <SettingsRow
            icon="edit"
            label="Edit profile"
            onPress={() => router.push('/settings/edit-profile')}
          />
          <SettingsRow icon="mail" label="Sign-in method" value="Email" />
        </Section>
        <Section title="Preferences">
          <SettingsRow
            icon="lock"
            label="Privacy & safety"
            onPress={() => router.push('/settings/privacy')}
          />
          <SettingsRow
            icon="pin"
            label="Home city"
            value={profile?.homeCity?.label ?? 'Not set'}
            onPress={() => router.push('/settings/home-city')}
          />
        </Section>
        <View>
          <SettingsRow icon="logout" label="Log out" danger onPress={confirmLogOut} />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </View>
        {version ? <Text style={styles.version}>{`Final Meal · version ${version}`}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  content: { gap: 22, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  section: { gap: 4 },
  sectionLabel: {
    fontFamily: fontFamily.uiBold,
    fontSize: typeScale.label.size,
    letterSpacing: typeScale.label.letterSpacingEm * typeScale.label.size,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  error: {
    paddingTop: 10,
    paddingHorizontal: 4,
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.danger,
  },
  version: { textAlign: 'center', fontFamily: fontFamily.ui, fontSize: 12, color: colors.dim },
});
