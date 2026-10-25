import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import {SessionProvider,useSession} from './session';
import {communityRulesVersion} from '../shared/generated';
import Capture from '../app/(tabs)/index';

jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()}),useFocusEffect:()=>{}}));
jest.mock('expo-crypto',()=>{let id=0;return {randomUUID:()=>`photo-${++id}`};});
jest.mock('expo-file-system/legacy',()=>({documentDirectory:'file:///drafts/',EncodingType:{Base64:'base64'},copyAsync:jest.fn(async()=>{}),deleteAsync:jest.fn(async()=>{}),readAsStringAsync:jest.fn(async()=>'cGhvdG8=')}));
jest.mock('expo-image-manipulator',()=>({SaveFormat:{JPEG:'jpeg'},manipulateAsync:jest.fn(async(uri:string)=>({uri:`processed:${uri}`}))}));
jest.mock('expo-image-picker',()=>({launchImageLibraryAsync:jest.fn(),requestCameraPermissionsAsync:jest.fn()}));
jest.mock('expo-location',()=>({reverseGeocodeAsync:jest.fn(async()=>[{city:'Melbourne',region:'VIC',isoCountryCode:'AU'}])}));
const stored=new Map<string,string>();
function SignedIn(){return useSession().loading ? null : <Capture/>;}
function open(){const client=new QueryClient({defaultOptions:{mutations:{gcTime:0},queries:{retry:false,gcTime:0}}});return render(<QueryClientProvider client={client}><SessionProvider><SignedIn/></SessionProvider></QueryClientProvider>);}
beforeEach(()=>{
  jest.clearAllMocks();stored.clear();
  stored.set('civiclens-session-v1',JSON.stringify({token:'synthetic-session',expiresAt:'2099-01-01',user:{id:'qa-photo',nickname:'SampleFox'}}));
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async key=>stored.get(key)||null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async(key,value)=>{stored.set(key,value);});
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key=>{stored.delete(key);});
  globalThis.fetch=jest.fn().mockImplementation(async(url)=>({ok:true,json:async()=>String(url).endsWith('/v1/capabilities') ? {assist:false,authorityPreview:false,manualSharing:true,complaintPreparation:true,maxPhotos:5,communityRulesVersion,facebookCountries:['AU'],publishing:{facebook:true}} : {id:'sample-report'}}));
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({canceled:false,assets:Array.from({length:5},(_,i)=>({uri:`library-${i}.jpg`,width:1600,height:1200,exif:{GPSLatitude:-37.814,GPSLongitude:144.9633}}))});
});

