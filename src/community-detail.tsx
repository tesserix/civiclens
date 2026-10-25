import { Text } from './text';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CivicCard, CivicFlagReason } from '../shared/contracts';
import { ApiError, request } from './api';
import { Button, Loading } from './ui';
import { Card, CivicNotice as Notice, SectionTitle } from './community-ui';
import { CommunityOpinions } from './community-opinions';
import { CommunityResults, CommunitySave, CommunityVote } from './community-participation';
import { civicChoiceLabels, civicQueryKey, topicLabel, civicFlagLabels as flagLabels } from './community-model';
import { CommunitySelect } from './community-select';
import { CommunityShare } from './community-share';
import { BlockUser } from './community-safety';

export { civicChoiceLabels, civicQueryKey } from './community-model';
const message=(error:unknown)=>error instanceof ApiError?error.message:'Could not connect. Your choice is still here. Please retry.';

export function CommunityDetail({id,userId,token}:{id:string;userId:string;token:string}){
  const client=useQueryClient(),key=civicQueryKey(userId,id);
  const query=useQuery({queryKey:key,queryFn:({signal})=>request<CivicCard>(`/v1/community/${id}`,{token,signal}),refetchInterval:q=>q.state.data?.closed?60000:15000});
  const [flag,setFlag]=useState<CivicFlagReason|null>(null);
  const [blocked,setBlocked]=useState<string|null>(null);
  useEffect(()=>{setFlag(null);setBlocked(null);},[id,userId,token]);
  const report=useMutation({mutationFn:(reason:CivicFlagReason)=>request(`/v1/community/${id}/flag`,{token,method:'POST',body:{reason}})});
  const review=useMutation({mutationFn:(decision:'approve'|'reject'|'hide')=>request<CivicCard>(`/v1/moderation/community/${id}`,{token,method:'POST',body:{decision}}),onSuccess:card=>{client.setQueryData(key,card);void client.invalidateQueries({queryKey:['community-feed',userId]});}});
  if(blocked)return <Notice>{`You blocked ${blocked}. Their community content is hidden. Manage blocked accounts in Account.`}</Notice>;
  if(query.isPending)return <Loading label="Opening community request…"/>;
  if(query.isError)return <View className="gap-3"><Notice>{message(query.error)}</Notice><Button title="Retry" onPress={()=>void query.refetch()}/></View>;
  const card=query.data;
  const open=card.status==='approved'&&!card.closed;
  return <View className="gap-4">
    <Card>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}><Text className="flex-1 text-xs font-bold uppercase tracking-wide text-brand">{topicLabel(card.topic)} · {card.kind==='poll'?'Opinion poll':'Civic request'}</Text><CommunitySave card={card} userId={userId} token={token}/></View>
      <Text accessibilityRole="header" className="text-2xl font-bold leading-8 text-ink">{card.title}</Text>
      <Text className="text-sm leading-6 text-ink">{card.body}</Text>
      <Text className="text-xs leading-5 text-muted">{card.authorNickname} · {card.locality}, {card.countryCode}</Text>
      <Text className="text-xs leading-5 text-muted">{card.closed?'Closed':'Closes'} {new Date(card.closesAt).toLocaleString()}</Text>
      {card.status!=='approved'?<Notice tone="warning">{card.status==='pending'?'Waiting for independent review. Other citizens cannot see or respond yet.':`This request is ${card.status}. It is not available in the public feed.`}</Notice>:null}
      {card.kind==='poll'?<Notice>This is a voluntary opinion poll of app accounts. It is not an official vote or a representative forecast. There is no money or wagering.</Notice>:<Notice>Support is recorded against your app account. It is not a legal signature or an official government petition.</Notice>}
    </Card>
    {card.kind==='poll'&&open?<Notice>Results appear after the closing deadline. Your response stays private.</Notice>:null}
    {card.closed&&card.myResponse!==null?<Notice tone="positive">{`Your response: ${civicChoiceLabels[card.myResponse]}.`}</Notice>:null}
    <CommunityVote card={card} userId={userId} token={token}/>
    {card.results&&(card.kind!=='poll'||card.closed)?<Card><CommunityResults card={card}/></Card>:null}
    {card.status==='approved'?<Card>
      <CommunityShare card={card} userId={userId} token={token} title="Share this request"/>
      <SectionTitle title="Report a concern" detail="Only moderators can see your report. Reporting does not automatically remove a request."/>
      <CommunitySelect<CivicFlagReason|''> label="Concern reason" value={flag??''} options={[{id:'',label:'Choose reason'},...(Object.keys(flagLabels) as CivicFlagReason[]).map(id=>({id,label:flagLabels[id]}))]} disabled={report.isPending||report.isSuccess} onChange={reason=>setFlag(reason||null)}/>
      {report.isSuccess?<Notice tone="positive">Your concern has been sent to moderators.</Notice>:<Button title="Send concern to moderators" variant="quiet" disabled={!flag} busy={report.isPending} onPress={()=>{if(flag)report.mutate(flag);}}/>}
      {report.isError?<Notice tone="warning">{message(report.error)}</Notice>:null}
      {!card.mine?<BlockUser nickname={card.authorNickname} userId={userId} token={token} onBlocked={()=>setBlocked(card.authorNickname)}/>:null}
    </Card>:null}
    {card.canReview?<Card>
      <SectionTitle title="Moderator review" detail="Review the full question, location and community rules before making it visible."/>
      {card.status!=='approved'?<Button title="Approve request" busy={review.isPending} onPress={()=>review.mutate('approve')}/>:null}
      <Button title={card.status==='approved'?'Hide request':'Reject request'} variant="secondary" busy={review.isPending} onPress={()=>review.mutate(card.status==='approved'?'hide':'reject')}/>
      {review.isError?<Notice tone="warning">{message(review.error)}</Notice>:null}
    </Card>:null}
    {card.status==='approved'||card.mine||card.canReview?<CommunityOpinions key={`${userId}:${id}`} id={id} userId={userId} token={token} open={open}/>:null}
  </View>;
}
