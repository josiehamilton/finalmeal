import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProfileView } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import type { FollowControl } from '../state/follow';
import { Avatar } from './Avatar';
import { FollowButton } from './FollowButton';
import { Icon } from './Icon';

interface StatProps {
  n: number;
  label: string;
  onPress?: () => void;
}

function Stat({ n, label, onPress }: StatProps) {
  const text = (
    <Text style={styles.stat}>
      <Text style={styles.statNumber}>{n}</Text>
      {` ${label}`}
    </Text>
  );
  if (!onPress) return text;
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      {text}
    </Pressable>
  );
}

interface OtherProfileHeaderProps {
  profile: ProfileView;
  follow: FollowControl;
  /** The follower count to show, which moves by one the moment you follow or unfollow. */
  followers: number;
  /** The stats open the lists; off while the account is private and not yet approved. */
  linkStats: boolean;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  /** Goes under the Follow button, such as the shared-taste line. */
  children?: ReactNode;
}

/** Someone else's avatar, name, city and bio, stats and Follow button (the OtherProfile board). */
export function OtherProfileHeader({
  profile,
  follow,
  followers,
  linkStats,
  onOpenFollowers,
  onOpenFollowing,
  children,
}: OtherProfileHeaderProps) {
  const { counts, homeCity, bio } = profile;
  return (
    <View style={styles.wrap}>
      <View style={styles.identity}>
        <Avatar
          uri={profile.avatarUrl}
          name={profile.displayName}
          size={64}
          accessibilityLabel={`${profile.displayName}’s photo`}
        />
        <View style={styles.text}>
          <Text style={styles.name} accessibilityRole="header">
            {profile.displayName}
          </Text>
          {homeCity || bio ? (
            <View style={styles.city} testID={homeCity ? 'home-city' : undefined}>
              {homeCity ? <Icon name="pin" size={13} color={colors.smoke} /> : null}
              <Text style={styles.cityText}>
                {homeCity}
                {homeCity && bio ? ' · ' : null}
                {bio ? <Text style={styles.bio}>{bio}</Text> : null}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.stats}>
        <Stat
          n={followers}
          label={followers === 1 ? 'follower' : 'followers'}
          onPress={linkStats ? onOpenFollowers : undefined}
        />
        <Stat
          n={counts.following}
          label="following"
          onPress={linkStats ? onOpenFollowing : undefined}
        />
        {counts.dishes === null ? null : (
          <Stat n={counts.dishes} label={counts.dishes === 1 ? 'dish' : 'dishes'} />
        )}
      </View>
      <FollowButton
        state={follow.state}
        followsViewer={profile.followsViewer}
        busy={follow.busy}
        isMe={profile.isMe}
        onPress={() => void follow.toggle()}
      />
      {follow.error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {follow.error}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  text: { flex: 1, gap: 3 },
  name: { fontFamily: fontFamily.serif, fontSize: 26, lineHeight: 26 * 1.1, color: colors.bone },
  city: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cityText: { flexShrink: 1, fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  bio: { color: colors.honorable },
  stats: { flexDirection: 'row', gap: 18 },
  stat: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  statNumber: { fontFamily: fontFamily.uiBold, color: colors.bone },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
});
