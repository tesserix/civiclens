import { fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommunityCreate } from './community-create';
import { ActionSheetIOS } from 'react-native';
jest.mock('expo-crypto',()=>({randomUUID:jest.fn(()=>'11111111-1111-4111-8111-111111111111')}));

beforeEach(async()=>{await AsyncStorage.clear();jest.clearAllMocks();});

test('starts with a poll and uses a native topic choice when supported',async()=>{
  const sheet=jest.spyOn(ActionSheetIOS,'showActionSheetWithOptions').mockImplementation((_options,choose)=>choose(1));
  render(<CommunityCreate userId="first" token="test-session" topicsEnabled onCreated={jest.fn()}/>);
  await screen.findByLabelText('Question or request');
  expect(screen.getByRole('button',{name:'Request type, Opinion poll'})).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Topic, Community'}));
  expect(sheet).toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Topic, Environment'})).toBeOnTheScreen();
  sheet.mockRestore();
});
test('retries a failed submission with the same saved intent and requires consent',async()=>{
  const created=jest.fn(),calls:RequestInit[]=[];
  let fail=true;
  globalThis.fetch=jest.fn(async(_url,init)=>{calls.push(init!);if(fail)throw new Error('offline');return {ok:true,status:200,json:async()=>({id:'new-card'})} as Response;}) as jest.Mock;
  render(<CommunityCreate userId="first" token="test-session" onCreated={created}/>);
  await screen.findByLabelText('Question or request');
  fireEvent.changeText(screen.getByLabelText('Question or request'),'Please add more bins to our local park');
  fireEvent.changeText(screen.getByLabelText('Why does this matter?'),'The path has nowhere to put litter or recycling. Please add bins near the entrance.');
  fireEvent.changeText(screen.getByLabelText('Town or city'),'Melbourne');
  expect(screen.getByRole('button',{name:'Send for review'})).toBeDisabled();
  fireEvent.press(screen.getByRole('checkbox',{name:'I accept the community rules and agree to publish this request under my nickname after review.'}));
  fireEvent.press(screen.getByRole('button',{name:'Send for review'}));
  await screen.findByText(/Could not connect/);
  expect(created).not.toHaveBeenCalled();
  fail=false;fireEvent.press(screen.getByRole('button',{name:'Send for review'}));
  await screen.findByText('Sent for independent review.');
  expect(calls).toHaveLength(2);
  expect(calls[0].body).toBe(calls[1].body);
  expect((calls[0].headers as Record<string,string>)['Idempotency-Key']).toBe((calls[1].headers as Record<string,string>)['Idempotency-Key']);
  expect(created).toHaveBeenCalledWith('new-card');
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});

test('restored text is kept but consent is never restored',async()=>{
  await AsyncStorage.setItem('civiclens-civic-draft-v1:first',JSON.stringify({version:1,key:'11111111-1111-4111-8111-111111111111',input:{kind:'poll',title:'Should our park have more rubbish bins?',body:'We want bins near the path so the park is easier to keep clean.',countryCode:'AU',locality:'Melbourne',closesAt:new Date(Date.now()+7*86400000).toISOString(),rulesVersion:'2026-10-24',consent:true}}));
  render(<CommunityCreate userId="first" token="test-session" onCreated={jest.fn()}/>);
  await screen.findByDisplayValue('Should our park have more rubbish bins?');
  expect(screen.getByRole('checkbox',{name:'I accept the community rules and agree to publish this request under my nickname after review.'})).not.toBeChecked();
  expect(screen.getByRole('button',{name:'Send for review'})).toBeDisabled();
});


test('changes request type through native choices while preserving the question',async()=>{
  const sheet=jest.spyOn(ActionSheetIOS,'showActionSheetWithOptions').mockImplementation((_options,choose)=>choose(0));
  render(<CommunityCreate userId="native-kind" token="test-session" onCreated={jest.fn()}/>);
  await screen.findByLabelText('Question or request');
  fireEvent.changeText(screen.getByLabelText('Question or request'),'Please add more bins beside our local park');
  fireEvent.press(screen.getByRole('button',{name:'Request type, Opinion poll'}));
  expect(sheet.mock.calls[0][0].options).toEqual(['Civic request','Opinion poll','Cancel']);
  expect(screen.getByRole('button',{name:'Request type, Civic request'})).toBeOnTheScreen();
  expect(screen.getByDisplayValue('Please add more bins beside our local park')).toBeOnTheScreen();
  sheet.mockRestore();
});