test('uploads five photos with the original photo GPS, country destination and explicit current rules acceptance',async()=>{
  open();await screen.findByLabelText('Description');
  fireEvent.press(screen.getByRole('button',{name:'Choose from photos'}));
  expect(await screen.findByText('5 of 5 photos')).toBeOnTheScreen();
  expect(screen.getByText(/You choose the group, Channel or account/)).toBeOnTheScreen();
  expect(screen.getByText(/Location suggested from photo metadata/)).toBeOnTheScreen();
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({exif:true,allowsMultipleSelection:true,selectionLimit:5}));
  fireEvent.changeText(screen.getByLabelText('Description'),'Litter is scattered beside the public path.');
  fireEvent(screen.getByLabelText('Consent to reviewed public sharing'),'valueChange',true);
  expect(screen.getByRole('button',{name:'Submit report'})).toBeDisabled();
  fireEvent(screen.getByLabelText('Accept community rules'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Submit report'}));
  await waitFor(()=>expect(jest.mocked(fetch).mock.calls.some(([url])=>String(url).endsWith('/v1/reports'))).toBe(true));
  const call=jest.mocked(fetch).mock.calls.find(([url])=>String(url).endsWith('/v1/reports'))!;
  const body=JSON.parse(call[1]!.body as string);
  expect(body.additionalPhotosBase64).toHaveLength(4);
  expect(body).not.toHaveProperty('complaintRequested');
  expect(body.location).toEqual({latitude:-37.814,longitude:144.9633,countryCode:'AU',locality:'Melbourne, VIC'});
  expect(body.sharingMode).toBe('manual');expect(body.locationSource).toBe('photo');expect(body.communityRulesVersion).toBe(communityRulesVersion);
});

test('preserves a manually selected place when importing a photo with different GPS',async()=>{
  const location={latitude:-33.8688,longitude:151.2093,countryCode:'AU',locality:'Sydney'};
  stored.set('civiclens-draft-qa-photo',JSON.stringify({key:'manual',photoUri:'',category:'waste',description:'Litter beside the public path.',location,locationSource:'manual',channels:['facebook'],consent:false}));
  open();await screen.findByDisplayValue('Sydney');
  fireEvent.press(screen.getByRole('button',{name:'Choose from photos'}));
  await screen.findByText('5 of 5 photos');
  expect(screen.getByDisplayValue('Sydney')).toBeOnTheScreen();
  fireEvent(screen.getByLabelText('Consent to reviewed public sharing'),'valueChange',true);
  fireEvent(screen.getByLabelText('Accept community rules'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Submit report'}));
  await waitFor(()=>expect(jest.mocked(fetch).mock.calls.some(([url])=>String(url).endsWith('/v1/reports'))).toBe(true));
  const call=jest.mocked(fetch).mock.calls.find(([url])=>String(url).endsWith('/v1/reports'))!;
  expect(JSON.parse(call[1]!.body as string)).toMatchObject({location,locationSource:'manual'});
});


test('offers user-owned destinations without a CivicLens country-Page mode',async()=>{
  open();await screen.findByLabelText('Description');
  expect(screen.queryByRole('radio',{name:'CivicLens country Pages'})).toBeNull();
  expect(screen.queryByRole('radio',{name:'Share using my own apps'})).toBeNull();
  expect(screen.getByText(/You choose the group, Channel or account/)).toBeOnTheScreen();
  expect(screen.queryByRole('checkbox',{name:'Instagram'})).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  fireEvent.press(screen.getByRole('checkbox',{name:'Instagram'}));
  fireEvent.press(screen.getByRole('checkbox',{name:'WhatsApp'}));
  for(const name of ['Facebook','Instagram','WhatsApp'])expect(screen.getByRole('checkbox',{name})).toBeChecked();
  fireEvent.press(screen.getByRole('button',{name:'Done'}));
  expect(screen.getByRole('button',{name:'Social apps, All 3 apps selected'})).toBeOnTheScreen();
  expect(screen.queryByRole('checkbox',{name:'Instagram'})).toBeNull();
});

test('offers TikTok only when the server supports it and submits all four as manual destinations',async()=>{
  jest.mocked(fetch).mockImplementation(async(url)=>({ok:true,json:async()=>String(url).endsWith('/v1/capabilities') ? {manualSharing:true,manualShareChannels:['facebook','instagram','whatsapp','tiktok'],maxPhotos:5,communityRulesVersion} : {id:'sample-report'}}) as Response);
  open();await screen.findByRole('button',{name:'Social apps, Facebook'});
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  expect(screen.getByRole('checkbox',{name:'TikTok'})).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Select all social apps'}));
  expect(screen.getByRole('checkbox',{name:'TikTok'})).toBeChecked();
  fireEvent.press(screen.getByRole('button',{name:'Done'}));
  expect(screen.getByRole('button',{name:'Social apps, All 4 apps selected'})).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Choose from photos'}));
  await screen.findByText('5 of 5 photos');
  fireEvent.changeText(screen.getByLabelText('Description'),'Litter is scattered beside the public path.');
  fireEvent(screen.getByLabelText('Consent to reviewed public sharing'),'valueChange',true);
  fireEvent(screen.getByLabelText('Accept community rules'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Submit report'}));
  await waitFor(()=>expect(jest.mocked(fetch).mock.calls.some(([url])=>String(url).endsWith('/v1/reports'))).toBe(true));
  const call=jest.mocked(fetch).mock.calls.find(([url])=>String(url).endsWith('/v1/reports'))!;
  expect(JSON.parse(call[1]!.body as string)).toMatchObject({sharingMode:'manual',channels:['facebook','instagram','whatsapp','tiktok']});
});

test('preserves a TikTok draft but blocks submission against an older server',async()=>{
  stored.set('civiclens-draft-qa-photo',JSON.stringify({key:'tiktok-draft',sharingMode:'manual',photoUri:'file:///drafts/civiclens-photo-test.jpg',category:'waste',description:'Litter beside the public path.',location:{latitude:-37.814,longitude:144.9633,countryCode:'AU',locality:'Melbourne'},channels:['tiktok'],consent:true,communityRulesVersion}));
  open();await screen.findByText(/Some saved destinations are unavailable/);
  expect(screen.queryByRole('checkbox',{name:'TikTok'})).toBeNull();
  expect(screen.getByRole('button',{name:'Submit report'})).toBeDisabled();
  expect(screen.getByDisplayValue('Litter beside the public path.')).toBeOnTheScreen();
});

test('explains the missing community-rules acceptance beside a disabled submission',async()=>{
  stored.set('civiclens-draft-qa-photo',JSON.stringify({key:'ready-except-rules',sharingMode:'manual',photoUri:'file:///drafts/civiclens-photo-test.jpg',category:'waste',description:'Litter beside the public path.',location:{latitude:-37.814,longitude:144.9633,countryCode:'AU',locality:'Melbourne'},channels:['facebook'],consent:true}));
  open();await screen.findByDisplayValue('Litter beside the public path.');
  expect(await screen.findByText('Before submitting, accept the community rules.')).toBeOnTheScreen();
  expect(screen.getByRole('button',{name:'Submit report'})).toBeDisabled();
  fireEvent(screen.getByLabelText('Accept community rules'),'valueChange',true);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Submit report'})).toBeEnabled());
  expect(screen.queryByText('Before submitting, accept the community rules.')).toBeNull();
  expect(jest.mocked(fetch).mock.calls.some(([url])=>String(url).endsWith('/v1/reports'))).toBe(false);
});

test('recovers reporting availability after a failed capability request without losing the draft',async()=>{
  stored.set('civiclens-draft-qa-photo',JSON.stringify({key:'retry-capabilities',sharingMode:'manual',photoUri:'file:///drafts/civiclens-photo-test.jpg',category:'waste',description:'Litter beside the public path.',location:{latitude:-37.814,longitude:144.9633,countryCode:'AU',locality:'Melbourne'},channels:['facebook'],consent:true,communityRulesVersion}));
  let unavailable=true;
  jest.mocked(fetch).mockImplementation(async()=>unavailable ? {ok:false,status:503,json:async()=>({code:'UNAVAILABLE',message:'Service unavailable.'})} as Response : {ok:true,json:async()=>({manualSharing:true,maxPhotos:5,communityRulesVersion})} as Response);
  open();
  expect(await screen.findByText('Could not check reporting availability. Your draft is safe. Retry to continue.')).toBeOnTheScreen();
  expect(screen.getByRole('button',{name:'Submit report'})).toBeDisabled();
  unavailable=false;
  fireEvent.press(screen.getByRole('button',{name:'Retry reporting availability'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Submit report'})).toBeEnabled());
  expect(screen.getByDisplayValue('Litter beside the public path.')).toBeOnTheScreen();
  expect(screen.queryByText('Could not check reporting availability. Your draft is safe. Retry to continue.')).toBeNull();
  expect(jest.mocked(fetch).mock.calls.some(([url])=>String(url).endsWith('/v1/reports'))).toBe(false);
});

test('keeps the complete draft after a failed upload and retries with the same submission key',async()=>{
  stored.set('civiclens-draft-qa-photo',JSON.stringify({key:'stable-retry-key',sharingMode:'manual',photoUri:'file:///drafts/civiclens-photo-test.jpg',category:'waste',description:'Litter beside the public path.',location:{latitude:-37.814,longitude:144.9633,countryCode:'AU',locality:'Melbourne'},channels:['facebook'],consent:true,communityRulesVersion}));
  let attempts=0;
  jest.mocked(fetch).mockImplementation(async(url)=>{
    if(String(url).endsWith('/v1/reports'))return ++attempts===1 ? {ok:false,status:503,json:async()=>({code:'UNAVAILABLE',message:'Upload unavailable. Please retry.'})} as Response : {ok:true,json:async()=>({id:'sample-report'})} as Response;
    return {ok:true,json:async()=>({manualSharing:true,maxPhotos:5,communityRulesVersion})} as Response;
  });
  open();await screen.findByDisplayValue('Litter beside the public path.');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Submit report'})).toBeEnabled());
  fireEvent.press(screen.getByRole('button',{name:'Submit report'}));
  expect(await screen.findByText('Upload unavailable. Please retry.')).toBeOnTheScreen();
  expect(screen.getByDisplayValue('Litter beside the public path.')).toBeOnTheScreen();
  expect(screen.getByLabelText('Your report photo')).toBeOnTheScreen();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('civiclens-draft-qa-photo');
  fireEvent.press(screen.getByRole('button',{name:'Submit report'}));
  await waitFor(()=>expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('civiclens-draft-qa-photo'));
  const uploads=jest.mocked(fetch).mock.calls.filter(([url])=>String(url).endsWith('/v1/reports'));
  expect(uploads).toHaveLength(2);
  expect(uploads.map(([,options])=>(options!.headers as Record<string,string>)['Idempotency-Key'])).toEqual(['stable-retry-key','stable-retry-key']);
  expect(uploads[0][1]!.body).toBe(uploads[1][1]!.body);
});
