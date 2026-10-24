import * as Device from 'expo-location';
import {pointLocation, searchLocations} from './location';

jest.mock('expo-location',()=>({geocodeAsync:jest.fn(),reverseGeocodeAsync:jest.fn()}));
const point={latitude:-37.814,longitude:144.9633};
beforeEach(()=>jest.resetAllMocks());

test('keeps a selected point when address lookup is unavailable',async()=>{
  jest.mocked(Device.reverseGeocodeAsync).mockRejectedValueOnce(new Error('offline'));
  await expect(pointLocation(point)).resolves.toEqual({...point,countryCode:'',locality:''});
});

test('bounds place choices and drops invalid or unaddressed native results',async()=>{
  jest.mocked(Device.geocodeAsync).mockResolvedValue([{latitude:NaN,longitude:1},...Array.from({length:8},()=>point)] as Device.LocationGeocodedLocation[]);
  jest.mocked(Device.reverseGeocodeAsync).mockResolvedValue([{city:'Melbourne',region:'VIC',isoCountryCode:'AU'}] as Device.LocationGeocodedAddress[]);
  expect(await searchLocations('Melbourne, Australia')).toHaveLength(3);
  expect(Device.reverseGeocodeAsync).toHaveBeenCalledTimes(3);
  jest.mocked(Device.reverseGeocodeAsync).mockResolvedValue([{city:'Melbourne',isoCountryCode:'invalid'}] as Device.LocationGeocodedAddress[]);
  expect(await searchLocations('Melbourne, Australia')).toEqual([]);
});

test('leaves no candidate for an unmatched place or failed native search',async()=>{
  jest.mocked(Device.geocodeAsync).mockResolvedValueOnce([]);
  expect(await searchLocations('Unknown location')).toEqual([]);
  jest.mocked(Device.geocodeAsync).mockRejectedValueOnce(new Error('offline'));
  await expect(searchLocations('Melbourne')).rejects.toThrow('offline');
  await expect(searchLocations(' ')).rejects.toThrow('Enter a town');
});

test('times out a stalled native search',async()=>{
  jest.useFakeTimers();
  try {
    jest.mocked(Device.geocodeAsync).mockReturnValueOnce(new Promise(()=>{}));
    const assertion=expect(searchLocations('Melbourne')).rejects.toThrow('Location timed out');
    await jest.advanceTimersByTimeAsync(8000);
    await assertion;
  } finally {jest.useRealTimers();}
});
