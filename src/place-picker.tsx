import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Location } from '../shared/contracts';
import { searchLocations } from './location';
import { Button, Field, Notice } from './ui';

export function PlacePicker({ onChoose, disabled = false }: { onChoose: (place: Location) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Location[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const current = useRef({disabled,onChoose}); current.current = {disabled,onChoose};
  const close = () => { generation.current++; setOpen(false); setBusy(false); };
  useEffect(() => { if (disabled) {generation.current++;setOpen(false);setBusy(false);} }, [disabled]);
  useEffect(() => () => {generation.current++;}, []);
  const find = async () => {
    if (busy || current.current.disabled) return;
    const run = ++generation.current; setBusy(true); setError(''); setPlaces([]);
    try {
      const found = await searchLocations(query);
      if (generation.current !== run || current.current.disabled) return;
      setPlaces(found);
      if (!found.length) setError('No matching place found. Try a town or address with its state and country.');
    } catch {
      if (generation.current === run) setError('Place search is unavailable. Check your connection and try again.');
    } finally {if(generation.current === run)setBusy(false);}
  };
  return <>
    <Button title="Change issue location" variant="secondary" compact icon="map-outline" disabled={disabled} onPress={()=>{setOpen(true);setQuery('');setPlaces([]);setError('');}} />
    <Modal visible={open && !disabled} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView className="flex-1 bg-canvas">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS==='ios'?'padding':'height'}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,gap:20,paddingBottom:40}}>
            <View className="flex-row items-center gap-3"><Text accessibilityRole="header" className="flex-1 text-xl font-bold text-ink">Issue location</Text><Button title="Cancel" variant="quiet" compact onPress={close}/></View>
            <Text className="text-sm leading-6 text-muted">Search for where the issue happened. Choose the closest matching place; the location point determines the responsible council.</Text>
            <Field label="Search issue location" placeholder="Town, suburb or address, state and country" value={query} maxLength={180} editable={!busy} onChangeText={text=>{setQuery(text);setPlaces([]);setError('');}} onSubmitEditing={()=>void find()} returnKeyType="search" />
            <Button title="Find places" variant="secondary" busy={busy} disabled={busy || query.trim().length<2} onPress={()=>void find()}/>
            {places.map(place=><View key={`${place.latitude},${place.longitude}`} className="gap-2 rounded-xl border border-line bg-surface p-4">
              <Text className="text-base font-semibold text-ink">{place.locality}, {place.countryCode}</Text>
              <Text className="text-xs text-muted">Point: {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</Text>
              <Button title={`Use ${place.locality}, ${place.countryCode}`} compact onPress={()=>{if(!current.current.disabled){current.current.onChoose(place);close();}}}/>
            </View>)}
            {error ? <Notice>{error}</Notice>:null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </>;
}
