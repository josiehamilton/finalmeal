import { StyleSheet, Text, View } from 'react-native';
import type { MyProfile } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { PrimaryButton } from './PrimaryButton';

interface StatProps {
  n: number;
  label: string;
}

function Stat({ n, label }: StatProps) {
  return (
    <Text style={styles.stat}>
      <Text style={styles.statNumber}>{n}</Text>
      {` ${label}`}
    </Text>
  );
}

interface ProfileHeaderProps {
  profile: MyProfile;
  onEdit: () => void;
}

/** Avatar, name, home city, bio, follower stats and Edit profile. */
export function ProfileHeader({ profile, onEdit }: ProfileHeaderProps) {
  const { counts } = profile;
  const city = profile.showHomeCity ? profile.homeCity : null;
  return (
    <View style={styles.wrap}>
      <View style={styles.identity}>
        <Avatar uri={profile.avatarUrl} name={profile.displayName} size={80} />
        <View style={styles.text}>
          <Text style={styles.name} accessibilityRole="header">
            {profile.displayName}
          </Text>
          {city ? (
            <View style={styles.city} testID="home-city">
              <Icon name="pin" size={13} color={colors.smoke} />
              <Text style={styles.cityText}>{city.label}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      <View style={styles.stats}>
        <Stat n={counts.followers} label={counts.followers === 1 ? 'follower' : 'followers'} />
        <Stat n={counts.following} label="following" />
        <Stat n={counts.dishes} label={counts.dishes === 1 ? 'dish' : 'dishes'} />
      </View>
      <PrimaryButton label="Edit profile" variant="ghost" size="compact" onPress={onEdit} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  text: { flex: 1, gap: 4 },
  name: { fontFamily: fontFamily.serif, fontSize: 28, lineHeight: 28 * 1.1, color: colors.bone },
  city: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cityText: { flexShrink: 1, fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  bio: {
    fontFamily: fontFamily.serifItalic,
    fontSize: 16,
    lineHeight: 16 * 1.4,
    color: colors.honorable,
  },
  stats: { flexDirection: 'row', gap: 18 },
  stat: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  statNumber: { fontFamily: fontFamily.uiBold, color: colors.bone },
});
