import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'CivicLens', slug: 'civiclens', owner: 'tesserix-org', version: '0.1.0', scheme: 'civiclens',
  orientation: 'portrait', userInterfaceStyle: 'light', icon: './assets/icon.png',
  ios: { bundleIdentifier: 'app.tesserix.civiclens', supportsTablet: true, buildNumber: '1',
    infoPlist: { ITSAppUsesNonExemptEncryption: false, NSLocationWhenInUseUsageDescription: 'CivicLens uses your location to suggest the place and responsible office for your report.' } },
  android: { package: 'app.tesserix.civiclens', versionCode: 1, allowBackup: false,
    permissions: ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.CAMERA'] },
  plugins: ['expo-router', 'expo-secure-store', 'expo-web-browser', ['expo-image-picker', {
    photosPermission: 'Choose a photo of the civic issue you want to report.', cameraPermission: 'Take a photo for your civic report.', microphonePermission: false,
  }], ['expo-location', { locationWhenInUsePermission: 'Attach your current location to a report when you choose.' }]],
  web: { bundler: 'metro', output: 'static', name: 'CivicLens', themeColor: '#163D32', favicon: './assets/favicon.png' },
  extra: { eas: { projectId: 'd439b0ec-4482-4f17-a134-fa0b0af57588' } },
};
export default config;
