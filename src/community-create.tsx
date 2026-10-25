import { Text } from './text';
import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Platform, Pressable, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Crypto from 'expo-crypto';
import { civicTopics, communityRulesVersion, type CivicCard, type CivicCardInput } from '../shared/contracts';
import { ApiError, request } from './api';
import { clearCivicDraft, loadCivicDraft, saveCivicDraft, type CivicDraft } from './community-draft';
import { LocationFields } from './report-details';
import { Button, Field, Loading } from './ui';
import { Card, CivicConsent, CivicNotice, SectionTitle } from './community-ui';
import { CommunitySelect } from './community-select';

const durations=[{label:'In 1 hour',hours:1},{label:'In 1 day',hours:24},{label:'In 3 days',hours:72},{label:'In 1 week',hours:168},{label:'In 2 weeks',hours:336},{label:'In 30 days',hours:720}];
function newDraft():CivicDraft{return {version:1,key:Crypto.randomUUID(),input:{kind:'poll',title:'',body:'',countryCode:'AU',locality:'',closesAt:new Date(Date.now()+7*86400000).toISOString(),rulesVersion:communityRulesVersion,consent:false}};}
function valid(input:CivicCardInput){return input.title.trim().length>=10&&input.body.trim().length>=20&&input.locality.trim().length>=2&&/^[A-Z]{2}$/.test(input.countryCode)&&Date.parse(input.closesAt)>Date.now()+5*60000&&input.consent&&input.rulesVersion===communityRulesVersion;}

function DeadlineSelect({value,onChange,disabled}:{value:string;onChange:(value:string)=>void;disabled:boolean}){
  const active=useRef(true),current=useRef({onChange,disabled});current.current={onChange,disabled};
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const choose=(index:number)=>{if(active.current&&!current.current.disabled&&durations[index])current.current.onChange(new Date(Date.now()+durations[index].hours*3600000).toISOString());};
  const label=new Date(value).toLocaleString();
  return <View className="gap-1.5"><Text className="text-[13px] font-semibold text-ink">Closing deadline</Text>{Platform.OS==='ios'?<Pressable accessibilityRole="button" accessibilityLabel={`Closing deadline, ${label}`} accessibilityState={{disabled}} disabled={disabled} onPress={()=>ActionSheetIOS.showActionSheetWithOptions({title:'Close responses',options:[...durations.map(d=>d.label),'Cancel'],cancelButtonIndex:durations.length},choose)} className="min-h-14 justify-center rounded-xl border border-line bg-surface px-4 py-3"><Text className="text-base text-ink">{label} ▾</Text></Pressable>:<View className="rounded-xl border border-line bg-surface"><Picker accessibilityLabel="Closing deadline" enabled={!disabled} selectedValue="current" mode="dialog" onValueChange={value=>{if(value!=='current')choose(Number(value));}}><Picker.Item label={label} value="current"/>{durations.map((d,i)=><Picker.Item key={d.hours} label={d.label} value={String(i)}/>)}</Picker></View>}<Text className="text-xs leading-5 text-muted">Shown in your device time zone. The server closes responses at this exact time.</Text></View>;
}

