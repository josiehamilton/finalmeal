import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyCode, friendlyMessage, updateMyProfile, uploadMyAvatar } from '@finalmeal/api';
import type { MyProfile, ProfilePatch } from '@finalmeal/api';
import { BIO_MAX, DISPLAY_NAME_MAX, isValidUsername } from '@finalmeal/core';
import { colors, typeScale } from '@finalmeal/ui-tokens';
import { Avatar } from '../../../src/components/Avatar';
import { AvailableBadge } from '../../../src/components/AvailableBadge';
import { Icon } from '../../../src/components/Icon';
import { KeyboardAvoider } from '../../../src/components/KeyboardAvoider';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { TextField } from '../../../src/components/TextField';
import { prepareAvatar } from '../../../src/lib/avatar';
import { fontFamily } from '../../../src/lib/fonts';
import { pickPhoto } from '../../../src/lib/pick-photo';
import type { PhotoSource } from '../../../src/lib/pick-photo';
import { getSupabase } from '../../../src/lib/supabase';
import { useUsernameAvailability } from '../../../src/lib/use-username-availability';
import { useSession } from '../../../src/providers/SessionProvider';

const PHOTO_DENIED = 'No problem. You can change your photo any time from here.';

export default function EditProfile() {
  const { profile } = useSession();
  // The form starts from the profile once; later profile changes (a new home city) must not
  // wipe what has been typed.
  return profile ? <EditProfileForm profile={profile} /> : <View style={styles.screen} />;
}

