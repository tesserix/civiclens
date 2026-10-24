import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
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
  const writes = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);
  const resetting = useRef(false);
  const enqueue = useCallback((operation: () => Promise<void>) => {
    const next = writes.current.catch(() => {}).then(operation);
    writes.current = next;
    return next;
  }, []);
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
    const run = generation.current;
    const timer = setTimeout(() => {
      void enqueue(async () => {
        if (run !== generation.current || resetting.current) return;
        await SecureStore.setItemAsync(storageKey, JSON.stringify(draft), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      }).catch(() => { if (run === generation.current) setError('Draft could not be saved on this device. Keep the app open and retry.'); });
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, ready, storageKey, enqueue]);
  const update = useCallback((patch: Partial<Draft>) => setDraft(d => {
    if (resetting.current) return d;
    const changed = (patch.category !== undefined && patch.category !== d.category) || (patch.location !== undefined && JSON.stringify(patch.location) !== JSON.stringify(d.location));
    return { ...d, ...patch, ...(changed ? {hashtags:undefined}:{}), key: Crypto.randomUUID() };
  }), []);
  const save = async () => {
    const run = generation.current;
    await enqueue(async () => {
      if (Platform.OS !== 'web' && run === generation.current && !resetting.current) await SecureStore.setItemAsync(storageKey, JSON.stringify(draft), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    });
  };
  const reset = async () => {
    if (resetting.current) return;
    resetting.current = true;
    generation.current++;
    try {
      await enqueue(async () => {
        if (Platform.OS !== 'web') {
          const prefix = FileSystem.documentDirectory && `${FileSystem.documentDirectory}civiclens-photo-`;
          await SecureStore.deleteItemAsync(storageKey);
          try {
            if (prefix && draft.photoUri.startsWith(prefix) && /^[a-zA-Z0-9-]+\.jpg$/.test(draft.photoUri.slice(prefix.length))) await FileSystem.deleteAsync(draft.photoUri, { idempotent: true });
          } catch (failure) {
            await SecureStore.setItemAsync(storageKey, JSON.stringify(draft), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
            throw failure;
          }
        }
      });
      setDraft(empty()); setError('');
    } finally { resetting.current = false; }
  };
  return { draft, update, ready, error, save, reset };
}
