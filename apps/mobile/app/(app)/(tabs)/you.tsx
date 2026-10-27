import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyMessage } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { EmptySeats } from '../../../src/components/EmptySeats';
import { Icon } from '../../../src/components/Icon';
import { ProfileHeader } from '../../../src/components/ProfileHeader';
import { fontFamily } from '../../../src/lib/fonts';
import { useSession } from '../../../src/providers/SessionProvider';

type ProfileTab = 'final' | 'honorable' | 'map';

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'final', label: 'Final Meal' },
  { key: 'honorable', label: 'Honorable' },
  { key: 'map', label: 'Map' },
];

export default function You() {
  const router = useRouter();
  const { profile, refreshProfile } = useSession();
  const [tab, setTab] = useState<ProfileTab>('final');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      await refreshProfile();
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setRefreshing(false);
    }
  }

  if (!profile) return <View style={styles.screen} />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.handle} accessibilityRole="header">{`@${profile.username}`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          hitSlop={4}
          style={styles.iconButton}
        >
          <Icon name="sliders" size={21} color={colors.bone} />
        </Pressable>
      </View>
      <ScrollView
        testID="you-scroll"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.smoke}
            colors={[colors.emberGlow]}
          />
        }
      >
        <ProfileHeader profile={profile} onEdit={() => router.push('/settings/edit-profile')} />
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <View accessibilityRole="tablist" style={styles.tabs}>
          {TABS.map(({ key, label }) => {
            const on = tab === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
                onPress={() => setTab(key)}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.panel}>
          {tab === 'final' ? (
            <>
              <EmptySeats />
              <Text style={styles.smoke}>Adding dishes arrives in the next build.</Text>
            </>
          ) : tab === 'honorable' ? (
            <Text style={styles.empty}>No honorable mentions yet.</Text>
          ) : (
            <Text style={styles.empty}>Your map fills in as you add dishes.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    paddingLeft: 20,
    paddingRight: 12,
  },
  handle: { flex: 1, fontFamily: fontFamily.uiBold, fontSize: 16, color: colors.bone },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 32 },
  error: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.danger,
  },
  tabs: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tab: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabOn: { borderBottomColor: colors.emberGlow },
  tabText: { fontFamily: fontFamily.uiBold, fontSize: 14, color: colors.dim },
  tabTextOn: { color: colors.bone },
  panel: { gap: 16, paddingHorizontal: 20, paddingTop: 20 },
  smoke: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke, textAlign: 'center' },
  empty: {
    paddingTop: 24,
    fontFamily: fontFamily.ui,
    fontSize: 15,
    color: colors.smoke,
    textAlign: 'center',
  },
});
