import { ActionSheetIOS, Dimensions } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommunityFeed } from './community-feed';
import type { CivicCard } from '../shared/contracts';

const card:CivicCard={id:'0199a77b-8b01-7000-8000-000000000001',kind:'poll',topic:'environment',title:'Should our park have more rubbish bins?',body:'More bins beside the path would help keep the park clean.',authorNickname:'HappyKea',locality:'Melbourne',countryCode:'AU',createdAt:'2026-10-25T00:00:00Z',status:'approved',closed:false,closesAt:'2027-01-01T12:00:00Z',mine:false,myResponse:null,results:null,canReview:false,watching:false,discussionCount:2};
let client:QueryClient;
beforeEach(()=>{
  client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false,gcTime:0}}});
  globalThis.fetch=jest.fn(async(url)=>{
    const path=String(url);
    const value=path.endsWith('/capabilities')?{civicParticipation:true,communityDiscovery:true,communityRulesVersion:'2026-10-24'}:path.endsWith('/access')?{canModerate:false}:path.endsWith('/response')?{...card,myResponse:'yes'}:path.endsWith(`/community/${card.id}`)?card:{items:[card],nextCursor:null};
    return {ok:true,status:200,json:async()=>value};
  }) as jest.Mock;
});
afterEach(()=>client.clear());
function chooseNative(label:string,option:string){
  const sheet=jest.spyOn(ActionSheetIOS,'showActionSheetWithOptions').mockImplementation(()=>{});
  fireEvent.press(screen.getByRole('button',{name:label}));
  const [options,choose]=sheet.mock.calls[0];
  const index=options.options.indexOf(option);
  expect(index).toBeGreaterThanOrEqual(0);
  act(()=>choose(index));
  sheet.mockRestore();
}
function mount(){return render(<QueryClientProvider client={client}><CommunityFeed userId="first" token="session" onSelect={jest.fn()} onCreate={jest.fn()}/></QueryClientProvider>);}

test('search, topics, saved cards and my votes become bounded API filters',async()=>{
  mount();await screen.findByText(card.title);
  fireEvent.changeText(screen.getByLabelText('Search community'),'bins');
  await waitFor(()=>expect((globalThis.fetch as jest.Mock).mock.calls.some(([u])=>String(u).includes('q=bins'))).toBe(true));
  chooseNative('Topic, All topics','Environment');
  await waitFor(()=>expect((globalThis.fetch as jest.Mock).mock.calls.some(([u])=>String(u).includes('topic=environment'))).toBe(true));
  chooseNative('Browse, Explore','Saved');
  await waitFor(()=>expect((globalThis.fetch as jest.Mock).mock.calls.some(([u])=>String(u).includes('watching=true'))).toBe(true));
  chooseNative('Browse, Saved','My votes');
  await waitFor(()=>expect((globalThis.fetch as jest.Mock).mock.calls.some(([u])=>String(u).includes('participated=true'))).toBe(true));
});

test('feed voting opens a fresh question and still requires explicit confirmation',async()=>{
  mount();await screen.findByText(card.title);
  fireEvent.press(screen.getByRole('button',{name:`Vote Yes on ${card.title}`}));
  await screen.findByRole('button',{name:'Confirm response'});
  expect(screen.getByRole('button',{name:'Confirm response'})).toBeDisabled();
  expect((globalThis.fetch as jest.Mock).mock.calls.filter(([,i])=>i?.method==='POST')).toHaveLength(0);
  fireEvent.press(screen.getByRole('checkbox',{name:'I confirm my response and accept the community rules.'}));
  fireEvent.press(screen.getByRole('button',{name:'Confirm response'}));
  await screen.findByText('Your response: Yes.');
  expect((globalThis.fetch as jest.Mock).mock.calls.filter(([u])=>String(u).endsWith('/response'))).toHaveLength(1);
});

test('opens compact filters without leaving the community feed',async()=>{
  mount();await screen.findByText(card.title);
  fireEvent.press(screen.getByRole('button',{name:'Filters'}));
  expect(screen.getByText('Explore your way')).toBeOnTheScreen();
  expect(screen.getByRole('button',{name:'Responses, Open and closed'})).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Show conversations'}));
  expect(screen.queryByText('Explore your way')).toBeNull();
  expect(screen.getByText(card.title)).toBeOnTheScreen();
});

test('uses native dropdowns for browsing and topics instead of scattered chips',async()=>{
  mount();await screen.findByText(card.title);
  expect(screen.getByRole('button',{name:'Browse, Explore'})).toBeOnTheScreen();
  expect(screen.getByRole('button',{name:'Topic, All topics'})).toBeOnTheScreen();
  expect(screen.queryByRole('radio',{name:'Environment'})).toBeNull();
  expect(screen.queryByRole('radio',{name:'Saved'})).toBeNull();
});

test('keeps selected filters when the window folds, unfolds or uses larger text',async()=>{
  const initial=Dimensions.get('window');
  try {
    act(()=>Dimensions.set({window:{...initial,width:280,height:720,fontScale:1}}));
    mount();await screen.findByText(card.title);
    chooseNative('Topic, All topics','Environment');
    chooseNative('Browse, Explore','Saved');
    for(const window of [{width:720,height:900,fontScale:1},{width:1200,height:800,fontScale:1},{width:360,height:720,fontScale:2}]){
      act(()=>Dimensions.set({window:{...initial,...window}}));
      expect(screen.getByRole('button',{name:'Browse, Saved'})).toBeOnTheScreen();
      expect(screen.getByRole('button',{name:'Topic, Environment'})).toBeOnTheScreen();
    }
  } finally { act(()=>Dimensions.set({window:initial})); }
});
