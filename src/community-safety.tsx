import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BlockPage, BlockState, Capabilities, CivicFlagInput, CivicFlagReason } from '../shared/contracts';
import { ApiError, request } from './api';
import { Card, CivicNotice, SectionTitle } from './community-ui';
import { Button, Loading } from './ui';
import { Text } from './text';
import { CommunitySelect } from './community-select';
import { civicFlagLabels } from './community-model';

function BlockAction({nickname,userId,token,blocked,onChanged}:{nickname:string;userId:string;token:string;blocked:boolean;onChanged?:()=>void}) {
  const client=useQueryClient(),scope=useRef(0),working=useRef(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{scope.current++;working.current=false;setBusy(false);setError('');return()=>{scope.current++;};},[nickname,userId,token]);
  const confirm=()=>{
    const generation=scope.current;
    const action=async()=>{
      if(generation!==scope.current||working.current)return;
      working.current=true;setBusy(true);setError('');
      try {
        const result=await request<BlockState>(`/v1/me/blocks/${encodeURIComponent(nickname)}`,{token,method:'PUT',body:{blocked}});
        if(generation!==scope.current)return;
        if(result.nickname.toLowerCase()!==nickname.toLowerCase()||result.blocked!==blocked)throw new Error('Invalid block response');
        onChanged?.();
        void client.resetQueries({predicate:q=>q.queryKey[1]===userId&&['community-card','community-feed','community-opinions'].includes(String(q.queryKey[0]))});
        void client.invalidateQueries({queryKey:['community-blocks',userId]});
      } catch(e) {if(generation===scope.current)setError(e instanceof ApiError?e.message:'Could not update the block. Check your connection and retry.');}
      finally {if(generation===scope.current){working.current=false;setBusy(false);}}
    };
    Alert.alert(`${blocked?'Block':'Unblock'} ${nickname}?`,blocked?'You will no longer see each other’s community requests and opinions while signed in. Moderators can still review abuse. Public links remain public. You can undo this in Account.':'Their community content may appear again unless they have also blocked you.',[
      {text:'Cancel',style:'cancel'},
      {text:blocked?'Block':'Unblock',style:blocked?'destructive':'default',onPress:action},
    ]);
  };
  return <View className="gap-2"><Button title={`${blocked?'Block':'Unblock'} ${nickname}`} compact variant="quiet" busy={busy} onPress={confirm}/>{error?<CivicNotice tone="warning">{error}</CivicNotice>:null}</View>;
}

export function BlockUser({nickname,userId,token,onBlocked}:{nickname:string;userId:string;token:string;onBlocked?:()=>void}) {
  const features=useQuery({queryKey:['capabilities'],queryFn:({signal})=>request<Capabilities>('/v1/capabilities',{signal})});
  if(features.data?.communityBlocking!==true)return null;
  return <BlockAction nickname={nickname} userId={userId} token={token} blocked onChanged={onBlocked}/>;
}

export function BlockedUsers({userId,token,available}:{userId:string;token:string;available:boolean}) {
  const query=useInfiniteQuery({queryKey:['community-blocks',userId],enabled:available,initialPageParam:null as string|null,
    queryFn:({pageParam,signal})=>request<BlockPage>(`/v1/me/blocks${pageParam?`?before=${encodeURIComponent(pageParam)}`:''}`,{token,signal}),getNextPageParam:last=>last.nextCursor??undefined});
  if(!available)return null;
  const users=query.data?.pages.flatMap(page=>page.items)??[];
  return <Card><SectionTitle title="Blocked accounts" detail="These accounts are hidden from your signed-in community view. Unblocking does not restore deleted content or change moderation."/>
    {query.isPending?<Loading label="Loading blocked accounts…"/>:null}
    {query.isError?<><CivicNotice tone="warning">Could not load your block list.</CivicNotice><Button title="Retry blocked accounts" variant="quiet" onPress={()=>void query.refetch()}/></>:null}
    {query.isSuccess&&!users.length?<Text className="text-sm text-muted">You haven’t blocked any accounts.</Text>:null}
    {users.map(user=><BlockAction key={user.nickname} nickname={user.nickname} userId={userId} token={token} blocked={false}/>)}
    {query.hasNextPage?<Button title="Load more blocked accounts" variant="quiet" busy={query.isFetchingNextPage} onPress={()=>void query.fetchNextPage()}/>:null}
  </Card>;
}

export function OpinionSafety({cardId,opinionId,nickname,userId,token}:{cardId:string;opinionId:string;nickname:string;userId:string;token:string}) {
  const features=useQuery({queryKey:['capabilities'],queryFn:({signal})=>request<Capabilities>('/v1/capabilities',{signal})});
  const scope=useRef(0),working=useRef(false);
  const [show,setShow]=useState(false),[reason,setReason]=useState<CivicFlagReason|''>(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
  useEffect(()=>{scope.current++;working.current=false;setShow(false);setReason('');setBusy(false);setSent(false);setError('');return()=>{scope.current++;};},[cardId,opinionId,userId,token]);
  const send=async()=>{
    if(!reason||working.current)return;
    const generation=scope.current;working.current=true;setBusy(true);setError('');
    try {
      await request(`/v1/community/${encodeURIComponent(cardId)}/flag`,{token,method:'POST',body:{reason,opinionId} satisfies CivicFlagInput});
      if(generation===scope.current)setSent(true);
    } catch(e) {if(generation===scope.current)setError(e instanceof ApiError?e.message:'Could not send this concern. Check your connection and retry.');}
    finally {if(generation===scope.current){working.current=false;setBusy(false);}}
  };
  if(features.data?.communityBlocking!==true)return null;
  return <View className="gap-2">
    {sent?<CivicNotice tone="positive">Opinion concern sent to moderators.</CivicNotice>:show?<>
      <Text className="text-xs text-muted">Report this opinion or its author. Only moderators can see your concern.</Text>
      <CommunitySelect<CivicFlagReason|''> key={`${userId}:${opinionId}`} label="Opinion concern reason" value={reason} options={[{id:'',label:'Choose reason'},...(Object.keys(civicFlagLabels) as CivicFlagReason[]).map(id=>({id,label:civicFlagLabels[id]}))]} disabled={busy} onChange={setReason}/>
      <Button title="Send opinion concern" variant="quiet" compact busy={busy} disabled={!reason} onPress={()=>void send()}/>
      {error?<CivicNotice tone="warning">{error}</CivicNotice>:null}
    </>:<Button title={`Report opinion by ${nickname}`} variant="quiet" compact onPress={()=>setShow(true)}/>}
    <BlockUser nickname={nickname} userId={userId} token={token}/>
  </View>;
}
