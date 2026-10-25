import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommunityFeed } from './community-feed';

let client:QueryClient;
beforeEach(()=>{client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});});
afterEach(()=>client.clear());
test('keeps participation disabled when the deployed backend does not support it',async()=>{
  globalThis.fetch=jest.fn(async()=>({ok:true,status:200,json:async()=>({assist:true})})) as jest.Mock;
  render(<QueryClientProvider client={client}><CommunityFeed userId="first" token="session" onSelect={jest.fn()} onCreate={jest.fn()}/></QueryClientProvider>);
  await screen.findByText(/Community requests are not available on this server yet/);
  expect(screen.queryByRole('button',{name:'Start a request or poll'})).toBeNull();
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});
test('opens reviewed cards and lets a signed-in citizen start a request',async()=>{
  const select=jest.fn(),create=jest.fn(),directory=jest.fn();
  globalThis.fetch=jest.fn(async(url)=>({ok:true,status:200,json:async()=>String(url).endsWith('/capabilities')?{civicParticipation:true,communityRulesVersion:'2026-10-24'}:String(url).endsWith('/access')?{canModerate:false}:{items:[{id:'card-1',kind:'request',title:'Add recycling bins near the park',body:'A bin would help us keep the public path clean.',authorNickname:'HappyKea',locality:'Melbourne',countryCode:'AU',status:'approved',closed:false,closesAt:'2026-11-01T12:00:00Z'}],nextCursor:null}})) as jest.Mock;
  render(<QueryClientProvider client={client}><CommunityFeed userId="first" token="session" onSelect={select} onCreate={create} onDirectory={directory}/></QueryClientProvider>);
  await screen.findByText('Add recycling bins near the park');
  fireEvent.press(screen.getByRole('button',{name:'Open Add recycling bins near the park'}));
  expect(select).toHaveBeenCalledWith('card-1');
  fireEvent.press(screen.getByRole('button',{name:'Start a request or poll'}));
  expect(create).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button',{name:'Find councils and official contacts'}));
  expect(directory).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button',{name:'Review pending requests'})).toBeNull();
  await waitFor(()=>expect(globalThis.fetch).toHaveBeenCalledTimes(3));
});
