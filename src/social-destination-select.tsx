import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { channels, channelLabels, type Channel } from '../shared/contracts';
import { Button, channelIcons, palette } from './ui';
import { Text } from './text';

type Props = { value: Channel[]; options: Channel[]; onChange: (value: Channel[]) => void; disabled?: boolean };

export function SocialDestinationSelect({ value, options, onChange, disabled = false }: Props) {
  const [pending, setPending] = useState<Channel[] | null>(null);
  const choices = channels.filter(channel => options.includes(channel));
  const choicesKey = choices.join(',');
  const chosen = choices.filter(channel => value.includes(channel));
  const locked = disabled || !choices.length;
  useEffect(() => { setPending(null); }, [value, choicesKey, disabled]);
  const summary = !choices.length ? 'No apps available'
    : value.some(channel => !choices.includes(channel)) ? 'Review saved selection'
    : !chosen.length ? 'Choose apps'
    : chosen.length === 1 ? channelLabels[chosen[0]]
    : chosen.length === choices.length ? `All ${chosen.length} apps selected`
    : `${chosen.length} apps selected`;
  const close = () => setPending(null);
  return <View className="gap-1.5">
    <Text className="text-[13px] font-semibold text-ink">Social apps</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Social apps, ${summary}`} accessibilityHint="Choose one or more apps in a selection sheet"
      accessibilityState={{ disabled: locked, expanded: pending !== null && !locked }} disabled={locked} onPress={() => setPending(chosen)}
      className="min-h-14 flex-row items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
      style={({ pressed }) => ({ opacity: locked ? 0.45 : pressed ? 0.7 : 1 })}>
      <Ionicons name={chosen.length === 1 ? channelIcons[chosen[0]] : 'share-social-outline'} size={21} color={palette.brand}/>
      <Text className="flex-1 text-base text-ink">{summary}</Text>
      <Ionicons name="chevron-down" size={18} color={palette.muted}/>
    </Pressable>
    <Modal accessibilityLabel="Social app selection" visible={pending !== null && !locked} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right', 'bottom']} accessibilityViewIsModal onAccessibilityEscape={close}>
        <View className="w-full max-w-2xl flex-1 self-center px-5 pt-3">
          <ScrollView className="flex-1" contentContainerStyle={{ paddingVertical: 12 }}>
          <View className="gap-3 border-b border-line pb-4">
            <Text accessibilityRole="header" className="text-xl font-semibold text-ink">Choose social apps</Text>
            <Text className="text-sm leading-5 text-muted">Choose one, several or all apps. You’ll confirm each post in its app.</Text>
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text accessibilityLiveRegion="polite" className="text-sm font-semibold text-ink">{pending?.length ?? 0} of {choices.length} selected</Text>
              <View className="flex-row flex-wrap gap-2">
                <Button title="Select all social apps" compact variant="quiet" disabled={pending?.length === choices.length} onPress={() => setPending(choices)}/>
                <Button title="Clear social apps" compact variant="quiet" disabled={!pending?.length} onPress={() => setPending([])}/>
              </View>
            </View>
          </View>
            {choices.map(channel => {
              const selected = pending?.includes(channel) === true;
              return <Pressable key={channel} accessibilityRole="checkbox" accessibilityLabel={channelLabels[channel]} accessibilityState={{ checked: selected }}
                onPress={() => setPending(current => current === null ? null : choices.filter(option => option === channel ? !current.includes(option) : current.includes(option)))}
                className="my-1 min-h-16 flex-row items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-4"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, borderColor: selected ? palette.brand : palette.line })}>
                <Ionicons name={channelIcons[channel]} size={24} color={selected ? palette.brand : palette.muted}/>
                <Text className="flex-1 text-base font-medium text-ink">{channelLabels[channel]}</Text>
                <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={25} color={selected ? palette.brand : palette.muted}/>
              </Pressable>;
            })}
          </ScrollView>
          <View className="gap-2 border-t border-line py-3">
            <Button title="Done" onPress={() => { if (!locked && pending !== null) { if (pending.join(',') !== chosen.join(',') || value.some(channel => !choices.includes(channel))) onChange(pending); close(); } }}/>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel social app selection" className="min-h-11 items-center justify-center px-3 py-2" onPress={close} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-base font-semibold text-brand">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  </View>;
}
