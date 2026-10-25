import { Text } from './text';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { communityRulesVersion, type CivicCard, type CivicChoice, type CivicResponseInput, type CivicWatchState } from '../shared/contracts';
import { ApiError, request } from './api';
import { Button, Loading, palette } from './ui';
import { Card, CivicConsent, CivicNotice, SectionTitle } from './community-ui';
import { civicChoices, civicChoiceLabels, civicQueryKey } from './community-model';

const failure=(error:unknown)=>error instanceof ApiError?error.message:'Could not connect. Your choice is still here. Please retry.';
function useRequestScope(id:string,userId:string,token:string){
  const scope=useRef({active:true,version:0});
  useEffect(()=>{scope.current.active=true;scope.current.version++;return()=>{scope.current.active=false;scope.current.version++;};},[id,userId,token]);
  return scope;
}
const choiceColors={yes:{ink:palette.brand,bg:palette.mint},no:{ink:palette.danger,bg:'#FEE4E2'},dont_know:{ink:palette.muted,bg:palette.canvas}};

export function CommunityVote({card,userId,token,initialChoice}:{card:CivicCard;userId:string;token:string;initialChoice?:CivicChoice}){
  const client=useQueryClient(),key=civicQueryKey(userId,card.id),scope=useRequestScope(card.id,userId,token);
  const [selected,setSelected]=useState<CivicChoice|undefined>(initialChoice),[consent,setConsent]=useState(false),[confirmed,setConfirmed]=useState(card.myResponse);
  const vote=useMutation({mutationFn:async(choice:CivicChoice|null)=>{
    const version=scope.current.version;
    const value=await request<CivicCard>(`/v1/community/${card.id}/response`,{token,method:'POST',body:{choice,consent:choice!==null,rulesVersion:communityRulesVersion} satisfies CivicResponseInput});
    if(value.id!==card.id||!(value.myResponse===null||civicChoices.includes(value.myResponse)))throw new Error('Unexpected response');
    return {card:value,version};
  },onSuccess:async(value)=>{
    if(!scope.current.active||scope.current.version!==value.version)return;
    await client.cancelQueries({queryKey:key,exact:true});
    if(!scope.current.active||scope.current.version!==value.version)return;
    client.setQueryData(key,value.card);setConfirmed(value.card.myResponse);setSelected(undefined);setConsent(false);
    void client.invalidateQueries({queryKey:['community-feed',userId]});
  },onError:error=>{if(error instanceof ApiError&&(error.status===409||error.status===404)){void client.invalidateQueries({queryKey:key});void client.invalidateQueries({queryKey:['community-feed',userId]});}}});
  useEffect(()=>{setSelected(initialChoice);setConsent(false);setConfirmed(card.myResponse);vote.reset();},[card.id,userId,token,initialChoice]);
  useEffect(()=>{setConfirmed(card.myResponse);setConsent(false);},[card.myResponse]);
  if(card.status!=='approved'||card.closed)return null;
  const choice=selected??confirmed;
  return <Card>
    <SectionTitle title={card.kind==='poll'?'Have your say':'Do you support this request?'} detail="One response per account. Change or withdraw it any time before closing."/>
    {confirmed!==null?<CivicNotice tone="positive">{`Your response: ${civicChoiceLabels[confirmed]}.`}</CivicNotice>:null}
    <View accessibilityRole="radiogroup" accessibilityLabel="Your response" style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{civicChoices.map(value=>{
      const color=choiceColors[value],checked=choice===value;
      return <Pressable key={value} accessibilityRole="radio" accessibilityLabel={civicChoiceLabels[value]} accessibilityState={{checked,disabled:vote.isPending}} disabled={vote.isPending} onPress={()=>{setSelected(value);setConsent(false);}} style={({pressed})=>({flexGrow:1,flexBasis:88,minHeight:52,justifyContent:'center',padding:12,borderRadius:12,borderWidth:checked?2:1,borderColor:checked?color.ink:color.bg,backgroundColor:color.bg,opacity:pressed?0.7:1})}><Text style={{color:color.ink,fontSize:16,fontWeight:'700',textAlign:'center'}}>{civicChoiceLabels[value]}</Text></Pressable>;
    })}</View>
    <CivicConsent label="I confirm my response and accept the community rules." checked={consent} disabled={vote.isPending} onChange={()=>setConsent(!consent)}/>
    {vote.isError?<CivicNotice tone="warning">{failure(vote.error)}</CivicNotice>:null}
    <Button title="Confirm response" busy={vote.isPending} disabled={!consent||choice===null} onPress={()=>{if(consent&&choice!==null&&!vote.isPending)vote.mutate(choice);}}/>
    {confirmed!==null?<Button title="Withdraw my response" variant="quiet" disabled={vote.isPending} onPress={()=>vote.mutate(null)}/>:null}
  </Card>;
}

