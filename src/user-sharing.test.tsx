import {act,fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {UserSharing} from './user-sharing';
import {beginReportSharing} from './report-sharing-intent';
import {communityRulesVersion,type Report} from '../shared/contracts';

jest.mock('react-native-share',()=>({__esModule:true,Social:{Facebook:'facebook',Whatsapp:'whatsapp'},default:{open:jest.fn(async()=>({success:true})),shareSingle:jest.fn(async()=>({success:true})),isPackageInstalled:jest.fn(async()=>({isInstalled:true}))}}));
const report={id:'report-qa',status:'approved',sharingMode:'manual',publications:[{channel:'facebook',status:'blocked'},{channel:'instagram',status:'blocked'},{channel:'whatsapp',status:'blocked'}]} as Report;
const packageBody={reportId:'report-qa',channel:'facebook',caption:'Reviewed litter caption. Reported by SampleFox. #Melbourne',photosBase64:['/9j/AA==','/9j/AQ==','/9j/Ag==','/9j/Aw==','/9j/BA==']};
beforeEach(()=>{jest.clearAllMocks();globalThis.fetch=jest.fn(async()=>({ok:true,json:async()=>packageBody})) as jest.Mock;});

test('requires identity disclosure acknowledgement and exports only reviewed content before native handoff',async()=>{
  const share=jest.requireMock('react-native-share').default.open;
  render(<UserSharing report={report} token="synthetic-session"/>);
  expect(screen.getByText(/profile name, username, Page name or phone number/)).toBeOnTheScreen();
  expect(screen.getByRole('button',{name:'Prepare reviewed post'})).toBeDisabled();
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  await screen.findByText(packageBody.caption);
  expect(share).not.toHaveBeenCalled();
  expect(screen.getByText('5 reviewed photos')).toBeOnTheScreen();
  expect(JSON.parse(jest.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({channel:'facebook',identityAcknowledged:true});
  fireEvent.press(screen.getByRole('button',{name:'Open system share menu for Facebook'}));
  await waitFor(()=>expect(share).toHaveBeenCalledWith(expect.objectContaining({message:packageBody.caption,urls:packageBody.photosBase64.map(p=>`data:image/jpeg;base64,${p}`),useInternalStorage:true,failOnCancel:false})));
  expect(await screen.findByText(/Check your chosen app to confirm whether you posted/)).toBeOnTheScreen();
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('never prepares an unreviewed report',()=>{
  render(<UserSharing report={{...report,status:'pending_review'}} token="synthetic-session"/>);
  expect(screen.getByText(/available after every photo/)).toBeOnTheScreen();
  expect(screen.queryByRole('button',{name:'Prepare reviewed post'})).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});


test('holds native sharing when the server withdraws approval at the final check',async()=>{
  const share=jest.requireMock('react-native-share').default.open;
  jest.mocked(fetch).mockResolvedValueOnce({ok:true,json:async()=>packageBody} as Response)
    .mockResolvedValueOnce({ok:false,status:409,json:async()=>({code:'CONFLICT',message:'Review required'})} as Response);
  render(<UserSharing report={report} token="synthetic-session"/>);
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  await screen.findByText(packageBody.caption);
  fireEvent.press(screen.getByRole('button',{name:'Open system share menu for Facebook'}));
  expect(await screen.findByText(/Sharing could not be opened/)).toBeOnTheScreen();
  expect(share).not.toHaveBeenCalled();
});


test('does not open a package belonging to another report',async()=>{
  const share=jest.requireMock('react-native-share').default.open;
  jest.mocked(fetch).mockResolvedValueOnce({ok:true,json:async()=>({...packageBody,reportId:'someone-else'})} as Response);
  render(<UserSharing report={report} token="synthetic-session"/>);
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  expect(await screen.findByText(/reviewed post could not be prepared/)).toBeOnTheScreen();
  expect(screen.queryByRole('button',{name:'Open system share menu for Facebook'})).toBeNull();
  expect(share).not.toHaveBeenCalled();
});

test('drops acknowledgement and prepared content when the signed-in account changes',async()=>{
  const share=jest.requireMock('react-native-share').default.open;
  const view=render(<UserSharing report={report} token="synthetic-session"/>);
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  await screen.findByText(packageBody.caption);
  view.rerender(<UserSharing report={report} token="other-synthetic-session"/>);
  expect(screen.queryByText(packageBody.caption)).toBeNull();
  expect(screen.getByRole('button',{name:'Prepare reviewed post'})).toBeDisabled();
  expect(share).not.toHaveBeenCalled();
});

test('supports selecting one, several or all destinations while requiring a separate handoff for each',async()=>{
  const share=jest.requireMock('react-native-share').default.open;
  jest.mocked(fetch).mockImplementation(async(_url,options)=>({ok:true,json:async()=>({...packageBody,channel:JSON.parse(options!.body as string).channel})}) as Response);
  render(<UserSharing report={report} token="synthetic-session"/>);
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  fireEvent.press(screen.getByRole('button',{name:'Clear social apps'}));
  fireEvent.press(screen.getByRole('button',{name:'Done'}));
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  expect(screen.getByRole('button',{name:'Prepare reviewed post'})).toBeDisabled();
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Choose apps'}));
  fireEvent.press(screen.getByRole('button',{name:'Select all social apps'}));
  for(const name of ['Facebook','Instagram','WhatsApp'])expect(screen.getByRole('checkbox',{name})).toBeChecked();
  fireEvent.press(screen.getByRole('button',{name:'Done'}));
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  expect(await screen.findByText('3 destinations selected')).toBeOnTheScreen();
  expect(share).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button',{name:'Open system share menu for Facebook'}));
  await waitFor(()=>expect(share).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Facebook: options opened; delivery unverified')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Next app: Instagram'}));
  expect(screen.getByRole('button',{name:'Open system share menu for Instagram'})).toBeOnTheScreen();
  expect(share).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button',{name:'Open system share menu for Instagram'}));
  await waitFor(()=>expect(share).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Instagram: options opened; delivery unverified')).toBeOnTheScreen();
});

test('does not offer social actions for a government-only report',()=>{
  render(<UserSharing report={{...report,publications:[]}} token="synthetic-session"/>);
  expect(screen.queryByText('Share to your communities')).toBeNull();
});

jest.mock('expo-media-library/legacy',()=>({requestPermissionsAsync:jest.fn(async()=>({granted:true})),saveToLibraryAsync:jest.fn(async()=>{})}));
jest.mock('expo-clipboard',()=>({setStringAsync:jest.fn(async()=>true)}));
jest.mock('expo-crypto',()=>({randomUUID:jest.fn(()=>'random-private-id')}));
jest.mock('expo-file-system/legacy',()=>({cacheDirectory:'file:///cache/',EncodingType:{Base64:'base64'},writeAsStringAsync:jest.fn(async()=>{}),deleteAsync:jest.fn(async()=>{})}));
const tiktokReport={...report,publications:[{channel:'tiktok',status:'blocked'}]} as Report;
async function prepareTikTok(){
  jest.mocked(fetch).mockImplementation(async()=>({ok:true,json:async()=>({...packageBody,channel:'tiktok'})}) as Response);
  const view=render(<UserSharing report={tiktokReport} token="synthetic-session"/>);
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  await screen.findByText(packageBody.caption);
  return view;
}
test('offers TikTok native handoff and an explicit save, copy and open fallback without claiming delivery',async()=>{
  const {Linking}=jest.requireActual('react-native');
  jest.spyOn(Linking,'openURL').mockResolvedValue(true);
  const media=jest.requireMock('expo-media-library/legacy'),fs=jest.requireMock('expo-file-system/legacy'),clipboard=jest.requireMock('expo-clipboard');
  await prepareTikTok();
  expect(screen.getByText(/If TikTok is missing from the share menu/)).toBeOnTheScreen();
  expect(media.saveToLibraryAsync).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button',{name:'Save reviewed photos for TikTok'}));
  await screen.findByText(/5 of 5 reviewed photos saved/);
  expect(media.requestPermissionsAsync).toHaveBeenCalledWith(true,['photo']);
  expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(5);
  expect(fs.writeAsStringAsync.mock.calls.map((call:unknown[])=>call[1])).toEqual(packageBody.photosBase64);
  expect(fs.deleteAsync).toHaveBeenCalledTimes(5);
  fireEvent.press(screen.getByRole('button',{name:'Copy TikTok caption'}));
  await waitFor(()=>expect(clipboard.setStringAsync).toHaveBeenCalledWith(packageBody.caption));
  await screen.findByText(/Reviewed caption copied/);
  fireEvent.press(screen.getByRole('button',{name:'Open TikTok app or website'}));
  await waitFor(()=>expect(Linking.openURL).toHaveBeenCalledWith('https://www.tiktok.com/'));
  expect(await screen.findByText(/CivicLens cannot verify delivery/)).toBeOnTheScreen();
  expect(fetch).toHaveBeenCalledTimes(4);
});
test('handles add-only photo permission denial without exporting any photo',async()=>{
  const media=jest.requireMock('expo-media-library/legacy');media.requestPermissionsAsync.mockResolvedValueOnce({granted:false});
  await prepareTikTok();fireEvent.press(screen.getByRole('button',{name:'Save reviewed photos for TikTok'}));
  await screen.findByText(/Photo access was not granted/);
  expect(media.saveToLibraryAsync).not.toHaveBeenCalled();
});
test('retries only unsaved photos after partial failure and cleans temporary files',async()=>{
  const media=jest.requireMock('expo-media-library/legacy'),fs=jest.requireMock('expo-file-system/legacy');
  media.saveToLibraryAsync.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('storage failure'));
  await prepareTikTok();fireEvent.press(screen.getByRole('button',{name:'Save reviewed photos for TikTok'}));
  await screen.findByText(/1 of 5 photos saved/);
  expect(fs.deleteAsync).toHaveBeenCalledTimes(2);
  fireEvent.press(screen.getByRole('button',{name:'Save reviewed photos for TikTok'}));
  await screen.findByText(/5 of 5 reviewed photos saved/);
  expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(6);
  expect(fs.writeAsStringAsync.mock.calls.map((call:unknown[])=>call[1])).toEqual([packageBody.photosBase64[0],packageBody.photosBase64[1],...packageBody.photosBase64.slice(1)]);
});
test.each(['Save reviewed photos for TikTok','Copy TikTok caption','Open TikTok app or website'])('rechecks review before %s and blocks withdrawn approval',async action=>{
  await prepareTikTok();
  jest.mocked(fetch).mockResolvedValueOnce({ok:false,status:409,json:async()=>({code:'CONFLICT',message:'Review required'})} as Response);
  fireEvent.press(screen.getByRole('button',{name:action}));
  await screen.findByText(/TikTok preparation could not continue/);
  expect(jest.requireMock('expo-media-library/legacy').saveToLibraryAsync).not.toHaveBeenCalled();
  expect(jest.requireMock('expo-clipboard').setStringAsync).not.toHaveBeenCalled();
});
test('stops saving remaining photos if the account changes during a native save',async()=>{
  const media=jest.requireMock('expo-media-library/legacy');let finish!:()=>void;
  media.saveToLibraryAsync.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
  const view=await prepareTikTok();fireEvent.press(screen.getByRole('button',{name:'Save reviewed photos for TikTok'}));
  await waitFor(()=>expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1));
  view.rerender(<UserSharing report={tiktokReport} token="other-synthetic-session"/>);
  finish();await waitFor(()=>expect(jest.requireMock('expo-file-system/legacy').deleteAsync).toHaveBeenCalledTimes(1));
  expect(media.saveToLibraryAsync).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(packageBody.caption)).toBeNull();
});

test('hands the TikTok caption and all reviewed images to the chooser without a published receipt',async()=>{
  await prepareTikTok();
  fireEvent.press(screen.getByRole('button',{name:'Open system share menu for TikTok'}));
  await waitFor(()=>expect(jest.requireMock('react-native-share').default.open).toHaveBeenCalledWith(expect.objectContaining({title:'Share reviewed post to TikTok',message:packageBody.caption,urls:packageBody.photosBase64.map(p=>`data:image/jpeg;base64,${p}`)})));
  await screen.findByText('TikTok: options opened; delivery unverified');
});
test('requires fresh preparation when the TikTok caption changes',async()=>{
  await prepareTikTok();
  jest.mocked(fetch).mockResolvedValueOnce({ok:true,json:async()=>({...packageBody,channel:'tiktok',caption:'A newly reviewed caption.'})} as Response);
  fireEvent.press(screen.getByRole('button',{name:'Copy TikTok caption'}));
  await screen.findByText('Reviewed content changed. Prepare and check the post again.');
  expect(jest.requireMock('expo-clipboard').setStringAsync).not.toHaveBeenCalled();
  expect(screen.queryByText(packageBody.caption)).toBeNull();
});
test('explains when the OS cannot open TikTok and keeps the reviewed package',async()=>{
  const {Linking}=jest.requireActual('react-native');
  jest.spyOn(Linking,'openURL').mockRejectedValueOnce(new Error('No browser'));
  await prepareTikTok();fireEvent.press(screen.getByRole('button',{name:'Open TikTok app or website'}));
  await screen.findByText(/TikTok preparation could not continue/);
  expect(screen.getByText(packageBody.caption)).toBeOnTheScreen();
});
test('does not save the same confirmed photos twice on repeated taps',async()=>{
  await prepareTikTok();
  fireEvent.press(screen.getByRole('button',{name:'Save reviewed photos for TikTok'}));
  await screen.findByText(/5 of 5 reviewed photos saved/);
  fireEvent.press(screen.getByRole('button',{name:'Save reviewed photos for TikTok'}));
  await screen.findByText(/5 of 5 reviewed photos saved/);
  expect(jest.requireMock('expo-media-library/legacy').saveToLibraryAsync).toHaveBeenCalledTimes(5);
});


test.each([
  ['facebook','Facebook','fb://'],
  ['instagram','Instagram','instagram://app'],
  ['whatsapp','WhatsApp','whatsapp://app'],
])('offers reviewed save, copy and native launch for %s without silently dropping photos',async(channel,label,url)=>{
  const {Linking}=jest.requireActual('react-native');
  jest.spyOn(Linking,'canOpenURL').mockResolvedValue(true);
  jest.spyOn(Linking,'openURL').mockResolvedValue(true);
  jest.mocked(fetch).mockImplementation(async()=>({ok:true,json:async()=>({...packageBody,channel})}) as Response);
  render(<UserSharing report={{...report,publications:[{channel,status:'blocked'}]} as Report} token="synthetic-session"/>);
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  await screen.findByText(packageBody.caption);
  fireEvent.press(screen.getByRole('button',{name:`Save reviewed photos for ${label}`}));
  await screen.findByText(/5 of 5 reviewed photos saved/);
  expect(jest.requireMock('expo-media-library/legacy').saveToLibraryAsync).toHaveBeenCalledTimes(5);
  fireEvent.press(screen.getByRole('button',{name:`Copy ${label} caption`}));
  await screen.findByText(/Reviewed caption copied/);
  expect(jest.requireMock('expo-clipboard').setStringAsync).toHaveBeenCalledWith(packageBody.caption);
  fireEvent.press(screen.getByRole('button',{name:`Open ${label}`}));
  await waitFor(()=>expect(Linking.openURL).toHaveBeenCalledWith(url));
  await screen.findByText(/Opening an app does not attach/);
  expect(jest.requireMock('react-native-share').default.open).not.toHaveBeenCalled();
});

test('explains a missing social app without navigating to a browser or exporting more data',async()=>{
  const {Linking}=jest.requireActual('react-native');
  jest.spyOn(Linking,'canOpenURL').mockResolvedValueOnce(false);
  jest.spyOn(Linking,'openURL').mockResolvedValue(true);
  render(<UserSharing report={report} token="synthetic-session"/>);
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  await screen.findByText(packageBody.caption);
  fireEvent.press(screen.getByRole('button',{name:'Open Facebook'}));
  await screen.findByText(/Facebook is not available/);
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(jest.requireMock('expo-clipboard').setStringAsync).not.toHaveBeenCalled();
  expect(jest.requireMock('expo-media-library/legacy').saveToLibraryAsync).not.toHaveBeenCalled();
});

test('does not open an app if the account changes during its availability check',async()=>{
  const {Linking}=jest.requireActual('react-native');
  let finish!:(value:boolean)=>void;
  jest.spyOn(Linking,'canOpenURL').mockImplementationOnce(()=>new Promise<boolean>(resolve=>{finish=resolve;}));
  jest.spyOn(Linking,'openURL').mockResolvedValue(true);
  const view=render(<UserSharing report={report} token="synthetic-session"/>);
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  await screen.findByText(packageBody.caption);
  fireEvent.press(screen.getByRole('button',{name:'Open Facebook'}));
  await waitFor(()=>expect(Linking.canOpenURL).toHaveBeenCalled());
  view.rerender(<UserSharing report={report} token="different-synthetic-session"/>);
  await act(async()=>finish(true));
  expect(Linking.openURL).not.toHaveBeenCalled();
});


test('reuses confirmed saved photos across selected apps and keeps their captions separate',async()=>{
  jest.mocked(fetch).mockImplementation(async(_url,options)=>{
    const channel=JSON.parse(options!.body as string).channel;
    return {ok:true,json:async()=>({...packageBody,channel,caption:`Reviewed ${channel} caption`})} as Response;
  });
  render(<UserSharing report={report} token="synthetic-session"/>);
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  fireEvent.press(screen.getByRole('button',{name:'Select all social apps'}));
  fireEvent.press(screen.getByRole('button',{name:'Done'}));
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  await screen.findByText('3 destinations selected');
  fireEvent.press(screen.getByRole('button',{name:'Save reviewed photos for Facebook'}));
  await screen.findByText(/5 of 5 reviewed photos saved/);
  fireEvent.press(screen.getByRole('button',{name:'Next app: Instagram'}));
  fireEvent.press(screen.getByRole('button',{name:'Save reviewed photos for Instagram'}));
  await screen.findByText(/then open Instagram/);
  expect(jest.requireMock('expo-media-library/legacy').saveToLibraryAsync).toHaveBeenCalledTimes(5);
  fireEvent.press(screen.getByRole('button',{name:'Copy Instagram caption'}));
  await screen.findByText(/Reviewed caption copied/);
  expect(jest.requireMock('expo-clipboard').setStringAsync).toHaveBeenCalledWith('Reviewed instagram caption');
});

test.each(['Save reviewed photos for Facebook','Copy Facebook caption','Open Facebook'])('blocks %s when approval is withdrawn',async action=>{
  const {Linking}=jest.requireActual('react-native');
  jest.spyOn(Linking,'openURL').mockResolvedValue(true);
  render(<UserSharing report={report} token="synthetic-session"/>);
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  await screen.findByText(packageBody.caption);
  jest.mocked(fetch).mockResolvedValueOnce({ok:false,status:409,json:async()=>({code:'CONFLICT',message:'Review required'})} as Response);
  fireEvent.press(screen.getByRole('button',{name:action}));
  await screen.findByText(/Facebook preparation could not continue/);
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(jest.requireMock('expo-media-library/legacy').saveToLibraryAsync).not.toHaveBeenCalled();
  expect(jest.requireMock('expo-clipboard').setStringAsync).not.toHaveBeenCalled();
});


test('prepares the whole post and opens the selected app with one explicit action',async()=>{
  const {Linking}=jest.requireActual('react-native');
  jest.spyOn(Linking,'canOpenURL').mockResolvedValue(true);
  jest.spyOn(Linking,'openURL').mockResolvedValue(true);
  render(<UserSharing report={report} token="synthetic-session"/>);
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  await screen.findByText(packageBody.caption);
  fireEvent.press(screen.getByRole('button',{name:'Save photos, copy caption & open Facebook'}));
  await waitFor(()=>expect(Linking.openURL).toHaveBeenCalledWith('fb://'));
  expect(jest.requireMock('expo-media-library/legacy').saveToLibraryAsync).toHaveBeenCalledTimes(5);
  expect(jest.requireMock('expo-clipboard').setStringAsync).toHaveBeenCalledWith(packageBody.caption);
  expect(fetch).toHaveBeenCalledTimes(3);
});

test('shows selected apps one at a time and lets the user continue after returning',async()=>{
  jest.mocked(fetch).mockImplementation(async(_url,options)=>({ok:true,json:async()=>({...packageBody,channel:JSON.parse(options!.body as string).channel})}) as Response);
  render(<UserSharing report={report} token="synthetic-session"/>);
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  fireEvent.press(screen.getByRole('button',{name:'Select all social apps'}));
  fireEvent.press(screen.getByRole('button',{name:'Done'}));
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  await screen.findByText('App 1 of 3: Facebook');
  expect(screen.queryByRole('button',{name:'Open Instagram'})).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'Open system share menu for Facebook'}));
  await screen.findByText('Facebook: options opened; delivery unverified');
  expect(screen.getByText('App 1 of 3: Facebook')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Next app: Instagram'}));
  expect(screen.getByText('App 2 of 3: Instagram')).toBeOnTheScreen();
  expect(screen.queryByRole('button',{name:'Open Facebook'})).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'Next app: WhatsApp'}));
  expect(screen.getByText('App 3 of 3: WhatsApp')).toBeOnTheScreen();
  expect(screen.queryByRole('button',{name:/Next app:/})).toBeNull();
  expect(jest.requireMock('react-native-share').default.open).toHaveBeenCalledTimes(1);
});


