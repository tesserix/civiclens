import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AssistInput, AssistMode, AssistSuggestion, AssistTone, Category, Location } from '../shared/contracts';
import { ApiError, request } from './api';
import { languages, useWritingLanguage } from './languages';
import { Button, Chip, Notice, palette } from './ui';

export function WritingAssist({ userId, token, category, description, hasPhoto, readPhoto, onUse, disabled = false, available = true, sourceId = '', location = null, contextual = false }: {
  userId: string; token: string; category: Category; description: string; hasPhoto: boolean;
  readPhoto: () => Promise<string>; onUse: (text: string) => void; disabled?: boolean; available?: boolean; sourceId?: string; location?: Location | null; contextual?: boolean;
}) {
  const [tone, setTone] = useState<AssistTone>('balanced');
  const [language, choose] = useWritingLanguage(userId);
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 375 || fontScale > 1.2;
  const actionsClass = stacked ? 'gap-2' : 'flex-row gap-2';
  const [busy, setBusy] = useState<AssistMode | null>(null);
  const [answer, setAnswer] = useState<{ text: string; source: string } | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const source = JSON.stringify([userId, category, description, hasPhoto, sourceId, language.tag, location, tone, contextual]);
  const suggestion = answer?.source === source ? answer.text : '';
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setAnswer(null); setReviewed(false); setError('');
    return () => { generation.current++; };
  }, [source]);
  const ask = async (mode: AssistMode) => {
    const run = generation.current;
    setBusy(mode); setError(''); setAnswer(null); setReviewed(false);
    try {
      const photoBase64 = mode === 'draft' ? await readPhoto() : null;
      const body: AssistInput = { mode, category, language: language.tag, text: description, photoBase64, ...(mode === 'draft' && contextual ? {tone, place:location ? {locality:location.locality,countryCode:location.countryCode} : undefined} : {}) };
      const { text } = await request<AssistSuggestion>('/v1/assist', { token, method: 'POST', body });
      if (run === generation.current) setAnswer({ text, source });
    } catch (e) {
      if (run === generation.current) setError(e instanceof ApiError && (e.status === 429 || e.code === 'CONTENT_REJECTED' || e.code === 'PHOTO_REVIEW_REQUIRED') ? e.message : 'Writing help isn’t available right now. Your text hasn’t changed.');
    } finally { setBusy(null); }
  };
  const locked = disabled || busy !== null;
  return <View className="gap-2">
    {available ? <Pressable accessibilityRole="button" accessibilityLabel="Writing help" accessibilityHint="Draft from your photo or improve your wording" disabled={disabled}
      onPress={() => setOpen(true)} className="min-h-11 flex-row items-center gap-2 self-start rounded-full bg-mint px-4" style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}>
      <Ionicons name="sparkles-outline" size={17} color={palette.brand} /><Text className="text-sm font-semibold text-brand">Writing help</Text><Ionicons name="chevron-forward" size={14} color={palette.brand} />
    </Pressable> : <Text className="text-xs leading-5 text-muted">Writing help is temporarily unavailable. You can still write your description.</Text>}
    <Modal visible={open && available} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined} onRequestClose={() => { setOpen(false); setPicking(false); }}>
      <SafeAreaView edges={Platform.OS === 'ios' ? ['bottom', 'left', 'right'] : ['top', 'bottom', 'left', 'right']} className="flex-1 bg-canvas">
        <View className="flex-row items-center justify-between gap-3 border-b border-line bg-surface px-5 pb-3 pt-5">
          <Text accessibilityRole="header" className="flex-1 text-lg font-bold text-ink">{picking ? 'Writing language' : 'Writing help'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={picking ? 'Back to writing help' : 'Close writing help'}
            onPress={() => picking ? setPicking(false) : setOpen(false)} className="h-11 w-11 items-center justify-center rounded-full bg-canvas"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}><Ionicons name={picking ? 'arrow-back' : 'close'} size={22} color={palette.ink} /></Pressable>
        </View>
        {!picking ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 32 }}>
          <Text className="text-[15px] leading-6 text-muted">Draft a caption from your photo, or tidy up what you wrote. You’re always in control.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Writing language: ${language.native}`} accessibilityHint="Choose the language for written suggestions"
      disabled={locked} onPress={() => setPicking(true)} className="min-h-11 flex-row items-center gap-2 self-start rounded-full border border-line bg-surface px-3.5"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name="language-outline" size={17} color={palette.brand} />
      <Text className="text-sm text-muted">Write in</Text>
      <Text className="text-sm font-semibold text-ink">{language.native}</Text>
      <Ionicons name="chevron-down" size={15} color={palette.muted} />
    </Pressable>
    {contextual ? <View className="gap-2">
      <Text className="text-[13px] font-semibold text-ink">Caption tone</Text>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
        {([['serious','Serious'],['satirical','Light satire'],['balanced','Balanced']] as const).map(([value,label])=><Chip key={value} label={label} selected={tone===value} disabled={locked} onPress={()=>setTone(value)}/>)}
      </View>
      <Text className="text-xs leading-5 text-muted">Humour stays constructive, with factual details and a clear request for action. No personal attacks or unsupported blame.</Text>
    </View> : null}
    <View className={actionsClass}>
      <View className={stacked ? undefined : "flex-1"}><Button title="Write it for me" variant="secondary" compact icon="sparkles-outline" busy={busy === 'draft'} disabled={locked || !available || !hasPhoto} onPress={() => void ask('draft')} /></View>
      <View className={stacked ? undefined : "flex-1"}><Button title="Fix spelling" variant="secondary" compact icon="checkmark-done-outline" busy={busy === 'correct'} disabled={locked || !available || description.trim().length < 10} onPress={() => void ask('correct')} /></View>
    </View>
    {suggestion ? <View className="gap-3 rounded-xl border border-brand/25 bg-mint p-4">
      <View className="flex-row items-center gap-1.5"><Ionicons name="sparkles" size={14} color={palette.brand} /><Text className="text-[13px] font-semibold text-brand">Suggestion</Text></View>
      <Text selectable className="text-base leading-6 text-ink">{suggestion}</Text>
      <Pressable accessibilityRole="checkbox" accessibilityLabel="I checked the caption and photo for identifying details" accessibilityState={{ checked: reviewed }} disabled={locked}
        onPress={() => setReviewed(!reviewed)} className="min-h-11 flex-row items-center gap-3">
        <Ionicons name={reviewed ? 'checkbox' : 'square-outline'} size={24} color={palette.brand} />
        <Text className="flex-1 text-sm leading-5 text-ink">I checked the caption and photo for identifying details</Text>
      </Pressable>
      <View className={actionsClass}>
        <View className={stacked ? undefined : "flex-1"}><Button title="Use this" compact disabled={locked || !reviewed} onPress={() => { onUse(suggestion); setAnswer(null); setOpen(false); }} /></View>
        <View className={stacked ? undefined : "flex-1"}><Button title="Dismiss" variant="quiet" compact onPress={() => setAnswer(null)} /></View>
      </View>
      <Text className="text-xs leading-5 text-muted">Keep it factual and respectful: no profanity, insults or threats. Remove identifying details from the caption; crop or replace photos showing faces, plates or private addresses. This check does not replace moderator review.</Text>
    </View> : <Text className="text-xs leading-5 text-muted">{hasPhoto ? 'Your photo and notes are used to create a suggestion. Nothing changes until you choose Use this.' : 'Add a photo to draft a caption. You can fix spelling once you’ve written at least 10 characters.'}</Text>}
    {error ? <Notice>{error}</Notice> : null}
        </ScrollView> :
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
          }} />}
      </SafeAreaView>
    </Modal>
  </View>;
}
