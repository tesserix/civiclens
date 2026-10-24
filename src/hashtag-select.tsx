import {Pressable,Text,View} from 'react-native';
import {Button,Chip} from './ui';

type Props={suggestions:string[];selected?:string[];onChange:(tags:string[])=>void;loading?:boolean;disabled?:boolean;error?:boolean;onRetry?:()=>void};
export function HashtagSelect({suggestions,selected,onChange,loading=false,disabled=false,error=false,onRetry}:Props){
  const chosen=suggestions.filter(tag=>selected===undefined||selected.includes(tag));
  const locked=disabled||loading;
  return <View className="gap-3">
    <View className="flex-row flex-wrap items-center gap-2">
      <Text accessibilityRole="header" className="flex-1 text-[13px] font-semibold text-ink">Suggested hashtags</Text>
      {suggestions.length ? <Text className="text-xs text-muted">{chosen.length} selected</Text>:null}
    </View>
    {error ? <View className="gap-2"><Text className="text-xs leading-5 text-muted">Couldn’t find hashtag suggestions. Your caption is safe.</Text>{onRetry ? <Button title="Retry hashtags" variant="secondary" compact disabled={locked} onPress={onRetry}/>:null}</View> : loading ? <Text accessibilityLiveRegion="polite" className="text-sm text-muted">Finding hashtags for this location…</Text> : suggestions.length ? <>
      <View className="flex-row flex-wrap gap-2">
        {suggestions.map(tag=><Chip key={tag} role="checkbox" label={tag} icon={chosen.includes(tag)?'checkmark-circle':'add-circle-outline'} selected={chosen.includes(tag)} disabled={locked}
          onPress={()=>onChange(chosen.includes(tag)?chosen.filter(value=>value!==tag):suggestions.filter(value=>value===tag||chosen.includes(value)))}/>)}
      </View>
      <View className="flex-row items-center gap-3">
        <Pressable accessibilityRole="button" accessibilityLabel="Select all hashtags" disabled={locked||chosen.length===suggestions.length} onPress={()=>onChange([...suggestions])} className="min-h-11 justify-center px-1" style={{opacity:locked||chosen.length===suggestions.length?0.4:1}}><Text className="text-sm font-semibold text-brand">Select all</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Clear hashtags" disabled={locked||!chosen.length} onPress={()=>onChange([])} className="min-h-11 justify-center px-1" style={{opacity:locked||!chosen.length?0.4:1}}><Text className="text-sm font-semibold text-brand">Clear</Text></Pressable>
      </View>
      <Text className="text-xs leading-5 text-muted">Tap to choose tags for this report. Council mentions are checked separately before sharing.</Text>
    </> : <Text className="text-xs leading-5 text-muted">No verified hashtag suggestions for this place and issue yet.</Text>}
  </View>;
}