test.each(['missing app','denied photo access','save failure','withdrawn final review'])('combined preparation stops on %s without copying or opening',async failure=>{
  const {Linking}=jest.requireActual('react-native');
  jest.spyOn(Linking,'canOpenURL').mockResolvedValue(failure!=='missing app');
  jest.spyOn(Linking,'openURL').mockResolvedValue(true);
  const media=jest.requireMock('expo-media-library/legacy');
  if(failure==='denied photo access')media.requestPermissionsAsync.mockResolvedValueOnce({granted:false});
  if(failure==='save failure')media.saveToLibraryAsync.mockRejectedValueOnce(new Error('storage unavailable'));
  render(<UserSharing report={report} token="synthetic-session"/>);
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  await screen.findByText(packageBody.caption);
  if(failure==='withdrawn final review')jest.mocked(fetch)
    .mockResolvedValueOnce({ok:true,json:async()=>packageBody} as Response)
    .mockResolvedValueOnce({ok:false,status:409,json:async()=>({code:'CONFLICT',message:'Review required'})} as Response);
  fireEvent.press(screen.getByRole('button',{name:'Save photos, copy caption & open Facebook'}));
  const message=failure==='missing app'?/Facebook is not available/:failure==='denied photo access'?/Photo access was not granted/:failure==='save failure'?/0 of 5 photos saved/:/Facebook preparation could not continue/;
  await screen.findByText(message);
  expect(jest.requireMock('expo-clipboard').setStringAsync).not.toHaveBeenCalled();
  expect(Linking.openURL).not.toHaveBeenCalled();
  if(failure==='missing app')expect(media.saveToLibraryAsync).not.toHaveBeenCalled();
});