function EditProfileForm({ profile }: { profile: MyProfile }) {
  const router = useRouter();
  const { refreshProfile } = useSession();
  const [name, setName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The photo that is already uploaded, so a retry after a later failure does not upload it again.
  const uploaded = useRef<string | null>(null);

  // Keep the focused field in view: the keyboard shrinks the scroll area, so scroll to the field
  // when it gets focus and again whenever the area changes size (the keyboard arriving or leaving).
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const tops = useRef<Record<string, number>>({});
  const focused = useRef<string | null>(null);
  const track = (key: string) => ({
    onLayout: (e: LayoutChangeEvent) => {
      tops.current[key] = e.nativeEvent.layout.y;
    },
  });
  const revealFocused = () => {
    const top = focused.current === null ? undefined : tops.current[focused.current];
    if (top !== undefined) scroll.current?.scrollTo({ y: Math.max(0, top - 12), animated: true });
  };
  const onFocusField = (key: string) => () => {
    focused.current = key;
    revealFocused();
  };
  const onBlurField = (key: string) => () => {
    if (focused.current === key) focused.current = null;
  };

  const usernameChanged = username !== profile.username;
  const handle = useUsernameAvailability(username, usernameChanged);

  const trimmedName = name.trim();
  const trimmedBio = bio.trim();
  const changed = {
    displayName: trimmedName !== profile.displayName,
    username: usernameChanged,
    bio: trimmedBio !== (profile.bio ?? ''),
    photo: photoUri !== null && uploaded.current !== photoUri,
  };
  const dirty = Object.values(changed).some(Boolean);
  const valid =
    trimmedName.length >= 1 &&
    trimmedName.length <= DISPLAY_NAME_MAX &&
    bio.length <= BIO_MAX &&
    (!usernameChanged || (isValidUsername(username) && handle.status !== 'taken'));
  const canSave = dirty && valid && !busy;

  async function pick(source: PhotoSource) {
    setNotice(null);
    setError(null);
    const result = await pickPhoto(source);
    if (result.status === 'picked') setPhotoUri(result.uri);
    else if (result.status === 'denied') setNotice(PHOTO_DENIED);
  }

  function changePhoto() {
    Alert.alert('Change photo', undefined, [
      { text: 'Take a photo', onPress: () => pick('camera') },
      { text: 'Choose from library', onPress: () => pick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const client = getSupabase();
      if (photoUri && uploaded.current !== photoUri) {
        await uploadMyAvatar(client, await prepareAvatar(photoUri));
        uploaded.current = photoUri;
      }
      const patch: ProfilePatch = {};
      if (changed.displayName) patch.displayName = trimmedName;
      if (changed.username) patch.username = username;
      if (changed.bio) patch.bio = trimmedBio === '' ? null : trimmedBio;
      if (Object.keys(patch).length > 0) await updateMyProfile(client, patch);
      try {
        await refreshProfile();
      } catch {
        // The change is saved. Only the shared copy is stale; the You tab shows the reason and a retry.
      }
      router.back();
    } catch (e) {
      const code = friendlyCode(e);
      if (code === 'username_taken') handle.reject('taken');
      else if (code === 'invalid_username') handle.reject('invalid');
      else setError(friendlyMessage(e));
      setBusy(false);
    }
  }

  const saveAction = busy ? (
    <View style={styles.saveBox}>
      <ActivityIndicator testID="cta-busy" color={colors.emberGlow} />
    </View>
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Save"
      accessibilityState={{ disabled: !canSave }}
      disabled={!canSave}
      onPress={save}
      hitSlop={8}
      style={styles.saveBox}
    >
      <Text style={[styles.save, !canSave && styles.saveOff]}>Save</Text>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <KeyboardAvoider>
        <ScreenHeader title="Edit profile" onBack={() => router.back()} right={saveAction} />
        <ScrollView
          ref={scroll}
          testID="edit-profile-scroll"
          onLayout={revealFocused}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.photo}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change photo"
              onPress={changePhoto}
              disabled={busy}
              style={styles.photoButton}
            >
              <Avatar
                uri={photoUri ?? profile.avatarUrl}
                name={trimmedName || profile.displayName}
                size={96}
                accessibilityLabel={photoUri ? 'Your new photo' : 'Your photo'}
              />
              <View style={styles.camera}>
                <Icon name="camera" size={15} color={colors.bone} />
              </View>
            </Pressable>
            <Text style={styles.changePhoto} onPress={busy ? undefined : changePhoto}>
              Change photo
            </Text>
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          </View>

          <View {...track('name')}>
            <TextField
              label="Name"
              onFocus={onFocusField('name')}
              onBlur={onBlurField('name')}
              value={name}
              onChangeText={setName}
              maxLength={DISPLAY_NAME_MAX}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
          </View>
          <View {...track('username')}>
            <TextField
              label="Username"
              onFocus={onFocusField('username')}
              onBlur={onBlurField('username')}
              prefix="@"
              value={username}
              onChangeText={(text) => setUsername(text.replace(/^@+/, ''))}
              error={usernameChanged ? handle.error : null}
              suffix={
                usernameChanged && handle.status === 'available' ? <AvailableBadge /> : undefined
              }
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
            />
          </View>
          <View testID="edit-profile-lower" style={styles.lower} {...track('bio')}>
            <TextField
              label="Bio"
              onFocus={onFocusField('bio')}
              onBlur={onBlurField('bio')}
              value={bio}
              onChangeText={setBio}
              maxLength={BIO_MAX}
              counter={`${bio.length} / ${BIO_MAX}`}
              multiline
              autoCapitalize="sentences"
            />
            <View style={styles.cityField}>
              <Text style={styles.cityLabel}>Home city</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Home city, ${profile.homeCity?.label ?? 'Not set'}`}
                onPress={() => router.push('/settings/home-city')}
                style={styles.cityBox}
              >
                <Text
                  style={[styles.cityValue, !profile.homeCity && styles.cityEmpty]}
                  numberOfLines={1}
                >
                  {profile.homeCity?.label ?? 'Not set'}
                </Text>
                <Icon name="chev" size={18} color={colors.dim} />
              </Pressable>
            </View>
          </View>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  flex: { flex: 1 },
  content: { gap: 20, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  saveBox: {
    minWidth: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  save: { fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.emberGlow },
  saveOff: { opacity: 0.4 },
  photo: { alignItems: 'center', gap: 10 },
  photoButton: { position: 'relative' },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ashRaised,
    borderWidth: 2,
    borderColor: colors.night,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhoto: {
    fontFamily: fontFamily.uiBold,
    fontSize: 14,
    color: colors.emberGlow,
    paddingVertical: 8,
  },
  notice: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.smoke,
    textAlign: 'center',
  },
  lower: { gap: 20 },
  cityField: { gap: 8 },
  cityLabel: {
    fontFamily: fontFamily.uiBold,
    fontSize: typeScale.label.size,
    letterSpacing: typeScale.label.letterSpacingEm * typeScale.label.size,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  cityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  cityValue: { flex: 1, fontFamily: fontFamily.uiMedium, fontSize: 17, color: colors.bone },
  cityEmpty: { color: colors.dim },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
});
