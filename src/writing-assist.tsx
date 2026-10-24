import { useState } from 'react';
import { FlatList, Modal, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AssistInput, AssistMode, AssistSuggestion, Category } from '../shared/contracts';
import { ApiError, request } from './api';
import { languages, useWritingLanguage } from './languages';
import { Button, Notice, palette } from './ui';

export function WritingAssist({ userId, token, category, description, hasPhoto, readPhoto, onUse, disabled = false, available = true, sourceId = '' }: {
  userId: string; token: string; category: Category; description: string; hasPhoto: boolean;
  readPhoto: () => Promise<string>; onUse: (text: string) => void; disabled?: boolean; available?: boolean; sourceId?: string;
}) {
  const [language, choose] = useWritingLanguage(userId);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<AssistMode | null>(null);
  const [answer, setAnswer] = useState<{ text: string; source: string } | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const source = JSON.stringify([userId, category, description, hasPhoto, sourceId, language.tag]);
  const suggestion = answer?.source === source ? answer.text : '';
  const [error, setError] = useState('');
  const ask = async (mode: AssistMode) => {
    setBusy(mode); setError(''); setAnswer(null); setReviewed(false);
    try {
      const photoBase64 = mode === 'draft' ? await readPhoto() : null;
      const body: AssistInput = { mode, category, language: language.tag, text: description, photoBase64 };
      setAnswer({ text: (await request<AssistSuggestion>('/v1/assist', { token, method: 'POST', body })).text, source });
    } catch (e) {
      setError(e instanceof ApiError && (e.status === 429 || e.code === 'CONTENT_REJECTED') ? e.message : 'Writing help isn’t available right now. Your text hasn’t changed.');
    } finally { setBusy(null); }
  };
  const locked = disabled || busy !== null;
  return <View className="gap-3">
    <Pressable accessibilityRole="button" accessibilityLabel={`Writing language: ${language.native}`} accessibilityHint="Choose the language for written suggestions"
      disabled={locked} onPress={() => setPicking(true)} className="min-h-11 flex-row items-center gap-2 self-start rounded-full border border-line bg-surface px-3.5"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name="language-outline" size={17} color={palette.brand} />
      <Text className="text-sm text-muted">Write in</Text>
      <Text className="text-sm font-semibold text-ink">{language.native}</Text>
      <Ionicons name="chevron-down" size={15} color={palette.muted} />
    </Pressable>
    <View className="flex-row gap-2">
      <View className="flex-1"><Button title="Write it for me" variant="secondary" compact icon="sparkles-outline" busy={busy === 'draft'} disabled={locked || !available || !hasPhoto} onPress={() => void ask('draft')} /></View>
      <View className="flex-1"><Button title="Fix spelling" variant="secondary" compact icon="checkmark-done-outline" busy={busy === 'correct'} disabled={locked || !available || description.trim().length < 10} onPress={() => void ask('correct')} /></View>
    </View>
    {suggestion ? <View className="gap-3 rounded-xl border border-brand/25 bg-mint p-4">
      <View className="flex-row items-center gap-1.5"><Ionicons name="sparkles" size={14} color={palette.brand} /><Text className="text-[13px] font-semibold text-brand">Suggestion</Text></View>
      <Text selectable className="text-base leading-6 text-ink">{suggestion}</Text>
      <Pressable accessibilityRole="checkbox" accessibilityLabel="I checked the caption and photo for identifying details" accessibilityState={{ checked: reviewed }} disabled={locked}
        onPress={() => setReviewed(!reviewed)} className="min-h-11 flex-row items-center gap-3">
        <Ionicons name={reviewed ? 'checkbox' : 'square-outline'} size={24} color={palette.brand} />
        <Text className="flex-1 text-sm leading-5 text-ink">I checked the caption and photo for identifying details</Text>
      </Pressable>
      <View className="flex-row gap-2">
        <View className="flex-1"><Button title="Use this" compact disabled={locked || !reviewed} onPress={() => { onUse(suggestion); setAnswer(null); }} /></View>
        <View className="flex-1"><Button title="Dismiss" variant="quiet" compact onPress={() => setAnswer(null)} /></View>
      </View>
      <Text className="text-xs leading-5 text-muted">Keep it factual and respectful: no profanity, insults or threats. Remove identifying details from the caption; crop or replace photos showing faces, plates or private addresses. This check does not replace moderator review.</Text>
    </View> : <Text className="text-xs leading-5 text-muted">{available ? 'Suggestions use your photo and text. Nothing changes until you choose Use this.' : 'Photo writing help isn’t available on this server yet. You can write your description manually.'}</Text>}
    {error ? <Notice>{error}</Notice> : null}
    <Modal visible={picking} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined} onRequestClose={() => setPicking(false)}>
      <View className="flex-1 bg-canvas">
        <View className="flex-row items-center justify-between border-b border-line bg-surface px-5 pb-3 pt-5">
          <Text accessibilityRole="header" className="text-lg font-bold text-ink">Writing language</Text>
          <Button title="Done" variant="quiet" compact onPress={() => setPicking(false)} />
        </View>
        <FlatList data={languages} keyExtractor={l => l.tag} initialNumToRender={languages.length} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={<Text className="px-1 pb-3 text-sm leading-5 text-muted">Write it for me drafts in this language. Fix spelling keeps the language you wrote in.</Text>}
          renderItem={({ item }) => {
            const selected = item.tag === language.tag;
            return <Pressable accessibilityRole="radio" accessibilityLabel={`${item.native}, ${item.english}`} accessibilityState={{ checked: selected }}
              onPress={() => { choose(item.tag); setPicking(false); }} className="min-h-14 flex-row items-center gap-3 border-b border-line px-1"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <View className="flex-1"><Text className="text-base text-ink">{item.native}</Text>{item.native !== item.english ? <Text className="text-[13px] text-muted">{item.english}</Text> : null}</View>
              {selected ? <Ionicons name="checkmark-circle" size={22} color={palette.brand} /> : null}
            </Pressable>;
          }} />
      </View>
    </Modal>
  </View>;
}
