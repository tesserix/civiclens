import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AuthorityPreview as Preview, Category, Location } from '../shared/contracts';
import { request } from './api';
import { Button, Notice, palette } from './ui';

type Props = { userId?: string; token: string; category: Category; location: Location | null; available: boolean; disabled?: boolean };

export function AuthorityPreview(props: Props) {
  if (!props.location) return null;
  if (!props.available) return <View className="flex-row items-center gap-2"><Ionicons name="shield-checkmark-outline" size={15} color={palette.muted} /><Text className="flex-1 text-xs leading-5 text-muted">A reviewer will verify the responsible office before sharing.</Text></View>;
  return <Lookup key={JSON.stringify([props.userId, props.category, props.location])} {...props} />;
}

function Lookup({ token, category, location, disabled }: Props) {
  const [result, setResult] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const valid = location && /^[A-Z]{2}$/.test(location.countryCode) && location.locality.trim().length >= 2;
  const lookup = async () => {
    setBusy(true); setError(''); setResult(null); setConfirmed(false);
    try {
      setResult(await request<Preview>('/v1/authorities/preview', { token, method: 'POST', body: { category, location } }));
    } catch { setError('Could not check authorities. Retry when connected; your draft is safe.'); }
    finally { setBusy(false); }
  };
  const coverageMessage = result?.reason ? {
    country_not_covered: `Verified authority coverage is not available in ${location?.countryCode} yet.`,
    area_not_covered: 'This location is outside our verified local coverage.',
    category_not_covered: 'We have not verified an office for this issue type here yet.',
    review_required: 'A reviewer needs to confirm the responsible office.',
  }[result.reason] : null;
  const open = (url: string) => {
    if (!url.startsWith('https://')) return;
    void Linking.openURL(url).catch(() => setError('Could not open the official source. Please try again.'));
  };
  return <View className="gap-3 rounded-xl border border-line bg-surface p-4">
    <Text accessibilityRole="header" className="text-base font-semibold text-ink">Responsible authorities</Text>
    <Text className="text-sm leading-5 text-muted">Find the office responsible for this location and issue.</Text>
      <Button title="Confirm location & find authorities" variant="secondary" compact busy={busy} disabled={disabled || busy || !valid} onPress={() => void lookup()} />
      {!valid ? <Text className="text-xs leading-5 text-muted">Add the issue’s location first.</Text> : null}
    {result?.status === 'unverified' ? <View accessibilityLiveRegion="polite" className="gap-2 rounded-lg bg-canvas p-3">
      <Text className="text-sm font-semibold text-ink">{coverageMessage || 'No verified authority match for this location and category.'}</Text>
      <Text className="text-sm leading-5 text-muted">Your location was checked. You can still submit for review; no office will be tagged until verified.</Text>
    </View> : null}
    {result?.status === 'matched' ? <>
      {result.authorities.map(office => <View key={office.id} className="gap-2 border-t border-line pt-3">
        <Text className="text-base font-semibold text-ink">{office.name}</Text>
        {office.facebook ? <Text className="text-sm text-ink">Facebook: @{office.facebook}</Text> : null}
        {office.instagram ? <Text className="text-sm text-ink">Instagram: @{office.instagram}</Text> : null}
        {!office.facebook && !office.instagram ? <Text className="text-sm text-muted">No verified social handle. The office can be named without a tag.</Text> : null}
        <Text className="text-xs text-muted">Verified {office.verifiedAt.slice(0, 10)} · valid until {office.expiresAt.slice(0, 10)}</Text>
        <Pressable accessibilityRole="link" accessibilityLabel={`Official website for ${office.name}`} onPress={() => open(office.officialUrl)} className="min-h-11 justify-center"><Text className="text-sm text-brand underline">Official website</Text></Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel={`Verification source for ${office.name}`} onPress={() => open(office.sourceUrl)} className="min-h-11 justify-center"><Text className="text-sm text-brand underline">Verification source</Text></Pressable>
      </View>)}
      <Pressable accessibilityRole="checkbox" accessibilityLabel="These offices match the issue" accessibilityState={{ checked: confirmed }} disabled={disabled}
        onPress={() => setConfirmed(!confirmed)} className="min-h-11 flex-row items-center gap-3">
        <Ionicons name={confirmed ? 'checkbox' : 'square-outline'} size={24} color={palette.brand} />
        <Text className="flex-1 text-sm text-ink">These offices match the issue</Text>
      </Pressable>
      <Text className="text-xs leading-5 text-muted">{confirmed ? 'Checked for this draft. ' : 'Review the source before confirming. '}A moderator rechecks authority details and photo privacy before posting. Mentions depend on platform support and may not notify the office.</Text>
    </> : null}
    {result?.status === 'matched' ? <Text className="text-xs leading-5 text-muted">Only verified accounts are mentioned. Topic hashtags are added after review.</Text> : null}
    {error ? <Notice>{error}</Notice> : null}
  </View>;
}