export function CommunityCreate({userId,token,onCreated,topicsEnabled=false}:{userId:string;token:string;onCreated:(id:string)=>void;topicsEnabled?:boolean}){
  const [draft,setDraft]=useState<CivicDraft|null>(null),[attempt,setAttempt]=useState(0),[loadError,setLoadError]=useState('');
  const [saveError,setSaveError]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[submitted,setSubmitted]=useState(false),[discard,setDiscard]=useState(false);
  const alive=useRef(true),sending=useRef(false),created=useRef<string|null>(null),generation=useRef(0);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;};},[]);
  useEffect(()=>{let active=true;setLoadError('');loadCivicDraft(userId).then(value=>{if(active)setDraft(value??newDraft());}).catch(()=>{if(active)setLoadError('Could not restore your saved request. Retry or discard the saved draft.');});return()=>{active=false;};},[userId,attempt]);
  useEffect(()=>{
    const run=++generation.current;
    if(!draft||busy||submitted)return;
    const timer=setTimeout(()=>{void saveCivicDraft(userId,draft).then(()=>{if(alive.current&&generation.current===run)setSaveError('');}).catch(()=>{if(alive.current&&generation.current===run)setSaveError('Could not save this draft on your device. Retry saving before submitting.');});},250);
    return()=>clearTimeout(timer);
  },[draft,userId,busy,submitted]);
  const update=(patch:Partial<CivicCardInput>)=>setDraft(old=>old?{...old,key:Object.keys(patch).some(key=>key!=='consent')?Crypto.randomUUID():old.key,input:{...old.input,...patch}}:old);
  const submit=async()=>{
    if(!draft||sending.current||submitted)return;
    if(!created.current&&(!valid(draft.input)||(!topicsEnabled&&draft.input.topic!==undefined))){setError('Complete the request, accept the rules and choose a future closing deadline.');return;}
    sending.current=true;setBusy(true);setError('');
    try{
      await saveCivicDraft(userId,draft);
      if(!created.current){const card=await request<CivicCard>('/v1/community',{token,method:'POST',key:draft.key,body:draft.input});created.current=card.id;}
      await clearCivicDraft(userId);
      if(alive.current){setSubmitted(true);onCreated(created.current);}
    }catch(cause){if(alive.current)setError(created.current?'Your request is saved on the server. Retry opening it; this will also clear the local draft.':cause instanceof ApiError?cause.message:'Could not connect. Your saved request is still here. Please retry.');}
    finally{sending.current=false;if(alive.current)setBusy(false);}
  };
  const discardDraft=async()=>{
    if(sending.current)return;
    setBusy(true);
    try{await clearCivicDraft(userId);if(alive.current){setDraft(newDraft());setLoadError('');setError('');setSaveError('');setDiscard(false);}}
    catch{if(alive.current)setError('Could not discard the saved draft. Your original text is still on the device.');}
    finally{if(alive.current)setBusy(false);}
  };
  const confirm=discard?<Card><CivicNotice tone="warning">Discard this private request draft? Submitted requests and responses will stay in your account.</CivicNotice><Button title="Keep draft" variant="secondary" disabled={busy} onPress={()=>setDiscard(false)}/><Button title="Discard saved draft" busy={busy} onPress={()=>void discardDraft()}/></Card>:null;
  if(loadError)return <View className="gap-4"><CivicNotice tone="warning">{loadError}</CivicNotice><Button title="Retry restoring draft" onPress={()=>setAttempt(n=>n+1)}/><Button title="Discard draft" variant="quiet" onPress={()=>setDiscard(true)}/>{confirm}{error?<CivicNotice tone="warning">{error}</CivicNotice>:null}</View>;
  if(!draft)return <Loading label="Restoring private request draft…"/>;
  if(submitted)return <CivicNotice tone="positive">Sent for independent review.</CivicNotice>;
  const locked=busy||!!created.current;
  return <View className="gap-4">
    <Card><SectionTitle title="Ask the community" detail="One clear question can start a useful conversation. Add context and choose when responses close."/>
      <CommunitySelect<CivicCardInput['kind']> label="Request type" value={draft.input.kind} options={[{id:'request',label:'Civic request'},{id:'poll',label:'Opinion poll'}]} disabled={locked} onChange={kind=>update({kind})}/>
      {topicsEnabled?<CommunitySelect label="Topic" value={draft.input.topic??'general'} options={civicTopics} disabled={locked} onChange={topic=>update({topic})}/>:draft.input.topic!==undefined?<><CivicNotice>This server does not support topics yet. Keep your question and remove its topic to continue.</CivicNotice><Button title="Remove unsupported topic" variant="secondary" disabled={locked} onPress={()=>update({topic:undefined})}/></>:null}
      <Field label="Question or request" value={draft.input.title} maxLength={180} editable={!locked} onChangeText={title=>update({title})}/>
      <Field label="Why does this matter?" value={draft.input.body} maxLength={4000} multiline textAlignVertical="top" style={{minHeight:144}} editable={!locked} onChangeText={body=>update({body})} hint="Use respectful, factual language. Keep private information and personal allegations out."/>
      <LocationFields value={{latitude:0,longitude:0,countryCode:draft.input.countryCode,locality:draft.input.locality}} disabled={locked} onChange={location=>update({countryCode:location.countryCode,locality:location.locality})}/>
      <DeadlineSelect value={draft.input.closesAt} disabled={locked} onChange={closesAt=>update({closesAt})}/>
      <CivicNotice>{draft.input.kind==='poll'?"Polls offer Yes, No and Don't know. Results appear after closing. This is a voluntary opinion survey, with no money or wagering.":'People can support, oppose or express uncertainty about this request. Support is account-backed participation, not a legal signature or an official government petition.'}</CivicNotice>
      <CivicConsent label="I accept the community rules and agree to publish this request under my nickname after review." checked={draft.input.consent} disabled={locked} onChange={()=>update({consent:!draft.input.consent,rulesVersion:communityRulesVersion})}/>
      {saveError?<><CivicNotice tone="warning">{saveError}</CivicNotice><Button title="Retry saving draft" variant="secondary" onPress={()=>{void saveCivicDraft(userId,draft).then(()=>setSaveError('')).catch(()=>setSaveError('Could not save this draft on your device. Retry saving before submitting.'));}}/></>:null}
      {error?<CivicNotice tone="warning">{error}</CivicNotice>:null}
      <Button title={created.current?'Open saved request':'Send for review'} busy={busy} disabled={!created.current&&(!valid(draft.input)||!!saveError||(!topicsEnabled&&draft.input.topic!==undefined))} onPress={()=>void submit()}/>
      <Button title="Discard draft" variant="quiet" disabled={locked} onPress={()=>setDiscard(true)}/>
    </Card>{confirm}
  </View>;
}
