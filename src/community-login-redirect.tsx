import { useCallback, useEffect, useState } from 'react';
import { Redirect, useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { readLoginDestination, rememberLoginDestination, type CommunityDestination } from './login-destination';
import { Button, Loading, Notice } from './ui';

export function RememberCommunityLink({path}:{path:string}){
  const [ready,setReady]=useState(false),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true;setError(false);void rememberLoginDestination(path).then(()=>{if(active)setReady(true);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[path,attempt]);
  if(ready)return <Redirect href="/sign-in"/>;
  if(error)return <View className="gap-3 p-5"><Notice>Could not save the shared request link on this device.</Notice><Button title="Retry opening sign-in" onPress={()=>setAttempt(n=>n+1)}/><Button title="Sign in without this link" variant="secondary" onPress={()=>setReady(true)}/></View>;
  return <Loading label="Preparing secure sign-in…"/>;
}

export function PostLoginRedirect(){
  const [focused,setFocused]=useState(false);
  useFocusEffect(useCallback(()=>{setFocused(true);return()=>setFocused(false);},[]));
  const [destination,setDestination]=useState<CommunityDestination|null>(null),[ready,setReady]=useState(false),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{if(!focused)return;let active=true;setReady(false);setError(false);void readLoginDestination().then(value=>{if(active){setDestination(value);setReady(true);}}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[focused,attempt]);
  if(!focused)return null;
  if(error)return <View className="gap-3 p-5"><Notice>Signed in. Could not restore the shared request link.</Notice><Button title="Retry shared request" onPress={()=>setAttempt(n=>n+1)}/><Button title="Continue to reports" variant="secondary" onPress={()=>{setDestination(null);setReady(true);setError(false);}}/></View>;
  if(!ready)return <Loading label="Opening CivicLens…"/>;
  return <Redirect href={destination??'/(tabs)'}/>;
}