test('a reporter-confirmed submission opens sharing once and retains every selected app without moderator approval',async()=>{
  const share=jest.requireMock('react-native-share').default.open;
  jest.mocked(fetch).mockImplementation(async(_url,options)=>({ok:true,json:async()=>({...packageBody,channel:JSON.parse(options!.body as string).channel})}) as Response);
  const pending={...report,status:'ready_to_share',photoCount:5};
  beginReportSharing('synthetic-session',pending.id);
  const view=render(<UserSharing report={pending} token="synthetic-session" reporterSharing/>);
  await waitFor(()=>expect(share).toHaveBeenCalledTimes(1));
  expect(screen.getByText('3 destinations selected')).toBeOnTheScreen();
  expect(screen.queryByText(/available after every photo/)).toBeNull();
  expect(JSON.parse(jest.mocked(fetch).mock.calls[0][1]!.body as string)).toMatchObject({reporterConfirmed:true,confirmedPhotoCount:5,identityAcknowledged:true,communityRulesVersion});
  view.rerender(<UserSharing report={{...pending}} token="synthetic-session" reporterSharing/>);
  expect(share).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button',{name:'Next app: Instagram'}));
  await waitFor(()=>expect(share).toHaveBeenCalledTimes(2));
  expect(screen.getByText(/delivery unverified/)).toBeOnTheScreen();
});