export function CommunitySave({card,userId,token}:{card:CivicCard;userId:string;token:string}){
  const client=useQueryClient(),scope=useRequestScope(card.id,userId,token);
  const [watching,setWatching]=useState(card.watching===true);
  const save=useMutation({mutationFn:async(value:boolean)=>{
    const version=scope.current.version;
    const result=await request<CivicWatchState>(`/v1/community/${card.id}/watch`,{token,method:'POST',body:{watching:value}});
    if(result.cardId!==card.id||result.watching!==value)throw new Error('Unexpected response');
    return {watching:result.watching,version};
  },onSuccess:value=>{
    if(!scope.current.active||scope.current.version!==value.version)return;
    setWatching(value.watching);
    client.setQueryData<CivicCard>(civicQueryKey(userId,card.id),old=>old?{...old,watching:value.watching}:undefined);
    void client.invalidateQueries({queryKey:['community-feed',userId]});
  }});
  useEffect(()=>{setWatching(card.watching===true);save.reset();},[card.id,userId,token,card.watching]);
  if(card.watching===undefined||card.status!=='approved')return null;
  return <View style={{alignItems:'flex-end'}}><Pressable accessibilityRole="checkbox" accessibilityLabel={`Save ${card.title}`} accessibilityHint="Keep this card in your private Saved list" accessibilityState={{checked:watching,disabled:save.isPending,busy:save.isPending}} disabled={save.isPending} onPress={()=>save.mutate(!watching)} style={({pressed})=>({minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:watching?palette.mint:palette.canvas,opacity:pressed?0.6:1})}><Ionicons name={watching?'bookmark':'bookmark-outline'} size={21} color={watching?palette.brand:palette.muted}/></Pressable>{save.isError?<CivicNotice tone="warning">Could not save this card. Please retry.</CivicNotice>:null}</View>;
}

export function CommunityResults({card,compact=false}:{card:CivicCard;compact?:boolean}){
  if(!card.results||(card.kind==='poll'&&!card.closed))return null;
  const results=card.results;
  return <View className="gap-3">
    {!compact?<SectionTitle title={card.kind==='poll'?'Final results':'Support so far'}/>:null}
    <Text className="text-sm font-semibold text-ink">{results.total} responses</Text>
    <View accessibilityLabel="Response distribution" style={{flexDirection:'row',height:8,overflow:'hidden',borderRadius:8,backgroundColor:palette.canvas}}>{civicChoices.map(choice=>{const r=choice==='dont_know'?results.dontKnow:results[choice];return <View key={choice} style={{width:`${Math.max(0,Math.min(100,r.percent))}%`,backgroundColor:choiceColors[choice].ink}}/>;})}</View>
    <View style={{flexDirection:compact?'row':'column',flexWrap:'wrap',gap:compact?12:8}}>{civicChoices.map(choice=>{const result=choice==='dont_know'?results.dontKnow:results[choice];return <Text key={choice} style={{color:choiceColors[choice].ink,fontSize:compact?13:15,fontWeight:'600'}}>{`${civicChoiceLabels[choice]}: ${result.percent}%${compact?'':` (${result.count})`}`}</Text>;})}</View>
    {!compact?<Text className="text-xs leading-5 text-muted">All three choices count in the total. Percentages are rounded to one decimal and may not add to exactly 100%.</Text>:null}
  </View>;
}

export function CommunityVoteSheet({id,initialChoice,userId,token,onClose}:{id:string;initialChoice:CivicChoice;userId:string;token:string;onClose:()=>void}){
  const query=useQuery({queryKey:civicQueryKey(userId,id),queryFn:({signal})=>request<CivicCard>(`/v1/community/${id}`,{token,signal}),refetchOnMount:'always',refetchInterval:15000});
  return <Modal transparent animationType="slide" visible onRequestClose={onClose}><View style={{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.35)'}}><SafeAreaView edges={['bottom']} style={{maxHeight:'90%',borderTopLeftRadius:24,borderTopRightRadius:24,backgroundColor:palette.canvas}}><ScrollView contentContainerStyle={{padding:20,gap:16}}><Button title="Close response" compact variant="quiet" onPress={onClose}/>{query.isPending||(!query.isError&&!query.isFetchedAfterMount)?<Loading label="Checking the question…"/>:query.isError?<CivicNotice tone="warning">This question could not be opened. Close and try again.</CivicNotice>:<><Text accessibilityRole="header" className="text-xl font-bold leading-7 text-ink">{query.data.title}</Text>{query.data.status==='approved'&&!query.data.closed?<CommunityVote card={query.data} userId={userId} token={token} initialChoice={initialChoice}/>:<CivicNotice>This question is no longer open for responses.</CivicNotice>}<Text className="text-xs leading-5 text-muted">{query.data.kind==='poll'?'A voluntary community opinion poll. Your response stays private; results appear after closing.':'Account-backed support for a community request, not a legal signature.'}</Text></>}</ScrollView></SafeAreaView></View></Modal>;
}
