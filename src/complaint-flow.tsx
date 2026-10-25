import { Text } from './text';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { Image } from 'expo-image';
import * as Crypto from 'expo-crypto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ComplaintOptions, ComplaintPackage, Report } from '../shared/contracts';
import { ApiError, request } from './api';
import { Button, Chip, Loading, Notice } from './ui';
import { Card, CivicConsent, SectionTitle } from './community-ui';
const failure=(e:unknown)=>e instanceof ApiError?e.message:'Could not connect. Your report is safe. Please retry.';
export function ComplaintFlow({report,userId,token}:{report:Report;userId:string;token:string}){
  const client=useQueryClient(),queryKey=['complaint-options',userId,report.id,report.status];
  const query=useQuery({queryKey,queryFn:({signal})=>request<ComplaintOptions>(`/v1/reports/${report.id}/complaints`,{token,signal}),enabled:report.complaintRequested===true});
  const [channel,setChannel]=useState<string|null>(null),[consent,setConsent]=useState(false),[handoffConsent,setHandoffConsent]=useState(false);
  const [prepared,setPrepared]=useState<ComplaintPackage|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const key=useRef(Crypto.randomUUID()),generation=useRef(0),working=useRef(false);
  useEffect(()=>{generation.current++;working.current=false;setBusy(false);key.current=Crypto.randomUUID();setPrepared(null);setChannel(null);setConsent(false);setHandoffConsent(false);setError('');setNotice('');return()=>{generation.current++;};},[report.id,token]);
  const prepare=async()=>{
    const value=await request<ComplaintPackage>(`/v1/reports/${report.id}/complaint-package`,{token,method:'POST',key:key.current,body:{channelId:channel,consent:true},timeoutMs:80000});
    if(value.reportId!==report.id||value.channel?.id!==channel||!value.text?.trim()||value.text.length>10000||!/^https:\/\//.test(value.channel.url)||!Array.isArray(value.photosBase64)||value.photosBase64.length<1||value.photosBase64.length>5||value.photosBase64.some(p=>typeof p!=='string'||p.length>8100000||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(p)))throw new Error('Invalid reviewed package');
    return value;
  };
  const run=async(action:'prepare'|'open'|'save')=>{
    if(working.current||!consent||!channel||(action!=='prepare'&&(!prepared||!handoffConsent)))return;
    working.current=true;setBusy(true);setError('');setNotice('');const version=generation.current;
    try{
      const fresh=await prepare();if(version!==generation.current)return;
      if(action==='prepare'){setPrepared(fresh);return;}
      if(!prepared||fresh.text!==prepared.text||JSON.stringify(fresh.channel)!==JSON.stringify(prepared.channel)||JSON.stringify(fresh.photosBase64)!==JSON.stringify(prepared.photosBase64)){setPrepared(null);setHandoffConsent(false);throw new Error('Reviewed package changed');}
      if(action==='open'){
        await request(`/v1/complaints/${fresh.id}/handoff`,{token,method:'POST',body:{consent:true}});
        if(version!==generation.current)return;
        await Linking.openURL(fresh.channel.url);
        if(version===generation.current)setNotice('The form was opened. CivicLens has no official receipt. Finish on the official site and keep its reference number.');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const native:typeof import('react-native-share')=require('react-native-share');
        await native.default.open({title:'Save reviewed complaint evidence',message:fresh.text,urls:fresh.photosBase64.map(p=>`data:image/jpeg;base64,${p}`),type:'image/jpeg',useInternalStorage:true,failOnCancel:false});
        if(version===generation.current)setNotice('Evidence options closed. Attach the saved photos and text on the official site. No government filing is confirmed.');
      }
      void client.invalidateQueries({queryKey});
    }catch(e){if(version===generation.current)setError(failure(e));}
    finally{if(version===generation.current){working.current=false;setBusy(false);}}
  };
  if(!report.complaintRequested)return null;
  if(query.isPending)return <Loading label="Checking official complaint options…"/>;
  if(query.isError)return <Card><Notice>{failure(query.error)}</Notice><Button title="Retry complaint options" onPress={()=>void query.refetch()}/></Card>;
  const ready=report.status==='approved'&&query.data.factualTextReviewed;
  return <Card><SectionTitle title="Report to the responsible body" detail="Prepare evidence here, then finish on the official site. This does not dispatch police or emergency services."/>
    {!query.data.channels.length?<Notice>No current verified complaint channel matches this location and issue. Your report is held safely; reference directory entries are not verified reporting routes.</Notice>:null}
    {query.data.channels.map(c=><View key={c.id} className="gap-2"><Chip role="radio" label={c.name} selected={channel===c.id} disabled={busy} onPress={()=>{setChannel(c.id);setPrepared(null);setConsent(false);setHandoffConsent(false);key.current=Crypto.randomUUID();}}/><Text selectable className="text-xs leading-5 text-muted">{c.url}</Text><Text className="text-xs leading-5 text-muted">{c.authentication} API availability: {c.apiStatus}. Checked {new Date(c.verifiedAt).toLocaleDateString()}.</Text></View>)}
    {!ready?<Notice>Every photo, responsible authority and separate factual complaint text need independent review first. Social humour is not automatically reused.</Notice>:null}
    {ready&&query.data.channels.length?<><CivicConsent label="I confirm this destination and want to prepare the reviewed text and photos." checked={consent} disabled={busy} onChange={()=>{setConsent(!consent);setPrepared(null);setHandoffConsent(false);}}/><Button title="Prepare reviewed complaint" busy={busy} disabled={!channel||!consent} onPress={()=>void run('prepare')}/></>:null}
    {prepared?<><Text selectable className="text-sm leading-6 text-ink">{prepared.text}</Text><View className="flex-row flex-wrap gap-3">{prepared.photosBase64.map((p,i)=><Image key={i} source={{uri:`data:image/jpeg;base64,${p}`}} style={{width:120,height:100,borderRadius:12}} accessibilityLabel={`Reviewed complaint photo ${i+1}`}/>)}</View><Text className="text-xs leading-5 text-muted">Only this reviewed text and these photos are prepared. Original metadata, exact coordinates, account credentials and private identity are excluded. Select text to copy it.</Text><CivicConsent label="I will check the official form, provide any required identity and submit it myself." checked={handoffConsent} disabled={busy} onChange={()=>setHandoffConsent(!handoffConsent)}/><Button title="Open official complaint form" disabled={!handoffConsent||!consent} busy={busy} onPress={()=>void run('open')}/>{Platform.OS!=='web'?<Button title="Save or share complaint evidence" variant="secondary" disabled={!handoffConsent||!consent} busy={busy} onPress={()=>void run('save')}/>:null}</>:null}
    {query.data.history.length?<Text className="text-xs leading-5 text-muted">{query.data.history.length} preparation record(s). Opening or sharing evidence does not confirm submission or acceptance.</Text>:null}
    {error?<Notice>{error}</Notice>:null}{notice?<Notice>{notice}</Notice>:null}
  </Card>;
}
