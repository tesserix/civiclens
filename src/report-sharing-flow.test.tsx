import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import {SessionProvider} from './session';
import {beginReportSharing,consumeReportSharing} from './report-sharing-intent';
import Receipt from '../app/report/[id]';
import type {Report} from '../shared/contracts';

jest.mock('expo-router',()=>({useRouter:()=>({replace:jest.fn()}),useLocalSearchParams:()=>({id:'report-qa'})}));
jest.mock('react-native-share',()=>({__esModule:true,default:{open:jest.fn(async()=>({success:true}))}}));
const report:Report={id:'report-qa',status:'ready_to_share',sharingMode:'manual',category:'waste',description:'Litter is scattered beside the public path.',nickname:'SampleFox',createdAt:'2026-10-25T00:00:00Z',location:{latitude:-37.814,longitude:144.9633,countryCode:'AU',locality:'Melbourne'},routing:{status:'needs_verification',authorityNames:[]},photoCount:1,publications:[{channel:'facebook',status:'blocked',providerId:null,reason:'Not posted.'}]};
beforeEach(()=>{
  jest.clearAllMocks();consumeReportSharing('','');
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify({token:'synthetic-session',expiresAt:'2099-01-01',user:{id:'qa-photo',nickname:'SampleFox'}}));
  globalThis.fetch=jest.fn(async(url)=>({ok:true,json:async()=>String(url).endsWith('/v1/capabilities') ? {reporterSharing:true} : String(url).endsWith('/share-package') ? {reportId:report.id,channel:'facebook',caption:'Litter beside the public path. #Litter',photosBase64:['/9j/AA==']} : report})) as jest.Mock;
});
function open(){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});return render(<QueryClientProvider client={client}><SessionProvider><Receipt/></SessionProvider></QueryClientProvider>);}

test('receipt immediately hands a submitted report to native sharing without a moderation wait',async()=>{
  beginReportSharing('synthetic-session',report.id);
  open();
  await screen.findByText('1 confirmed photo');
  await waitFor(()=>expect(jest.requireMock('react-native-share').default.open).toHaveBeenCalledTimes(1));
  expect(screen.getByText(/Your report is saved. No moderator approval is needed/)).toBeOnTheScreen();
  expect(screen.queryByText(/stays private until review/)).toBeNull();
  expect(screen.queryByText(/safely held for review/)).toBeNull();
});

test('opening a receipt without a submission intent requires explicit confirmation and does not open another app',async()=>{
  open();
  await screen.findByRole('button',{name:'Prepare post'});
  expect(jest.requireMock('react-native-share').default.open).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Prepare post'})).toBeDisabled();
  fireEvent(screen.getByLabelText('Confirm my post and social identity'),'valueChange',true);
  expect(screen.getByRole('button',{name:'Prepare post'})).toBeEnabled();
});

test('a submission intent cannot authorize another account or report and can only be used once',()=>{
  beginReportSharing('owner-session','report-a');
  expect(consumeReportSharing('someone-else','report-a')).toBe(false);
  expect(consumeReportSharing('owner-session','report-a')).toBe(false);
  beginReportSharing('owner-session','report-a');
  expect(consumeReportSharing('owner-session','report-b')).toBe(false);
  beginReportSharing('owner-session','report-a');
  expect(consumeReportSharing('owner-session','report-a')).toBe(true);
  expect(consumeReportSharing('owner-session','report-a')).toBe(false);
});
