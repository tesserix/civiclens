import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import countries from 'i18n-iso-countries';
import english from 'i18n-iso-countries/langs/en.json';
import { categories, categoryLabels, type Category, type Location } from '../shared/contracts';
import { Button, Field, categoryIcons, palette } from './ui';

countries.registerLocale(english);
const countryOptions = Object.entries(countries.getNames('en', { select: 'official' })).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, 'en'));

export function CategorySelect({ value, onChange, disabled = false }: { value: Category; onChange: (value: Category) => void; disabled?: boolean }) {
  const { fontScale } = useWindowDimensions();
  const mounted = useRef(true);
  const selection = useRef(0);
  const current = useRef({ disabled, onChange });
  current.current = { disabled, onChange };
  useEffect(() => { if (disabled) selection.current += 1; }, [disabled]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; selection.current += 1; };
  }, []);
  const select = (category: unknown) => {
    if (mounted.current && !current.current.disabled && categories.includes(category as Category)) current.current.onChange(category as Category);
  };
  return <View className="gap-1.5">
    <Text className="text-[13px] font-semibold text-ink">Issue type</Text>
    {Platform.OS === 'ios' ? <Pressable accessibilityRole="button" accessibilityLabel={`Issue type, ${categoryLabels[value]}`} accessibilityHint="Opens issue types" accessibilityState={{ disabled }} disabled={disabled}
      onPress={() => {
        const request = ++selection.current;
        ActionSheetIOS.showActionSheetWithOptions({ title: 'Issue type', options: [...categories.map(category => categoryLabels[category]), 'Cancel'], cancelButtonIndex: categories.length }, index => {
          if (request === selection.current) select(categories[index]);
        });
      }}
      className="min-h-14 flex-row items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3" style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.7 : 1 })}>
      <Ionicons name={categoryIcons[value]} size={21} color={palette.brand} />
      <Text className="flex-1 text-base text-ink">{categoryLabels[value]}</Text>
      <Ionicons name="chevron-down" size={18} color={palette.muted} />
    </Pressable> : <View className="min-h-14 justify-center rounded-xl border border-line bg-surface px-2" style={{ opacity: disabled ? 0.45 : 1 }}>
      <Picker accessibilityLabel="Issue type" selectedValue={value} enabled={!disabled} mode={fontScale > 1.2 ? 'dialog' : 'dropdown'} prompt="Issue type" onValueChange={select} dropdownIconColor={palette.muted} style={{ color: palette.ink, minHeight: Math.max(56, 40 * fontScale) }}>
        {categories.map(category => <Picker.Item key={category} label={categoryLabels[category]} value={category} />)}
      </Picker>
    </View>}
  </View>;
}

export function LocationFields({ value, onChange, disabled = false }: { value: Location; onChange: (value: Location) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const countryName = countryOptions.find(country => country.code === value.countryCode)?.name || 'Choose country';
  const query = search.trim().toLocaleLowerCase('en');
  const exactCode = countryOptions.find(country => country.code.toLowerCase() === query);
  const matches = exactCode ? [exactCode] : countryOptions.filter(country => country.name.toLocaleLowerCase('en').includes(query));
  return <View className="gap-4">
    <Field label="Town or city" value={value.locality} maxLength={120} editable={!disabled} onChangeText={locality => onChange({ ...value, locality })} style={{ minHeight: 56 }} />
    <View className="gap-1.5">
      <Text className="text-[13px] font-semibold text-ink">Country</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Country, ${countryName}`} accessibilityHint="Opens searchable countries" accessibilityState={{ disabled, expanded: open }} disabled={disabled}
        onPress={() => { setSearch(''); setOpen(true); }} className="min-h-14 flex-row items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3" style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.7 : 1 })}>
        <Ionicons name="globe-outline" size={21} color={palette.brand} />
        <Text className="flex-1 text-base text-ink">{countryName}</Text>
        <Ionicons name="chevron-down" size={18} color={palette.muted} />
      </Pressable>
    </View>
    <View className="flex-row items-start gap-2"><Ionicons name="lock-closed-outline" size={14} color={palette.muted} /><Text className="flex-1 text-xs leading-5 text-muted">Precise location stays private. Only an approximate location is shared after review.</Text></View>
    <Modal visible={open && !disabled} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
      <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="w-full max-w-2xl flex-1 self-center px-5 pt-3">
            <View className="mb-4 flex-row items-center gap-3"><Text accessibilityRole="header" className="flex-1 text-xl font-semibold text-ink">Choose country</Text><Button title="Cancel" variant="quiet" compact onPress={() => setOpen(false)} /></View>
            <TextInput accessibilityLabel="Search countries" placeholder="Search name or country code" placeholderTextColor={palette.faint} value={search} onChangeText={setSearch} autoCorrect={false} autoCapitalize="none" returnKeyType="search" className="mb-3 min-h-14 rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink" />
            <FlatList data={matches} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" keyExtractor={item => item.code}
              ListEmptyComponent={<Text accessibilityLiveRegion="polite" className="py-6 text-base text-muted">No countries found. Try another name or code.</Text>}
              renderItem={({ item }) => <Pressable accessibilityRole="radio" accessibilityLabel={item.name} accessibilityState={{ checked: item.code === value.countryCode }}
                onPress={() => { if (!disabled) { onChange({ ...value, countryCode: item.code }); setOpen(false); } }}
                className="min-h-14 flex-row items-center gap-3 border-b border-line py-4" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Text className="flex-1 text-base text-ink">{item.name}</Text><Text className="text-sm text-muted">{item.code}</Text>
                {item.code === value.countryCode ? <Ionicons name="checkmark" size={20} color={palette.brand} /> : null}
              </Pressable>} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </View>;
}
