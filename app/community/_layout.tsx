import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../src/session';
import { Loading, palette } from '../../src/ui';
import { RememberCommunityLink } from '../../src/community-login-redirect';
import { clearLoginDestination } from '../../src/login-destination';
export default function CommunityLayout(){
  const {session,loading}=useSession(),path=usePathname(),router=useRouter();
  useEffect(()=>{if(session)void clearLoginDestination(path).catch(()=>{});},[session,path]);
  if(loading)return <View className="flex-1 justify-center bg-canvas"><Loading label="Checking your sign-in"/></View>;
  if(!session)return <RememberCommunityLink path={path}/>;
  return <Stack screenOptions={{headerLeft:()=> <Pressable accessibilityRole="button" accessibilityLabel="Back to community" onPress={()=>router.dismissTo('/(tabs)/community')} className="min-h-11 min-w-11 items-center justify-center" style={({pressed})=>({opacity:pressed?0.6:1})}><Ionicons name="chevron-back" size={24} color={palette.ink}/></Pressable>,headerStyle:{backgroundColor:palette.surface},headerTintColor:palette.ink,contentStyle:{backgroundColor:palette.canvas}}}><Stack.Screen name="new" options={{title:'Start a request'}}/><Stack.Screen name="directory" options={{title:'Councils & contacts'}}/><Stack.Screen name="[id]" options={{title:'Community request'}}/></Stack>;
}
