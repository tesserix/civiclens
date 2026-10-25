jest.unmock('expo-router');
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import { Text, Pressable } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostLoginRedirect } from './community-login-redirect';
import { readLoginDestination } from './login-destination';
import { SessionProvider, useSession } from './session';
import * as SecureStore from 'expo-secure-store';
import { fireEvent } from '@testing-library/react-native';
import CommunityLayout from '../app/community/_layout';
import TabLayout from '../app/(tabs)/_layout';

test('signed-out tab navigation reaches the unambiguous sign-in route',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{gcTime:0,retry:false}}});
  function Root(){return <QueryClientProvider client={client}><SessionProvider><Stack/></SessionProvider></QueryClientProvider>;}
  const navigation=renderRouter({_layout:Root,index:()=> <Text>App entry</Text>,'sign-in':()=> <Text>Secure sign-in</Text>,'(tabs)/_layout':TabLayout,'(tabs)/index':()=> <Text>Capture</Text>,'(tabs)/profile':()=> <Text>Account</Text>,'(tabs)/reports':()=>null,'(tabs)/community':()=>null},{initialUrl:'/(tabs)/profile'});
  await waitFor(()=>expect(navigation.getPathname()).toBe('/sign-in'));
  expect(screen.getByText('Secure sign-in')).toBeOnTheScreen();
  client.clear();
});

test('a signed-in shared request has a visible way back to the community feed',async()=>{
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({token:'test-session',expiresAt:'2099-01-01',user:{id:'local-qa',nickname:'LocalKea'}}));
  const client=new QueryClient({defaultOptions:{queries:{gcTime:0,retry:false}}});
  function Root(){return <QueryClientProvider client={client}><SessionProvider><Stack/></SessionProvider></QueryClientProvider>;}
  const navigation=renderRouter({_layout:Root,'(tabs)/community':()=> <Text>Community feed</Text>,'community/_layout':CommunityLayout,'community/[id]':()=> <Text>Shared request detail</Text>,'community/new':()=>null,'community/directory':()=>null},{initialUrl:'/community/11111111-1111-4111-8111-111111111111'});
  const button=await screen.findByRole('button',{name:'Back to community'});
  fireEvent.press(button);
  await waitFor(()=>expect(navigation.getPathname()).toBe('/community'));
  expect(screen.getByText('Community feed')).toBeOnTheScreen();
  client.clear();
});


test('a shared request survives real router sign-in and clears its remembered destination',async()=>{
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  const client=new QueryClient({defaultOptions:{queries:{gcTime:0,retry:false}}});
  const id='11111111-1111-4111-8111-111111111111';
  function Root(){return <QueryClientProvider client={client}><SessionProvider><Stack/></SessionProvider></QueryClientProvider>;}
  function SignIn(){
    const {session,signIn}=useSession();
    if(session)return <PostLoginRedirect/>;
    return <Pressable accessibilityRole="button" accessibilityLabel="Complete test provider callback" onPress={()=>void signIn({token:'synthetic-provider-response',expiresAt:'2099-01-01',user:{id:'qa-sign-in',nickname:'LocalKea'}})}><Text>Complete test provider callback</Text></Pressable>;
  }
  const navigation=renderRouter({_layout:Root,'sign-in':SignIn,'(tabs)/index':()=>null,'(tabs)/community':()=>null,'community/_layout':CommunityLayout,'community/[id]':()=> <Text>Restored shared request</Text>,'community/new':()=>null,'community/directory':()=>null},{initialUrl:`/community/${id}`});
  fireEvent.press(await screen.findByRole('button',{name:'Complete test provider callback'}));
  await waitFor(()=>expect(navigation.getPathname()).toBe(`/community/${id}`));
  expect(screen.getByText('Restored shared request')).toBeOnTheScreen();
  await waitFor(async()=>expect(await readLoginDestination()).toBeNull());
  client.clear();
});
