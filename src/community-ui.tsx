import { Text } from './text';
import type { PropsWithChildren } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cardShadow, palette } from './ui';

export function Card({ children }: PropsWithChildren) {
  return <View className="gap-4 rounded-3xl border border-line bg-surface p-5" style={cardShadow}>{children}</View>;
}
export function SectionTitle({title,detail}:{title:string;detail?:string}){return <View className="gap-1"><Text accessibilityRole="header" className="text-lg font-semibold text-ink">{title}</Text>{detail?<Text className="text-sm leading-5 text-muted">{detail}</Text>:null}</View>;}
export function CivicNotice({children,tone='default'}:PropsWithChildren<{tone?:'default'|'warning'|'positive'}>){return <View accessibilityRole={tone==='warning'?'alert':'text'} accessibilityLiveRegion="polite" className={`rounded-xl p-3 ${tone==='warning'?'bg-notice':tone==='positive'?'bg-mint':'bg-canvas'}`}><Text className={`text-sm leading-5 ${tone==='warning'?'text-caution':'text-ink'}`}>{children}</Text></View>;}
export function CivicConsent({label,checked,onChange,disabled=false}:{label:string;checked:boolean;onChange:()=>void;disabled?:boolean}){return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked,disabled}} disabled={disabled} onPress={onChange} className="min-h-12 flex-row items-center gap-3 rounded-xl border border-line px-3 py-3" style={{opacity:disabled?0.5:1}}><Ionicons name={checked?'checkbox':'square-outline'} size={22} color={checked?palette.brand:palette.muted}/><Text className="flex-1 text-sm leading-5 text-ink">{label}</Text></Pressable>;}
