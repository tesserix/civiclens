import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommunityOpinions } from './community-opinions';
import { ActionSheetIOS } from 'react-native';
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

test('reports a specific opinion and its author privately with an explicit reason',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false,gcTime:0}}});
  const opinion={id:'0199a77b-8b01-7000-8000-000000000002',cardId:'card-1',text:'A recycling bin beside the entrance would help.',authorNickname:'HappyKea',mine:false,canReview:false,status:'approved',createdAt:'2026-10-25T12:00:00Z'};
  const reports:unknown[]=[];
  const sheet=jest.spyOn(ActionSheetIOS,'showActionSheetWithOptions').mockImplementation((_options,choose)=>choose(2));
  globalThis.fetch=jest.fn(async(url,init)=>{
    const path=String(url);
    if(path.endsWith('/capabilities'))return {ok:true,status:200,json:async()=>({communityBlocking:true})} as Response;
    if(path.endsWith('/access'))return {ok:true,status:200,json:async()=>({canModerate:false})} as Response;
    if(path.endsWith('/flag')){reports.push(JSON.parse(String(init?.body)));return {ok:true,status:200,json:async()=>({received:true})} as Response;}
    return {ok:true,status:200,json:async()=>({items:[opinion],nextCursor:null})} as Response;
  }) as jest.Mock;
  render(<QueryClientProvider client={client}><CommunityOpinions id="card-1" userId="first" token="session" open/></QueryClientProvider>);
  fireEvent.press(await screen.findByRole('button',{name:'Report opinion by HappyKea'}));
  fireEvent.press(screen.getByRole('button',{name:'Opinion concern reason, Choose reason'}));
  expect(reports).toEqual([]);
  fireEvent.press(screen.getByRole('button',{name:'Send opinion concern'}));
  await screen.findByText('Opinion concern sent to moderators.');
  expect(reports).toEqual([{reason:'harassment',opinionId:opinion.id}]);
  sheet.mockRestore();client.clear();
});
