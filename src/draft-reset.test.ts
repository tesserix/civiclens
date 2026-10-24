import {act,renderHook,waitFor} from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import {useDraft} from './useDraft';

jest.mock('expo-file-system/legacy',()=>({documentDirectory:'file:///drafts/',deleteAsync:jest.fn(async()=>{})}));
jest.mock('expo-crypto',()=>{let id=0;return {randomUUID:()=>`draft-${++id}`};});

beforeEach(()=>jest.clearAllMocks());

test('discard clears saved content and the private photo, and starts with fresh consent and submission key',async()=>{
  const view=renderHook(()=>useDraft('reset-user'));
  await waitFor(()=>expect(view.result.current.ready).toBe(true));
  act(()=>view.result.current.update({photoUri:'file:///drafts/civiclens-photo-test.jpg',description:'Litter beside the path.',category:'roads',location:{latitude:1,longitude:2,locality:'Test',countryCode:'AU'},locationSource:'manual',consent:true,channels:['instagram']}));
  act(()=>view.result.current.update({hashtags:['#RoadSafety']}));
  const key=view.result.current.draft.key;
  await act(async()=>{await view.result.current.reset();});
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///drafts/civiclens-photo-test.jpg',{idempotent:true});
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('civiclens-draft-reset-user');
  expect(view.result.current.draft).toEqual({key:expect.any(String),category:'waste',description:'',photoUri:'',location:null,channels:['facebook'],consent:false});
  expect(view.result.current.draft.key).not.toBe(key);
});

test('discard waits for an outstanding save so it cannot resurrect the old draft',async()=>{
  const view=renderHook(()=>useDraft('reset-race'));
  await waitFor(()=>expect(view.result.current.ready).toBe(true));
  act(()=>view.result.current.update({description:'Old draft content'}));
  let finish!:()=>void;
  jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
  let saving!:Promise<void>;let resetting!:Promise<void>;
  act(()=>{saving=view.result.current.save();});
  await waitFor(()=>expect(finish).toBeDefined());
  act(()=>{resetting=view.result.current.reset();});
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  await act(async()=>{finish();await saving;await resetting;});
  expect(view.result.current.draft.description).toBe('');
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
});

test('failed discard keeps the draft available for retry and never deletes a library photo',async()=>{
  const view=renderHook(()=>useDraft('reset-error'));
  await waitFor(()=>expect(view.result.current.ready).toBe(true));
  act(()=>view.result.current.update({photoUri:'file:///library/original.jpg',description:'Keep this draft'}));
  jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('locked'));
  await act(async()=>{await expect(view.result.current.reset()).rejects.toThrow('locked');});
  expect(view.result.current.draft.description).toBe('Keep this draft');
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  await act(async()=>{await view.result.current.reset();});
  expect(view.result.current.draft.photoUri).toBe('');
});

test('storage failure does not remove the current photo; photo cleanup failure restores the saved draft for retry',async()=>{
  const view=renderHook(()=>useDraft('cleanup-failure'));
  await waitFor(()=>expect(view.result.current.ready).toBe(true));
  act(()=>view.result.current.update({photoUri:'file:///drafts/civiclens-photo-retry.jpg',description:'Retain on failure'}));
  jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('locked'));
  await act(async()=>{await expect(view.result.current.reset()).rejects.toThrow('locked');});
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  jest.mocked(FileSystem.deleteAsync).mockRejectedValueOnce(new Error('disk unavailable'));
  await act(async()=>{await expect(view.result.current.reset()).rejects.toThrow('disk unavailable');});
  expect(JSON.parse(jest.mocked(SecureStore.setItemAsync).mock.calls.at(-1)![1]).photoUri).toBe('file:///drafts/civiclens-photo-retry.jpg');
  expect(view.result.current.draft.description).toBe('Retain on failure');
});
