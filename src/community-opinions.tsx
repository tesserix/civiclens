import { Text } from './text';
import { useState } from 'react';
import { View } from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { communityRulesVersion, type CivicAccess, type CivicOpinion, type CivicOpinionInput, type CivicOpinionPage } from '../shared/contracts';
import { ApiError, request } from './api';
import { Button, Chip, Field, Loading } from './ui';
import { Card, CivicConsent, CivicNotice, SectionTitle } from './community-ui';
import { OpinionSafety } from './community-safety';

const failure=(error:unknown)=>error instanceof ApiError?error.message:'Could not connect. Your opinion is still here. Please retry.';
export function CommunityOpinions({id,userId,token,open}:{id:string;userId:string;token:string;open:boolean}){
  const client=useQueryClient(),prefix=['community-opinions',userId,id];
  const [text,setText]=useState(''),[consent,setConsent]=useState(false),[key,setKey]=useState(Crypto.randomUUID),[reviewing,setReviewing]=useState(false);
  const access=useQuery({queryKey:['community-access',userId],queryFn:({signal})=>request<CivicAccess>('/v1/community/access',{token,signal})});
  const moderation=reviewing&&access.data?.canModerate===true;
  const query=useInfiniteQuery({queryKey:[...prefix,moderation],initialPageParam:null as string|null,queryFn:({pageParam,signal})=>request<CivicOpinionPage>(`${moderation?'/v1/moderation/community':'/v1/community'}/${id}/opinions${pageParam?`?before=${encodeURIComponent(pageParam)}`:''}`,{token,signal}),getNextPageParam:last=>last.nextCursor??undefined});
  const submit=useMutation({mutationFn:()=>request<CivicOpinion>(`/v1/community/${id}/opinions`,{token,method:'POST',key,body:{text,rulesVersion:communityRulesVersion,consent} satisfies CivicOpinionInput}),onSuccess:()=>{setText('');setConsent(false);setKey(Crypto.randomUUID());void client.invalidateQueries({queryKey:prefix});}});
  const review=useMutation({mutationFn:({opinion,decision}:{opinion:string;decision:'approve'|'reject'|'hide'})=>request(`/v1/moderation/community/${id}/opinions/${opinion}`,{token,method:'POST',body:{decision}}),onSuccess:()=>{void client.invalidateQueries({queryKey:prefix});}});
  return <Card><SectionTitle title="Opinions" detail="Discuss the request respectfully. New opinions stay private until independent review."/>
    {access.data?.canModerate?<Chip role="checkbox" label="Review pending opinions" selected={reviewing} onPress={()=>setReviewing(!reviewing)}/>:null}
    {query.isPending?<Loading label="Loading opinions…"/>:null}
    {query.isError?<><CivicNotice tone="warning">{failure(query.error)}</CivicNotice><Button title="Retry opinions" variant="secondary" onPress={()=>void query.refetch()}/></>:null}
    {query.data?.pages.flatMap(p=>p.items).map(opinion=><View key={opinion.id} className="gap-2 border-b border-line py-3"><Text className="text-sm font-semibold text-ink">{opinion.authorNickname}</Text><Text className="text-sm leading-6 text-ink">{opinion.text}</Text><Text className="text-xs text-muted">{new Date(opinion.createdAt).toLocaleString()}</Text>{opinion.status!=='approved'?<CivicNotice>{opinion.status==='pending'?'Waiting for independent review. Only you and moderators can see this opinion.':`This opinion is ${opinion.status} and is not publicly visible.`}</CivicNotice>:null}{!opinion.mine&&opinion.status==='approved'?<OpinionSafety cardId={id} opinionId={opinion.id} nickname={opinion.authorNickname} userId={userId} token={token}/>:null}{opinion.canReview?<View className="gap-2">{opinion.status!=='approved'?<Button title="Approve opinion" compact busy={review.isPending} onPress={()=>review.mutate({opinion:opinion.id,decision:'approve'})}/>:null}<Button title={opinion.status==='approved'?'Hide opinion':'Reject opinion'} variant="secondary" compact busy={review.isPending} onPress={()=>review.mutate({opinion:opinion.id,decision:opinion.status==='approved'?'hide':'reject'})}/></View>:null}</View>)}
    {query.hasNextPage?<Button title="Load more opinions" variant="quiet" busy={query.isFetchingNextPage} onPress={()=>void query.fetchNextPage()}/>:null}
    {review.isError?<CivicNotice tone="warning">{failure(review.error)}</CivicNotice>:null}
    {open&&!moderation?<View className="gap-3"><Field label="Your opinion" value={text} maxLength={1000} multiline textAlignVertical="top" style={{minHeight:110}} editable={!submit.isPending} onChangeText={value=>{setText(value);setKey(Crypto.randomUUID());}}/><CivicConsent label="Publish this opinion under my nickname after independent review." checked={consent} disabled={submit.isPending} onChange={()=>setConsent(!consent)}/>{submit.isError?<CivicNotice tone="warning">{failure(submit.error)}</CivicNotice>:null}<Button title="Send opinion for review" disabled={text.trim().length<10||!consent} busy={submit.isPending} onPress={()=>{if(consent&&text.trim().length>=10&&!submit.isPending)submit.mutate();}}/></View>:null}
  </Card>;
}
