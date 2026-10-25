import { Text } from './text';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { FlatList, Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { civicTopics, communityRulesVersion, type Capabilities, type CivicAccess, type CivicCardPage, type CivicChoice, type CivicFeedState, type CivicSort, type CivicTopic } from '../shared/contracts';
import { ApiError, request } from './api';
import { Button, Field, Loading, Title, palette } from './ui';
import { Card, CivicNotice } from './community-ui';
import { CommunityPollCard } from './community-poll-card';
import { CommunityVoteSheet } from './community-participation';
import { CommunitySelect } from './community-select';

export function useParticipation(){return useQuery({queryKey:['capabilities'],queryFn:({signal})=>request<Capabilities>('/v1/capabilities',{signal}),staleTime:30000});}
const failure=(error:unknown)=>error instanceof ApiError?error.message:'Could not connect. Please retry.';
export function CivicFeatureGate({children}:PropsWithChildren){
  const query=useParticipation();
  if(query.isPending)return <Loading label="Checking community availability…"/>;
  if(query.isError)return <View className="gap-3"><CivicNotice tone="warning">{failure(query.error)}</CivicNotice><Button title="Retry availability" onPress={()=>void query.refetch()}/></View>;
  if(!query.data.civicParticipation||query.data.communityRulesVersion!==communityRulesVersion)return <CivicNotice>Community requests are not available on this server yet. Update the app and try again after the service is enabled.</CivicNotice>;
  return children;
}
type Filter='all'|'request'|'poll'|'mine'|'saved'|'participated'|'review'|'flags';
type FlagPage={items:{id:string;cardId:string;reason:string;createdAt:string}[];nextCursor:string|null};
export function CommunityFeed({userId,token,onSelect,onCreate,onDirectory}:{userId:string;token:string;onSelect:(id:string)=>void;onCreate:()=>void;onDirectory?:()=>void}){
  const {width,fontScale}=useWindowDimensions();
  const stackDropdowns=width<380||fontScale>1.2;
  const [filter,setFilter]=useState<Filter>('all'),[search,setSearch]=useState(''),[q,setQ]=useState('');
  const [topic,setTopic]=useState<CivicTopic|'all'>('all'),[state,setState]=useState<CivicFeedState>('all'),[sort,setSort]=useState<CivicSort>('newest'),[kind,setKind]=useState<'all'|'poll'|'request'>('all');
  const [filtersOpen,setFiltersOpen]=useState(false),[response,setResponse]=useState<{id:string;choice:CivicChoice}|null>(null);
  const capabilities=useParticipation(),enhanced=capabilities.data?.communityDiscovery===true;
  const enabled=capabilities.data?.civicParticipation===true&&capabilities.data.communityRulesVersion===communityRulesVersion;
  useEffect(()=>{const timer=setTimeout(()=>setQ(search.trim()),300);return()=>clearTimeout(timer);},[search]);
  const access=useQuery({queryKey:['community-access',userId],enabled,queryFn:({signal})=>request<CivicAccess>('/v1/community/access',{token,signal})});
  const review=filter==='review',flagged=filter==='flags';
  const query=useInfiniteQuery({queryKey:['community-feed',userId,filter,enhanced,topic,state,sort,kind,q],enabled:enabled&&!flagged&&(!review||access.data?.canModerate===true),initialPageParam:null as string|null,refetchInterval:review?false:15000,
    queryFn:({pageParam,signal})=>{
      const p=new URLSearchParams();
      if(filter==='request'||filter==='poll')p.set('kind',filter);if(filter==='mine')p.set('mine','true');
      if(enhanced&&!review){if(kind!=='all')p.set('kind',kind);if(topic!=='all')p.set('topic',topic);if(state!=='all')p.set('state',state);if(sort!=='newest')p.set('sort',sort);if(q)p.set('q',q);if(filter==='saved')p.set('watching','true');if(filter==='participated')p.set('participated','true');}
      if(pageParam)p.set('before',pageParam);
      return request<CivicCardPage>(`${review?'/v1/moderation/community':'/v1/community'}?${p}`,{token,signal});
    },getNextPageParam:last=>last.nextCursor??undefined});
  const flags=useInfiniteQuery({queryKey:['community-flags',userId],enabled:enabled&&flagged&&access.data?.canModerate===true,initialPageParam:null as string|null,queryFn:({pageParam,signal})=>request<FlagPage>(`/v1/moderation/community/flags${pageParam?`?before=${encodeURIComponent(pageParam)}`:''}`,{token,signal}),getNextPageParam:last=>last.nextCursor??undefined});
  const selected=flagged?flags:query;
  const tabs:readonly {id:Filter;label:string}[]=enhanced?[{id:'all',label:'Explore'},{id:'saved',label:'Saved'},{id:'mine',label:'My posts'},{id:'participated',label:'My votes'}]:[{id:'all',label:'All'},{id:'request',label:'Requests'},{id:'poll',label:'Polls'},{id:'mine',label:'Mine'}];
  const browseOptions=access.data?.canModerate?[...tabs,{id:'review' as const,label:'Review pending'},{id:'flags' as const,label:'Reported concerns'}]:tabs;
  const filterCount=[state!=='all',sort!=='newest',kind!=='all'].filter(Boolean).length;
  const header=<View className="gap-4 pb-2"><Title subtitle="Good questions. Local ideas. A voice for everyone.">Community</Title><Button title={enhanced?'Ask the community':'Start a request or poll'} icon="add" onPress={onCreate}/>
    {enhanced?<Field label="Search community" value={search} maxLength={80} onChangeText={setSearch} placeholder="Questions, ideas or places" returnKeyType="search" autoCorrect={false}/>:null}
    <View className={stackDropdowns?'gap-3':'flex-row gap-3'}>
      <View className={stackDropdowns?'':'flex-1'}><CommunitySelect label="Browse" value={filter} options={browseOptions} onChange={setFilter}/></View>
      {enhanced&&!review&&!flagged?<View className={stackDropdowns?'':'flex-1'}><CommunitySelect label="Topic" value={topic} options={[{id:'all',label:'All topics'},...civicTopics]} onChange={setTopic}/></View>:null}
    </View>
    {enhanced&&!review&&!flagged?<View className="flex-row flex-wrap items-center justify-between gap-2"><Button title={`Filters${filterCount?` · ${filterCount}`:''}`} variant="quiet" compact icon="options-outline" onPress={()=>setFiltersOpen(true)}/>{onDirectory?<Button title="Councils & contacts" variant="quiet" compact icon="business-outline" onPress={onDirectory}/>:null}</View>:null}
    {onDirectory&&(!enhanced||review||flagged)?<Button title="Find councils and official contacts" variant="quiet" compact onPress={onDirectory}/>:null}
    {selected.isError?<><CivicNotice tone="warning">{failure(selected.error)}</CivicNotice><Button title="Retry community feed" variant="secondary" onPress={()=>void selected.refetch()}/></>:null}
  </View>;
  const empty=selected.isPending?<Loading label="Loading community requests…"/>:!selected.isError?<Card><Text className="text-lg font-semibold text-ink">{review?'No requests waiting for review':flagged?'No reported concerns':filter==='saved'?'Your saved cards will appear here':filter==='participated'?'Your responses will appear here':q||topic!=='all'?'No questions match these filters':'Start a conversation'}</Text><Text className="text-sm leading-6 text-muted">{review||flagged?'New moderation items will appear here.':filter==='saved'?'Tap the bookmark on a card to find it here later.':filter==='participated'?'Choose a card and have your say. Each account has one current response.':'Ask a fair question or suggest a local change. New posts appear after independent review.'}</Text>{q||topic!=='all'?<Button title="Clear search and filters" variant="secondary" onPress={()=>{setSearch('');setQ('');setTopic('all');setState('all');setKind('all');setSort('newest');}}/>:null}</Card>:null;
  return <CivicFeatureGate><View style={{flex:1}}>{flagged?<FlatList data={flags.data?.pages.flatMap(p=>p.items)??[]} keyExtractor={i=>i.id} contentContainerStyle={{padding:20,gap:12,flexGrow:1}} ListHeaderComponent={header} ListEmptyComponent={empty} refreshing={flags.isRefetching} onRefresh={()=>void flags.refetch()} onEndReached={()=>{if(flags.hasNextPage&&!flags.isFetchingNextPage)void flags.fetchNextPage();}} renderItem={({item})=><Card><Text className="text-base font-semibold text-ink">{item.reason} concern</Text><Text className="text-xs text-muted">{new Date(item.createdAt).toLocaleString()}</Text><Button title="Review reported request" variant="secondary" onPress={()=>onSelect(item.cardId)}/></Card>}/>:<FlatList data={query.data?.pages.flatMap(p=>p.items)??[]} keyExtractor={c=>c.id} contentContainerStyle={{padding:20,gap:14,flexGrow:1,paddingBottom:32,width:'100%',maxWidth:800,alignSelf:'center'}} ListHeaderComponent={header} ListEmptyComponent={empty} refreshing={query.isRefetching} onRefresh={()=>void query.refetch()} onEndReached={()=>{if(query.hasNextPage&&!query.isFetchingNextPage)void query.fetchNextPage();}} ListFooterComponent={query.isFetchingNextPage?<Loading label="Loading more questions"/>:null} renderItem={({item})=><CommunityPollCard card={item} userId={userId} token={token} onOpen={()=>onSelect(item.id)} onVote={choice=>setResponse({id:item.id,choice})}/>}/>}
    {response?<CommunityVoteSheet key={`${userId}:${response.id}`} id={response.id} initialChoice={response.choice} userId={userId} token={token} onClose={()=>setResponse(null)}/>:null}
    <Modal transparent animationType="slide" visible={filtersOpen} onRequestClose={()=>setFiltersOpen(false)}><View style={{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.35)'}}><SafeAreaView edges={['bottom']} style={{maxHeight:'90%',borderTopLeftRadius:24,borderTopRightRadius:24,backgroundColor:palette.canvas}}><ScrollView contentContainerStyle={{padding:24,gap:20}}><Title subtitle="Find the conversations you want to join.">Explore your way</Title><CommunitySelect label="Show" value={kind} options={[{id:'all',label:'Polls and requests'},{id:'poll',label:'Opinion polls'},{id:'request',label:'Civic requests'}]} onChange={setKind}/><CommunitySelect label="Responses" value={state} options={[{id:'all',label:'Open and closed'},{id:'open',label:'Open for responses'},{id:'closed',label:'Closed with results'}]} onChange={setState}/><CommunitySelect label="Sort by" value={sort} options={[{id:'newest',label:'Newest first'},{id:'closing_soon',label:'Closing soon'}]} onChange={setSort}/><Button title="Show conversations" onPress={()=>setFiltersOpen(false)}/></ScrollView></SafeAreaView></View></Modal>
  </View></CivicFeatureGate>;
}
