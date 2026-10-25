import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountProfile, ImportedProfilePhoto } from '../shared/contracts';
import { request } from './api';
import { Button, Field, Loading, Notice, palette } from './ui';
import { Card } from './community-ui';
import { Text } from './text';

type Props = { userId: string; token: string; nickname: string; available: boolean };

export function AccountProfileCard(props: Props) { return <ProfileEditor key={props.userId} {...props} />; }

function ProfileEditor({ userId, token, nickname, available }: Props) {
  const client = useQueryClient(), key = ['account-profile', userId];
  const query = useQuery({ queryKey: key, enabled: available, queryFn: ({ signal }) => request<AccountProfile>('/v1/me/profile', { token, signal }) });
  const [editing, setEditing] = useState(false), [bio, setBio] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [photoBase64, setPhoto] = useState<string | null>(null), [removePhoto, setRemovePhoto] = useState(false);
  const scope = useRef(0);
  useEffect(() => { scope.current++; setEditing(false); setBio(''); setError(''); setBusy(false); setPhoto(null); setRemovePhoto(false); return () => { scope.current++; }; }, [userId, token]);
  const choosePhoto = async () => {
    if (busy) return;
    const generation = scope.current; setBusy(true); setError('');
    let temporary: string | undefined;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, exif: false });
      if (result.canceled || generation !== scope.current) return;
      const image = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 256 } }], { base64: true, compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      temporary = image.uri;
      if (generation !== scope.current) return;
      if (!image.base64 || image.base64.length > 2_800_000) throw new Error('Photo is too large');
      setPhoto(image.base64); setRemovePhoto(false);
    } catch { if (generation === scope.current) setError('Could not prepare this photo. Choose another image or retry.'); }
    finally {
      if (temporary && Platform.OS !== 'web' && FileSystem.cacheDirectory && temporary.startsWith(FileSystem.cacheDirectory)) {
        try { await FileSystem.deleteAsync(temporary, { idempotent: true }); } catch { /* The OS also clears temporary image files. */ }
      }
      if (generation === scope.current) setBusy(false);
    }
  };
  const importPhoto = async () => {
    if (busy || !query.data?.signInPhotoAvailable) return;
    const generation = scope.current; setBusy(true); setError('');
    try {
      const photo = await request<ImportedProfilePhoto>('/v1/me/profile/sign-in-photo', { token, method: 'POST', body: {} });
      if (generation !== scope.current) return;
      if (typeof photo.photoBase64 !== 'string' || !photo.photoBase64.startsWith('/9j/') || photo.photoBase64.length > 131_072) throw new Error('Invalid profile photo');
      setPhoto(photo.photoBase64); setRemovePhoto(false);
    } catch { if (generation === scope.current) setError('Could not import your sign-in photo. Choose a photo from your device instead, or retry.'); }
    finally { if (generation === scope.current) setBusy(false); }
  };
  const save = async () => {
    if (busy || [...bio.trim()].length > 280) return;
    const generation = scope.current; setBusy(true); setError('');
    try {
      const profile = await request<AccountProfile>('/v1/me/profile', { token, method: 'PUT', body: { bio: bio.trim(), photoBase64, removePhoto } });
      if (generation !== scope.current) return;
      client.setQueryData(key, profile); setEditing(false);
    } catch { if (generation === scope.current) setError('Could not save your profile. Your changes are still here. Please retry.'); }
    finally { if (generation === scope.current) setBusy(false); }
  };
  const preview = editing ? removePhoto ? null : photoBase64 ?? query.data?.photoBase64 : query.data?.photoBase64;
  return <Card>
    <View className="flex-row items-center gap-4">
      {preview ? <Image source={{ uri: `data:image/jpeg;base64,${preview}` }} accessibilityLabel={editing ? 'Profile photo preview' : 'Your profile photo'} contentFit="cover" style={{ width: 72, height: 72, borderRadius: 36, flexShrink: 0 }} />
        : <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="items-center justify-center rounded-full bg-ink" style={{width:72,height:72,flexShrink:0}}><Text maxFontSizeMultiplier={1.5} className="text-2xl font-bold" style={{ color: palette.hivis }}>{nickname.charAt(0).toUpperCase()}</Text></View>}
      <View className="flex-1 gap-1"><Text className="text-xs text-muted">Public nickname</Text><Text selectable className="text-xl font-bold text-ink">{nickname}</Text></View>
    </View>
    <Text className="text-sm leading-5 text-muted">Your photo and bio are private account settings. CivicLens reports use your nickname.</Text>
    {!available ? <Text className="text-sm leading-5 text-muted">Profile editing needs an updated CivicLens service.</Text>
      : query.isPending ? <Loading label="Loading your profile" />
      : query.isError ? <><Notice>Could not load your profile.</Notice><Button title="Retry profile" variant="secondary" onPress={() => void query.refetch()} /></>
      : editing ? <>
        <Button title="Choose profile photo" variant="secondary" icon="image-outline" disabled={busy} onPress={() => void choosePhoto()} />
        <Button title="Use sign-in photo" variant="secondary" icon="person-circle-outline" disabled={busy || !query.data.signInPhotoAvailable} onPress={() => void importPhoto()} />
        {!query.data.signInPhotoAvailable ? <Text className="text-xs leading-5 text-muted">A sign-in photo isn’t available for this account yet. Choose one from this device, or sign in again to check.</Text> : null}
        {preview ? <Button title="Remove profile photo" variant="quiet" disabled={busy} onPress={() => { setPhoto(null); setRemovePhoto(true); }} /> : null}
        <Field label="Bio" hint={`${[...bio].length} of 280 characters`} value={bio} onChangeText={setBio} multiline editable={!busy} style={{ minHeight: 100, textAlignVertical: 'top' }} placeholder="A little about you and your community" />
        {error ? <Notice>{error}</Notice> : null}
        <Button title="Save profile" busy={busy} disabled={[...bio.trim()].length > 280} onPress={() => void save()} />
        <Button title="Cancel editing" variant="quiet" disabled={busy} onPress={() => { scope.current++; setEditing(false); setError(''); }} />
      </> : <>
        <Text className="text-sm leading-6 text-ink">{query.data.bio || 'Add a short bio to make this account your own.'}</Text>
        <Button title="Edit profile" variant="secondary" icon="create-outline" onPress={() => { setBio(query.data.bio); setPhoto(null); setRemovePhoto(false); setEditing(true); setError(''); }} />
      </>}
  </Card>;
}
