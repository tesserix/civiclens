import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { LocationSource } from './photo-location';
import type { Category, Channel, Location } from '../shared/contracts';

export type Draft = { key: string; category: Category; description: string; photoUri: string; location: Location | null; locationSource?: LocationSource; channels: Channel[]; consent: boolean; hashtags?: string[] };
const empty = (): Draft => ({ key: Crypto.randomUUID(), category: 'waste', description: '', photoUri: '', location: null, channels: ['facebook'], consent: false });

export function useDraft(userId: string) {
  const storageKey = `civiclens-draft-${userId}`;
  const [draft, setDraft] = useState<Draft>(empty);
  const [ready, setReady] = useState(Platform.OS === 'web');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (Platform.OS === 'web') return;
    SecureStore.getItemAsync(storageKey).then(value => {
      if (active && value) setDraft(JSON.parse(value));
    }).catch(() => { if (active) setError('Your saved draft could not be opened. Start a new draft or retry later.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [storageKey]);
  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    const timer = setTimeout(() => {
      SecureStore.setItemAsync(storageKey, JSON.stringify(draft), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
        .catch(() => setError('Draft could not be saved on this device. Keep the app open and retry.'));
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, ready, storageKey]);
  const update = useCallback((patch: Partial<Draft>) => setDraft(d => {
    const changed = (patch.category !== undefined && patch.category !== d.category) || (patch.location !== undefined && JSON.stringify(patch.location) !== JSON.stringify(d.location));
    return { ...d, ...patch, ...(changed ? {hashtags:undefined}:{}), key: Crypto.randomUUID() };
  }), []);
  const save = async () => {
    if (Platform.OS !== 'web') await SecureStore.setItemAsync(storageKey, JSON.stringify(draft), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  };
  const reset = async () => {
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(storageKey);
    setDraft(empty()); setError('');
  };
  return { draft, update, ready, error, save, reset };
}
