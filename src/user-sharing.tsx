import {useEffect,useRef,useState} from 'react';
import {Platform,Switch,Text,View} from 'react-native';
import {Image} from 'expo-image';
import {request} from './api';
import {Button,Chip,Notice,palette} from './ui';
import type {Channel,Report,SharePackage} from '../shared/contracts';

const labels:Record<Channel,string>={facebook:'Facebook',instagram:'Instagram',whatsapp:'WhatsApp'};
export function UserSharing({report,token}:{report:Report;token:string}) {
  const [selected,setSelected]=useState<Channel[]>([]);
  const [acknowledged,setAcknowledged]=useState(false);
  const [prepared,setPrepared]=useState<SharePackage[]|null>(null);
  const [opened,setOpened]=useState<Channel[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const generation=useRef(0);
  const channelKey=[...new Set(report.publications.map(p=>p.channel))].join(',');
  const available=report.sharingMode==='manual' && report.status==='approved';
  useEffect(()=>{
    generation.current++;setAcknowledged(false);setPrepared(null);setOpened([]);setMessage('');setBusy(false);
    setSelected(channelKey ? [channelKey.split(',')[0] as Channel] : []);
    return ()=>{generation.current++;};
  },[token,report.id,available,channelKey]);
  const choose=(channels:Channel[])=>{generation.current++;setSelected(channels);setPrepared(null);setOpened([]);setMessage('');};
  const packageForShare=async(channel:Channel)=>{
    const value=await request<SharePackage>(`/v1/reports/${encodeURIComponent(report.id)}/share-package`,{token,method:'POST',body:{channel,identityAcknowledged:true},timeoutMs:80000});
    if(value.reportId!==report.id || value.channel!==channel || typeof value.caption!=='string' || !value.caption.trim() || value.caption.length>10000 || !Array.isArray(value.photosBase64) || value.photosBase64.length<1 || value.photosBase64.length>5 || value.photosBase64.some(photo=>typeof photo!=='string' || photo.length>8100000 || !/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(photo))) throw new Error('Invalid reviewed package');
    return value;
  };
  const prepare=async()=>{
    if(!selected.length || !acknowledged || !available)return;
    const run=generation.current;setBusy(true);setMessage('');setPrepared(null);setOpened([]);
    try {
      const packages:SharePackage[]=[];
      for(const channel of selected){
        const value=await packageForShare(channel);
        if(run!==generation.current)return;
        if(packages.length && JSON.stringify(value.photosBase64)!==JSON.stringify(packages[0].photosBase64))throw new Error('Reviewed photos changed');
        packages.push(value);
      }
      setPrepared(packages);
    }
    catch {if(run===generation.current)setMessage('The reviewed post could not be prepared. Keep your report and retry after review or connection is restored.');}
    finally {if(run===generation.current)setBusy(false);}
  };
  const share=async(target:SharePackage)=>{
    if(!prepared || !acknowledged || !available || Platform.OS==='web')return;
    const run=generation.current;setBusy(true);setMessage('');
    try {
      const fresh=await packageForShare(target.channel);
      if(run!==generation.current)return;
      if(JSON.stringify(fresh)!==JSON.stringify(target)) {setPrepared(null);setMessage('Reviewed content changed. Prepare and check the post again.');return;}
      // Older development clients can still read reports before installing the sharing module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const native: typeof import('react-native-share') = require('react-native-share');
      if(run!==generation.current)return;
      await native.default.open({title:`Share reviewed post to ${labels[target.channel]}`,message:fresh.caption,urls:fresh.photosBase64.map(photo=>`data:image/jpeg;base64,${photo}`),type:'image/jpeg',useInternalStorage:true,failOnCancel:false});
      if(run===generation.current){setOpened(current=>[...new Set([...current,target.channel])]);setMessage('Sharing options closed. Check your chosen app to confirm whether you posted. CivicLens cannot verify delivery.');}
    } catch {if(run===generation.current)setMessage('Sharing could not be opened. Your report is safe. Update CivicLens or retry after review and connection are available.');}
    finally {if(run===generation.current)setBusy(false);}
  };
  if(report.sharingMode!=='manual')return null;
  return <View className="gap-3 rounded-2xl border border-line bg-surface p-4">
    <Text accessibilityRole="header" className="text-[17px] font-semibold text-ink">Share to your communities</Text>
    <Text className="text-sm leading-5 text-muted">You own and manage your groups, Channels and accounts in their apps. Choose the destination and confirm the post there. No extra social login is needed in CivicLens.</Text>
    {!available ? <Notice>Sharing is available after every photo, the public caption and responsible authority have been reviewed.</Notice> : <>
      <Text className="text-sm leading-5 text-muted">Your social profile name, username, Page name or phone number may be visible. The caption credits your CivicLens nickname; it does not hide the sender in another app.</Text>
      <Text className="text-sm leading-5 text-muted">Choose one, several or all destinations. Your phone opens one app at a time; confirm each post in the matching app.</Text>
      <View className="flex-row flex-wrap gap-2">{report.publications.map(p=><Chip key={p.channel} role="checkbox" label={labels[p.channel]} selected={selected.includes(p.channel)} disabled={busy} onPress={()=>choose(selected.includes(p.channel)?selected.filter(c=>c!==p.channel):[...selected,p.channel])}/>)}</View>
      <View className="flex-row flex-wrap gap-2"><Button title="Select all destinations" compact variant="quiet" disabled={busy} onPress={()=>choose([...new Set(report.publications.map(p=>p.channel))])}/><Button title="Clear destinations" compact variant="quiet" disabled={busy} onPress={()=>choose([])}/></View>
      <View className="flex-row items-center gap-3"><Text className="flex-1 text-sm leading-5 text-ink">I understand my social account identity may be visible.</Text><Switch accessibilityLabel="Accept social identity visibility" value={acknowledged} disabled={busy} onValueChange={value=>{setAcknowledged(value);setPrepared(null);setOpened([]);setMessage('');}} trackColor={{true:palette.brand}}/></View>
      <Button title="Prepare reviewed post" variant="secondary" disabled={!acknowledged || !selected.length || busy || Platform.OS==='web'} busy={busy} onPress={()=>void prepare()}/>
      {prepared ? <>
        <Text className="text-sm font-semibold text-ink">{prepared.length} {prepared.length===1?'destination':'destinations'} selected</Text>
        <Text className="text-sm font-semibold text-ink">{prepared[0].photosBase64.length} reviewed photos</Text>
        <View className="flex-row flex-wrap gap-2">{prepared[0].photosBase64.map((photo,index)=><Image key={index} source={{uri:`data:image/jpeg;base64,${photo}`}} accessibilityLabel={`Reviewed photo ${index+1}`} contentFit="cover" style={{width:88,height:88,borderRadius:12}}/>)}</View>
        <Notice>Some apps may omit the caption or limit attachments. Check every photo, the caption, the sending account and the destination before posting.</Notice>
        {prepared.map(target=><View key={target.channel} className="gap-3 border-t border-line pt-3">
          <Text accessibilityRole="header" className="font-semibold text-ink">{labels[target.channel]}</Text>
          <Text selectable className="text-sm leading-6 text-ink">{target.caption}</Text>
          <Button title={prepared.length===1?'Choose app and destination':`Open ${labels[target.channel]} sharing options`} icon="share-outline" disabled={!acknowledged || busy || Platform.OS==='web'} busy={busy} onPress={()=>void share(target)}/>
          {opened.includes(target.channel)?<Text className="text-sm leading-5 text-muted">{labels[target.channel]}: options opened; delivery unverified</Text>:null}
        </View>)}
      </> : null}
      {Platform.OS==='web'?<Notice>Use the iOS or Android app to share reviewed photos.</Notice>:null}
    </>}
    {message?<Notice>{message}</Notice>:null}
  </View>;
}
