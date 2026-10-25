import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform, Share } from 'react-native';
import { CommunityShare } from './community-share';
import type { CivicCard } from '../shared/contracts';
const card={id:'0199a77b-8b01-7000-8000-000000000001',title:'Should our park have more rubbish bins?',status:'approved',webShareSupported:true} as CivicCard;
afterEach(()=>jest.restoreAllMocks());

test('shares a verified HTTPS question link through the native social chooser',async()=>{
  const native=jest.spyOn(Share,'share').mockResolvedValue({action:Share.sharedAction});
  const url=`https://civiclns-api.tesserix.app/community/${card.id}`;
  globalThis.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({cardId:card.id,url,text:card.title})});
  render(<CommunityShare card={card} userId="first" token="session"/>);
  fireEvent.press(screen.getByRole('button',{name:`Share ${card.title}`}));
  await waitFor(()=>expect(native).toHaveBeenCalledWith(expect.objectContaining({url,message:card.title})));
});

test('never shares an untrusted host or after the account changes during recheck',async()=>{
  const native=jest.spyOn(Share,'share').mockResolvedValue({action:Share.sharedAction});
  let resolve!:(value:Response)=>void;
  globalThis.fetch=jest.fn(()=>new Promise<Response>(r=>{resolve=r;}));
  const view=render(<CommunityShare card={card} userId="first" token="old"/>);
  fireEvent.press(screen.getByRole('button',{name:`Share ${card.title}`}));
  await waitFor(()=>expect(globalThis.fetch).toHaveBeenCalledTimes(1));
  view.rerender(<CommunityShare card={card} userId="second" token="new"/>);
  await act(async()=>resolve({ok:true,json:async()=>({cardId:card.id,url:`https://civiclns-api.tesserix.app/community/${card.id}`,text:card.title})} as Response));
  expect(native).not.toHaveBeenCalled();
  globalThis.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({cardId:card.id,url:`https://example.org/community/${card.id}`,text:card.title})});
  fireEvent.press(screen.getByRole('button',{name:`Share ${card.title}`}));
  await screen.findByText('Could not share. Please retry.');
  expect(native).not.toHaveBeenCalled();
});

test.each([
  `https://civiclns-api.tesserix.app/community/${card.id}?token=secret`,
  `https://civiclns-api.tesserix.app/community/${card.id}#other`,
  `https://name:password@civiclns-api.tesserix.app/community/${card.id}`,
  'https://civiclns-api.tesserix.app/community/another-card',
  `http://civiclns-api.tesserix.app/community/${card.id}`,
])('rejects a share response outside the exact public question URL: %s', async url => {
  const native=jest.spyOn(Share,'share').mockResolvedValue({action:Share.sharedAction});
  globalThis.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({cardId:card.id,url,text:card.title})});
  render(<CommunityShare card={card} userId="first" token="session"/>);
  fireEvent.press(screen.getByRole('button',{name:`Share ${card.title}`}));
  await screen.findByText('Could not share. Please retry.');
  expect(native).not.toHaveBeenCalled();
});

test('includes the HTTPS link once in the Android share text', async()=>{
  const previous=Platform.OS;
  Platform.OS='android';
  try {
    const native=jest.spyOn(Share,'share').mockResolvedValue({action:Share.sharedAction});
    const url=`https://civiclns-api.tesserix.app/community/${card.id}`;
    globalThis.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({cardId:card.id,url,text:`${card.title}\n\n${url}`})});
    render(<CommunityShare card={card} userId="first" token="session"/>);
    fireEvent.press(screen.getByRole('button',{name:`Share ${card.title}`}));
    await waitFor(()=>expect(native).toHaveBeenCalledWith({message:`${card.title}\n\n${url}`}));
  } finally { Platform.OS=previous; }
});

test('cancellation does not claim a send and network failure can be retried',async()=>{
  const native=jest.spyOn(Share,'share').mockResolvedValue({action:Share.dismissedAction});
  const url=`https://civiclns-api.tesserix.app/community/${card.id}`;
  globalThis.fetch=jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ok:true,json:async()=>({cardId:card.id,url,text:card.title})});
  render(<CommunityShare card={card} userId="first" token="session"/>);
  fireEvent.press(screen.getByRole('button',{name:`Share ${card.title}`}));
  await screen.findByText('Could not share. Please retry.');
  fireEvent.press(screen.getByRole('button',{name:`Share ${card.title}`}));
  await waitFor(()=>expect(native).toHaveBeenCalledTimes(1));
  await waitFor(()=>expect(screen.getByRole('button',{name:`Share ${card.title}`})).not.toBeDisabled());
  expect(screen.queryByText('Check the destination app to confirm it was sent.')).toBeNull();
});

test('withdrawal during the server recheck never opens sharing',async()=>{
  const native=jest.spyOn(Share,'share').mockResolvedValue({action:Share.sharedAction});
  let resolve!:(value:Response)=>void;
  globalThis.fetch=jest.fn(()=>new Promise<Response>(r=>{resolve=r;}));
  const view=render(<CommunityShare card={card} userId="first" token="session"/>);
  fireEvent.press(screen.getByRole('button',{name:`Share ${card.title}`}));
  view.rerender(<CommunityShare card={{...card,status:'hidden'}} userId="first" token="session"/>);
  await act(async()=>resolve({ok:true,json:async()=>({cardId:card.id,url:`https://civiclns-api.tesserix.app/community/${card.id}`,text:card.title})} as Response));
  expect(native).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:`Share ${card.title}`})).toBeNull();
});
