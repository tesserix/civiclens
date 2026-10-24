import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AuthorityPreview } from './authority-preview';

const location = { latitude: 15, longitude: 75, countryCode: 'IN', locality: 'Test town' };
const match = { status: 'matched', authorities: [{ id: 'test', name: 'Test Municipality', officialUrl: 'https://authority.invalid', sourceUrl: 'https://authority.invalid/contact', verifiedAt: '2026-01-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z', facebook: 'TestMunicipality', instagram: null }] };
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => { globalThis.fetch = jest.fn().mockResolvedValue(reply(match)); });

test('looks up confirmed coordinates and shows verified sources and channel-specific handles', async () => {
  render(<AuthorityPreview token="test-session" category="waste" location={location} available />);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Confirm location & find authorities' }));
  expect(await screen.findByText('Test Municipality')).toBeOnTheScreen();
  const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
  expect(url).toMatch(/\/v1\/authorities\/preview$/);
  expect(init.headers.Authorization).toBe('Session test-session');
  expect(JSON.parse(init.body)).toEqual({ category: 'waste', location });
  expect(screen.getByText('Facebook: @TestMunicipality')).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: 'Verification source for Test Municipality' })).toBeOnTheScreen();
  expect(screen.getByRole('checkbox', { name: 'These offices match the issue' })).not.toBeChecked();
  fireEvent.press(screen.getByRole('checkbox', { name: 'These offices match the issue' }));
  expect(screen.getByRole('checkbox', { name: 'These offices match the issue' })).toBeChecked();
});

test('removes old matches when the location changes and ignores their late response', async () => {
  let resolve!: (value: unknown) => void;
  (globalThis.fetch as jest.Mock).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const view = render(<AuthorityPreview token="test-session" category="waste" location={location} available />);
  fireEvent.press(screen.getByRole('button', { name: 'Confirm location & find authorities' }));
  view.rerender(<AuthorityPreview token="test-session" category="waste" location={{ ...location, longitude: 76 }} available />);
  await act(async () => { resolve(reply(match)); });
  expect(screen.queryByText('Test Municipality')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Confirm location & find authorities' })).toBeEnabled();
});

test('never fabricates a handle when coverage is missing or the API is unavailable', async () => {
  (globalThis.fetch as jest.Mock).mockResolvedValueOnce(reply({ status: 'unverified', authorities: [] }));
  render(<AuthorityPreview token="test-session" category="waste" location={location} available />);
  fireEvent.press(screen.getByRole('button', { name: 'Confirm location & find authorities' }));
  expect(await screen.findByText(/No verified authority match/)).toBeOnTheScreen();
  expect(screen.queryByRole('checkbox')).not.toBeOnTheScreen();
  (globalThis.fetch as jest.Mock).mockResolvedValueOnce(reply({}, 503));
  fireEvent.press(screen.getByRole('button', { name: 'Confirm location & find authorities' }));
  expect(await screen.findByText(/Could not check authorities/)).toBeOnTheScreen();
});

test('keeps authority controls out of the way until location is provided', () => {
  render(<AuthorityPreview token="test-session" category="waste" location={null} available />);
  expect(screen.queryByText('Responsible authorities')).not.toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Confirm location & find authorities' })).not.toBeOnTheScreen();
});

test('uses a brief review explanation when authority lookup is unavailable', () => {
  render(<AuthorityPreview token="test-session" category="waste" location={location} available={false} />);
  expect(screen.getByText('A reviewer will verify the responsible office before sharing.')).toBeOnTheScreen();
  expect(screen.queryByText(/Topic hashtags/)).not.toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Confirm location & find authorities' })).not.toBeOnTheScreen();
});
