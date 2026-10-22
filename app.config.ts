import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'CivicLens', slug: 'civiclens', owner: 'tesserix-org', version: '0.1.2', scheme: 'civiclens',
  orientation: 'portrait', userInterfaceStyle: 'light', icon: './assets/civiclens-icon.png',
  ios: { bundleIdentifier: 'app.tesserix.civiclens', appleTeamId: '2CRHRRYBPL', supportsTablet: true, buildNumber: '5',
    privacyManifests: { NSPrivacyTracking: false, NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: ['Name', 'EmailAddress', 'UserID', 'PreciseLocation', 'PhotosorVideos', 'OtherUserContent'].map(type => ({
        NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`, NSPrivacyCollectedDataTypeLinked: true,
        NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
      })),
    },
    infoPlist: { ITSAppUsesNonExemptEncryption: false, NSLocationWhenInUseUsageDescription: 'CivicLens uses your location to suggest the place and responsible office for your report.' } },
  android: { package: 'app.tesserix.civiclens', versionCode: 2, allowBackup: false,
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.ACTIVITY_RECOGNITION'],
    permissions: ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.CAMERA'] },
  plugins: ['expo-router', ['expo-secure-store', { faceIDPermission: false }], 'expo-web-browser', ['expo-image-picker', {
    photosPermission: 'Choose a photo of the civic issue you want to report.', cameraPermission: 'Take a photo for your civic report.', microphonePermission: false,
  }], ['expo-location', { locationWhenInUsePermission: 'Attach your current location to a report when you choose.', locationAlwaysPermission: false, locationAlwaysAndWhenInUsePermission: false, motionUsagePermission: false, isIosBackgroundLocationEnabled: false, isAndroidBackgroundLocationEnabled: false, isAndroidForegroundServiceEnabled: false, isAndroidMotionActivityEnabled: false }]],
  web: { bundler: 'metro', output: 'static', name: 'CivicLens', themeColor: '#3858F5', favicon: './assets/civiclens-icon.png' },
  extra: { eas: { projectId: 'd439b0ec-4482-4f17-a134-fa0b0af57588' } },
};
export default config;
