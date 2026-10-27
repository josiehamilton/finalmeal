import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyMessage, signOut } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { fontFamily } from '../../src/lib/fonts';
import { getSupabase } from '../../src/lib/supabase';
import { useSession } from '../../src/providers/SessionProvider';

/** Placeholder so the gate has a target. Task 8 replaces it with the real You tab. */
export default function You() {
  const { profile } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setBusy(true);
    setError(null);
    try {
      await signOut(getSupabase());
    } catch (e) {
      setError(friendlyMessage(e));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>You</Text>
        {profile ? <Text style={styles.handle}>{`@${profile.username}`}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <View style={styles.actions}>
        <PrimaryButton label="Sign out" variant="ghost" busy={busy} onPress={handleSignOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontFamily: fontFamily.display, fontSize: 34, color: colors.bone },
  handle: { fontFamily: fontFamily.ui, fontSize: 15, color: colors.smoke },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 14, color: colors.danger },
  actions: { paddingHorizontal: 24, paddingBottom: 16 },
});
