jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked',
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-router', () => ({ Redirect: () => null, useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
