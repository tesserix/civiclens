import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../src/session';
import { providerLogin } from '../src/oauth';
import { request } from '../src/api';
import { Brand, Button, Field, Notice } from '../src/ui';
import type { Capabilities, LoginProvider } from '../shared/contracts';

export default function Welcome() {
  const { session, loading, error: sessionError, retry, signIn } = useSession();
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState<LoginProvider | null>(null);
  const [error, setError] = useState('');
  const capabilities = useQuery({ queryKey: ['capabilities'], queryFn: ({ signal }) => request<Capabilities>('/v1/capabilities', { signal }) });
  if (loading) return <SafeAreaView className="flex-1 items-center justify-center bg-canvas"><ActivityIndicator color="#3858F5" /></SafeAreaView>;
  if (session) return <Redirect href="/(tabs)" />;
  const login = async (provider: LoginProvider) => {
    setBusy(provider); setError('');
    try { await signIn(await providerLogin(provider, nickname)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in. Please retry.'); }
    finally { setBusy(null); }
  };
  return <SafeAreaView className="flex-1 bg-canvas"><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 24, gap: 24 }} keyboardShouldPersistTaps="handled">
      <View className="flex-row items-center justify-between"><Brand /><View className="rounded-full bg-white px-3 py-2"><Text className="text-xs font-medium text-muted">By Tesserix</Text></View></View>
      <View className="gap-5 pt-4">
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="h-40 items-center justify-center overflow-hidden rounded-[32px] bg-tint">
          <View className="absolute h-64 w-64 rounded-full border border-blue-200" /><View className="absolute h-44 w-44 rounded-full border border-blue-200" />
          <View className="absolute left-8 top-7 -rotate-6 flex-row items-center gap-2 rounded-full bg-white px-3 py-2"><View className="h-2 w-2 rounded-full bg-primary" /><Text className="text-xs font-semibold text-ink">Spotted nearby</Text></View>
          <View className="h-20 w-20 items-center justify-center rounded-[26px] bg-primary" style={{ transform: [{ rotate: '-8deg' }] }}><Ionicons name="scan" size={43} color="#FFF" /></View>
          <View className="absolute bottom-5 right-7 rotate-3 flex-row items-center gap-2 rounded-full bg-accent px-3 py-2"><Ionicons name="location" size={14} color="#151923" /><Text className="text-xs font-semibold text-ink">A place worth caring for</Text></View>
        </View>
        <View className="gap-2"><Text className="text-[40px] font-bold leading-[45px] tracking-[-1.5px] text-ink">Small proof.{`\n`}Real change<Text className="text-primary">.</Text></Text><Text className="text-base leading-6 text-muted">Spot an issue. Share a photo.{`\n`}Give your neighbourhood a voice.</Text></View>
      </View>
      <View className="gap-3">
        <Field label="Public nickname · optional" value={nickname} onChangeText={setNickname} autoCapitalize="none" autoCorrect={false} maxLength={30} placeholder="What should we call you?" />
        <Text className="text-xs leading-5 text-muted">Leave it blank and we’ll assign a unique nickname for you.</Text>
        <View className="mt-1 gap-2.5">
          {Platform.OS === 'ios' ? <Button title="Sign in with Apple" icon="logo-apple" tone="apple" busy={busy === 'apple'} disabled={busy !== null || !capabilities.data?.apple} onPress={() => void login('apple')} /> : null}
          <Button title="Continue with Google" icon="logo-google" secondary busy={busy === 'google'} disabled={busy !== null || !capabilities.data?.google} onPress={() => void login('google')} />
          <Button title="Continue with Facebook" icon="logo-facebook" secondary busy={busy === 'facebook'} disabled={busy !== null || !capabilities.data?.facebook} onPress={() => void login('facebook')} />
        </View>
        {capabilities.isPending ? <ActivityIndicator color="#3858F5" accessibilityLabel="Checking sign-in availability" /> : null}
        {capabilities.isError ? <><Notice>The CivicLens API could not be reached. Sign-in will be available when it reconnects.</Notice><Button title="Retry connection" secondary onPress={() => void capabilities.refetch()} /></> : null}
        {capabilities.data && !capabilities.data.google && !capabilities.data.facebook && !capabilities.data.apple ? <Notice>Sign-in setup is in progress. Please check back soon.</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}
        {sessionError ? <><Notice>{sessionError}</Notice><Button title="Retry saved sign-in" secondary onPress={retry} /></> : null}
      </View>
      <View className="flex-row items-start gap-2.5"><Ionicons name="shield-checkmark-outline" size={17} color="#717887" /><Text className="flex-1 text-xs leading-5 text-muted">Your profile stays private. Reports appear under your nickname and are reviewed before public sharing.</Text></View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
