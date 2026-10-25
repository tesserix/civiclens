import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLoginDestination, readLoginDestination, rememberLoginDestination } from './login-destination';
const first='/community/0199a77b-8b01-7000-8000-000000000001';
const second='/community/0199a77b-8b01-7000-8000-000000000002';
beforeEach(async()=>{await AsyncStorage.clear();});
test('preserves a shared request across sign-in and only clears the active destination',async()=>{
  await rememberLoginDestination(first);
  expect(await readLoginDestination()).toBe(first);
  await rememberLoginDestination(second);
  await clearLoginDestination(first);
  expect(await readLoginDestination()).toBe(second);
  await clearLoginDestination(second);
  expect(await readLoginDestination()).toBeNull();
});
test('rejects external URLs, encoded paths and query strings instead of creating open redirects',async()=>{
  for(const value of ['https://evil.invalid','//evil.invalid','/community/../profile',`${first}?token=secret`,'/community/%2f%2fevil.invalid','/profile'])await expect(rememberLoginDestination(value)).rejects.toThrow('Invalid');
  expect(await readLoginDestination()).toBeNull();
});
test('does not lose a requested page when device storage fails',async()=>{
  await rememberLoginDestination(first);
  jest.spyOn(AsyncStorage,'getItem').mockRejectedValueOnce(new Error('locked'));
  await expect(readLoginDestination()).rejects.toThrow();
  expect(await readLoginDestination()).toBe(first);
});
