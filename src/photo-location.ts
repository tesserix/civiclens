import type {LocationSource} from '../shared/contracts';
export type {LocationSource} from '../shared/contracts';
export type Coordinates = { latitude: number; longitude: number };

function number(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.length > 64) return null;
  const parts = value.trim().split('/');
  if (parts.length > 2 || parts.some(part => !/^[+-]?\d+(?:\.\d+)?$/.test(part.trim()))) return null;
  const result = Number(parts[0]) / (parts.length === 2 ? Number(parts[1]) : 1);
  return Number.isFinite(result) ? result : null;
}

function coordinate(value: unknown, reference: unknown, maximum: number): number | null {
  const parts = Array.isArray(value) ? value : typeof value === 'string' && value.includes(',') && value.length <= 128 ? value.split(',') : null;
  let result = number(value);
  if (parts) {
    if (parts.length !== 3) return null;
    const [degrees, minutes, seconds] = parts.map(number);
    if (degrees === null || minutes === null || seconds === null || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return null;
    result = Math.sign(degrees || 1) * (Math.abs(degrees) + minutes / 60 + seconds / 3600);
  }
  if (result === null || Math.abs(result) > maximum) return null;
  if (reference !== undefined && reference !== null) {
    if (typeof reference !== 'string') return null;
    const ref = reference.toUpperCase();
    if (!(maximum === 90 ? ['N', 'S'] : ['E', 'W']).includes(ref)) return null;
    if ((ref === 'N' || ref === 'E') && result < 0) return null;
    result = Math.abs(result) * (ref === 'S' || ref === 'W' ? -1 : 1);
  }
  return result;
}

export function photoCoordinates(exif: Record<string, unknown> | null | undefined): Coordinates | null {
  if (!exif) return null;
  const latitude = coordinate(exif.GPSLatitude, exif.GPSLatitudeRef, 90);
  const longitude = coordinate(exif.GPSLongitude, exif.GPSLongitudeRef, 180);
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

export function deviceCoordinates(position: { timestamp: number; coords: Coordinates & { accuracy: number | null } }, now: number): Coordinates | null {
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
    || !Number.isFinite(position.timestamp) || Math.abs(now - position.timestamp) > 120000
    || accuracy === null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) return null;
  return { latitude, longitude };
}

export function selectPhotoLocation(current: { location: import('../shared/contracts').Location | null; locationSource?: LocationSource }, inferred: import('../shared/contracts').Location | null, source: 'camera' | 'photo') {
  return current.locationSource === 'manual' && current.location ? {location:current.location,locationSource:'manual' as const} : {location:inferred,locationSource:inferred ? source : undefined};
}
