import { ActivityIndicator, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, PropsWithChildren } from 'react';

export function Button({ title, onPress, busy = false, disabled = false, secondary = false, tone, icon }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; tone?: 'apple'; icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || busy, busy }}
    disabled={disabled || busy} onPress={onPress}
    className={`min-h-14 flex-row items-center justify-center gap-3 rounded-2xl border px-5 py-3.5 ${tone === 'apple' ? 'border-black bg-black' : secondary ? 'border-line bg-white' : 'border-primary bg-primary'}`}
    style={({ pressed }) => ({ opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1 })}>
    {busy ? <ActivityIndicator color={secondary ? '#3858F5' : '#FFF'} /> : icon ? <Ionicons name={icon} size={20} color={secondary ? '#3858F5' : '#FFF'} /> : null}
    <Text className={`text-base font-semibold ${secondary ? 'text-primary' : 'text-white'}`}>{title}</Text>
  </Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View className="gap-2"><Text className="text-sm font-semibold text-ink">{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor="#7C8980" {...props}
      className="min-h-14 rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink" /></View>;
}

export function Notice({ children }: PropsWithChildren) {
  return <View accessibilityRole="alert" className="rounded-2xl border border-orange-200 bg-orange-50 p-4"><Text className="text-sm leading-6 text-orange-950">{children}</Text></View>;
}

export function Brand() {
  return <View className="flex-row items-center gap-2.5"><View className="h-10 w-10 items-center justify-center rounded-[14px] bg-primary"><Ionicons name="scan" size={25} color="#EEF1FF" /></View><Text className="text-xl font-bold tracking-tight text-ink">civiclens<Text className="text-primary">.</Text></Text></View>;
}
