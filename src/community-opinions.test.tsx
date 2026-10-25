import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommunityOpinions } from './community-opinions';
jest.mock('expo-crypto',()=>({randomUUID:jest.fn(()=>'9dcc1ee1-54cc-4fa4-bc97-52a099e1514f')}));
test('keeps opinions private for review and retries with the same submission key',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false,gcTime:0}}});
  const calls:RequestInit[]=[];let fail=true,posted=false;
  const opinion={id:'opinion-1',cardId:'card-1',text:'Please put a recycling bin near the entrance too.',authorNickname:'HappyKea',mine:true,canReview:false,status:'pending',createdAt:'2026-10-25T12:00:00Z'};
  globalThis.fetch=jest.fn(async(url,init)=>{
    if(String(url).endsWith('/access'))return {ok:true,status:200,json:async()=>({canModerate:false})} as Response;
    if(init?.method==='POST'){calls.push(init);if(fail)throw new Error('offline');posted=true;return {ok:true,status:200,json:async()=>opinion} as Response;}
    return {ok:true,status:200,json:async()=>({items:posted?[opinion]:[],nextCursor:null})} as Response;
  }) as jest.Mock;
  render(<QueryClientProvider client={client}><CommunityOpinions id="card-1" userId="first" token="session" open/></QueryClientProvider>);
  await screen.findByLabelText('Your opinion');
  fireEvent.changeText(screen.getByLabelText('Your opinion'),opinion.text);
  fireEvent.press(screen.getByRole('checkbox',{name:'Publish this opinion under my nickname after independent review.'}));
  fireEvent.press(screen.getByRole('button',{name:'Send opinion for review'}));
  await screen.findByText(/Could not connect/);
  fail=false;fireEvent.press(screen.getByRole('button',{name:'Send opinion for review'}));
  await screen.findByText('Waiting for independent review. Only you and moderators can see this opinion.');
  expect(calls[0].body).toBe(calls[1].body);
  expect((calls[0].headers as Record<string,string>)['Idempotency-Key']).toBe((calls[1].headers as Record<string,string>)['Idempotency-Key']);
  client.clear();
});
