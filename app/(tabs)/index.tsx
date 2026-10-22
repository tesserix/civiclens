import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as LocationService from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Brand, Button, Field, Notice } from '../../src/ui';
import { useSession } from '../../src/session';
import { useDraft } from '../../src/useDraft';
import { request } from '../../src/api';
import { categories, categoryLabels, channels, type Report } from '../../shared/contracts';

export default function Capture() {
  const { session } = useSession();
  const { draft, update, ready, error: draftError, save, reset } = useDraft(session?.user.id || '');
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const client = useQueryClient(); const router = useRouter();
  const submit = useMutation({ mutationFn: async () => {
    if (!session || !draft.location) throw new Error('Sign in and confirm the location first.');
    await save();
    const photoBase64 = Platform.OS === 'web' ? await webBase64(draft.photoUri) : await FileSystem.readAsStringAsync(draft.photoUri, { encoding: FileSystem.EncodingType.Base64 });
    return request<Report>('/v1/reports', { token: session.token, method: 'POST', key: draft.key,
      body: { category: draft.category, description: draft.description, location: draft.location, photoBase64, channels: draft.channels, consent: draft.consent } });
  }, onSuccess: async () => {
    await reset();
    await client.invalidateQueries({ queryKey: ['reports', session?.user.id] });
    router.push('/(tabs)/reports');
  } });
  const photo = async (camera: boolean) => {
    setWorking('photo'); setError('');
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Camera access is off. You can choose an existing photo instead, or enable access in Settings.');
      }
      const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
      if (!result.canceled) {
        const compressed = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 1600 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
        let uri = compressed.uri;
        if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
          uri = `${FileSystem.documentDirectory}civiclens-draft-${session?.user.id}.jpg`;
          await FileSystem.copyAsync({ from: compressed.uri, to: uri });
        }
        update({ photoUri: uri });
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open the camera. Please retry.'); }
    finally { setWorking(''); }
  };
  const locate = async () => {
    setWorking('location'); setError('');
    try {
      const permission = await LocationService.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location access is off. Enable it in Settings to attach the issue’s location.');
      const position = await LocationService.getCurrentPositionAsync({ accuracy: LocationService.Accuracy.Balanced });
      let countryCode = ''; let locality = '';
      try {
        const [place] = await LocationService.reverseGeocodeAsync(position.coords);
        countryCode = place?.isoCountryCode || ''; locality = [place?.city || place?.district, place?.region].filter(Boolean).join(', ');
      } catch { setError('Location captured. Please enter the locality and two-letter country code below.'); }
      update({ location: { latitude: position.coords.latitude, longitude: position.coords.longitude, countryCode, locality } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not capture location. Please retry.'); }
    finally { setWorking(''); }
  };
  if (!ready) return <SafeAreaView className="flex-1 items-center justify-center bg-canvas"><ActivityIndicator color="#163D32" /></SafeAreaView>;
  const valid = draft.photoUri && draft.location && /^[A-Z]{2}$/.test(draft.location.countryCode) && draft.location.locality.trim().length > 1 && draft.description.trim().length >= 10 && draft.consent && draft.channels.length > 0;
  return <SafeAreaView edges={['top','left','right']} className="flex-1 bg-canvas"><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }}>
      <View className="flex-row items-center justify-between"><Brand /><View className="flex-row items-center gap-1.5 rounded-full bg-mint px-3 py-2"><Ionicons name="shield-checkmark" size={13} color="#163D32" /><Text className="text-xs font-semibold text-forest">Nickname only</Text></View></View>
      <View className="gap-2"><Text className="text-xs font-semibold tracking-[3px] text-muted">NOTICE. CAPTURE. MAKE A DIFFERENCE.</Text><Text className="text-[34px] font-bold leading-[40px] tracking-tight text-ink">A better place{`\n`}starts with you.</Text><Text className="text-sm leading-6 text-muted">Share what needs care. We’ll help it reach the right office.</Text></View>
      {draft.photoUri ? <View className="gap-3"><Image source={{ uri: draft.photoUri }} contentFit="cover" style={{ height: 240, borderRadius: 26 }} accessibilityLabel="Your report photo" /><Button title="Retake photo" secondary icon="camera-outline" onPress={() => void photo(true)} disabled={submit.isPending} /></View>
        : <View className="gap-5 rounded-[28px] bg-forest p-6"><View className="h-16 w-16 items-center justify-center rounded-2xl bg-mint"><Ionicons name="camera-outline" size={32} color="#163D32" /></View><View><Text className="text-2xl font-semibold text-white">One photo. A first step.</Text><Text className="mt-2 text-sm leading-6 text-emerald-100">Litter, broken roads, polluted water.{`\n`}Show the issue from a safe distance.</Text></View><Button title="Take a photo" icon="camera" secondary busy={working === 'photo'} onPress={() => void photo(true)} /></View>}
      <Button title="Choose from photos" secondary icon="images-outline" disabled={working !== '' || submit.isPending} onPress={() => void photo(false)} />
      <View className="gap-3"><Text className="text-lg font-semibold text-ink">What needs attention?</Text><View className="flex-row flex-wrap gap-2">{categories.map(category => <Pressable key={category} accessibilityRole="radio" accessibilityState={{ checked: draft.category === category }} disabled={submit.isPending} onPress={() => update({ category })}
        className={`min-h-12 justify-center rounded-full border px-4 py-3 ${draft.category === category ? 'border-forest bg-mint' : 'border-line bg-white'}`}><Text className={`text-sm ${draft.category === category ? 'font-semibold text-forest' : 'text-muted'}`}>{categoryLabels[category]}</Text></Pressable>)}</View></View>
      <Field label="A little context" placeholder="What did you see? Describe the issue, without naming private individuals." multiline maxLength={500} value={draft.description} editable={!submit.isPending} onChangeText={description => update({ description })} />
      <View className="gap-3 rounded-3xl border border-line bg-white p-5"><View className="flex-row items-center gap-2"><Ionicons name="location-outline" size={22} color="#163D32" /><Text className="text-lg font-semibold text-ink">Where is it?</Text></View><Text className="text-sm leading-6 text-muted">Capture your current location at the issue. Confirm the suggested place before submitting.</Text>
        <Button title={draft.location ? 'Update current location' : 'Use current location'} secondary busy={working === 'location'} disabled={submit.isPending} onPress={() => void locate()} />
        {draft.location ? <><Text className="text-xs text-muted">{draft.location.latitude.toFixed(5)}, {draft.location.longitude.toFixed(5)} · exact coordinates stay private</Text><Field label="Locality / city" value={draft.location.locality} maxLength={120} editable={!submit.isPending} onChangeText={locality => update({ location: { ...draft.location!, locality } })} /><Field label="Country code" placeholder="IN, AU, GB…" autoCapitalize="characters" maxLength={2} value={draft.location.countryCode} editable={!submit.isPending} onChangeText={countryCode => update({ location: { ...draft.location!, countryCode: countryCode.toUpperCase() } })} /></> : null}
      </View>
      <View className="gap-3"><Text className="text-lg font-semibold text-ink">Let it be seen</Text><Text className="text-sm leading-6 text-muted">Choose requested destinations. Posting starts after review and requires a connected, supported account.</Text><View className="flex-row flex-wrap gap-2">{channels.map(channel => <Pressable key={channel} accessibilityRole="checkbox" accessibilityState={{ checked: draft.channels.includes(channel) }} disabled={submit.isPending}
        onPress={() => update({ channels: draft.channels.includes(channel) ? draft.channels.filter(c => c !== channel) : [...draft.channels, channel] })}
        className={`min-h-12 flex-row items-center gap-2 rounded-full border px-4 py-3 ${draft.channels.includes(channel) ? 'border-forest bg-mint' : 'border-line bg-white'}`}><Ionicons name={channel === 'facebook' ? 'logo-facebook' : channel === 'instagram' ? 'logo-instagram' : 'logo-whatsapp'} size={18} color="#163D32" /><Text className="text-sm capitalize text-forest">{channel}</Text></Pressable>)}</View></View>
      <View className="flex-row items-start gap-3 rounded-2xl bg-mint p-4"><Switch accessibilityLabel="Consent to reviewed public sharing" value={draft.consent} disabled={submit.isPending} onValueChange={consent => update({ consent })} trackColor={{ true: '#163D32' }} /><Text className="flex-1 text-sm leading-6 text-forest">I agree to public sharing after review, using my nickname and an approximate location. I have checked the photo for identifying details.</Text></View>
      {draftError || error || submit.error ? <Notice>{draftError || error || submit.error?.message}</Notice> : null}
      <Button title="Submit report" icon="arrow-forward" busy={submit.isPending} disabled={!valid || working !== ''} onPress={() => submit.mutate()} />
      <Text className="text-center text-xs leading-5 text-muted">{Platform.OS === 'web' ? 'Browser drafts last while this page stays open.' : 'Your draft stays on this device until you submit.'}{`\n`}In immediate danger? Contact local emergency services.</Text>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

async function webBase64(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Could not read the selected photo.')); reader.readAsDataURL(blob); });
}
