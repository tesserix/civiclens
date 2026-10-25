import {render,screen} from '@testing-library/react-native';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import {SessionProvider} from './session';
import Welcome from '../app/sign-in';

test('sign-in explains owner-confirmed social sharing without a moderator wait',async()=>{
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  globalThis.fetch=jest.fn(async()=>({ok:true,json:async()=>({google:true,facebook:false,apple:false})})) as jest.Mock;
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  render(<QueryClientProvider client={client}><SessionProvider><Welcome/></SessionProvider></QueryClientProvider>);
  await screen.findByText('Report what needs fixing near you.');
  expect(screen.getByText(/Share through your own social apps without waiting for moderator approval/)).toBeOnTheScreen();
  expect(screen.queryByText(/Every report is reviewed before/)).toBeNull();
  expect(screen.queryByText(/are reviewed before public sharing/)).toBeNull();
});
