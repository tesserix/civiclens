import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActionSheetIOS, Platform } from 'react-native';
import { CommunitySelect } from './community-select';

jest.mock('@react-native-picker/picker', () => {
  const { View } = jest.requireActual('react-native');
  const Picker = (props: object) => <View {...props} />;
  Picker.Item = () => null;
  return { Picker };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

const options = [{ id: 'all', label: 'All topics' }, { id: 'environment', label: 'Environment' }] as const;

afterEach(() => jest.restoreAllMocks());

test('opens native iOS choices, supports cancelling and ignores a selection after unmount', () => {
  const change = jest.fn();
  const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
  const view = render(<CommunitySelect label="Topic" value="all" options={options} onChange={change} />);
  fireEvent.press(screen.getByRole('button', { name: 'Topic, All topics' }));
  expect(sheet.mock.calls[0][0].options).toEqual(['All topics', 'Environment', 'Cancel']);
  act(() => sheet.mock.calls[0][1](2));
  expect(change).not.toHaveBeenCalled();
  act(() => sheet.mock.calls[0][1](1));
  expect(change).toHaveBeenCalledWith('environment');
  view.unmount();
  act(() => sheet.mock.calls[0][1](0));
  expect(change).toHaveBeenCalledTimes(1);
});

test('uses the native Android picker and rejects invalid or disabled selections', () => {
  const previous = Platform.OS;
  Platform.OS = 'android';
  try {
    const change = jest.fn();
    const view = render(<CommunitySelect label="Topic" value="all" options={options} onChange={change} />);
    fireEvent(screen.getByLabelText('Topic'), 'valueChange', 'environment');
    expect(change).toHaveBeenCalledWith('environment');
    fireEvent(screen.getByLabelText('Topic'), 'valueChange', 'unknown');
    view.rerender(<CommunitySelect label="Topic" value="all" options={options} onChange={change} disabled />);
    fireEvent(screen.getByLabelText('Topic'), 'valueChange', 'all');
    expect(change).toHaveBeenCalledTimes(1);
  } finally { Platform.OS = previous; }
});

test('ignores an iOS sheet result after its options or current value have changed',()=>{
  const change=jest.fn();
  const sheet=jest.spyOn(ActionSheetIOS,'showActionSheetWithOptions').mockImplementation(()=>{});
  const view=render(<CommunitySelect label="Topic" value="all" options={options} onChange={change}/>);
  fireEvent.press(screen.getByRole('button',{name:'Topic, All topics'}));
  view.rerender(<CommunitySelect label="Topic" value="all" options={[{id:'all',label:'All topics'},{id:'other',label:'Other'}]} onChange={change}/>);
  act(()=>sheet.mock.calls[0][1](1));
  expect(change).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button',{name:'Topic, All topics'}));
  view.rerender(<CommunitySelect label="Topic" value="other" options={[{id:'all',label:'All topics'},{id:'other',label:'Other'}]} onChange={change}/>);
  act(()=>sheet.mock.calls[1][1](0));
  expect(change).not.toHaveBeenCalled();
});
