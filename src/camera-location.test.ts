import * as Device from 'expo-location';
import { captureWithLocation } from './camera-location';

jest.mock('expo-location', () => ({ Accuracy:{High:4}, hasServicesEnabledAsync:jest.fn(), getForegroundPermissionsAsync:jest.fn(), requestForegroundPermissionsAsync:jest.fn(), watchPositionAsync:jest.fn() }));
const now = 1792824000000;
const photo = { canceled: false as const, assets: [{ uri: 'test.jpg', width: 1600, height: 1200 }] };
const remove = jest.fn();
beforeEach(() => {
  jest.clearAllMocks(); jest.spyOn(Date, 'now').mockReturnValue(now);
  jest.mocked(Device.hasServicesEnabledAsync).mockResolvedValue(true);
  jest.mocked(Device.getForegroundPermissionsAsync).mockResolvedValue({ granted:true } as Device.LocationPermissionResponse);
  jest.mocked(Device.watchPositionAsync).mockImplementation(async (_, callback) => {
    callback({ timestamp:now, coords:{latitude:-37.814, longitude:144.9633, accuracy:10} } as Device.LocationObject);
    return { remove };
  });
});
afterEach(() => jest.restoreAllMocks());

test('samples device GPS during camera capture and always stops the foreground watcher', async () => {
  const capture = jest.fn(async () => photo);
  await expect(captureWithLocation(capture)).resolves.toEqual({ result:photo, point:{latitude:-37.814,longitude:144.9633} });
  expect(jest.mocked(Device.watchPositionAsync).mock.invocationCallOrder[0]).toBeLessThan(capture.mock.invocationCallOrder[0]);
  expect(remove).toHaveBeenCalledTimes(1);
});

test.each(['denied','disabled','stale','imprecise'])('leaves the photo unlocated when GPS is %s', async reason => {
  if (reason === 'denied') jest.mocked(Device.getForegroundPermissionsAsync).mockResolvedValue({granted:false,canAskAgain:false} as Device.LocationPermissionResponse);
  if (reason === 'disabled') jest.mocked(Device.hasServicesEnabledAsync).mockResolvedValue(false);
  if (reason === 'stale' || reason === 'imprecise') jest.mocked(Device.watchPositionAsync).mockImplementation(async (_, cb) => {
    cb({timestamp:reason==='stale'?now-121000:now, coords:{latitude:-37,longitude:144,accuracy:reason==='imprecise'?101:10}} as Device.LocationObject); return {remove};
  });
  expect((await captureWithLocation(async()=>photo)).point).toBeNull();
});

test('stops tracking after cancellation or camera failure and rejects a fix that became stale during capture', async () => {
  const cancelled = {canceled:true as const,assets:null};
  expect((await captureWithLocation(async()=>cancelled)).point).toBeNull();
  await expect(captureWithLocation(async()=>{throw new Error('camera closed');})).rejects.toThrow('camera closed');
  expect(remove).toHaveBeenCalledTimes(2);
  expect((await captureWithLocation(async()=>{jest.spyOn(Date,'now').mockReturnValue(now+121000);return photo;})).point).toBeNull();
});


test('removes a watcher that starts after the camera has already closed', async () => {
  jest.useFakeTimers();
  let started!: (value: Device.LocationSubscription) => void;
  jest.mocked(Device.watchPositionAsync).mockReturnValueOnce(new Promise(resolve => { started=resolve; }));
  try {
    const capturing=captureWithLocation(async()=>photo);
    await jest.advanceTimersByTimeAsync(5000);
    expect((await capturing).point).toBeNull();
    started({remove});
    await Promise.resolve();
    expect(remove).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});

test('keeps the camera available when location permission lookup fails', async()=>{
  jest.mocked(Device.getForegroundPermissionsAsync).mockRejectedValueOnce(new Error('location unavailable'));
  const capture=jest.fn(async()=>photo);
  expect((await captureWithLocation(capture)).point).toBeNull();
  expect(capture).toHaveBeenCalledTimes(1);
});
