import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const config = JSON.parse(execFileSync(process.execPath, ['node_modules/expo/bin/cli', 'config', '--type', 'introspect', '--json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));

test('native permissions match foreground photo reporting', () => {
  const plist = config._internal.modResults.ios.infoPlist;
  for (const key of ['NSLocationAlwaysUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription', 'NSMotionUsageDescription', 'NSFaceIDUsageDescription', 'NSMicrophoneUsageDescription']) {
    assert.equal(plist[key], undefined, `unneeded permission ${key}`);
  }
  assert.match(plist.NSCameraUsageDescription, /report/);
  assert.match(plist.NSLocationWhenInUseUsageDescription, /choose/);
  const manifest = config._internal.modResults.android.manifest.manifest;
  const permissions = (manifest['uses-permission'] || []).filter(p => p.$['tools:node'] !== 'remove').map(p => p.$['android:name']);
  for (const name of ['RECORD_AUDIO', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'ACCESS_BACKGROUND_LOCATION', 'ACTIVITY_RECOGNITION']) {
    assert.ok(!permissions.includes(`android.permission.${name}`), `unneeded Android permission ${name}`);
  }
});

test('app privacy manifest declares account-linked reporting data without tracking', () => {
  const privacy = config.ios.privacyManifests;
  assert.equal(privacy?.NSPrivacyTracking, false);
  const data = privacy.NSPrivacyCollectedDataTypes;
  for (const type of ['Name', 'EmailAddress', 'UserID', 'PreciseLocation', 'PhotosorVideos', 'OtherUserContent']) {
    const entry = data.find(d => d.NSPrivacyCollectedDataType === `NSPrivacyCollectedDataType${type}`);
    assert.ok(entry, `missing disclosure ${type}`);
    assert.equal(entry.NSPrivacyCollectedDataTypeLinked, true);
    assert.equal(entry.NSPrivacyCollectedDataTypeTracking, false);
    assert.deepEqual(entry.NSPrivacyCollectedDataTypePurposes, ['NSPrivacyCollectedDataTypePurposeAppFunctionality']);
  }
});
