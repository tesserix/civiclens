import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Chip, Field, Loading, Notice, Step, Title, Viewfinder, palette } from '../../src/ui';
import { useSession } from '../../src/session';
import { useDraft } from '../../src/useDraft';
import { preparePhoto } from '../../src/report-photo';
import { photoCoordinates, selectPhotoLocation } from '../../src/photo-location';
import { captureWithLocation } from '../../src/camera-location';
import { pointLocation } from '../../src/location';
import { PlacePicker } from '../../src/place-picker';
import { useDeviceLocation } from '../../src/useDeviceLocation';
import { request } from '../../src/api';
import { WritingAssist } from '../../src/writing-assist';
import {HashtagSelect} from '../../src/hashtag-select';
import { AuthorityPreview } from '../../src/authority-preview';
import { CategorySelect, LocationFields } from '../../src/report-details';
import { channels, type AuthorityPreview as Preview, type Capabilities, type Report } from '../../shared/contracts';

const channelIcons = { facebook: 'logo-facebook', instagram: 'logo-instagram', whatsapp: 'logo-whatsapp' } as const;
const channelLabels = { facebook: 'Facebook', instagram: 'Instagram', whatsapp: 'WhatsApp' } as const;

export default function Capture() {
  const { width, fontScale } = useWindowDimensions();
  const { session } = useSession();
  const { draft, update, ready, error: draftError, save, reset } = useDraft(session?.user.id || '');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState('');
  const [formVersion, setFormVersion] = useState(0);
  const [working, setWorking] = useState<'photo' | ''>('');
  const [error, setError] = useState<{ step: 'photo'; message: string } | null>(null);
  const client = useQueryClient(); const router = useRouter();
  const capabilities = useQuery({ queryKey: ['capabilities'], queryFn: ({ signal }) => request<Capabilities>('/v1/capabilities', { signal }) });
  const [authorityRetry,setAuthorityRetry]=useState(0);
  const authorityScope=JSON.stringify([session?.user.id,draft.category,draft.location,authorityRetry]);
  const [resolvedAuthority,setResolvedAuthority]=useState<{scope:string;result:Preview|null;error:boolean}|null>(null);
  const authorityResolved=useCallback((result:Preview|null,error=false)=>setResolvedAuthority({scope:authorityScope,result,error}),[authorityScope]);
  const suggestions=resolvedAuthority?.scope===authorityScope ? resolvedAuthority : null;
  const hashtagOptions=suggestions?.result?.status==='matched' ? suggestions.result.hashtags || [] : [];
  const hashtagsBusy=!!draft.photoUri && !!draft.location && capabilities.data?.authorityPreview===true && !suggestions?.result && !suggestions?.error;
  useEffect(()=>{
    const result=suggestions?.result;
    if (!result || draft.hashtags===undefined) return;
    const allowed=result.status==='matched' ? result.hashtags || [] : [];
    const next=allowed.filter(tag=>draft.hashtags?.includes(tag));
    if (JSON.stringify(next)!==JSON.stringify(draft.hashtags)) update({hashtags:next});
  },[suggestions?.result,draft.hashtags,update]);
  const retryHashtags=()=>setAuthorityRetry(value=>value+1);
  const chooseHashtags=(hashtags:string[])=>update({hashtags});
  const readPhoto = () => Platform.OS === 'web' ? webBase64(draft.photoUri) : FileSystem.readAsStringAsync(draft.photoUri, { encoding: FileSystem.EncodingType.Base64 });
  const submit = useMutation({ mutationFn: async () => {
    if (!session || !draft.location) throw new Error('Sign in and confirm the location first.');
    if (draft.hashtags !== undefined && capabilities.data?.hashtagSelection !== true) throw new Error('Hashtag choices can’t be saved right now. Please retry shortly.');
    await save();
    const photoBase64 = await readPhoto();
    return request<Report>('/v1/reports', { token: session.token, method: 'POST', key: draft.key,
      body: { category: draft.category, description: draft.description, location: draft.location, photoBase64, channels: draft.channels, consent: draft.consent, ...(draft.hashtags === undefined ? {} : {hashtags:draft.hashtags}) } });
  }, onSuccess: async () => {
    await reset();
    await client.invalidateQueries({ queryKey: ['reports', session?.user.id] });
    router.push('/(tabs)/reports');
  } });
  const photoGeneration = useRef(0);
  const photo = async (camera: boolean) => {
    const run = ++photoGeneration.current;
    const active = () => run === photoGeneration.current;
    setWorking('photo'); setError(null);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Camera access is off. You can choose an existing photo instead, or enable access in Settings.');
      }
      const captured = camera ? await captureWithLocation(() => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, exif: true })) : null;
      const result = captured ? captured.result : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: true });
      if (!active()) return;
      if (!result.canceled) {
        const metadataPoint = photoCoordinates(result.assets[0].exif);
        const point = metadataPoint || captured?.point || null;
        const inferred = point && draft.locationSource !== 'manual' ? await pointLocation(point) : null;
        if (!active()) return;
        const uri = await preparePhoto(result.assets[0].uri);
        if (!active()) return;
        update({ photoUri: uri, ...selectPhotoLocation(draft, inferred, metadataPoint ? 'photo' : camera ? 'camera' : 'photo') });
      }
    } catch (e) { setError({ step: 'photo', message: e instanceof Error ? e.message : 'Could not open the camera. Please retry.' }); }
    finally { setWorking(''); }
  };
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); photoGeneration.current++; };  }, []));
  const deviceLocation = useDeviceLocation(ready && focused && !submit.isPending && !confirmDiscard && !discarding && working !== 'photo', draft.location, location => update({ location, locationSource: 'device' }), !draft.photoUri);
  const discard = async () => {
    setDiscarding(true); setDiscardError(''); photoGeneration.current++;
    try {
      await reset();
      setError(null); submit.reset(); setResolvedAuthority(null);
      setAuthorityRetry(0); setFormVersion(value => value + 1); setConfirmDiscard(false);
    } catch { setDiscardError('Could not discard your draft. Please retry.'); }
    finally { setDiscarding(false); }
  };
  if (!ready) return <SafeAreaView className="flex-1 justify-center bg-canvas"><Loading label="Opening your draft" /></SafeAreaView>;
  const located = !!draft.location && /^[A-Z]{2}$/.test(draft.location.countryCode) && draft.location.locality.trim().length > 1;
  const described = draft.description.trim().length >= 10;
  const shared = draft.consent && draft.channels.length > 0;
  const locked = submit.isPending || discarding || confirmDiscard;
  const stepError = (step: 'photo') => error?.step === step ? <Notice>{error.message}</Notice> : null;
  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas"><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView key={formVersion} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 32, paddingBottom: 40, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
      <Title subtitle="Nothing is shared until a reviewer has checked it.">Report an issue</Title>

      {confirmDiscard ? <View className="gap-3 rounded-xl border border-line bg-surface p-4">
        <Text accessibilityRole="header" className="text-lg font-semibold text-ink">Discard this draft?</Text>
        <Text className="text-sm leading-5 text-muted">This removes the draft photo, description, location and sharing choices from CivicLens on this device. Your original photo and submitted reports are kept.</Text>
        {discardError ? <Notice>{discardError}</Notice> : null}
        <Button title="Discard and start again" busy={discarding} onPress={() => void discard()} />
        <Button title="Keep draft" variant="secondary" disabled={discarding} onPress={() => { setConfirmDiscard(false); setDiscardError(''); }} />
      </View> : <Button title="Discard draft" variant="quiet" icon="trash-outline" disabled={submit.isPending || working !== ''} onPress={() => setConfirmDiscard(true)} />}

      <Step number={1} title="Take a photo" done={!!draft.photoUri}>
        <Viewfinder className="p-2">
          {draft.photoUri ? <Image source={{ uri: draft.photoUri }} contentFit="cover" style={{ height: 240, borderRadius: 12 }} accessibilityLabel="Your report photo" />
            : <Pressable accessibilityRole="button" accessibilityLabel="Take a photo" disabled={working !== '' || locked} onPress={() => void photo(true)}
              className="h-56 items-center justify-center gap-3 rounded-xl bg-ink px-6" style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
              {working === 'photo' ? <ActivityIndicator color={palette.hivis} /> : <Ionicons name="camera" size={34} color={palette.hivis} />}
              <Text className="text-lg font-semibold text-white">Take a photo</Text>
              <Text className="text-center text-sm leading-5 text-white/70">Keep a safe distance. Leave faces and number plates out of frame.</Text>
            </Pressable>}
        </Viewfinder>
        <View className={width < 380 || fontScale > 1.2 ? 'gap-2' : 'flex-row gap-2'}>
          {draft.photoUri ? <View className="flex-1"><Button title="Retake" variant="secondary" compact icon="camera-outline" disabled={working !== '' || locked} onPress={() => void photo(true)} /></View> : null}
          <View className="flex-1"><Button title="Choose from photos" variant="secondary" compact icon="images-outline" disabled={working !== '' || locked} onPress={() => void photo(false)} /></View>
        </View>
        {stepError('photo')}
      </Step>

      <Step number={2} title="What kind of issue?" done>
        <CategorySelect value={draft.category} disabled={locked} onChange={category => update({ category })} />
      </Step>

      <Step number={3} title="Where is it?" done={located}>
        {draft.location ? <LocationFields value={draft.location} disabled={locked || deviceLocation.busy || working === 'photo'} onChange={location => update({ location, locationSource: 'manual' })} /> : <Text className="text-sm leading-5 text-muted">{draft.photoUri ? 'This photo has no usable location. Choose where the issue happened, or use your current location if you are still there.' : 'We detect your device location automatically. Stay near the issue and check the suggested place.'}</Text>}
        {draft.location ? <Text className="text-xs leading-5 text-muted">{draft.locationSource === 'manual' ? 'Location chosen by you.' : draft.locationSource === 'photo' ? 'Location suggested from photo metadata. Check that it matches the issue.' : draft.locationSource === 'camera' ? 'Device location recorded with this camera photo.' : 'Current device location. Check that this is where the issue happened.'}</Text> : null}
        <PlacePicker disabled={locked || deviceLocation.busy || working === 'photo'} onChoose={location => update({location, locationSource:'manual'})}/>
        {deviceLocation.busy ? <Text accessibilityLiveRegion="polite" className="text-sm text-muted">Detecting your device location…</Text> : null}
        <Button title="Use current device location" variant="secondary" compact icon="navigate-outline" busy={deviceLocation.busy} disabled={working === 'photo' || locked} onPress={() => void deviceLocation.locate()} />
        {deviceLocation.error ? <Notice>{deviceLocation.error}</Notice> : null}
        {deviceLocation.settingsNeeded && Platform.OS !== 'web' ? <Button title="Open location settings" variant="secondary" onPress={() => void deviceLocation.openSettings()} /> : null}
        {session ? <AuthorityPreview retryKey={authorityRetry} onResolve={authorityResolved} automatic={!!draft.photoUri} userId={session.user.id} token={session.token} category={draft.category} location={draft.location} available={capabilities.data?.authorityPreview === true} disabled={locked || working !== '' || deviceLocation.busy} /> : null}
      </Step>

      <Step number={4} title="Describe it" done={described}>
        <Field label="Description" hint={`${draft.description.trim().length} of 1000 characters, at least 10. Don’t name private individuals.`}
          placeholder="What did you see, and where exactly?" multiline maxLength={1000} autoCorrect spellCheck value={draft.description} editable={!locked}
          onChangeText={description => update({ description })} style={{ minHeight: 120, textAlignVertical: 'top' }} />
        <HashtagSelect suggestions={hashtagOptions} selected={draft.hashtags} onChange={chooseHashtags} loading={hashtagsBusy} error={suggestions?.error} onRetry={retryHashtags} disabled={locked || working !== '' || deviceLocation.busy}/>
        {session ? <WritingAssist userId={session.user.id} token={session.token} category={draft.category} description={draft.description}
          hasPhoto={!!draft.photoUri} readPhoto={readPhoto} onUse={description => update({ description })} disabled={locked || working !== ''}
          available={capabilities.data?.assist === true} sourceId={draft.photoUri} location={draft.location} contextual={capabilities.data?.assistContext === true} suggestedHashtags={hashtagOptions} selectedHashtags={draft.hashtags} onHashtagsChange={chooseHashtags} hashtagsBusy={hashtagsBusy} hashtagsError={suggestions?.error} onHashtagsRetry={retryHashtags} /> : null}
      </Step>

      <Step number={5} title="Share after review" done={shared}>
        <Text className="text-sm leading-5 text-muted">Pick where it should be posted. Posting starts after review, through a connected, supported account.</Text>
        <View className="flex-row flex-wrap gap-2">
          {channels.map(channel => <Chip key={channel} role="checkbox" label={channelLabels[channel]} icon={channelIcons[channel]} selected={draft.channels.includes(channel)} disabled={locked}
            onPress={() => update({ channels: draft.channels.includes(channel) ? draft.channels.filter(c => c !== channel) : [...draft.channels, channel] })} />)}
        </View>
        <View className="flex-row items-start gap-3 rounded-xl border border-line bg-surface p-4">
          <Text className="flex-1 text-sm leading-5 text-ink">I agree to public sharing after review, using my nickname and an approximate location. I’ve checked the photo for identifying details.</Text>
          <Switch accessibilityLabel="Consent to reviewed public sharing" value={draft.consent} disabled={locked} onValueChange={consent => update({ consent })} trackColor={{ true: palette.brand }} />
        </View>
      </Step>

      <View className="gap-3">
        {draftError || submit.error ? <Notice>{draftError || submit.error?.message}</Notice> : null}
        <Button title="Submit report" icon="send" busy={submit.isPending} disabled={locked || !draft.photoUri || !located || !described || !shared || working !== '' || deviceLocation.busy} onPress={() => submit.mutate()} />
        <Text className="text-center text-xs leading-5 text-muted">{Platform.OS === 'web' ? 'Browser drafts last while this page stays open.' : 'Your draft stays on this device until you submit or discard it.'}{`\n`}In immediate danger? Contact local emergency services.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

async function webBase64(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Could not read the selected photo.')); reader.readAsDataURL(blob); });
}
