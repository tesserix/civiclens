import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountProfileCard } from './account-profile';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: jest.fn(), SaveFormat: { JPEG: 'jpeg' } }));

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ bio: '', photoBase64: null, signInPhotoAvailable: false }) });
});
afterEach(() => { client.clear(); jest.restoreAllMocks(); });
function mount() { return render(<QueryClientProvider client={client}><AccountProfileCard userId="first" token="session" nickname="ParkFox" available /></QueryClientProvider>); }

test('saves a short private bio and restores it after reopening the editor', async () => {
  mount();
  fireEvent.press(await screen.findByRole('button', { name: 'Edit profile' }));
  fireEvent.changeText(screen.getByLabelText('Bio'), 'I care about cleaner parks.');
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ bio: 'I care about cleaner parks.', photoBase64: null, signInPhotoAvailable: false }) } as Response);
  fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByText('I care about cleaner parks.');
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringMatching(/\/v1\/me\/profile$/), expect.objectContaining({ method: 'PUT', body: JSON.stringify({ bio: 'I care about cleaner parks.', photoBase64: null, removePhoto: false }) })));
  fireEvent.press(screen.getByRole('button', { name: 'Edit profile' }));
  expect(screen.getByLabelText('Bio')).toHaveProp('value', 'I care about cleaner parks.');
});

test('previews a selected photo and uploads it only when Save is pressed', async () => {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///chosen.jpg', width: 900, height: 900 }] });
  jest.mocked(ImageManipulator.manipulateAsync).mockResolvedValue({ uri: 'file:///resized.jpg', base64: '/9j/AA==', width: 256, height: 256 });
  mount();
  fireEvent.press(await screen.findByRole('button', { name: 'Edit profile' }));
  fireEvent.press(screen.getByRole('button', { name: 'Choose profile photo' }));
  await screen.findByLabelText('Profile photo preview');
  expect(fetch).toHaveBeenCalledTimes(1);
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ bio: '', photoBase64: '/9j/AA==', signInPhotoAvailable: false }) } as Response);
  fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByRole('button', { name: 'Edit profile' });
  expect(fetch).toHaveBeenLastCalledWith(expect.stringMatching(/\/v1\/me\/profile$/), expect.objectContaining({ method: 'PUT', body: JSON.stringify({ bio: '', photoBase64: '/9j/AA==', removePhoto: false }) }));
});

test('imports only the verified sign-in photo candidate and previews it before saving', async () => {
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ bio: '', photoBase64: null, signInPhotoAvailable: true }) } as Response);
  mount();
  fireEvent.press(await screen.findByRole('button', { name: 'Edit profile' }));
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ photoBase64: '/9j/AQ==' }) } as Response);
  fireEvent.press(screen.getByRole('button', { name: 'Use sign-in photo' }));
  await screen.findByLabelText('Profile photo preview');
  expect(fetch).toHaveBeenLastCalledWith(expect.stringMatching(/\/v1\/me\/profile\/sign-in-photo$/), expect.objectContaining({ method: 'POST', body: '{}' }));
  expect(screen.getByRole('button', { name: 'Save profile' })).toBeOnTheScreen();
});

test('keeps unsaved bio text after a network failure and does not invent a provider photo', async () => {
  mount();
  fireEvent.press(await screen.findByRole('button', { name: 'Edit profile' }));
  expect(screen.getByRole('button', { name: 'Use sign-in photo' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Bio'), 'Keep this edit');
  jest.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
  fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByText('Could not save your profile. Your changes are still here. Please retry.');
  expect(screen.getByLabelText('Bio')).toHaveProp('value', 'Keep this edit');
});

test('removing the photo is an explicit save action', async () => {
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ bio: '', photoBase64: '/9j/AA==', signInPhotoAvailable: false }) } as Response);
  mount();
  fireEvent.press(await screen.findByRole('button', { name: 'Edit profile' }));
  fireEvent.press(screen.getByRole('button', { name: 'Remove profile photo' }));
  expect(screen.queryByLabelText('Profile photo preview')).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByRole('button', { name: 'Edit profile' });
  expect(fetch).toHaveBeenLastCalledWith(expect.stringMatching(/\/v1\/me\/profile$/), expect.objectContaining({ body: JSON.stringify({ bio: '', photoBase64: null, removePhoto: true }) }));
});

test('ignores a pending photo selection after the account changes', async () => {
  let release!: (value: ImagePicker.ImagePickerResult) => void;
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const view = mount();
  fireEvent.press(await screen.findByRole('button', { name: 'Edit profile' }));
  fireEvent.press(screen.getByRole('button', { name: 'Choose profile photo' }));
  view.rerender(<QueryClientProvider client={client}><AccountProfileCard userId="second" token="other-session" nickname="ParkKea" available /></QueryClientProvider>);
  await act(async () => release({ canceled: false, assets: [{ uri: 'file:///old-account.jpg', width: 500, height: 500 }] }));
  await screen.findByRole('button', { name: 'Edit profile' });
  expect(screen.getByText('ParkKea')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Profile photo preview')).toBeNull();
});
