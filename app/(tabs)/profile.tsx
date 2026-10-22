import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../src/session';
import { Button, Notice } from '../../src/ui';

export default function Profile() {
  const { session, signOut } = useSession(); const client = useQueryClient();
  const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  const logout = async () => { setBusy(true); setError(''); try { await signOut(); client.clear(); } catch { setError('Could not revoke this session. Reconnect and retry signing out.'); } finally { setBusy(false); } };
  return <SafeAreaView edges={['top','left','right']} className="flex-1 bg-canvas"><ScrollView contentContainerStyle={{ padding:24,gap:24 }}>
    <Text className="text-xs font-semibold tracking-[3px] text-muted">PRIVATE ACCOUNT · PUBLIC VOICE</Text>
    <Text className="text-[34px] font-bold tracking-tight text-ink">Your space</Text>
    <View className="items-center gap-4 rounded-[28px] border border-line bg-white p-8"><View className="h-24 w-24 items-center justify-center rounded-full bg-tint"><Ionicons name="person-outline" size={42} color="#3858F5" /></View><Text className="text-xs uppercase tracking-widest text-muted">Your public nickname</Text><Text selectable className="text-2xl font-bold text-ink">{session?.user.nickname}</Text><Text className="text-center text-sm leading-6 text-muted">This is how your community sees you.</Text></View>
    <View className="gap-4 rounded-2xl border border-line bg-white p-6"><Text className="text-xl font-semibold text-ink">Simple actions. Thoughtful sharing.</Text>{[
      ['camera-outline','Capture the issue','Take a clear photo from a safe distance.'],
      ['location-outline','Confirm the place','Location helps us find the responsible office.'],
      ['shield-checkmark-outline','Review, then share','An authorised reviewer checks privacy and authority details before publishing.'],
    ].map(([icon,title,description]) => <View key={title} className="flex-row gap-3"><Ionicons name={icon as 'camera-outline'} size={23} color="#3858F5" /><View className="flex-1 gap-1"><Text className="font-semibold text-ink">{title}</Text><Text className="text-sm leading-6 text-muted">{description}</Text></View></View>)}</View>
    <Notice>Your sign-in provider identifies your account privately. Public posts use your nickname. Photos, text and location may still identify you or someone else. Check them carefully.</Notice>
    <Text className="text-sm leading-6 text-muted">CivicLens is for constructive community reporting. Avoid identifying private people, unsupported allegations, faces, number plates and sensitive locations. This is not an emergency service.</Text>
    {error ? <Notice>{error}</Notice> : null}<Button title="Sign out securely" secondary icon="log-out-outline" busy={busy} onPress={() => void logout()} />
    <Text className="text-center text-xs text-muted">CivicLens · by Tesserix · 0.1.0</Text>
  </ScrollView></SafeAreaView>;
}
