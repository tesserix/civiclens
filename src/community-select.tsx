import { Text } from './text';
import { useEffect, useRef } from 'react';
import { ActionSheetIOS, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { palette } from './ui';

export function CommunitySelect<T extends string>({label,value,options,onChange,disabled=false}:{label:string;value:T;options:readonly{id:T;label:string}[];onChange:(value:T)=>void;disabled?:boolean}){
  const {fontScale}=useWindowDimensions();
  const active=useRef(true),generation=useRef(0),latest=useRef({options,onChange,disabled});latest.current={options,onChange,disabled};
  const optionsKey=JSON.stringify(options);
  useEffect(()=>{generation.current++;},[value,optionsKey,disabled,label]);
  useEffect(()=>{active.current=true;return()=>{active.current=false;generation.current++;};},[]);
  const choose=(index:number)=>{const option=latest.current.options[index];if(active.current&&!latest.current.disabled&&option)latest.current.onChange(option.id);};
  const selected=options.find(o=>o.id===value)?.label??'Choose';
  return <View className="gap-1.5"><Text className="text-[13px] font-semibold text-ink">{label}</Text>{Platform.OS==='ios'?<Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${selected}`} accessibilityHint="Opens native choices" accessibilityState={{disabled}} disabled={disabled} onPress={()=>{
    const run=++generation.current;
    ActionSheetIOS.showActionSheetWithOptions({title:label,options:[...options.map(o=>o.label),'Cancel'],cancelButtonIndex:options.length},index=>{if(run===generation.current)choose(index);});
  }} className="min-h-14 flex-row items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3" style={({pressed})=>({opacity:disabled?0.45:pressed?0.7:1})}><Text className="flex-1 text-base text-ink">{selected}</Text><Ionicons name="chevron-down" size={18} color={palette.muted}/></Pressable>:<View className="min-h-14 justify-center rounded-xl border border-line bg-surface px-2" style={{opacity:disabled?0.45:1}}><Picker accessibilityLabel={label} selectedValue={value} enabled={!disabled} mode="dialog" prompt={label} numberOfLines={3} dropdownIconColor={palette.muted} style={{color:palette.ink,height:fontScale>1.2?72*fontScale:56}} onValueChange={id=>{const index=options.findIndex(o=>o.id===id);if(index>=0)choose(index);}}>{options.map(o=><Picker.Item key={o.id} label={o.label} value={o.id}/>)}</Picker></View>}</View>;
}
