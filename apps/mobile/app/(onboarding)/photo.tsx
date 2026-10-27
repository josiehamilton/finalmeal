import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { finishOnboarding, friendlyMessage, uploadMyAvatar } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { OnboardingScreen } from '../../src/components/OnboardingScreen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { prepareAvatar } from '../../src/lib/avatar';
import { fontFamily } from '../../src/lib/fonts';
import { pickPhoto } from '../../src/lib/pick-photo';
import type { PhotoSource } from '../../src/lib/pick-photo';
import { getSupabase } from '../../src/lib/supabase';

const DENIED = 'No problem. You can add a photo later from Edit profile.';

function CameraIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={1.75} />
    </Svg>
  );
}

function LibraryIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Rect x={3} y={3} width={18} height={18} rx={2} stroke={colors.bone} strokeWidth={1.75} />
      <Circle cx={8.5} cy={8.5} r={1.5} stroke={colors.bone} strokeWidth={1.75} />
      <Path
        d="m21 15-5-5L5 21"
        stroke={colors.bone}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Step 6. The last step; finishing it shows the loading screen. */
export default function PhotoStep() {
  const router = useRouter();
  const [uri, setUri] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The photo that is already uploaded, so a retry after a later failure does not upload it again.
  const uploaded = useRef<string | null>(null);

  async function pick(source: PhotoSource) {
    setNotice(null);
    setError(null);
    const result = await pickPhoto(source);
    if (result.status === 'picked') setUri(result.uri);
    else if (result.status === 'denied') setNotice(DENIED);
  }

  async function finish(withPhoto: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (withPhoto && uri && uploaded.current !== uri) {
        await uploadMyAvatar(getSupabase(), await prepareAvatar(uri));
        uploaded.current = uri;
      }
      await finishOnboarding(getSupabase());
      router.replace('/loading');
    } catch (e) {
      setError(friendlyMessage(e));
      setBusy(false);
    }
  }

  return (
    <OnboardingScreen
      step={6}
      title="Put a face to the plate."
      subtitle="Optional, but people follow faces."
      onBack={() => router.back()}
      onSkip={() => {
        if (!busy) void finish(false);
      }}
      cta={{ label: 'Continue', onPress: () => finish(true), busy }}
    >
      <View style={styles.body}>
        <View style={styles.avatar}>
          {uri ? (
            <Image
              source={{ uri }}
              accessibilityLabel="Your photo"
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <CameraIcon size={36} color={colors.smoke} />
          )}
        </View>
        <View style={styles.buttons}>
          <PrimaryButton
            label="Take a photo"
            variant="secondary"
            icon={<CameraIcon size={18} color={colors.bone} />}
            disabled={busy}
            onPress={() => pick('camera')}
          />
          <PrimaryButton
            label="Choose from library"
            variant="secondary"
            icon={<LibraryIcon />}
            disabled={busy}
            onPress={() => pick('library')}
          />
        </View>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: 24, paddingTop: 8 },
  avatar: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    backgroundColor: colors.ash,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: 148, height: 148 },
  buttons: { alignSelf: 'stretch', gap: 10 },
  notice: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.smoke,
    textAlign: 'center',
  },
  error: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
});
