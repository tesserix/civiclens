import type { ExpoConfig } from 'expo/config';
import appLinks from './shared/app-links.json';
import socialApps from './shared/social-apps.json';
const linkHost=new URL(appLinks.publicOrigin).hostname;

const config: ExpoConfig = {
  name: 'CivicLens', slug: 'civiclens', owner: 'tesserix-org', version: '1.0.0', scheme: 'civiclens',
  runtimeVersion: '1.0.0-reporter-sharing-3', orientation: 'default', userInterfaceStyle: 'light', icon: './assets/civiclens-icon.png',
  ios: { icon: './assets/civiclens-icon.png', bundleIdentifier: appLinks.iosBundleId, appleTeamId: appLinks.appleTeamId, supportsTablet: true, buildNumber: '15',
    associatedDomains:[`applinks:${linkHost}`],
    privacyManifests: { NSPrivacyTracking: false, NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: ['Name', 'EmailAddress', 'UserID', 'PreciseLocation', 'PhotosorVideos', 'OtherUserContent', 'SensitiveInfo'].map(type => ({
        NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`, NSPrivacyCollectedDataTypeLinked: true,
        NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
      })),
    },
    infoPlist: { LSApplicationQueriesSchemes: Object.values(socialApps).filter(url=>!url.startsWith('https:')).map(url=>url.split(':')[0]), ITSAppUsesNonExemptEncryption: false, NSPhotoLibraryAddUsageDescription: 'Save your confirmed CivicLens photos so you can upload them to your chosen social apps, including TikTok.', NSLocationWhenInUseUsageDescription: 'CivicLens uses your location to suggest the place and responsible office for your report.' } },
  android: { icon: './assets/civiclens-icon.png', adaptiveIcon: { foregroundImage: './assets/civiclens-icon.png', backgroundColor: '#3858F5' }, package: appLinks.androidPackageName, versionCode: 6, allowBackup: false,
    intentFilters:[{action:'VIEW',autoVerify:true,data:[{scheme:'https',host:linkHost,pathPrefix:'/community/'}],category:['BROWSABLE','DEFAULT']}],
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.READ_MEDIA_VISUAL_USER_SELECTED', 'android.permission.READ_MEDIA_AUDIO', 'android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.ACTIVITY_RECOGNITION'],
    permissions: ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.CAMERA'] },
  plugins: ['expo-router', ['react-native-share', {android:['com.facebook.katana','com.whatsapp']}], ['expo-secure-store', { faceIDPermission: false }], 'expo-web-browser', ['expo-image-picker', {
    photosPermission: 'Choose a photo of the civic issue you want to report.', cameraPermission: 'Take a photo for your civic report.', microphonePermission: false,
  }], ['expo-location', { locationWhenInUsePermission: 'Attach your current location to a report when you choose.', locationAlwaysPermission: false, locationAlwaysAndWhenInUsePermission: false, motionUsagePermission: 'Motion information helps the location library improve the position attached to a civic report.', isIosBackgroundLocationEnabled: false, isAndroidBackgroundLocationEnabled: false, isAndroidForegroundServiceEnabled: false, isAndroidMotionActivityEnabled: false }]],
  web: { bundler: 'metro', output: 'static', name: 'CivicLens', themeColor: '#3858F5', favicon: './assets/civiclens-icon.png' },
  extra: { eas: { projectId: 'd439b0ec-4482-4f17-a134-fa0b0af57588' } },
};
export default config;
