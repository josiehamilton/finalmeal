import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PersonRow as PersonRowData } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { useFollow } from '../state/follow';
import { Avatar } from './Avatar';
import { FollowButton } from './FollowButton';

interface PersonRowProps {
  person: PersonRowData;
  /** The line under the name; the @handle when not given. */
  subtitle?: string;
  onOpen: (id: string) => void;
}

/** A person in a list: avatar, name, @handle (or a subtitle) and a Follow button. Tapping the row opens them. */
export function PersonRow({ person, subtitle, onOpen }: PersonRowProps) {
  const follow = useFollow(person);
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${person.displayName}, @${person.username}`}
          onPress={() => onOpen(person.id)}
          style={styles.open}
        >
          <Avatar
            uri={person.avatarUrl}
            name={person.displayName}
            size={44}
            accessibilityLabel={`${person.displayName}’s photo`}
          />
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>
              {person.displayName}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {subtitle ?? `@${person.username}`}
            </Text>
          </View>
        </Pressable>
        <FollowButton
          size="row"
          state={follow.state}
          followsViewer={person.followsViewer}
          busy={follow.busy}
          isMe={person.isMe}
          onPress={() => void follow.toggle()}
        />
      </View>
      {follow.error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {follow.error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  main: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.bone },
  sub: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
});
