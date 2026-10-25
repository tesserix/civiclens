import { Text } from './text';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { API_URL } from './api';
import { Notice } from './ui';

export function LegalLinks() {
  const [error, setError] = useState('');
  const open = async (path: string) => {
    setError('');
    try { await Linking.openURL(`${API_URL}/v1/${path}`); }
    catch { setError('Could not open this page. Retry when connected or contact sales@tesserix.app.'); }
  };
  return <View className="gap-1">
    <Text className="text-xs text-muted">CivicLens is for adults aged 18 and over.</Text>
    {([['privacy', 'Privacy policy'], ['terms', 'Terms and community rules'], ['account-deletion', 'Account deletion details']] as const).map(([path, label]) =>
      <Pressable key={path} accessibilityRole="link" accessibilityLabel={label} accessibilityHint="Opens in your browser" onPress={() => void open(path)} className="min-h-12 justify-center" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}><Text className="text-sm text-brand underline">{label}</Text></Pressable>)}
    {error ? <Notice>{error}</Notice> : null}
  </View>;
}
