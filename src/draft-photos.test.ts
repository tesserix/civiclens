import {act,renderHook,waitFor} from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import {draftPhotos,useDraft} from './useDraft';

jest.mock('expo-file-system/legacy',()=>({documentDirectory:'file:///drafts/',copyAsync:jest.fn(),deleteAsync:jest.fn()}));
jest.mock('expo-crypto',()=>{let id=0;return {randomUUID:()=>`copy-${++id}`};});
const files=new Map<string,string>();
const a='file:///drafts/civiclens-photo-a.jpg';
const b='file:///drafts/civiclens-photo-b.jpg';
beforeEach(()=>{
  jest.clearAllMocks();files.clear();files.set(a,'first image');files.set(b,'second image');
  jest.mocked(FileSystem.copyAsync).mockImplementation(async({from,to})=>{if(!files.has(from))throw new Error('missing photo');files.set(to,files.get(from)!);});
  jest.mocked(FileSystem.deleteAsync).mockImplementation(async uri=>{files.delete(uri);});
});
test('discard removes every app-owned photo including a photo removed from the selection',async()=>{
  const view=renderHook(()=>useDraft('multi-cleanup'));await waitFor(()=>expect(view.result.current.ready).toBe(true));
  act(()=>view.result.current.update({photoUri:a,additionalPhotoUris:[b]}));
  act(()=>view.result.current.update({additionalPhotoUris:[]}));
  await act(async()=>{await view.result.current.reset();});
  expect(files.size).toBe(0);expect(draftPhotos(view.result.current.draft)).toEqual([]);
});
test('partial photo cleanup failure preserves both images and a retryable saved draft',async()=>{
  const view=renderHook(()=>useDraft('multi-recovery'));await waitFor(()=>expect(view.result.current.ready).toBe(true));
  act(()=>view.result.current.update({photoUri:a,additionalPhotoUris:[b],description:'Keep both photos'}));
  jest.mocked(FileSystem.deleteAsync).mockImplementation(async uri=>{if(uri===b)throw new Error('storage busy');files.delete(uri);});
  await act(async()=>{await expect(view.result.current.reset()).rejects.toThrow('storage busy');});
  expect(draftPhotos(view.result.current.draft).map(uri=>files.get(uri))).toEqual(['first image','second image']);
  const saved=JSON.parse(jest.mocked(SecureStore.setItemAsync).mock.calls.at(-1)![1]);
  expect(draftPhotos(saved).map(uri=>files.get(uri))).toEqual(['first image','second image']);
  jest.mocked(FileSystem.deleteAsync).mockImplementation(async uri=>{files.delete(uri);});
  await act(async()=>{await view.result.current.reset();});expect(files.size).toBe(0);
});
