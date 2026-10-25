import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Button, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SessionProvider, useSession } from './session';

const session={token:'a'.repeat(64),expiresAt:new Date(Date.now()+86400000).toISOString(),user:{id:'test-account',nickname:'HappyKea'}};
function Probe(){const {session,loading,signOut}=useSession();return <View><Text>{loading?'Loading':session?'Signed in':'Signed out'}</Text><Button title="Sign out" onPress={()=>void signOut().catch(()=>{})}/></View>;}
let client:QueryClient;
beforeEach(()=>{client=new QueryClient({defaultOptions:{queries:{gcTime:Infinity}}});jest.clearAllMocks();jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(session));jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);});
afterEach(()=>client.clear());

test('clears device credentials and private cached data when the API is offline',async()=>{
  globalThis.fetch=jest.fn().mockRejectedValue(new Error('offline'));
  client.setQueryData(['community-card','test-account','card-1'],{privateChoice:'yes'});
  render(<QueryClientProvider client={client}><SessionProvider><Probe/></SessionProvider></QueryClientProvider>);
  await screen.findByText('Signed in');fireEvent.press(screen.getByRole('button',{name:'Sign out'}));
  await screen.findByText('Signed out');
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('civiclens-session-v1');
  expect(client.getQueryData(['community-card','test-account','card-1'])).toBeUndefined();
  client.clear();
});

test('keeps the session visible for retry if the device cannot clear its credentials',async()=>{
  jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('device locked'));
  globalThis.fetch=jest.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true})});
  render(<QueryClientProvider client={client}><SessionProvider><Probe/></SessionProvider></QueryClientProvider>);
  await screen.findByText('Signed in');fireEvent.press(screen.getByRole('button',{name:'Sign out'}));
  await waitFor(()=>expect(SecureStore.deleteItemAsync).toHaveBeenCalled());
  expect(screen.getByText('Signed in')).toBeTruthy();
  client.clear();
});
