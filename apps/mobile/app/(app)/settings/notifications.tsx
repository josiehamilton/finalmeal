import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  friendlyMessage,
  getMyNotificationSettings,
  updateMyNotificationSettings,
} from '@finalmeal/api';
import type { NotificationSettings } from '@finalmeal/api';
import { colors, typeScale } from '@finalmeal/ui-tokens';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { ToggleRow } from '../../../src/components/ToggleRow';
import { fontFamily } from '../../../src/lib/fonts';
import { isPushAvailable } from '../../../src/lib/push';
import { getSupabase } from '../../../src/lib/supabase';

const ROWS: { key: keyof NotificationSettings; label: string; sub?: string }[] = [
  {
    key: 'dethroned',
    label: 'Dethronings',
    sub: 'When someone you follow swaps a dish out of their five.',
  },
  { key: 'newFollowers', label: 'New followers' },
  { key: 'saves', label: 'Saves of your picks' },
  { key: 'friendsFinals', label: 'Friends’ new Final Meals' },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A switch saves on its own and is locked until its save ends; the others stay usable.
  const [saving, setSaving] = useState<ReadonlySet<keyof NotificationSettings>>(new Set());
  // Keys with a save in flight, kept in a ref so two taps before a redraw cannot both pass.
  const inFlight = useRef(new Set<keyof NotificationSettings>());
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const loaded = await getMyNotificationSettings(getSupabase());
      if (mounted.current) setSettings(loaded);
    } catch (e) {
      if (mounted.current) setLoadError(friendlyMessage(e));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  async function change(key: keyof NotificationSettings, next: boolean) {
    if (!settings || inFlight.current.has(key)) return;
    inFlight.current.add(key);
    const before = settings[key];
    setError(null);
    setSettings((prev) => (prev ? { ...prev, [key]: next } : prev));
    setSaving((prev) => new Set(prev).add(key));
    try {
      const saved = await updateMyNotificationSettings(getSupabase(), { [key]: next });
      // Only this switch takes the server's answer; another one may be mid-save.
      if (mounted.current) setSettings((prev) => (prev ? { ...prev, [key]: saved[key] } : prev));
    } catch (e) {
      if (!mounted.current) return;
      setSettings((prev) => (prev ? { ...prev, [key]: before } : prev));
      setError(friendlyMessage(e));
    } finally {
      inFlight.current.delete(key);
      if (mounted.current) {
        setSaving((prev) => {
          const rest = new Set(prev);
          rest.delete(key);
          return rest;
        });
      }
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen} testID="notification-settings">
      <ScreenHeader title="Notifications" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Push</Text>
          {settings ? (
            ROWS.map((row) => (
              <ToggleRow
                key={row.key}
                label={row.label}
                sub={row.sub}
                value={settings[row.key]}
                disabled={saving.has(row.key)}
                onChange={(next) => void change(row.key, next)}
              />
            ))
          ) : loadError ? (
            <View style={styles.problemBox}>
              <Text style={styles.problem} accessibilityRole="alert">
                {loadError}
              </Text>
              <PrimaryButton label="Try again" onPress={() => void load()} />
            </View>
          ) : (
            <ActivityIndicator
              testID="settings-loading"
              color={colors.emberGlow}
              style={styles.spinner}
            />
          )}
        </View>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {!isPushAvailable() ? (
          <Text style={styles.note}>
            Push notifications start with the first test build. Your choices are saved for then.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  content: { gap: 16, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  section: { gap: 0 },
  sectionLabel: {
    fontFamily: fontFamily.uiBold,
    fontSize: typeScale.label.size,
    letterSpacing: typeScale.label.letterSpacingEm * typeScale.label.size,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  spinner: { paddingTop: 24 },
  problemBox: { gap: 16, paddingTop: 16 },
  problem: { fontFamily: fontFamily.uiMedium, fontSize: 15, color: colors.bone },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
  note: { fontFamily: fontFamily.ui, fontSize: 13, lineHeight: 13 * 1.4, color: colors.dim },
});
