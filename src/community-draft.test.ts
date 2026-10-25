import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearCivicDraft, loadCivicDraft, saveCivicDraft, type CivicDraft } from './community-draft';

const draft:CivicDraft={version:1,key:'11111111-1111-4111-8111-111111111111',input:{kind:'request',title:'Please add more bins near the park',body:'There are no recycling bins beside the playground and the entrance.',countryCode:'AU',locality:'Melbourne',closesAt:'2026-11-01T12:00:00Z',rulesVersion:'2026-10-24',consent:true}};
beforeEach(async()=>{await AsyncStorage.clear();jest.clearAllMocks();});

test('topic survives restoration while consent remains fresh',async()=>{
  await saveCivicDraft('first',{...draft,input:{...draft.input,topic:'environment'}});
  expect((await loadCivicDraft('first'))?.input).toEqual({...draft.input,topic:'environment',consent:false});
});

test('drafts are account-scoped and consent must be given again on restore',async()=>{
  await saveCivicDraft('first',draft);
  expect(await loadCivicDraft('second')).toBeNull();
  const restored=await loadCivicDraft('first');
  expect(restored).toEqual({...draft,input:{...draft.input,consent:false}});
  await clearCivicDraft('second');
  expect((await loadCivicDraft('first'))?.key).toBe(draft.key);
});

test('clearing waits for older writes so a submitted draft cannot reappear',async()=>{
  let release!:()=>void;
  const real=AsyncStorage.setItem;
  jest.spyOn(AsyncStorage,'setItem').mockImplementationOnce(async(key,value)=>{await new Promise<void>(resolve=>{release=resolve;});await real(key,value);});
  const saving=saveCivicDraft('first',draft);
  const clearing=clearCivicDraft('first');
  await Promise.resolve();await Promise.resolve();
  release();await saving;await clearing;
  expect(await loadCivicDraft('first')).toBeNull();
});

test('corrupt storage is preserved for retry instead of silently replacing the draft',async()=>{
  await AsyncStorage.setItem('civiclens-civic-draft-v1:first','broken JSON');
  await expect(loadCivicDraft('first')).rejects.toThrow('restore');
  expect(await AsyncStorage.getItem('civiclens-civic-draft-v1:first')).toBe('broken JSON');
});
