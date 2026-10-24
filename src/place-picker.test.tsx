import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Device from 'expo-location';
import { PlacePicker } from './place-picker';

jest.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
jest.mock('expo-location',()=>({geocodeAsync:jest.fn(),reverseGeocodeAsync:jest.fn()}));
test('lets the user choose an explicit point returned by the native place search', async()=>{
  jest.mocked(Device.geocodeAsync).mockResolvedValue([{latitude:-37.814,longitude:144.9633}] as Device.LocationGeocodedLocation[]);
  jest.mocked(Device.reverseGeocodeAsync).mockResolvedValue([{city:'Melbourne',region:'VIC',isoCountryCode:'AU'}] as Device.LocationGeocodedAddress[]);
  const choose=jest.fn();
  render(<PlacePicker onChoose={choose} />);
  fireEvent.press(screen.getByRole('button',{name:'Change issue location'}));
  fireEvent.changeText(screen.getByLabelText('Search issue location'),'Melbourne, VIC, Australia');
  fireEvent.press(screen.getByRole('button',{name:'Find places'}));
  fireEvent.press(await screen.findByRole('button',{name:'Use Melbourne, VIC, AU'}));
  expect(choose).toHaveBeenCalledWith({latitude:-37.814,longitude:144.9633,locality:'Melbourne, VIC',countryCode:'AU'});
});

test('removes old search choices when the query changes', async()=>{
  const choose=jest.fn(); render(<PlacePicker onChoose={choose}/>);
  fireEvent.press(screen.getByRole('button',{name:'Change issue location'}));
  fireEvent.changeText(screen.getByLabelText('Search issue location'),'Melbourne');
  fireEvent.press(screen.getByRole('button',{name:'Find places'}));
  expect(await screen.findByRole('button',{name:'Use Melbourne, VIC, AU'})).toBeOnTheScreen();
  fireEvent.changeText(screen.getByLabelText('Search issue location'),'Sydney');
  expect(screen.queryByRole('button',{name:'Use Melbourne, VIC, AU'})).not.toBeOnTheScreen();
});

test('does not apply a result after the picker closes', async()=>{
  let finish!: (value:Device.LocationGeocodedLocation[])=>void;
  jest.mocked(Device.geocodeAsync).mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
  const choose=jest.fn(); render(<PlacePicker onChoose={choose}/>);
  fireEvent.press(screen.getByRole('button',{name:'Change issue location'}));
  fireEvent.changeText(screen.getByLabelText('Search issue location'),'Melbourne');
  fireEvent.press(screen.getByRole('button',{name:'Find places'}));
  fireEvent.press(screen.getByRole('button',{name:'Cancel'}));
  await act(async()=>{finish([{latitude:-37,longitude:144}] as Device.LocationGeocodedLocation[]);});
  expect(choose).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:'Use Melbourne, VIC, AU'})).not.toBeOnTheScreen();
});
