import { Text } from '../../src/text';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Field, Loading, Notice, Step, Title, Viewfinder, palette } from '../../src/ui';
import { useSession } from '../../src/session';
import { draftPhotos, isDraftPhotoUri, useDraft } from '../../src/useDraft';
import { preparePhoto } from '../../src/report-photo';
import { photoCoordinates, selectPhotoLocation } from '../../src/photo-location';
import { captureWithLocation } from '../../src/camera-location';
import { pointLocation } from '../../src/location';
import { PlacePicker } from '../../src/place-picker';
import { useDeviceLocation } from '../../src/useDeviceLocation';
import { request } from '../../src/api';
import { WritingAssist } from '../../src/writing-assist';
import { SocialDestinationSelect } from '../../src/social-destination-select';
import {HashtagSelect} from '../../src/hashtag-select';
import { AuthorityPreview } from '../../src/authority-preview';
import { CategorySelect, LocationFields } from '../../src/report-details';
import { channels, communityRulesVersion, type AuthorityPreview as Preview, type Capabilities, type Report } from '../../shared/contracts';


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
  const photos = draftPhotos(draft);
  const sharingMode = 'manual' as const;
  const manualReady = capabilities.data?.manualSharing === true;
  const availableChannels = channels.filter(channel => capabilities.data?.manualShareChannels?.includes(channel) ?? channel !== 'tiktok');
  const destinationsReady = draft.channels.every(channel => availableChannels.includes(channel));
  const maxPhotos = capabilities.data?.maxPhotos === 5 ? 5 : 1;
  const rulesReady = capabilities.data?.communityRulesVersion === communityRulesVersion;
  const rulesAccepted = draft.communityRulesVersion === communityRulesVersion;
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
  const readPhoto = (uri = draft.photoUri) => Platform.OS === 'web' ? webBase64(uri) : FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const submit = useMutation({ mutationFn: async () => {
    if (!session || !draft.location) throw new Error('Sign in and confirm the location first.');
    if (draft.hashtags !== undefined && capabilities.data?.hashtagSelection !== true) throw new Error('Hashtag choices can’t be saved right now. Please retry shortly.');
    if (!destinationsReady) throw new Error('Some saved destinations are unavailable. Keep your draft and retry or change your selection.');
    if (!manualReady) throw new Error('Sharing with your own apps is being updated. Keep your draft and retry with the latest CivicLens.');
    if (!rulesReady || !rulesAccepted) throw new Error('Read and accept the current community rules before submitting.');
    if (photos.length>maxPhotos) throw new Error('Extra photos are temporarily unavailable. Keep your draft and retry shortly.');
    await save();
    const additionalPhotosBase64: string[] = [];
    for (const uri of photos.slice(1)) additionalPhotosBase64.push(await readPhoto(uri));
    const photoBase64 = await readPhoto();
    return request<Report>('/v1/reports', { token: session.token, method: 'POST', key: draft.key, timeoutMs: 90000,
      body: { category: draft.category, description: draft.description, location: draft.location, photoBase64, additionalPhotosBase64, locationSource: draft.locationSource, communityRulesVersion, ...(capabilities.data?.complaintPreparation===true && draft.complaintRequested===true ? {complaintRequested:true} : {}), ...(capabilities.data?.manualSharing === true ? {sharingMode} : {}), channels: draft.channels, consent: draft.consent, ...(draft.hashtags === undefined ? {} : {hashtags:draft.hashtags}) } });
  }, onSuccess: async () => {
    await reset();
    await client.invalidateQueries({ queryKey: ['reports', session?.user.id] });
    router.push('/(tabs)/reports');
  } });
  const photoGeneration = useRef(0);
  const photo = async (camera: boolean, replace = false) => {
    const run = ++photoGeneration.current;
    const active = () => run === photoGeneration.current;
    setWorking('photo'); setError(null);
    const prepared: string[] = []; let assigned = false;
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Camera access is off. You can choose an existing photo instead, or enable access in Settings.');
      }
      const replacing = !draft.photoUri || replace || maxPhotos === 1;
      const remaining = replacing ? maxPhotos : maxPhotos - photos.length;
      if (remaining<1) throw new Error('You can attach at most five photos. Remove a photo to add another.');
      const captured = camera ? await captureWithLocation(() => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, exif: true })) : null;
      const result = captured ? captured.result : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: true, allowsMultipleSelection: remaining > 1, selectionLimit: remaining });
      if (!active()) return;
      if (!result.canceled) {
        if (result.assets.length>remaining) throw new Error('Choose no more than five photos for one report.');
        const metadataPoint = photoCoordinates(result.assets[0].exif);
        const point = metadataPoint || captured?.point || null;
        const inferred = replacing && point && draft.locationSource !== 'manual' ? await pointLocation(point) : null;
        if (!active()) return;
        for (const asset of result.assets) {
          prepared.push(await preparePhoto(asset.uri));
          if (!active()) return;
        }
        const next = replacing ? replace ? [prepared[0], ...photos.slice(1)] : prepared : [...photos, ...prepared];
        update({photoUri:next[0], additionalPhotoUris:next.slice(1), ...(replacing ? selectPhotoLocation(draft,inferred,metadataPoint ? 'photo' : camera ? 'camera' : 'photo') : {})}); assigned = true;
      }
    } catch (e) { setError({ step: 'photo', message: e instanceof Error ? e.message : 'Could not open the camera. Please retry.' }); }
    finally {
      if (!assigned && Platform.OS!=='web') for (const uri of prepared.filter(isDraftPhotoUri)) {try {await FileSystem.deleteAsync(uri,{idempotent:true});} catch { /* Keep the original picker error visible during a storage outage. */ }}
      setWorking('');
    }
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
  const shared = draft.consent && (draft.channels.length > 0 || (draft.complaintRequested===true && capabilities.data?.complaintPreparation===true)) && rulesAccepted && rulesReady && manualReady && destinationsReady;
  const locked = submit.isPending || discarding || confirmDiscard;
  const availabilityError = capabilities.isError && !capabilities.data;
  const submissionHint = working === 'photo' ? 'Preparing your photo…'
    : deviceLocation.busy ? 'Waiting for your device location…'
    : !draft.photoUri ? 'Before submitting, add at least one photo.'
    : !located ? 'Before submitting, choose and confirm the issue location.'
    : !described ? 'Before submitting, write at least 10 characters in Description.'
    : capabilities.isPending ? 'Checking reporting availability…'
    : !manualReady || !rulesReady ? 'Reporting is temporarily unavailable. Keep your draft and retry.'
    : !destinationsReady ? 'Before submitting, update the unavailable social destinations.'
    : !draft.channels.length && !(draft.complaintRequested && capabilities.data?.complaintPreparation) ? 'Before submitting, choose a sharing destination.'
    : !draft.consent ? 'Before submitting, confirm consent to reviewed sharing.'
    : !rulesAccepted ? 'Before submitting, accept the community rules.' : '';
  const removePhoto = (index: number) => {
    const remaining = photos.filter((_,i)=>i!==index);
    const clearLocation = index===0 && (draft.locationSource==='photo' || draft.locationSource==='camera');
    update({photoUri:remaining[0] || '',additionalPhotoUris:remaining.slice(1),...(clearLocation ? {location:null,locationSource:undefined} : {})});
  };
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

      <Step number={1} title="Add photos" done={!!draft.photoUri}>
        <Viewfinder className="p-2">
          {draft.photoUri ? <Image source={{ uri: draft.photoUri }} contentFit="cover" style={{ height: 240, borderRadius: 12 }} accessibilityLabel="Your report photo" />
            : <Pressable accessibilityRole="button" accessibilityLabel="Take a photo" disabled={working !== '' || locked} onPress={() => void photo(true)}
              className="min-h-56 items-center justify-center gap-3 rounded-xl bg-ink px-6" style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
              {working === 'photo' ? <ActivityIndicator color={palette.hivis} /> : <Ionicons name="camera" size={34} color={palette.hivis} />}
              <Text className="text-lg font-semibold text-white">Take a photo</Text>
              <Text className="text-center text-sm leading-5 text-white/70">Keep a safe distance. Leave faces and number plates out of frame.</Text>
            </Pressable>}
        </Viewfinder>
        <View className={width < 380 || fontScale > 1.2 ? 'gap-2' : 'flex-row gap-2'}>
          {draft.photoUri ? <View className="flex-1"><Button title="Retake" variant="secondary" compact icon="camera-outline" disabled={working !== '' || locked} onPress={() => void photo(true, true)} /></View> : null}
          <View className="flex-1"><Button title="Choose from photos" variant="secondary" compact icon="images-outline" disabled={working !== '' || locked || (maxPhotos>1 && photos.length>=maxPhotos)} onPress={() => void photo(false)} /></View>
        </View>
        <Text className="text-sm text-muted">{photos.length} of {maxPhotos} photos</Text>
        {draft.photoUri ? <Button title="Remove photo 1" variant="quiet" compact disabled={working!=='' || locked} onPress={()=>removePhoto(0)}/> : null}
        {photos.length>1 ? <View className="flex-row flex-wrap gap-3">{photos.slice(1).map((uri,index)=><View key={uri} className="gap-1"><Image source={{uri}} contentFit="cover" style={{width:120,height:100,borderRadius:12}} accessibilityLabel={`Report photo ${index+2}`}/><Button title={`Remove photo ${index+2}`} variant="quiet" compact disabled={working!=='' || locked} onPress={()=>removePhoto(index+1)}/></View>)}</View> : null}
        {draft.photoUri && photos.length<maxPhotos ? <Button title="Add camera photo" variant="secondary" compact icon="camera-outline" disabled={working!=='' || locked} onPress={()=>void photo(true)}/> : null}
        <Text className="text-xs leading-5 text-muted">Use photos of the same issue at one location. The first photo sets the suggested location and is used for writing help. Check every photo before sharing.</Text>
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
        <Text className="text-sm leading-5 text-muted">You choose the group, Channel or account in your social app after review. You own the community and manage its members there. Select one, several or all destinations. Your social profile, username or phone number may be visible; the caption credits your CivicLens nickname.</Text>
        {!manualReady && capabilities.isSuccess ? <Notice>Sharing with your own apps is being updated. Keep your draft and retry with the latest CivicLens.</Notice> : null}
        {!destinationsReady ? <Notice>Some saved destinations are unavailable. Keep your draft and retry or change your selection.</Notice> : null}
        <SocialDestinationSelect value={draft.channels} options={availableChannels} disabled={locked} onChange={channels => update({channels})}/>
        {capabilities.data?.complaintPreparation===true?<View className="flex-row items-start gap-3 rounded-xl border border-line bg-surface p-4"><Text className="flex-1 text-sm leading-5 text-ink">Prepare a complaint for the responsible body after review. You will confirm the destination and finish on its official form. You can use this without social apps.</Text><Switch accessibilityLabel="Request official complaint preparation" value={draft.complaintRequested===true} disabled={locked} onValueChange={complaintRequested=>update({complaintRequested})} trackColor={{true:palette.brand}}/></View>:null}
        <View className="flex-row items-start gap-3 rounded-xl border border-line bg-surface p-4">
          <Text className="flex-1 text-sm leading-5 text-ink">I agree to prepare my selected destinations after review, using my nickname and an approximate location. I’ve checked every photo for identifying details.</Text>
          <Switch accessibilityLabel="Consent to reviewed public sharing" value={draft.consent} disabled={locked} onValueChange={consent => update({ consent })} trackColor={{ true: palette.brand }} />
        </View>
        <View className="gap-3 rounded-xl border border-line bg-surface p-4">
          <Text accessibilityRole="header" className="font-semibold text-ink">Our community rules</Text>
          <Text className="text-sm leading-6 text-muted">Keep it respectful: no hate, profanity, threats, harassment or personal attacks. Humour about the situation is welcome; humiliating a person is not.{`\n\n`}Share truthful evidence you have the right to share. Don’t invent a culprit or an official response. Keep private names, faces, number plates, children and precise home addresses out of public reports.{`\n\n`}Use photos of the same issue at one confirmed location. Every photo and public caption needs review. Hashtags do not guarantee that an authority has been notified. For emergencies, contact local emergency services.</Text>
          <View className="flex-row items-center gap-3"><Text className="flex-1 text-sm leading-5 text-ink">I have read and accept these community rules.</Text><Switch accessibilityLabel="Accept community rules" value={rulesAccepted} disabled={locked} onValueChange={accepted=>update({communityRulesVersion:accepted ? communityRulesVersion : undefined})} trackColor={{true:palette.brand}}/></View>
          {!rulesReady && capabilities.isSuccess ? <Notice>Reporting is being updated. Your draft is safe; please retry shortly or update CivicLens.</Notice> : null}
        </View>
      </Step>

      <View className="gap-3">
        {draftError || submit.error ? <Notice>{draftError || submit.error?.message}</Notice> : null}
        {availabilityError ? <>
          <Notice>Could not check reporting availability. Your draft is safe. Retry to continue.</Notice>
          <Button title="Retry reporting availability" variant="secondary" busy={capabilities.isFetching} disabled={locked} onPress={() => void capabilities.refetch()} />
        </> : null}
        {submissionHint && !locked && !availabilityError ? <Text accessibilityLiveRegion="polite" className="text-sm leading-5 text-muted">{submissionHint}</Text> : null}
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
