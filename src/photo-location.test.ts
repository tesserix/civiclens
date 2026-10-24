import { photoCoordinates } from './photo-location';

test('reads signed and hemisphere-referenced photo GPS without retaining other metadata', () => {
  expect(photoCoordinates({ GPSLatitude: 37.814, GPSLatitudeRef: 'S', GPSLongitude: 144.9633, GPSLongitudeRef: 'E', Make: 'private camera' })).toEqual({ latitude: -37.814, longitude: 144.9633 });
  expect(photoCoordinates({ GPSLatitude: -37.814, GPSLongitude: 144.9633 })).toEqual({ latitude: -37.814, longitude: 144.9633 });
  expect(photoCoordinates({ GPSLatitude: '37/1,48/1,50/1', GPSLatitudeRef: 'S', GPSLongitude: [144,57,48], GPSLongitudeRef: 'E' })).toEqual({ latitude: -(37+48/60+50/3600), longitude: 144+57/60+48/3600 });
});

test.each([undefined, null, {}, {GPSLatitude:91,GPSLongitude:12}, {GPSLatitude:12,GPSLongitude:181}, {GPSLatitude:'',GPSLongitude:12}, {GPSLatitude:'1/0',GPSLongitude:12}, {GPSLatitude:[37,60,0],GPSLongitude:12}, {GPSLatitude:NaN,GPSLongitude:12}, {GPSLatitude:12,GPSLatitudeRef:'W',GPSLongitude:12}])('ignores missing or malformed photo GPS: %p', exif => {
  expect(photoCoordinates(exif)).toBeNull();
});

import { selectPhotoLocation } from './photo-location';
test('preserves an explicit manual point and clears an unrelated old device point for an unlocated upload', () => {
  const location={latitude:-37,longitude:144,locality:'Town',countryCode:'AU'};
  expect(selectPhotoLocation({location,locationSource:'manual'},null,'photo')).toEqual({location,locationSource:'manual'});
  expect(selectPhotoLocation({location,locationSource:'device'},null,'photo')).toEqual({location:null,locationSource:undefined});
});
