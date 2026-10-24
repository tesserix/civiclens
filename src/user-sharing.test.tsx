import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {UserSharing} from './user-sharing';
import type {Report} from '../shared/contracts';

jest.mock('react-native-share',()=>({__esModule:true,default:{open:jest.fn(async()=>({success:true}))}}),{virtual:true});
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
  fireEvent.press(screen.getByRole('button',{name:'Choose app and destination'}));
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
  fireEvent.press(screen.getByRole('button',{name:'Choose app and destination'}));
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
  expect(screen.queryByRole('button',{name:'Choose app and destination'})).toBeNull();
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
  fireEvent.press(screen.getByRole('button',{name:'Clear destinations'}));
  fireEvent(screen.getByLabelText('Accept social identity visibility'),'valueChange',true);
  expect(screen.getByRole('button',{name:'Prepare reviewed post'})).toBeDisabled();
  fireEvent.press(screen.getByRole('button',{name:'Select all destinations'}));
  for(const name of ['Facebook','Instagram','WhatsApp'])expect(screen.getByRole('checkbox',{name})).toBeChecked();
  fireEvent.press(screen.getByRole('button',{name:'Prepare reviewed post'}));
  expect(await screen.findByText('3 destinations selected')).toBeOnTheScreen();
  expect(share).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button',{name:'Open Facebook sharing options'}));
  await waitFor(()=>expect(share).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Facebook: options opened; delivery unverified')).toBeOnTheScreen();
  expect(screen.getByRole('button',{name:'Open Instagram sharing options'})).toBeOnTheScreen();
  expect(share).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button',{name:'Open Instagram sharing options'}));
  await waitFor(()=>expect(share).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Instagram: options opened; delivery unverified')).toBeOnTheScreen();
});
