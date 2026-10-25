import {act,renderHook,waitFor} from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import {useDraft} from './useDraft';

jest.mock('expo-crypto',()=>{let id=0;return {randomUUID:()=>`00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`};});
test('preserves chosen hashtags for text edits and resets them when category or location changes',async()=>{
  const view=renderHook(()=>useDraft('qa-user'));
  await waitFor(()=>expect(view.result.current.ready).toBe(true));
  const location={latitude:-37.814,longitude:144.9633,countryCode:'AU',locality:'Melbourne'};
  act(()=>view.result.current.update({location}));
  act(()=>view.result.current.update({hashtags:['#Melbourne']}));
  act(()=>view.result.current.update({description:'Rubbish is scattered on the grass.'}));
  expect(view.result.current.draft.hashtags).toEqual(['#Melbourne']);
  act(()=>view.result.current.update({category:'roads'}));
  expect(view.result.current.draft.hashtags).toBeUndefined();
  act(()=>view.result.current.update({hashtags:['#RoadSafety']}));
  act(()=>view.result.current.update({location:{...location,longitude:151.2}}));
  expect(view.result.current.draft.hashtags).toBeUndefined();
});

test.each([{hashtags:['#Litter']},{hashtags:[]}])('restores explicit hashtag choices from the private saved draft: %j',async({hashtags})=>{
  const view=renderHook(()=>useDraft('qa-saved-tags'));
  await waitFor(()=>expect(view.result.current.ready).toBe(true));
  act(()=>view.result.current.update({hashtags}));
  await act(async()=>{await view.result.current.save();});
  const saved=(SecureStore.setItemAsync as jest.Mock).mock.calls.at(-1);
  expect(JSON.parse(saved[1]).hashtags).toEqual(hashtags);
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(saved[1]);
  view.unmount();
  const reopened=renderHook(()=>useDraft('qa-saved-tags'));
  await waitFor(()=>expect(reopened.result.current.ready).toBe(true));
  expect(reopened.result.current.draft.hashtags).toEqual(hashtags);
});


test('moves an older country-Page draft to user sharing with fresh consent and submission key',async()=>{
  const prior={key:'old-managed-key',sharingMode:'managed',category:'waste',description:'Keep this description.',photoUri:'',location:null,channels:['facebook','whatsapp'],consent:true};
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(prior));
  const view=renderHook(()=>useDraft('qa-legacy-sharing'));
  await waitFor(()=>expect(view.result.current.ready).toBe(true));
  expect(view.result.current.draft).toMatchObject({sharingMode:'manual',consent:false,description:prior.description,channels:prior.channels});
  expect(view.result.current.draft.key).not.toBe(prior.key);
});

test('repeated native text callbacks keep an unchanged draft and submission key stable',async()=>{
  const view=renderHook(()=>useDraft('qa-native-text'));
  await waitFor(()=>expect(view.result.current.ready).toBe(true));
  act(()=>view.result.current.update({description:'Litter is scattered on the grass.'}));
  const saved=view.result.current.draft;
  for(let i=0;i<60;i++)act(()=>view.result.current.update({description:saved.description}));
  expect(view.result.current.draft).toBe(saved);
  expect(view.result.current.draft.key).toBe(saved.key);
  act(()=>view.result.current.update({description:'Litter is scattered beside the public path.'}));
  expect(view.result.current.draft.description).toBe('Litter is scattered beside the public path.');
  expect(view.result.current.draft.key).not.toBe(saved.key);
});
