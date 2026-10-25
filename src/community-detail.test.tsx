import { Share, ActionSheetIOS } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CivicCard } from '../shared/contracts';
import { CommunityDetail } from './community-detail';

const card:CivicCard={id:'0199a77b-8b01-7000-8000-000000000001',kind:'poll',title:'Should our park have more rubbish bins?',body:'More bins beside the public path would help everyone keep this park clean.',countryCode:'AU',locality:'Melbourne',closesAt:'2026-11-01T12:00:00Z',createdAt:'2026-10-25T12:00:00Z',status:'approved',authorNickname:'HappyKea',mine:false,closed:false,myResponse:null,results:null,canReview:false};
jest.mock('expo-linking',()=>({createURL:(path:string)=>`civiclens://${path}`}));
let current:CivicCard;
let calls:{url:string;method:string;body:unknown}[];
let failVote=false;
let client:QueryClient;
beforeEach(()=>{
  client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false,gcTime:0}}});
  current={...card};calls=[];failVote=false;
  globalThis.fetch=jest.fn(async(url,init)=>{
    const path=String(url),method=init?.method??'GET';
    const body=init?.body?JSON.parse(String(init.body)):null;
    calls.push({url:path,method,body});
    if(path.endsWith('/response')){
      if(failVote)throw new Error('network disconnected');
      current={...current,myResponse:body.choice};
    }
    if(path.includes('/opinions'))return {ok:true,status:200,json:async()=>({items:[],nextCursor:null})} as Response;
    return {ok:true,status:200,json:async()=>current} as Response;
  }) as jest.Mock;
});
afterEach(()=>{client.clear();jest.restoreAllMocks();jest.useRealTimers();});
function mount(){return render(<QueryClientProvider client={client}><CommunityDetail id={card.id} userId="test-account" token="test-session"/></QueryClientProvider>);}

test('requires explicit consent before recording a response and hides interim totals',async()=>{
  mount();await screen.findByText(card.title);
  expect(screen.getByText(/Results appear after/)).toBeTruthy();
  fireEvent.press(screen.getByRole('radio',{name:'Yes'}));
  expect(screen.getByRole('button',{name:'Confirm response'})).toBeDisabled();
  fireEvent.press(screen.getByRole('checkbox',{name:'I confirm my response and accept the community rules.'}));
  fireEvent.press(screen.getByRole('button',{name:'Confirm response'}));
  await screen.findByText('Your response: Yes.');
  expect(calls.filter(c=>c.method==='POST')[0].body).toEqual({choice:'yes',rulesVersion:'2026-10-24',consent:true});
  expect(screen.queryByText(/33.3%/)).toBeNull();
});

test('closed polls show all three percentages and no response form',async()=>{
  current={...card,closed:true,results:{total:3,yes:{count:1,percent:33.3},no:{count:1,percent:33.3},dontKnow:{count:1,percent:33.3}}};
  mount();await screen.findByText(card.title);
  expect(screen.getByText('3 responses')).toBeTruthy();
  expect(screen.getByText("Don't know: 33.3% (1)")).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Confirm response'})).toBeNull();
  expect(screen.getByText(/voluntary opinion poll/)).toBeTruthy();
});

test('a failed response can be retried without losing the selection',async()=>{
  failVote=true;mount();await screen.findByText(card.title);
  fireEvent.press(screen.getByRole('radio',{name:'No'}));
  fireEvent.press(screen.getByRole('checkbox',{name:'I confirm my response and accept the community rules.'}));
  fireEvent.press(screen.getByRole('button',{name:'Confirm response'}));
  await screen.findByText(/Could not connect/);
  expect(screen.getByRole('radio',{name:'No'})).toBeChecked();
  failVote=false;
  fireEvent.press(screen.getByRole('button',{name:'Confirm response'}));
  await screen.findByText('Your response: No.');
  await waitFor(()=>expect(calls.filter(c=>c.url.endsWith('/response'))).toHaveLength(2));
});


test('does not share cached text after a moderator withdraws a card',async()=>{
  const native=jest.spyOn(Share,'share').mockResolvedValue({action:Share.sharedAction});
  mount();await screen.findByText(card.title);
  current={...card,status:'hidden'};
  fireEvent.press(screen.getByRole('button',{name:'Share this request'}));
  await screen.findByText('Could not open sharing. Please try again.');
  expect(native).not.toHaveBeenCalled();
  native.mockRestore();
});


test('does not open sharing if the account changes during the approval recheck',async()=>{
  const native=jest.spyOn(Share,'share').mockResolvedValue({action:Share.sharedAction});
  const view=mount();await screen.findByText(card.title);
  await waitFor(()=>expect(calls.some(c=>c.url.includes('/opinions'))).toBe(true));
  let release:((value:Response)=>void)|undefined;
  jest.mocked(fetch).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  fireEvent.press(screen.getByRole('button',{name:'Share this request'}));
  view.rerender(<QueryClientProvider client={client}><CommunityDetail id={card.id} userId="another-account" token="another-session"/></QueryClientProvider>);
  await act(async()=>{release!({ok:true,status:200,json:async()=>card} as Response);});
  await screen.findByText(card.title);
  await waitFor(()=>expect(screen.queryByLabelText('Loading opinions…')).toBeNull());
  expect(native).not.toHaveBeenCalled();
});

test('reconciles closed results instead of freezing an early snapshot forever',async()=>{
  jest.useFakeTimers();
  current={...card,closed:true,results:{total:0,yes:{count:0,percent:0},no:{count:0,percent:0},dontKnow:{count:0,percent:0}}};
  mount();await screen.findByText('0 responses');
  current={...current,results:{total:3,yes:{count:1,percent:33.3},no:{count:1,percent:33.3},dontKnow:{count:1,percent:33.3}}};
  await act(async()=>{await jest.advanceTimersByTimeAsync(60001);});
  expect(screen.getByText('3 responses')).toBeOnTheScreen();
  client.clear();jest.useRealTimers();
});


test('chooses a concern reason with the native dropdown before explicit submission',async()=>{
  const sheet=jest.spyOn(ActionSheetIOS,'showActionSheetWithOptions').mockImplementation((_options,choose)=>choose(1));
  mount();await screen.findByText(card.title);
  expect(screen.getByRole('button',{name:'Send concern to moderators'})).toBeDisabled();
  fireEvent.press(screen.getByRole('button',{name:'Concern reason, Choose reason'}));
  expect(screen.getByRole('button',{name:'Concern reason, Privacy'})).toBeOnTheScreen();
  expect(calls.some(c=>c.url.endsWith('/flag'))).toBe(false);
  fireEvent.press(screen.getByRole('button',{name:'Send concern to moderators'}));
  await screen.findByText('Your concern has been sent to moderators.');
  expect(calls.find(c=>c.url.endsWith('/flag'))?.body).toEqual({reason:'privacy'});
  sheet.mockRestore();
});