test('existing pending reports can be shared by their owner after explicit personal responsibility confirmation',async()=>{
  jest.mocked(fetch).mockImplementation(async(_url,options)=>({ok:true,json:async()=>({...packageBody,channel:JSON.parse(options!.body as string).channel})}) as Response);
  render(<UserSharing report={{...report,status:'pending_review',photoCount:5}} token="synthetic-session" reporterSharing/>);
  expect(screen.getByRole('button',{name:'Prepare post'})).toBeDisabled();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent(screen.getByLabelText('Confirm my post and social identity'),'valueChange',true);
  fireEvent.press(screen.getByRole('button',{name:'Prepare post'}));
  await screen.findByText(packageBody.caption);
  expect(JSON.parse(jest.mocked(fetch).mock.calls[0][1]!.body as string)).toMatchObject({reporterConfirmed:true,confirmedPhotoCount:5});
});


test.each(['facebook','whatsapp'] as const)('Android %s targets the installed app with every photo',async channel=>{
  const {Platform}=jest.requireActual('react-native');
  const property=jest.replaceProperty(Platform,'OS','android');
  try {
    const native=jest.requireMock('react-native-share').default;
    jest.mocked(fetch).mockImplementation(async()=>({ok:true,json:async()=>({...packageBody,channel})}) as Response);
    beginReportSharing('synthetic-session',report.id);
    render(<UserSharing report={{...report,status:'ready_to_share',photoCount:5,publications:[{channel,status:'blocked',reason:null,providerId:null}]}} token="synthetic-session" reporterSharing/>);
    await waitFor(()=>expect(native.shareSingle).toHaveBeenCalledWith(expect.objectContaining({social:channel,urls:packageBody.photosBase64.map(photo=>`data:image/jpeg;base64,${photo}`)})));
    expect(native.open).not.toHaveBeenCalled();
  }finally{property.restore();}
});

test('Android reports a missing selected app without opening a website or losing the package',async()=>{
  const {Platform}=jest.requireActual('react-native');
  const property=jest.replaceProperty(Platform,'OS','android');
  try {
    const native=jest.requireMock('react-native-share').default;
    native.isPackageInstalled.mockResolvedValueOnce({isInstalled:false});
    beginReportSharing('synthetic-session',report.id);
    render(<UserSharing report={{...report,status:'ready_to_share',photoCount:5,publications:report.publications.slice(0,1)}} token="synthetic-session" reporterSharing/>);
    await screen.findByText(/Facebook is not available/);
    expect(native.shareSingle).not.toHaveBeenCalled();
    expect(native.open).not.toHaveBeenCalled();
    expect(screen.getByText(packageBody.caption)).toBeOnTheScreen();
  }finally{property.restore();}
});
