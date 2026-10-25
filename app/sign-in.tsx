import { Text } from '../src/text';
import { LegalLinks } from '../src/legal-links';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PostLoginRedirect } from '../src/community-login-redirect';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../src/session';
import { providerLogin } from '../src/oauth';
import { request } from '../src/api';
import { Brand, Button, Field, Loading, Notice, Viewfinder, palette } from '../src/ui';
import type { Capabilities, LoginProvider } from '../shared/contracts';

export default function Welcome() {
  const { session, loading, error: sessionError, signOutNotice, retry, signIn } = useSession();
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState<LoginProvider | null>(null);
  const [error, setError] = useState('');
  const capabilities = useQuery({ queryKey: ['capabilities'], queryFn: ({ signal }) => request<Capabilities>('/v1/capabilities', { signal }) });
  if (loading) return <SafeAreaView className="flex-1 justify-center bg-canvas"><Loading label="Checking your sign-in" /></SafeAreaView>;
  if (session) return <PostLoginRedirect />;
  const login = async (provider: LoginProvider) => {
    setBusy(provider); setError('');
    try { await signIn(await providerLogin(provider, nickname)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in. Please retry.'); }
    finally { setBusy(null); }
  };
  return <SafeAreaView className="flex-1 bg-canvas"><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, gap: 28 }} keyboardShouldPersistTaps="handled">
      <Brand />
      {signOutNotice?<Notice>{signOutNotice}</Notice>:null}
      <View className="gap-4">
        <Viewfinder className="px-6 py-8">
          <Text accessibilityRole="header" className="text-[36px] font-bold leading-[42px] tracking-tight text-ink">Report what needs fixing near you.</Text>
        </Viewfinder>
        <Text className="text-base leading-6 text-muted">Photograph the problem, mark where it is and describe it in your own language. Every report is reviewed before it’s shared.</Text>
      </View>
      <View className="gap-4">
        <Field label="Public nickname (optional)" hint="Choose a unique nickname, or leave blank for an automatic one. Existing accounts keep their nickname." value={nickname} onChangeText={setNickname} autoCapitalize="none" autoCorrect={false} maxLength={30} placeholder="e.g. RiverFox_27" />
        <View className="gap-2.5">
          {Platform.OS === 'ios' ? <Button title="Sign in with Apple" icon="logo-apple" variant="apple" busy={busy === 'apple'} disabled={busy !== null || !capabilities.data?.apple} onPress={() => void login('apple')} /> : null}
          <Button title="Continue with Google" icon="logo-google" variant="secondary" busy={busy === 'google'} disabled={busy !== null || !capabilities.data?.google} onPress={() => void login('google')} />
          <Button title="Continue with Facebook" icon="logo-facebook" variant="secondary" busy={busy === 'facebook'} disabled={busy !== null || !capabilities.data?.facebook} onPress={() => void login('facebook')} />
        </View>
        {capabilities.isPending ? <Loading label="Checking sign-in availability" /> : null}
        {capabilities.isError ? <><Notice>The CivicLens API could not be reached. Sign-in will be available when it reconnects.</Notice><Button title="Retry connection" variant="secondary" onPress={() => void capabilities.refetch()} /></> : null}
        {capabilities.data && !capabilities.data.google && !capabilities.data.facebook && !capabilities.data.apple ? <Notice>Sign-in setup is in progress. Please check back soon.</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}
        {sessionError ? <><Notice>{sessionError}</Notice><Button title="Retry saved sign-in" variant="secondary" onPress={retry} /></> : null}
      </View>
      <View className="flex-row items-start gap-2.5"><Ionicons name="lock-closed-outline" size={16} color={palette.muted} /><Text className="flex-1 text-[13px] leading-5 text-muted">Your profile stays private. Reports appear under your nickname and are reviewed before public sharing.</Text></View>
      <LegalLinks />
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
