import { LegalLinks } from '../../src/legal-links';
import { AccountDeletion } from '../../src/account-deletion';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useSession } from '../../src/session';
import { Button, Notice, Title, palette } from '../../src/ui';

const journey = [
  ['Capture the issue', 'Take a clear photo from a safe distance.'],
  ['Confirm the place', 'Location helps us find the responsible office.'],
  ['Review, then share', 'An authorised reviewer checks privacy and authority details before publishing.'],
];

export default function Profile() {
  const { session, signOut } = useSession(); const client = useQueryClient();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const logout = async () => { setBusy(true); setError(''); try { await signOut(); client.clear(); } catch { setError('Could not revoke this session. Reconnect and retry signing out.'); } finally { setBusy(false); } };
  const nickname = session?.user.nickname ?? '';
  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas"><ScrollView contentContainerStyle={{ padding: 20, gap: 28 }}>
    <Title>Your account</Title>
    <View className="flex-row items-center gap-4 rounded-2xl border border-line bg-surface p-4">
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="h-14 w-14 items-center justify-center rounded-full bg-ink">
        <Text className="text-2xl font-bold" style={{ color: palette.hivis }}>{nickname.charAt(0).toUpperCase()}</Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[13px] text-muted">Public nickname</Text>
        <Text selectable className="text-xl font-bold text-ink">{nickname}</Text>
        <Text className="text-[13px] leading-5 text-muted">Used in CivicLens captions. Your social app controls its sender identity.</Text>
      </View>
    </View>
    <View className="gap-3">
      <Text accessibilityRole="header" className="text-[17px] font-semibold text-ink">How a report travels</Text>
      {journey.map(([title, description], i) => <View key={title} className="flex-row gap-3">
        <View className="h-6 w-6 items-center justify-center rounded-full border border-ink"><Text className="text-xs font-bold text-ink">{i + 1}</Text></View>
        <View className="flex-1 gap-0.5"><Text className="text-[15px] font-semibold text-ink">{title}</Text><Text className="text-sm leading-5 text-muted">{description}</Text></View>
      </View>)}
    </View>
    <Notice>Your sign-in provider identifies your account privately. CivicLens captions use your nickname. Sharing through your own social apps may show your profile name, username or phone number. Photos, text and location may still identify you or someone else. Check them carefully.</Notice>
    <Text className="text-sm leading-5 text-muted">CivicLens is for constructive community reporting. Avoid identifying private people, unsupported allegations, faces, number plates and sensitive locations. This is not an emergency service.</Text>
    <View className="gap-3 rounded-2xl border border-line bg-surface p-4">
      <Text accessibilityRole="header" className="text-[17px] font-semibold text-ink">Your communities, your control</Text>
      <Text className="text-sm leading-5 text-muted">Create and manage your Facebook groups or Pages, WhatsApp groups or Channels and Instagram accounts in those apps. You control invites, members and community rules there.</Text>
      <Text className="text-sm leading-5 text-muted">Stay signed in here with Google, Facebook or Apple. Sharing a reviewed report through your phone needs no additional login in CivicLens. Always check the sending account and destination before you post.</Text>
    </View>
    <LegalLinks />
    {session ? <AccountDeletion token={session.token} /> : null}
    <View className="gap-3">
      {error ? <Notice>{error}</Notice> : null}
      <Button title="Sign out securely" variant="secondary" icon="log-out-outline" busy={busy} onPress={() => void logout()} />
      <Text className="text-center text-xs text-muted">CivicLens by Tesserix, version {Constants.expoConfig?.version}</Text>
    </View>
  </ScrollView></SafeAreaView>;
}
