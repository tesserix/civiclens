import * as Device from 'expo-location';
import type { Location } from '../shared/contracts';
import type { Coordinates } from './photo-location';

export async function deadline<T>(operation: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Location timed out')), ms); })]);
  } finally { clearTimeout(timer); }
}

export async function pointLocation(point: Coordinates): Promise<Location> {
  let countryCode = ''; let locality = '';
  try {
    const [place] = await deadline(Device.reverseGeocodeAsync(point), 8000);
    const country = place?.isoCountryCode?.toUpperCase() || '';
    countryCode = /^[A-Z]{2}$/.test(country) ? country : '';
    locality = [place?.city || place?.district, place?.region].filter(Boolean).join(', ').slice(0, 120);
  } catch { /* The selected point remains usable when address lookup is unavailable. */ }
  return { ...point, countryCode, locality };
}

export async function searchLocations(query: string): Promise<Location[]> {
  const text = query.trim();
  if (text.length < 2 || text.length > 180) throw new Error('Enter a town, suburb or address, including the state and country.');
  const points = await deadline(Device.geocodeAsync(text), 8000);
  const valid = points.filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180).slice(0, 3);
  const places = await Promise.all(valid.map(point => pointLocation({latitude:point.latitude, longitude:point.longitude})));
  return places.filter(place => !!place.countryCode && !!place.locality);
}
