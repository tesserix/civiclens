import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Device from 'expo-location';
import type { Location } from '../shared/contracts';

export function useDeviceLocation(enabled: boolean, value: Location | null, onChange: (location: Location) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [settingsNeeded, setSettingsNeeded] = useState(false);
  const current = useRef({ enabled, onChange });
  current.current = { enabled, onChange };
  const generation = useRef(0);
  const inFlight = useRef(false);
  const locate = useCallback(async (manual = true) => {
    if (!current.current.enabled || AppState.currentState === 'background' || inFlight.current) return;
    const run = ++generation.current;
    const active = () => current.current.enabled && generation.current === run;
    inFlight.current = true; setBusy(true); setError(''); setSettingsNeeded(false);
    try {
      if (!await Device.hasServicesEnabledAsync()) {
        if (active()) { setSettingsNeeded(true); setError('Turn on device Location Services, then retry.'); }
        return;
      }
      let permission = await Device.getForegroundPermissionsAsync();
      if (!active()) return;
      if (!permission.granted && permission.canAskAgain && (manual || permission.status === 'undetermined')) {
        permission = await Device.requestForegroundPermissionsAsync();
      }
      if (!active()) return;
      if (!permission.granted) {
        setSettingsNeeded(true); setError('Allow location access in Settings, then retry. Your report has not been shared.'); return;
      }
      const position = await deadline(Device.getCurrentPositionAsync({ accuracy: Device.Accuracy.High }), 15000);
      if (!active()) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
        || !Number.isFinite(position.timestamp) || Math.abs(Date.now() - position.timestamp) > 120000
        || accuracy === null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
        setError('A precise current location is needed. Enable Precise Location, move to an open area and retry.');
        setSettingsNeeded(true); return;
      }
      let countryCode = ''; let locality = '';
      try {
        const [place] = await deadline(Device.reverseGeocodeAsync({ latitude, longitude }), 8000);
        countryCode = place?.isoCountryCode?.toUpperCase() || '';
        locality = [place?.city || place?.district, place?.region].filter(Boolean).join(', ');
      } catch { /* Coordinates remain usable when address lookup is unavailable. */ }
      if (!active()) return;
      if (!/^[A-Z]{2}$/.test(countryCode) || !locality.trim()) setError('Device location detected. Enter the town or city and two-letter country code below.');
      current.current.onChange({ latitude, longitude, countryCode, locality });
    } catch {
      if (active()) setError('Could not get your current device location. Move to an open area and retry.');
    } finally {
      if (generation.current === run) { inFlight.current = false; setBusy(false); }
    }
  }, []);
  const hasLocation = value !== null;
  useEffect(() => {
    if (enabled && !hasLocation) void locate(false);
    else setBusy(false);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') { generation.current++; inFlight.current = false; setBusy(false); }
      if (state === 'active' && enabled && !hasLocation) void locate(false);
    });
    return () => { generation.current++; inFlight.current = false; subscription.remove(); };
  }, [enabled, hasLocation, locate]);
  const openSettings = () => Linking.openSettings().catch(() => setError('Open your device Settings and allow CivicLens to use your precise location.'));
  return { busy: enabled && busy, error, settingsNeeded, locate, openSettings };
}

async function deadline<T>(operation: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Location timed out')), ms); })]);
  } finally { clearTimeout(timer); }
}
