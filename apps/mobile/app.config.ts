import type { ExpoConfig } from 'expo/config';
// Expo's config loader runs in plain Node, which cannot resolve the tokens package's
// extensionless TypeScript re-exports, so import the colours file directly (it has no imports).
import { colors } from '../../packages/ui-tokens/src/colors.ts';

const CAMERA_USAGE = 'Final Meal uses your camera for your profile photo.';
const PHOTOS_USAGE = 'Final Meal uses your photos for your profile photo.';
const LOCATION_USAGE = 'Final Meal uses your location to find your home city.';

const config: ExpoConfig = {
  name: 'Final Meal',
  slug: 'finalmeal',
  version: '0.1.0',
  scheme: 'finalmeal',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: colors.night,
  icon: './assets/icon.png',
  ios: {
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: CAMERA_USAGE,
      NSPhotoLibraryUsageDescription: PHOTOS_USAGE,
      NSLocationWhenInUseUsageDescription: LOCATION_USAGE,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: colors.night,
    },
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        cameraPermission: CAMERA_USAGE,
        photosPermission: PHOTOS_USAGE,
        microphonePermission: false,
      },
    ],
    ['expo-location', { locationWhenInUsePermission: LOCATION_USAGE }],
    [
      'expo-splash-screen',
      {
        backgroundColor: colors.night,
        image: './assets/splash-icon.png',
        imageWidth: 120,
      },
    ],
  ],
};

export default config;
