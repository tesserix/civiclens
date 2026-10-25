import { Text } from './text';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CivicCard, CivicChoice } from '../shared/contracts';
import { palette } from './ui';
import { Card } from './community-ui';
import { civicChoices, civicChoiceLabels, closingLabel, topicLabel } from './community-model';
import { CommunityResults, CommunitySave } from './community-participation';
import { CommunityShare } from './community-share';

export function CommunityPollCard({card,userId,token,onOpen,onVote}:{card:CivicCard;userId:string;token:string;onOpen:()=>void;onVote:(choice:CivicChoice)=>void}){
  const open=card.status==='approved'&&!card.closed;
  return <Card>
    <View className="flex-row items-center gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-mint"><Ionicons name={card.kind==='poll'?'stats-chart-outline':'bulb-outline'} size={22} color={palette.brand}/></View>
      <View className="flex-1 gap-1.5"><Text className="text-xs font-semibold uppercase tracking-wide text-brand">{topicLabel(card.topic)} · {card.kind==='poll'?'Poll':'Request'}</Text><Text className="text-xs text-muted">{card.status==='pending'?'Waiting for review':card.status!=='approved'?card.status:closingLabel(card)}</Text></View>
      <CommunitySave card={card} userId={userId} token={token}/>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${card.title}`} onPress={onOpen} style={({pressed})=>({gap:8,opacity:pressed?0.7:1})}><Text className="text-lg font-bold leading-6 text-ink">{card.title}</Text><Text numberOfLines={2} className="text-sm leading-5 text-muted">{card.body}</Text></Pressable>
    <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6}}><Ionicons name="location-outline" size={14} color={palette.muted}/><Text className="text-xs text-muted">{card.locality}, {card.countryCode}</Text><Text className="text-xs text-muted">· {card.authorNickname}</Text></View>
    <CommunityResults card={card} compact/>
    {open?<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{civicChoices.map(choice=><Pressable key={choice} accessibilityRole="button" accessibilityLabel={`Vote ${civicChoiceLabels[choice]} on ${card.title}`} onPress={()=>onVote(choice)} style={({pressed})=>({flexGrow:1,flexBasis:82,minHeight:46,borderRadius:10,justifyContent:'center',padding:10,backgroundColor:choice==='yes'?palette.mint:choice==='no'?'#FEE4E2':palette.canvas,opacity:pressed?0.65:1})}><Text style={{textAlign:'center',fontSize:14,fontWeight:'700',color:choice==='yes'?palette.brand:choice==='no'?palette.danger:palette.muted}}>{civicChoiceLabels[choice]}</Text></Pressable>)}</View>:null}
    <Text className="text-xs leading-5 text-muted">{card.myResponse!=null?`Your pick: ${civicChoiceLabels[card.myResponse]}`:open&&card.kind==='poll'?'Private vote · results after closing':card.closed?'Final community responses':'Independent review first'}</Text>
    <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
      <Pressable accessibilityRole="button" accessibilityLabel={`Open discussion for ${card.title}`} onPress={onOpen} style={({pressed})=>({minHeight:48,justifyContent:'center',paddingHorizontal:8,opacity:pressed?0.65:1})}><Text className="text-sm font-semibold text-brand">{card.discussionCount??0} in discussion →</Text></Pressable>
      <CommunityShare card={card} userId={userId} token={token} compact/>
    </View>
  </Card>;
}
