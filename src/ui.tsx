import { Text } from './text';
import { ActivityIndicator, Platform, Pressable, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type PropsWithChildren, type ReactNode } from 'react';
import type { Category, Channel } from '../shared/contracts';
import palette from './palette.json';

export { palette };
type Icon = ComponentProps<typeof Ionicons>['name'];

export const cardShadow: ViewStyle = Platform.select({
  web: { boxShadow: '0 6px 24px rgba(20, 43, 36, 0.09)' },
  default: { shadowColor: '#142B24', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.09, shadowRadius: 16, elevation: 4 },
});

export const channelIcons: Record<Channel, Icon> = { facebook: 'logo-facebook', instagram: 'logo-instagram', whatsapp: 'logo-whatsapp', tiktok: 'logo-tiktok' };

export const categoryIcons: Record<Category, Icon> = {
  waste: 'trash-outline', pollution: 'cloud-outline', roads: 'construct-outline', water: 'water-outline', public_safety: 'warning-outline',
};

const surfaces = { primary: 'border-ink bg-ink', secondary: 'border-line bg-surface', quiet: 'border-transparent bg-transparent', apple: 'border-black bg-black' };

export function Button({ title, onPress, busy = false, disabled = false, variant = 'primary', icon, compact = false }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; variant?: keyof typeof surfaces; icon?: Icon; compact?: boolean;
}) {
  const inverse = variant === 'primary' || variant === 'apple';
  const tint = inverse ? '#FFFFFF' : variant === 'quiet' ? palette.brand : palette.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || busy, busy }}
    disabled={disabled || busy} onPress={onPress}
    className={`${compact ? 'min-h-11 px-3' : 'min-h-[52px] px-5'} flex-row items-center justify-center gap-2 rounded-xl border ${surfaces[variant]}`}
    style={({ pressed }) => ({ opacity: disabled ? 0.4 : busy ? 0.8 : pressed ? 0.7 : 1 })}>
    {busy ? <ActivityIndicator color={tint} /> : icon ? <Ionicons name={icon} size={compact ? 18 : 20} color={tint} /> : null}
    <Text style={{flexGrow:1,flexShrink:1,textAlign:'center'}} className={`${compact ? 'text-[15px]' : 'text-base'} font-semibold ${inverse ? 'text-white' : variant === 'quiet' ? 'text-brand' : 'text-ink'}`}>{title}</Text>
  </Pressable>;
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return <View className="gap-1.5">
    <Text className="text-[13px] font-semibold text-ink">{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={palette.faint} {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }} onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      className={`min-h-12 rounded-xl border bg-surface px-4 py-3 text-base text-ink ${focused ? 'border-brand' : 'border-line'}`} />
    {hint ? <Text className="text-xs leading-5 text-muted">{hint}</Text> : null}
  </View>;
}

export function Notice({ children }: PropsWithChildren) {
  return <View accessibilityRole="alert" className="flex-row gap-2.5 rounded-xl border border-hivis/40 bg-notice p-3.5">
    <Ionicons name="alert-circle" size={18} color={palette.caution} />
    <Text className="flex-1 text-sm leading-5 text-caution">{children}</Text>
  </View>;
}

export function Brand() {
  return <View className="flex-row items-center gap-2.5">
    <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-ink"><Ionicons name="scan" size={20} color={palette.hivis} /></View>
    <Text className="text-lg font-bold tracking-tight text-ink">CivicLens</Text>
  </View>;
}

export function Title({ children, subtitle }: { children: string; subtitle?: string }) {
  return <View className="gap-1.5">
    <Text accessibilityRole="header" className="text-[30px] font-bold leading-9 tracking-tight text-ink">{children}</Text>
    {subtitle ? <Text className="text-[15px] leading-[22px] text-muted">{subtitle}</Text> : null}
  </View>;
}

const corner = { position: 'absolute', width: 26, height: 26, borderColor: palette.hivis } as const;
const corners: ViewStyle[] = [
  { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 },
  { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 },
  { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 },
  { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 },
];

export function Viewfinder({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <View className={className}>
    {children}
    {corners.map((place, i) => <View key={i} pointerEvents="none" style={[corner, place]} />)}
  </View>;
}

export function Step({ number, title, done = false, aside, children }: PropsWithChildren<{ number: number; title: string; done?: boolean; aside?: ReactNode }>) {
  return <View className="gap-3.5">
    <View className="flex-row items-center gap-2.5">
      <View className={`min-h-6 min-w-6 px-1 items-center justify-center rounded-full ${done ? 'bg-brand' : 'border border-ink'}`}>
        {done ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : <Text className="text-xs font-bold text-ink" style={{ fontVariant: ['tabular-nums'] }}>{number}</Text>}
      </View>
      <Text accessibilityRole="header" accessibilityLabel={`Step ${number}, ${title}${done ? ', done' : ''}`} className="flex-1 text-[17px] font-semibold text-ink">{title}</Text>
      {aside}
    </View>
    {children}
  </View>;
}

export function Chip({ label, selected, onPress, icon, role = 'radio', disabled = false }: {
  label: string; selected: boolean; onPress: () => void; icon?: Icon; role?: 'radio' | 'checkbox'; disabled?: boolean;
}) {
  return <Pressable accessibilityRole={role} accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
    className={`min-h-11 flex-row items-center gap-2 rounded-full border px-3.5 ${selected ? 'border-brand bg-mint' : 'border-line bg-surface'}`}
    style={({ pressed }) => ({ maxWidth:'100%', opacity: pressed ? 0.7 : 1 })}>
    {icon ? <Ionicons name={icon} size={16} color={selected ? palette.brand : palette.muted} /> : null}
    <Text style={{flexShrink:1}} className={`text-sm ${selected ? 'font-semibold text-brand' : 'text-ink'}`}>{label}</Text>
  </Pressable>;
}

export function Status({ label, color }: { label: string; color: string }) {
  return <View className="flex-row items-center gap-1.5 self-start rounded-full bg-canvas px-2.5 py-1">
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    <Text className="text-xs font-semibold text-ink">{label}</Text>
  </View>;
}

export function Loading({ label }: { label: string }) {
  return <View className="items-center py-10"><ActivityIndicator accessibilityLabel={label} color={palette.brand} /></View>;
}
