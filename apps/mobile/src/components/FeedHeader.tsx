import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getUnreadCount, subscribeToMyNotifications } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { getSupabase } from '../lib/supabase';
import { useSession } from '../providers/SessionProvider';
import { Icon } from './Icon';
import { SkullMark } from './SkullMark';

/**
 * The top of the Feed tab (and of First landing): the skull and wordmark, Search (Find people,
 * until Phase 5 builds Search) and the Notifications bell, which shows a dot while anything is
 * unread. The count reloads when the screen regains focus and when a notification arrives.
 */
export function FeedHeader() {
  const router = useRouter();
  const { profile } = useSession();
  const userId = profile?.id;
  const [unread, setUnread] = useState(0);
  // Only the newest answer may set the count: an older, slower one must not overwrite it.
  const requestId = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const count = await getUnreadCount(getSupabase());
      if (mounted.current && id === requestId.current) setUnread(count);
    } catch {
      // The dot is a hint; without a count it is simply not shown.
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!userId) return;
    return subscribeToMyNotifications(getSupabase(), userId, () => void load());
  }, [userId, load]);

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <SkullMark size={22} color={colors.ember} />
        <Text style={styles.wordmark} accessibilityRole="header">
          Final Meal
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search"
        onPress={() => router.push('/people')}
        style={styles.round}
      >
        <Icon name="search" size={21} color={colors.bone} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        accessibilityValue={unread > 0 ? { text: 'New activity' } : undefined}
        onPress={() => router.push('/notifications')}
        style={styles.round}
      >
        <Icon name="bell" size={21} color={colors.bone} />
        {unread > 0 ? <View testID="unread-dot" style={styles.dot} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 60,
    paddingHorizontal: 16,
  },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: {
    fontFamily: fontFamily.wordmark,
    fontSize: 28,
    letterSpacing: -0.01 * 28,
    color: colors.bone,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.emberGlow,
  },
});
