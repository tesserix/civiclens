import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Brand, Button, Field, Notice } from '../src/ui';
import { request } from '../src/api';
import { useSession } from '../src/session';
import { providerLogin } from '../src/oauth';
import type { Capabilities } from '../shared/contracts';

export default function Welcome() {
  const { session, loading, error: sessionError, retry, signIn } = useSession();
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState<'google' | 'facebook' | null>(null);
  const [error, setError] = useState('');
  const capabilities = useQuery({ queryKey: ['capabilities'], queryFn: ({ signal }) => request<Capabilities>('/v1/capabilities',{ signal }) });
  if (loading) return <SafeAreaView className="flex-1 items-center justify-center bg-canvas"><ActivityIndicator color="#163D32" /></SafeAreaView>;
  if (session) return <Redirect href="/(tabs)" />;
  const login = async (provider: 'google' | 'facebook') => {
    setBusy(provider); setError('');
    try { await signIn(await providerLogin(provider, nickname)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in. Please retry.'); }
    finally { setBusy(null); }
  };
  return <SafeAreaView className="flex-1 bg-canvas"><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 24 }} keyboardShouldPersistTaps="handled">
      <Brand />
      <View className="gap-5 rounded-[32px] bg-forest px-7 pb-8 pt-8">
        <View className="self-start rounded-full border border-emerald-700 px-3 py-2"><Text className="text-xs font-semibold tracking-widest text-mint">SMALL ACTION. SHARED RESPONSIBILITY.</Text></View>
        <View className="my-2 flex-row items-center justify-between"><View className="h-24 w-24 items-center justify-center rounded-full border border-emerald-700"><Ionicons name="camera-outline" size={45} color="#DFF0D8" /></View><Ionicons name="arrow-forward" size={28} color="#87AB8E" /><View className="h-20 w-20 items-center justify-center rounded-full bg-mint"><Ionicons name="leaf-outline" size={36} color="#163D32" /></View></View>
        <Text className="text-[38px] font-bold leading-[43px] tracking-tight text-white">See something.{`\n`}Change something.</Text>
        <Text className="text-base leading-7 text-emerald-100">One photo can start a better neighbourhood. Make the issue visible. Keep your real name private.</Text>
      </View>
      <View className="gap-4">
        <View><Text className="text-2xl font-bold tracking-tight text-ink">Your voice. Your nickname.</Text><Text className="mt-2 text-sm leading-6 text-muted">Sign in securely. Public reports use a nickname, never your Google or Facebook profile name.</Text></View>
        <Field label="Public nickname · optional" value={nickname} onChangeText={setNickname} autoCapitalize="none" autoCorrect={false} maxLength={30} placeholder="e.g. RiverFox" />
        <Text className="text-xs leading-5 text-muted">Leave it blank and we’ll assign a unique nickname for you.</Text>
        {capabilities.isPending ? <ActivityIndicator color="#163D32" accessibilityLabel="Checking sign-in availability" /> : null}
        {capabilities.isError ? <><Notice>The CivicLens API could not be reached. Sign-in will be available when it reconnects.</Notice><Button title="Retry connection" secondary onPress={() => void capabilities.refetch()} /></> : null}
        {capabilities.data && !capabilities.data.google && !capabilities.data.facebook ? <Notice>Sign-in setup is in progress. Google and Facebook access must be configured by the CivicLens team.</Notice> : null}
        <Button title="Continue with Google" icon="logo-google" busy={busy === 'google'} disabled={busy !== null || !capabilities.data?.google} onPress={() => void login('google')} />
        <Button title="Continue with Facebook" icon="logo-facebook" secondary busy={busy === 'facebook'} disabled={busy !== null || !capabilities.data?.facebook} onPress={() => void login('facebook')} />
        {error ? <Notice>{error}</Notice> : null}
        {sessionError ? <><Notice>{sessionError}</Notice><Button title="Retry saved sign-in" secondary onPress={retry} /></> : null}
      </View>
      <View className="flex-row items-start gap-3 rounded-2xl bg-mint p-4"><Ionicons name="shield-checkmark-outline" size={22} color="#163D32" /><Text className="flex-1 text-xs leading-5 text-forest">Your account stays private. Photos, descriptions and places may still identify people, so every report is reviewed before sharing.</Text></View>
      <Text className="text-center text-xs text-muted">A little care for the places we share.</Text>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
