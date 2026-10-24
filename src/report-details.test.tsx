import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActionSheetIOS, Platform } from 'react-native';
import { CategorySelect, LocationFields } from './report-details';

jest.mock('@react-native-picker/picker', () => {
  const { View } = jest.requireActual('react-native');
  const Picker = (props: { accessibilityLabel: string; onValueChange: (value: string) => void; enabled: boolean }) => <View accessibilityLabel={props.accessibilityLabel} onValueChange={props.onValueChange} enabled={props.enabled} />;
  Picker.Item = () => null;
  return { Picker };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

const location = { latitude: -37.814, longitude: 144.9633, countryCode: 'AU', locality: 'Melbourne' };

test('uses the iOS native choices and commits only a valid selection', () => {
  const onChange = jest.fn();
  const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
  render(<CategorySelect value="waste" onChange={onChange} />);
  fireEvent.press(screen.getByRole('button', { name: 'Issue type, Waste & litter' }));
  expect(sheet.mock.calls[0][0].options).toEqual(['Waste & litter', 'Pollution', 'Roads & infrastructure', 'Water & drainage', 'Public safety', 'Cancel']);
  act(() => sheet.mock.calls[0][1](5));
  expect(onChange).not.toHaveBeenCalled();
  act(() => sheet.mock.calls[0][1](4));
  expect(onChange).toHaveBeenCalledWith('public_safety');
  sheet.mockRestore();
});

test('ignores iOS selections after locking or leaving the form', () => {
  const onChange = jest.fn();
  const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
  const view = render(<CategorySelect value="waste" onChange={onChange} />);
  fireEvent.press(screen.getByRole('button', { name: 'Issue type, Waste & litter' }));
  view.rerender(<CategorySelect value="waste" onChange={onChange} disabled />);
  act(() => sheet.mock.calls[0][1](2));
  expect(onChange).not.toHaveBeenCalled();
  view.rerender(<CategorySelect value="waste" onChange={onChange} />);
  act(() => sheet.mock.calls[0][1](3));
  expect(onChange).not.toHaveBeenCalled();
  view.unmount();
  act(() => sheet.mock.calls[0][1](0));
  expect(onChange).not.toHaveBeenCalled();
  sheet.mockRestore();
});

test('uses the Android picker and rejects unknown values', () => {
  const original = Platform.OS;
  Platform.OS = 'android';
  try {
    const onChange = jest.fn();
    const view = render(<CategorySelect value="waste" onChange={onChange} />);
    const picker = screen.getByLabelText('Issue type');
    fireEvent(picker, 'valueChange', 'roads');
    expect(onChange).toHaveBeenLastCalledWith('roads');
    fireEvent(picker, 'valueChange', 'invalid');
    expect(onChange).toHaveBeenCalledTimes(1);
    view.rerender(<CategorySelect value="waste" onChange={onChange} disabled />);
    fireEvent(screen.getByLabelText('Issue type'), 'valueChange', 'water');
    expect(onChange).toHaveBeenCalledTimes(1);
  } finally { Platform.OS = original; }
});

test('searches global countries by name and ISO code without changing GPS coordinates', () => {
  const onChange = jest.fn();
  render(<LocationFields value={location} onChange={onChange} />);
  fireEvent.press(screen.getByRole('button', { name: 'Country, Australia' }));
  fireEvent.changeText(screen.getByLabelText('Search countries'), ' zz ');
  expect(screen.getByText(/No countries found/)).toBeOnTheScreen();
  fireEvent.changeText(screen.getByLabelText('Search countries'), 'India');
  expect(screen.getByRole('radio', { name: 'India' })).toBeOnTheScreen();
  fireEvent.changeText(screen.getByLabelText('Search countries'), ' in ');
  fireEvent.press(screen.getByRole('radio', { name: 'India' }));
  expect(onChange).toHaveBeenCalledWith({ ...location, countryCode: 'IN' });
  expect(screen.queryByLabelText('Search countries')).not.toBeOnTheScreen();
});

test('cancels country changes, closes when locked, and preserves GPS on town edits', () => {
  const onChange = jest.fn();
  const view = render(<LocationFields value={location} onChange={onChange} />);
  fireEvent.changeText(screen.getByLabelText('Town or city'), 'Geelong');
  expect(onChange).toHaveBeenLastCalledWith({ ...location, locality: 'Geelong' });
  onChange.mockClear();
  fireEvent.press(screen.getByRole('button', { name: 'Country, Australia' }));
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Country, Australia' }));
  view.rerender(<LocationFields value={location} onChange={onChange} disabled />);
  expect(screen.queryByLabelText('Search countries')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Country, Australia' })).toBeDisabled();
});


test('keeps native choices usable after Strict Mode reconnects effects', () => {
  const onChange = jest.fn();
  const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
  render(<StrictMode><CategorySelect value="waste" onChange={onChange} /></StrictMode>);
  fireEvent.press(screen.getByRole('button', { name: 'Issue type, Waste & litter' }));
  act(() => sheet.mock.calls[0][1](1));
  expect(onChange).toHaveBeenCalledWith('pollution');
  sheet.mockRestore();
});
