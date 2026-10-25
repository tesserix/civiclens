import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import type { LocationSource } from './photo-location';
import type { Category, Channel, Location, SharingMode } from '../shared/contracts';

export type Draft = { key: string; complaintRequested?: boolean; sharingMode?: SharingMode; category: Category; description: string; photoUri: string; additionalPhotoUris?: string[]; photoFiles?: string[]; communityRulesVersion?: string; location: Location | null; locationSource?: LocationSource; channels: Channel[]; consent: boolean; hashtags?: string[] };
export const draftPhotos = (draft: Pick<Draft, 'photoUri' | 'additionalPhotoUris'>): string[] => [draft.photoUri, ...(draft.additionalPhotoUris || [])].filter(uri => typeof uri === 'string' && !!uri).slice(0, 5);
export function isDraftPhotoUri(uri: string): boolean {
  const prefix = FileSystem.documentDirectory && `${FileSystem.documentDirectory}civiclens-photo-`;
  return !!prefix && uri.startsWith(prefix) && /^[a-zA-Z0-9-]+\.jpg$/.test(uri.slice(prefix.length));
}
const empty = (): Draft => ({ key: Crypto.randomUUID(), sharingMode: 'manual', category: 'waste', description: '', photoUri: '', location: null, channels: ['facebook'], consent: false });

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
      if (active && value) {
        const saved:Draft=JSON.parse(value);
        setDraft(saved.sharingMode==='manual' ? saved : {...saved,sharingMode:'manual',consent:false,key:Crypto.randomUUID()});
      }
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
    const next = { ...d, ...patch, ...(changed ? {hashtags:undefined}:{}), key: Crypto.randomUUID() };
    if (patch.photoUri!==undefined || patch.additionalPhotoUris!==undefined) next.photoFiles=[...new Set([...(d.photoFiles || []),...draftPhotos(d),...draftPhotos(next)])];
    return next;
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
          const files = [...new Set([...(draft.photoFiles || []), ...draftPhotos(draft)])].filter(isDraftPhotoUri);
          const backups = new Map<string,string>();
          const deleted = new Set<string>();
          const retained = new Set<string>();
          try {
            if (files.length>1) for (const from of files) {
              const to = `${FileSystem.documentDirectory}civiclens-photo-${Crypto.randomUUID()}.jpg`;
              await FileSystem.copyAsync({from,to}); backups.set(from,to);
            }
            await SecureStore.deleteItemAsync(storageKey);
            try {
              for (const uri of files) {await FileSystem.deleteAsync(uri,{idempotent:true});deleted.add(uri);}
            } catch (failure) {
              const recover = (uri: string) => deleted.has(uri) ? backups.get(uri)! : uri;
              const recovered = {...draft,photoUri:recover(draft.photoUri),...(draft.additionalPhotoUris ? {additionalPhotoUris:draft.additionalPhotoUris.map(recover)} : {}),photoFiles:files.map(recover)};
              for (const uri of recovered.photoFiles) retained.add(uri);
              setDraft(recovered);
              await SecureStore.setItemAsync(storageKey, JSON.stringify(recovered), {keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
              throw failure;
            }
          } finally {
            for (const uri of backups.values()) if (!retained.has(uri)) {
              try {await FileSystem.deleteAsync(uri,{idempotent:true});} catch { /* A storage outage must not remove recovery copies still used by the draft. */ }
            }
          }
        }
      });
      setDraft(empty()); setError('');
    } finally { resetting.current = false; }
  };
  return { draft, update, ready, error, save, reset };
}
