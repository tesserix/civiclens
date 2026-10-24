import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useWritingLanguage } from './languages';

beforeEach(() => { jest.restoreAllMocks(); });

test('a delayed saved preference cannot replace a language chosen now', async () => {
  let finish!: (value: string) => void;
  jest.spyOn(AsyncStorage, 'getItem').mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useWritingLanguage('first'));
  act(() => result.current[1]('or'));
  await act(async () => finish('hi'));
  expect(result.current[0].tag).toBe('or');
});

test('switching accounts without a saved preference does not inherit the previous account language', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce('or').mockResolvedValueOnce(null);
  const { result, rerender } = renderHook<ReturnType<typeof useWritingLanguage>, { user: string }>(({ user }) => useWritingLanguage(user), { initialProps: { user: 'first' } });
  await waitFor(() => expect(result.current[0].tag).toBe('or'));
  rerender({ user: 'second' });
  await waitFor(() => expect(result.current[0].tag).toBe('en'));
});
