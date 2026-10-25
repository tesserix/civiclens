import { Text } from './text';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import type { CivicCard, CivicShareLink } from '../shared/contracts';
import appLinks from '../shared/app-links.json';
import { API_URL, request } from './api';
import { CivicNotice } from './community-ui';
import { palette } from './ui';

export function CommunityShare({ card, userId, token, compact = false, title }: {
  card: CivicCard; userId: string; token: string; compact?: boolean; title?: string;
}) {
  const scope = useRef(0), flight = useRef<number | null>(null);
  const [busy, setBusy] = useState(false), [shared, setShared] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    scope.current++; flight.current = null; setBusy(false); setShared(false); setError('');
    return () => { scope.current++; };
  }, [card.id, card.status, userId, token]);
  if (card.status !== 'approved') return null;
  const share = async () => {
    if (flight.current !== null) return;
    const generation = scope.current;
    flight.current = generation; setBusy(true); setShared(false); setError('');
    try {
      let content: { message: string; url?: string };
      if (card.webShareSupported) {
        const link = await request<CivicShareLink>(`/v1/community/${encodeURIComponent(card.id)}/share-link`, { token, method: 'POST', body: {} });
        if (generation !== scope.current) return;
        const url = new URL(link.url);
        const local = __DEV__ && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(url.origin) && url.origin === API_URL;
        if (link.cardId !== card.id || (!local && url.origin !== appLinks.publicOrigin) || url.protocol !== (local ? 'http:' : 'https:') ||
          url.pathname !== `/community/${card.id}` || url.search || url.hash || url.username || url.password ||
          typeof link.text !== 'string' || !link.text.trim() || link.text.length > 3000) throw new Error('Invalid share link');
        const message = link.text.replaceAll(link.url, '').trim();
        content = Platform.OS === 'ios' ? { message, url: link.url } : { message: `${message}\n\n${link.url}` };
      } else {
        const fresh = await request<CivicCard>(`/v1/community/${encodeURIComponent(card.id)}`, { token });
        if (generation !== scope.current) return;
        if (fresh.id !== card.id || fresh.status !== 'approved' || typeof fresh.title !== 'string' || typeof fresh.body !== 'string' || fresh.title.length > 720 || fresh.body.length > 16000) throw new Error('Request unavailable');
        content = { message: `${fresh.title}\n\n${fresh.body}\n\n${Linking.createURL(`community/${card.id}`)}` };
      }
      const result = await Share.share(content);
      if (generation === scope.current && result.action === Share.sharedAction) setShared(true);
    } catch {
      if (generation === scope.current) setError(card.webShareSupported ? 'Could not share. Please retry.' : 'Could not open sharing. Please try again.');
    } finally {
      if (generation === scope.current) { flight.current = null; setBusy(false); }
    }
  };
  return <View style={{ gap: 8, flexShrink: 1 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={title ?? `Share ${card.title}`} accessibilityHint="Choose a social or messaging app on your device" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => void share()}
      className={`${compact ? 'self-start px-3' : 'border border-line bg-surface px-4'} min-h-12 flex-row items-center justify-center gap-2 rounded-xl`}
      style={({ pressed }) => ({ opacity: busy || pressed ? 0.6 : 1 })}>
      <Ionicons name="share-outline" size={19} color={palette.brand} />
      <Text className="text-sm font-semibold text-brand" style={{ flexShrink: 1 }}>{busy ? 'Preparing…' : title ?? 'Share'}</Text>
    </Pressable>
    {shared ? <CivicNotice>Check the destination app to confirm it was sent.</CivicNotice> : null}
    {error ? <CivicNotice tone="warning">{error}</CivicNotice> : null}
    {!compact && !card.webShareSupported ? <Text className="text-xs leading-5 text-muted">This server supports installed-app links only. The recipient needs CivicLens installed.</Text> : null}
  </View>;
}
