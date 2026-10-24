import * as Device from 'expo-location';
import type { ImagePickerResult } from 'expo-image-picker';
import { deviceCoordinates } from './photo-location';
import { deadline } from './location';

export async function captureWithLocation(capture: () => Promise<ImagePickerResult>) {
  let latest: Device.LocationObject | null = null;
  let watcher: Device.LocationSubscription | undefined;
  let finished = false; let starting = true;
  const start = async () => {
    if (!await Device.hasServicesEnabledAsync() || !starting) return;
    let permission = await Device.getForegroundPermissionsAsync();
    if (!starting) return;
    if (!permission.granted && permission.canAskAgain) permission = await Device.requestForegroundPermissionsAsync();
    if (!permission.granted || !starting) return;
    const subscription = await Device.watchPositionAsync({ accuracy: Device.Accuracy.High, timeInterval: 1000, distanceInterval: 0 }, position => {
      if (!finished && deviceCoordinates(position, Date.now())) latest = position;
    });
    if (finished) subscription.remove();
    else watcher = subscription;
  };
  try {
    await deadline(start(), 5000).catch(() => { starting = false; });
    const result = await capture();
    return { result, point: !result.canceled && latest ? deviceCoordinates(latest, Date.now()) : null };
  } finally { finished = true; starting = false; watcher?.remove(); }
}
