import { Text } from './text';
import {useEffect,useRef,useState} from 'react';
import { Linking, Platform, Switch, View } from 'react-native';
import {Image} from 'expo-image';
import { SocialDestinationSelect } from './social-destination-select';
import {request} from './api';
import socialApps from '../shared/social-apps.json';
import {Button,Notice,channelIcons,palette} from './ui';
import {channelLabels as labels, type Channel, type Report, type SharePackage} from '../shared/contracts';

export function UserSharing({report,token}:{report:Report;token:string}) {
  const [selected,setSelected]=useState<Channel[]>([]);
  const [acknowledged,setAcknowledged]=useState(false);
  const [prepared,setPrepared]=useState<SharePackage[]|null>(null);
  const [opened,setOpened]=useState<Channel[]>([]);
  const [step,setStep]=useState(0);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const generation=useRef(0);
  const saved=useRef({photos:'',count:0});
  const working=useRef(false);
  const channelKey=[...new Set(report.publications.map(p=>p.channel))].join(',');
  const available=report.sharingMode==='manual' && report.status==='approved';
  useEffect(()=>{
    saved.current={photos:'',count:0};working.current=false;
    generation.current++;setAcknowledged(false);setPrepared(null);setOpened([]);setStep(0);setMessage('');setBusy(false);
    setSelected(channelKey ? [channelKey.split(',')[0] as Channel] : []);
    return ()=>{generation.current++;};
  },[token,report.id,available,channelKey]);
  const choose=(channels:Channel[])=>{generation.current++;setSelected(channels);setPrepared(null);setOpened([]);setStep(0);setMessage('');};
  const packageForShare=async(channel:Channel)=>{
    const value=await request<SharePackage>(`/v1/reports/${encodeURIComponent(report.id)}/share-package`,{token,method:'POST',body:{channel,identityAcknowledged:true},timeoutMs:80000});
    if(value.reportId!==report.id || value.channel!==channel || typeof value.caption!=='string' || !value.caption.trim() || value.caption.length>10000 || !Array.isArray(value.photosBase64) || value.photosBase64.length<1 || value.photosBase64.length>5 || value.photosBase64.some(photo=>typeof photo!=='string' || photo.length>8100000 || !/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(photo))) throw new Error('Invalid reviewed package');
    return value;
  };
  const prepare=async()=>{
    if(!selected.length || !acknowledged || !available || working.current)return;
    working.current=true;
    const run=generation.current;setBusy(true);setMessage('');setPrepared(null);setOpened([]);setStep(0);
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
    finally {if(run===generation.current){working.current=false;setBusy(false);}}
  };
  const share=async(target:SharePackage)=>{
    if(!prepared || !acknowledged || !available || Platform.OS==='web' || working.current)return;
    working.current=true;
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
    finally {if(run===generation.current){working.current=false;setBusy(false);}}
  };
  const appAction=async(target:SharePackage,action:'save'|'copy'|'open'|'prepare')=>{
    if(!prepared || !acknowledged || !available || Platform.OS==='web' || working.current || busy)return;
    working.current=true;
    const run=generation.current;const active=()=>run===generation.current;
    setBusy(true);setMessage('');
    try {
      const fresh=await packageForShare(target.channel);
      if(!active())return;
      if(JSON.stringify(fresh)!==JSON.stringify(target)){setPrepared(null);setMessage('Reviewed content changed. Prepare and check the post again.');return;}
      const url=socialApps[target.channel];
      const canOpen=async()=>{
        if(Platform.OS==='ios' && target.channel!=='tiktok'){
          const installed=await Linking.canOpenURL(url);
          if(!active())return false;
          if(!installed){setMessage(`${labels[target.channel]} is not available. Install or update it, then retry, or use the system share menu.`);return false;}
        }
        return active();
      };
      const copy=async()=>{
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const clipboard:typeof import('expo-clipboard')=require('expo-clipboard');
        if(!active())return false;
        if(!await clipboard.setStringAsync(fresh.caption))throw new Error('Clipboard unavailable');
        if(active())setMessage(`Reviewed caption copied. Paste it into ${labels[target.channel]} and check it before posting.`);
        return active();
      };
      const open=async()=>{
        if(!active())return;
        await Linking.openURL(url);
        if(active()){
          setOpened(current=>[...new Set([...current,target.channel])]);
          setMessage(`${labels[target.channel]} ${target.channel==='tiktok'?'app or website':'app'} opened. Opening an app does not attach photos or paste a caption. Create a post or message, select your saved photos, paste the copied caption and check your account and destination before posting. CivicLens cannot verify delivery. Return to CivicLens for the next selected app.`);
        }
      };
      if(action==='copy'){
        await copy();
      } else if(action==='open'){
        if(await canOpen())await open();
      } else {
        if(action==='prepare'&&!await canOpen())return;
        if(Platform.OS==='android' && Number(Platform.Version)<33){setMessage(`Use the share menu to save photos on this Android version, then upload them in ${labels[target.channel]}.`);return;}
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
          if(active())setMessage(`${progress.count} of ${fresh.photosBase64.length} reviewed photos saved to Photos. Copies remain there until you remove them. Copy the caption, then open ${labels[target.channel]}.`);
        } catch {
          if(active())setMessage(`${progress.count} of ${fresh.photosBase64.length} photos saved. Check Photos before retrying; an interrupted save may already have created a copy. Retry continues after confirmed saves while this screen stays open.`);
          return;
        }
        if(action==='prepare'&&active()){
          const latest=await packageForShare(target.channel);
          if(!active())return;
          if(JSON.stringify(latest)!==JSON.stringify(target)){setPrepared(null);setMessage('Reviewed content changed. Prepare and check the post again.');return;}
          if(await copy())await open();
        }
      }
    } catch {if(active())setMessage(`${labels[target.channel]} preparation could not continue. Check that the app is installed, your connection and review status, then retry. No delivery is confirmed.`);}
    finally {if(active()){working.current=false;setBusy(false);}}
  };
  if(report.sharingMode!=='manual'||!report.publications.length)return null;
  return <View className="gap-3 rounded-2xl border border-line bg-surface p-4">
    <Text accessibilityRole="header" className="text-[17px] font-semibold text-ink">Share to your communities</Text>
    <Text className="text-sm leading-5 text-muted">You own and manage your groups, Channels and accounts in their apps. Choose the destination and confirm the post there. No extra social login is needed in CivicLens.</Text>
    {!available ? <Notice>Sharing is available after every photo, the public caption and responsible authority have been reviewed. Selecting an app does not start that review or send a post. Your report is private; return here after approval to prepare and share it.</Notice> : <>
      <Text className="text-sm leading-5 text-muted">Your social profile name, username, Page name or phone number may be visible. The caption credits your CivicLens nickname; it does not hide the sender in another app.</Text>
      <Text className="text-sm leading-5 text-muted">Choose one, several or all destinations. Your phone opens one app at a time; confirm each post in the matching app.</Text>
      <SocialDestinationSelect value={selected} options={report.publications.map(p=>p.channel)} disabled={busy} onChange={choose}/>
      <View className="flex-row items-center gap-3"><Text className="flex-1 text-sm leading-5 text-ink">I understand my social account identity may be visible.</Text><Switch accessibilityLabel="Accept social identity visibility" value={acknowledged} disabled={busy} onValueChange={value=>{generation.current++;working.current=false;setBusy(false);setAcknowledged(value);setPrepared(null);setOpened([]);setStep(0);setMessage('');}} trackColor={{true:palette.brand}}/></View>
      <Button title="Prepare reviewed post" variant="secondary" disabled={!acknowledged || !selected.length || busy || Platform.OS==='web'} busy={busy} onPress={()=>void prepare()}/>
      {prepared ? <>
        <Text className="text-sm font-semibold text-ink">{prepared.length} {prepared.length===1?'destination':'destinations'} selected</Text>
        <Text className="text-sm font-semibold text-ink">{prepared[0].photosBase64.length} reviewed {prepared[0].photosBase64.length===1?'photo':'photos'}</Text>
        <View className="flex-row flex-wrap gap-2">{prepared[0].photosBase64.map((photo,index)=><Image key={index} source={{uri:`data:image/jpeg;base64,${photo}`}} accessibilityLabel={`Reviewed photo ${index+1}`} contentFit="cover" style={{width:88,height:88,borderRadius:12}}/>)}</View>
        <Notice>Some apps may omit the caption or limit attachments. Check every photo, the caption, the sending account and the destination before posting.</Notice>
        {prepared.slice(step,step+1).map(target=><View key={target.channel} className="gap-3 border-t border-line pt-3">
          <Text accessibilityRole="header" className="font-semibold text-ink">App {step+1} of {prepared.length}: {labels[target.channel]}</Text>
          <Text selectable className="text-sm leading-6 text-ink">{target.caption}</Text>
          <Button title={`Open system share menu for ${labels[target.channel]}`} icon="share-outline" disabled={!acknowledged || busy || Platform.OS==='web'} busy={busy} onPress={()=>void share(target)}/>
          <View className="gap-3 rounded-xl border border-line p-3">
            <Text className="text-sm font-semibold text-ink">Post in {labels[target.channel]}</Text>
            <Text className="text-sm leading-5 text-muted">If {labels[target.channel]} is missing from the share menu or drops attachments, use these steps: save the reviewed photos, copy the caption, then open {labels[target.channel]}. Create a post or message and add all your saved photos. Opening the app does not attach them automatically.</Text>
            {target.channel==='tiktok'?<Text className="text-sm leading-5 text-muted">The TikTok link may open its app or website, depending on your device. If the website cannot upload your photos, open TikTok from your home screen.</Text>:null}
            <Notice>Saving creates copies in Photos, which may sync through your device’s backup settings. Copying places the public caption on your clipboard. CivicLens cannot remove exported copies or confirm a post.</Notice>
            <Button title={`Save photos, copy caption & open ${labels[target.channel]}`} icon={channelIcons[target.channel]} disabled={!acknowledged || busy || Platform.OS==='web'} busy={busy} onPress={()=>void appAction(target,'prepare')}/>
            <Button title={`Save reviewed photos for ${labels[target.channel]}`} icon="download-outline" variant="secondary" disabled={!acknowledged || busy || Platform.OS==='web'} onPress={()=>void appAction(target,'save')}/>
            <Button title={`Copy ${labels[target.channel]} caption`} icon="copy-outline" variant="secondary" disabled={!acknowledged || busy || Platform.OS==='web'} onPress={()=>void appAction(target,'copy')}/>
            <Button title={target.channel==='tiktok'?'Open TikTok app or website':`Open ${labels[target.channel]}`} icon={channelIcons[target.channel]} variant="secondary" disabled={!acknowledged || busy || Platform.OS==='web'} onPress={()=>void appAction(target,'open')}/>
          </View>
          {opened.includes(target.channel)?<Text className="text-sm leading-5 text-muted">{labels[target.channel]}: options opened; delivery unverified</Text>:null}
          <Text className="text-sm leading-5 text-muted">Finish or cancel in this app, then return here. Continuing does not mark a post as delivered.</Text>
          <View className="gap-2">
            {step+1<prepared.length?<Button title={`Next app: ${labels[prepared[step+1].channel]}`} icon="arrow-forward" disabled={busy} onPress={()=>{setStep(current=>current+1);setMessage('');}}/>:null}
            {step>0?<Button title={`Previous app: ${labels[prepared[step-1].channel]}`} variant="quiet" disabled={busy} onPress={()=>{setStep(current=>current-1);setMessage('');}}/>:null}
          </View>
        </View>)}
      </> : null}
      {Platform.OS==='web'?<Notice>Use the iOS or Android app to share reviewed photos.</Notice>:null}
    </>}
    {message?<Notice>{message}</Notice>:null}
  </View>;
}
