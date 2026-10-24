import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import * as Device from 'expo-location';
import { useDeviceLocation } from './useDeviceLocation';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 }, hasServicesEnabledAsync: jest.fn(), getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn(), reverseGeocodeAsync: jest.fn(),
}));
const fix = () => ({ timestamp: Date.now(), coords: { latitude: -37.81, longitude: 144.96, accuracy: 10 } });
const place = { latitude: -37.81, longitude: 144.96, countryCode: 'AU', locality: 'Test city, Test region' };
beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  (Device.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
  (Device.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' });
  (Device.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (Device.getCurrentPositionAsync as jest.Mock).mockResolvedValue(fix());
  (Device.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{ isoCountryCode: 'AU', city: 'Test city', region: 'Test region' }]);
});

test('automatically uses a fresh device fix and geocodes those coordinates without IP lookup', async () => {
  const changed = jest.fn(); globalThis.fetch = jest.fn();
  renderHook(() => useDeviceLocation(true, null, changed));
  await waitFor(() => expect(changed).toHaveBeenCalledWith(place));
  expect(Device.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Device.Accuracy.High });
  expect(Device.reverseGeocodeAsync).toHaveBeenCalledWith({ latitude: -37.81, longitude: 144.96 });
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('requests foreground permission once for a new report, and keeps denied permission actionable', async () => {
  (Device.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, canAskAgain: true, status: 'undetermined' });
  (Device.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  const changed = jest.fn();
  const { result } = renderHook(() => useDeviceLocation(true, null, changed));
  await waitFor(() => expect(result.current.settingsNeeded).toBe(true));
  expect(Device.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Device.getCurrentPositionAsync).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
});

test('does not repeatedly prompt denied users or silently move a saved report', async () => {
  (Device.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied' });
  const changed = jest.fn();
  const saved = renderHook(() => useDeviceLocation(true, place, changed));
  expect(Device.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  saved.unmount();
  const { result } = renderHook(() => useDeviceLocation(true, null, changed));
  await waitFor(() => expect(result.current.settingsNeeded).toBe(true));
  expect(Device.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});

test.each(['stale', 'imprecise', 'invalid', 'unknown accuracy'])('rejects a %s device fix without geocoding or updating the draft', async kind => {
  const position = fix();
  if (kind === 'stale') position.timestamp -= 121000;
  if (kind === 'imprecise') position.coords.accuracy = 101;
  if (kind === 'invalid') position.coords.latitude = NaN;
  (Device.getCurrentPositionAsync as jest.Mock).mockResolvedValue(kind === 'unknown accuracy' ? { ...position, coords: { ...position.coords, accuracy: null } } : position);
  const changed = jest.fn(); const { result } = renderHook(() => useDeviceLocation(true, null, changed));
  await waitFor(() => expect(result.current.error).toMatch(/precise current location/));
  expect(changed).not.toHaveBeenCalled(); expect(Device.reverseGeocodeAsync).not.toHaveBeenCalled();
});

test('retains device coordinates for manual town correction if geocoding fails', async () => {
  (Device.reverseGeocodeAsync as jest.Mock).mockRejectedValue(new Error('offline'));
  const changed = jest.fn(); const { result } = renderHook(() => useDeviceLocation(true, null, changed));
  await waitFor(() => expect(changed).toHaveBeenCalledWith({ ...place, countryCode: '', locality: '' }));
  expect(result.current.error).toMatch(/Enter the town/);
});

test('ignores a late fix after leaving the report screen and can retry on return', async () => {
  let resolve!: (value: unknown) => void;
  (Device.getCurrentPositionAsync as jest.Mock).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const changed = jest.fn(); const view = renderHook<ReturnType<typeof useDeviceLocation>, { enabled: boolean }>(({ enabled }) => useDeviceLocation(enabled, null, changed), { initialProps: { enabled: true } });
  await waitFor(() => expect(Device.getCurrentPositionAsync).toHaveBeenCalledTimes(1));
  view.rerender({ enabled: false });
  await act(async () => { resolve(fix()); });
  expect(changed).not.toHaveBeenCalled();
  view.rerender({ enabled: true });
  await waitFor(() => expect(changed).toHaveBeenCalledWith(place));
  expect(view.result.current.busy).toBe(false);
});

test('times out a stalled fix, ignores its late result, and permits a retry', async () => {
  jest.useFakeTimers();
  let resolve!: (value: unknown) => void;
  (Device.getCurrentPositionAsync as jest.Mock).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const changed = jest.fn(); const view = renderHook(() => useDeviceLocation(true, null, changed));
  await act(async () => {});
  await act(async () => { jest.advanceTimersByTime(15000); });
  expect(view.result.current.busy).toBe(false);
  expect(view.result.current.error).toMatch(/retry/);
  await act(async () => { resolve(fix()); });
  expect(changed).not.toHaveBeenCalled();
  await act(async () => { await view.result.current.locate(); });
  expect(changed).toHaveBeenCalledWith(place);
  view.unmount(); jest.useRealTimers();
});

test('offers settings when device location services are disabled', async () => {
  (Device.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(false);
  const { result } = renderHook(() => useDeviceLocation(true, null, jest.fn()));
  await waitFor(() => expect(result.current.error).toMatch(/Location Services/));
  expect(Device.getCurrentPositionAsync).not.toHaveBeenCalled();
});


test('retries automatically after returning from Settings without accepting a background result', async () => {
  let changedState!: (state: AppStateStatus) => void;
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
    changedState = handler; return { remove: jest.fn() };
  });
  let resolve!: (value: unknown) => void;
  (Device.getCurrentPositionAsync as jest.Mock).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const changed = jest.fn(); const view = renderHook(() => useDeviceLocation(true, null, changed));
  await waitFor(() => expect(Device.getCurrentPositionAsync).toHaveBeenCalledTimes(1));
  act(() => { changedState('background'); });
  await act(async () => { resolve(fix()); });
  expect(changed).not.toHaveBeenCalled();
  await act(async () => { changedState('active'); });
  await waitFor(() => expect(changed).toHaveBeenCalledWith(place));
  view.unmount(); listener.mockRestore();
});

test('does not begin acquisition if the app mounts in the background', async () => {
  const state = AppState.currentState;
  AppState.currentState = 'background';
  const view = renderHook(() => useDeviceLocation(true, null, jest.fn()));
  await act(async () => {});
  const calls = (Device.getCurrentPositionAsync as jest.Mock).mock.calls.length;
  view.unmount(); AppState.currentState = state;
  expect(calls).toBe(0);
});

test('does not silently substitute current GPS for an uploaded photo with no metadata', async () => {
  const changed = jest.fn();
  const view = renderHook(() => useDeviceLocation(true, null, changed, false));
  await act(async () => {});
  expect(Device.getCurrentPositionAsync).not.toHaveBeenCalled();
  await act(async () => { await view.result.current.locate(); });
  expect(changed).toHaveBeenCalledWith(place);
});
