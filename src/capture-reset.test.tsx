import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import {SessionProvider,useSession} from './session';
import Capture from '../app/(tabs)/index';

jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()}),useFocusEffect:()=>{}}));
jest.mock('expo-file-system/legacy',()=>({documentDirectory:'file:///drafts/',deleteAsync:jest.fn(async()=>{})}));
jest.mock('expo-crypto',()=>{let id=0;return {randomUUID:()=>`draft-${++id}`};});
const stored=new Map<string,string>();
function SignedInCapture(){const {loading}=useSession();return loading ? null : <Capture/>;}
function open(){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});return render(<QueryClientProvider client={client}><SessionProvider><SignedInCapture/></SessionProvider></QueryClientProvider>);}
beforeEach(()=>{
  stored.clear();
  stored.set('civiclens-session-v1',JSON.stringify({token:'synthetic-session',expiresAt:'2099-01-01',user:{id:'qa-reset',nickname:'TestFox'}}));
  stored.set('civiclens-draft-qa-reset',JSON.stringify({key:'old-key',photoUri:'file:///drafts/civiclens-photo-test.jpg',category:'roads',description:'Old report description',location:{latitude:1,longitude:2,countryCode:'AU',locality:'Test town'},locationSource:'manual',channels:['facebook'],consent:true,hashtags:[]}));
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async key=>stored.get(key)||null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async(key,value)=>{stored.set(key,value);});
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key=>{stored.delete(key);});
  globalThis.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({assist:false,authorityPreview:false})});
});
test('keeps the draft on cancellation, then discards it across reopening and allows a fresh description',async()=>{
  const view=open();
  expect(await screen.findByDisplayValue('Old report description')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Discard draft'}));
  fireEvent.press(screen.getByRole('button',{name:'Keep draft'}));
  expect(screen.getByDisplayValue('Old report description')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Discard draft'}));
  fireEvent.press(screen.getByRole('button',{name:'Discard and start again'}));
  await waitFor(()=>expect(screen.getByLabelText('Description').props.value).toBe(''));
  expect(screen.queryByLabelText('Your report photo')).toBeNull();
  expect(screen.getByLabelText('Description').props.value).toBe('');
  expect(screen.getByLabelText('Confirm my post and sharing responsibility').props.value).toBe(false);
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///drafts/civiclens-photo-test.jpg',{idempotent:true});
  view.unmount();open();
  await screen.findByLabelText('Description');
  expect(screen.getByLabelText('Description').props.value).toBe('');
  fireEvent.changeText(screen.getByLabelText('Description'),'A new report about litter');
  expect(screen.getByDisplayValue('A new report about litter')).toBeOnTheScreen();
  expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/v1/reports'),expect.anything());
});
test('shows a retryable reset error without claiming the draft was discarded',async()=>{
  open();await screen.findByDisplayValue('Old report description');
  jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('locked'));
  fireEvent.press(screen.getByRole('button',{name:'Discard draft'}));
  fireEvent.press(screen.getByRole('button',{name:'Discard and start again'}));
  expect(await screen.findByText('Could not discard your draft. Please retry.')).toBeOnTheScreen();
  expect(screen.getByDisplayValue('Old report description')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Discard and start again'}));
  await waitFor(()=>expect(screen.getByLabelText('Description').props.value).toBe(''));
});
