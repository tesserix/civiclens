import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CivicCard } from '../shared/contracts';
import { CommunityVote, CommunitySave } from './community-participation';
import { civicQueryKey } from './community-model';

const card:CivicCard={id:'0199a77b-8b01-7000-8000-000000000001',kind:'poll',topic:'environment',title:'Should our park have more rubbish bins?',body:'More bins would help everyone keep this park clean.',countryCode:'AU',locality:'Melbourne',closesAt:'2027-01-01T12:00:00Z',createdAt:'2026-10-25T12:00:00Z',status:'approved',authorNickname:'HappyKea',mine:false,closed:false,myResponse:null,results:null,canReview:false,watching:false};
let client:QueryClient;
beforeEach(()=>{client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false,gcTime:0}}});});
afterEach(()=>client.clear());

test('a feed choice still requires consent and can be retried without losing the choice',async()=>{
  let fail=true;globalThis.fetch=jest.fn(async()=>{if(fail)throw new Error('offline');return{ok:true,json:async()=>({...card,myResponse:'yes'})};}) as jest.Mock;
  render(<QueryClientProvider client={client}><CommunityVote card={card} userId="first" token="private-session" initialChoice="yes"/></QueryClientProvider>);
  expect(screen.getByRole('radio',{name:'Yes'})).toBeChecked();
  expect(screen.getByRole('button',{name:'Confirm response'})).toBeDisabled();
  fireEvent.press(screen.getByRole('checkbox',{name:'I confirm my response and accept the community rules.'}));
  fireEvent.press(screen.getByRole('button',{name:'Confirm response'}));
  await screen.findByText(/Could not connect/);
  expect(screen.getByRole('radio',{name:'Yes'})).toBeChecked();
  fail=false;fireEvent.press(screen.getByRole('button',{name:'Confirm response'}));
  await screen.findByText('Your response: Yes.');
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});

test('a save response from a previous account cannot repopulate cleared private caches',async()=>{
  let resolve!:(value:unknown)=>void;
  globalThis.fetch=jest.fn(()=>new Promise(r=>{resolve=r;})) as jest.Mock;
  const view=render(<QueryClientProvider client={client}><CommunitySave card={card} userId="first" token="old-session"/></QueryClientProvider>);
  fireEvent.press(screen.getByRole('checkbox',{name:`Save ${card.title}`}));
  await waitFor(()=>expect(globalThis.fetch).toHaveBeenCalledTimes(1));
  client.clear();
  view.rerender(<QueryClientProvider client={client}><CommunitySave card={card} userId="second" token="new-session"/></QueryClientProvider>);
  await act(async()=>resolve({ok:true,json:async()=>({cardId:card.id,watching:true})}));
  expect(screen.getByRole('checkbox',{name:`Save ${card.title}`})).not.toBeChecked();
  expect(client.getQueryData(civicQueryKey('first',card.id))).toBeUndefined();
});

test('pending and closed polls cannot accept a response',()=>{
  const view=render(<QueryClientProvider client={client}><CommunityVote card={{...card,closed:true}} userId="first" token="private-session"/></QueryClientProvider>);
  expect(screen.queryByRole('button',{name:'Confirm response'})).toBeNull();
  view.rerender(<QueryClientProvider client={client}><CommunityVote card={{...card,status:'pending'}} userId="first" token="private-session"/></QueryClientProvider>);
  expect(screen.queryByRole('button',{name:'Confirm response'})).toBeNull();
});
