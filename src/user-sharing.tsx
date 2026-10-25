import { Text } from './text';
import {useEffect,useRef,useState} from 'react';
import { Linking, Platform, Switch, View } from 'react-native';
import {Image} from 'expo-image';
import { SocialDestinationSelect } from './social-destination-select';
import {request} from './api';
import {Button,Notice,palette} from './ui';
import {channelLabels as labels, type Channel, type Report, type SharePackage} from '../shared/contracts';

export function UserSharing({report,token}:{report:Report;token:string}) {
  const [selected,setSelected]=useState<Channel[]>([]);
  const [acknowledged,setAcknowledged]=useState(false);
  const [prepared,setPrepared]=useState<SharePackage[]|null>(null);
  const [opened,setOpened]=useState<Channel[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const generation=useRef(0);
  const saved=useRef({photos:'',count:0});
  const working=useRef(false);
  const channelKey=[...new Set(report.publications.map(p=>p.channel))].join(',');
  const available=report.sharingMode==='manual' && report.status==='approved';
  useEffect(()=>{
    saved.current={photos:'',count:0};working.current=false;
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
  const tiktokAction=async(target:SharePackage,action:'save'|'copy'|'open')=>{
    if(!prepared || !acknowledged || !available || Platform.OS==='web' || working.current || busy)return;
    working.current=true;
    const run=generation.current;const active=()=>run===generation.current;
    setBusy(true);setMessage('');
    try {
      const fresh=await packageForShare('tiktok');
      if(!active())return;
      if(JSON.stringify(fresh)!==JSON.stringify(target)){setPrepared(null);setMessage('Reviewed content changed. Prepare and check the post again.');return;}
      if(action==='copy'){
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const clipboard:typeof import('expo-clipboard')=require('expo-clipboard');
        if(!active())return;
        if(!await clipboard.setStringAsync(fresh.caption))throw new Error('Clipboard unavailable');
        if(active())setMessage('Reviewed caption copied. Paste it into TikTok and check it before posting.');
      } else if(action==='open'){
        await Linking.openURL('https://www.tiktok.com/');
        if(active())setMessage('TikTok opened. Choose Upload, select your saved photos in order, paste the caption and confirm your account before posting. CivicLens cannot verify delivery.');
      } else {
        if(Platform.OS==='android' && Number(Platform.Version)<33){setMessage('Use the share menu to save photos on this Android version, then upload them in TikTok.');return;}
        // Explicit legacy entry preserves add-only access; the SDK 57 top-level save method throws.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const media:typeof import('expo-media-library/legacy')=require('expo-media-library/legacy');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const files:typeof import('expo-file-system/legacy')=require('expo-file-system/legacy');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const crypto:typeof import('expo-crypto')=require('expo-crypto');
        if(Platform.OS==='ios'){
          const permission=await media.requestPermissionsAsync(true,['photo']);
          if(!active())return;
          if(!permission.granted){setMessage('Photo access was not granted. Allow adding photos in Settings or use the share menu. CivicLens does not need to read your photo library.');return;}
        }
        if(!files.cacheDirectory)throw new Error('Photo cache unavailable');
        const photoKey=JSON.stringify(fresh.photosBase64);
        if(saved.current.photos!==photoKey)saved.current={photos:photoKey,count:0};
        const progress=saved.current;
        try {
          while(progress.count<fresh.photosBase64.length){
            if(!active())return;
            const uri=`${files.cacheDirectory}civiclens-share-${crypto.randomUUID()}.jpg`;
            try {
              await files.writeAsStringAsync(uri,fresh.photosBase64[progress.count],{encoding:files.EncodingType.Base64});
              if(!active())return;
              await media.saveToLibraryAsync(uri);
              progress.count++;
            } finally {await files.deleteAsync(uri,{idempotent:true});}
          }
          if(active())setMessage(`${progress.count} of ${fresh.photosBase64.length} reviewed photos saved to Photos. Copies remain there until you remove them. Copy the caption, then open TikTok.`);
        } catch {
          if(active())setMessage(`${progress.count} of ${fresh.photosBase64.length} photos saved. Check Photos before retrying; an interrupted save may already have created a copy. Retry continues after confirmed saves while this screen stays open.`);
        }
      }
    } catch {if(active())setMessage('TikTok preparation could not continue. Check your connection and review status, update CivicLens if needed, then retry. No delivery is confirmed.');}
    finally {if(active()){working.current=false;setBusy(false);}}
  };
  if(report.sharingMode!=='manual'||!report.publications.length)return null;
  return <View className="gap-3 rounded-2xl border border-line bg-surface p-4">
    <Text accessibilityRole="header" className="text-[17px] font-semibold text-ink">Share to your communities</Text>
    <Text className="text-sm leading-5 text-muted">You own and manage your groups, Channels and accounts in their apps. Choose the destination and confirm the post there. No extra social login is needed in CivicLens.</Text>
    {!available ? <Notice>Sharing is available after every photo, the public caption and responsible authority have been reviewed.</Notice> : <>
      <Text className="text-sm leading-5 text-muted">Your social profile name, username, Page name or phone number may be visible. The caption credits your CivicLens nickname; it does not hide the sender in another app.</Text>
      <Text className="text-sm leading-5 text-muted">Choose one, several or all destinations. Your phone opens one app at a time; confirm each post in the matching app.</Text>
      <SocialDestinationSelect value={selected} options={report.publications.map(p=>p.channel)} disabled={busy} onChange={choose}/>
      <View className="flex-row items-center gap-3"><Text className="flex-1 text-sm leading-5 text-ink">I understand my social account identity may be visible.</Text><Switch accessibilityLabel="Accept social identity visibility" value={acknowledged} disabled={busy} onValueChange={value=>{setAcknowledged(value);setPrepared(null);setOpened([]);setMessage('');}} trackColor={{true:palette.brand}}/></View>
      <Button title="Prepare reviewed post" variant="secondary" disabled={!acknowledged || !selected.length || busy || Platform.OS==='web'} busy={busy} onPress={()=>void prepare()}/>
      {prepared ? <>
        <Text className="text-sm font-semibold text-ink">{prepared.length} {prepared.length===1?'destination':'destinations'} selected</Text>
        <Text className="text-sm font-semibold text-ink">{prepared[0].photosBase64.length} reviewed {prepared[0].photosBase64.length===1?'photo':'photos'}</Text>
        <View className="flex-row flex-wrap gap-2">{prepared[0].photosBase64.map((photo,index)=><Image key={index} source={{uri:`data:image/jpeg;base64,${photo}`}} accessibilityLabel={`Reviewed photo ${index+1}`} contentFit="cover" style={{width:88,height:88,borderRadius:12}}/>)}</View>
        <Notice>Some apps may omit the caption or limit attachments. Check every photo, the caption, the sending account and the destination before posting.</Notice>
        {prepared.map(target=><View key={target.channel} className="gap-3 border-t border-line pt-3">
          <Text accessibilityRole="header" className="font-semibold text-ink">{labels[target.channel]}</Text>
          <Text selectable className="text-sm leading-6 text-ink">{target.caption}</Text>
          <Button title={prepared.length===1?'Choose app and destination':`Open ${labels[target.channel]} sharing options`} icon="share-outline" disabled={!acknowledged || busy || Platform.OS==='web'} busy={busy} onPress={()=>void share(target)}/>
          {target.channel==='tiktok'?<View className="gap-3 rounded-xl border border-line p-3">
            <Text className="text-sm leading-5 text-muted">If TikTok is missing from the share menu, save the reviewed photos, copy the caption, then open TikTok. Choose Upload and select your photos in order. TikTok may require its app or an account. Check every attachment and your sending account before posting.</Text>
            <Notice>Saving creates copies in your photo library, which may sync through your device’s photo backup settings. Copying places the public caption on your clipboard. CivicLens cannot remove exported copies or confirm a TikTok post.</Notice>
            <Button title="Save reviewed photos for TikTok" icon="download-outline" variant="secondary" disabled={!acknowledged || busy || Platform.OS==='web'} onPress={()=>void tiktokAction(target,'save')}/>
            <Button title="Copy TikTok caption" icon="copy-outline" variant="secondary" disabled={!acknowledged || busy || Platform.OS==='web'} onPress={()=>void tiktokAction(target,'copy')}/>
            <Button title="Open TikTok" icon="logo-tiktok" variant="secondary" disabled={!acknowledged || busy || Platform.OS==='web'} onPress={()=>void tiktokAction(target,'open')}/>
          </View>:null}
          {opened.includes(target.channel)?<Text className="text-sm leading-5 text-muted">{labels[target.channel]}: options opened; delivery unverified</Text>:null}
        </View>)}
      </> : null}
      {Platform.OS==='web'?<Notice>Use the iOS or Android app to share reviewed photos.</Notice>:null}
    </>}
    {message?<Notice>{message}</Notice>:null}
  </View>;
}
