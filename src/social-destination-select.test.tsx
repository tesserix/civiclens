import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { channels, type Channel } from '../shared/contracts';
import { SocialDestinationSelect } from './social-destination-select';

function Harness({ disabled=false, options=channels }: {disabled?: boolean; options?: Channel[]}) {
  const [value,setValue]=useState<Channel[]>(['facebook']);
  return <SocialDestinationSelect value={value} options={options} disabled={disabled} onChange={setValue}/>;
}

test('keeps multi-selection inside a sheet and applies only on Done',()=>{
  render(<Harness/>);
  expect(screen.queryByRole('checkbox',{name:'TikTok'})).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  expect(screen.getByRole('header',{name:'Choose social apps'})).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('checkbox',{name:'Instagram'}));
  fireEvent.press(screen.getByRole('checkbox',{name:'TikTok'}));
  expect(screen.getByText('3 of 4 selected')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Done'}));
  expect(screen.getByRole('button',{name:'Social apps, 3 apps selected'})).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Social apps, 3 apps selected'}));
  expect(screen.getByRole('checkbox',{name:'Instagram'})).toBeChecked();
  expect(screen.getByRole('checkbox',{name:'WhatsApp'})).not.toBeChecked();
});

test('Cancel discards tentative selection and retains the existing summary',()=>{
  const change=jest.fn();
  render(<SocialDestinationSelect value={['facebook']} options={channels} onChange={change}/>);
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  fireEvent.press(screen.getByRole('button',{name:'Select all social apps'}));
  fireEvent.press(screen.getByRole('button',{name:'Cancel social app selection'}));
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Social apps, Facebook'})).toBeOnTheScreen();
});

test('selects all available apps in canonical order and permits clearing all',()=>{
  render(<Harness/>);
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  fireEvent.press(screen.getByRole('button',{name:'Select all social apps'}));
  fireEvent.press(screen.getByRole('button',{name:'Done'}));
  fireEvent.press(screen.getByRole('button',{name:'Social apps, All 4 apps selected'}));
  fireEvent.press(screen.getByRole('button',{name:'Clear social apps'}));
  expect(screen.getByText('0 of 4 selected')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Done'}));
  expect(screen.getByRole('button',{name:'Social apps, Choose apps'})).toBeOnTheScreen();
});

test('limits selections to supported channels and deduplicates available choices',()=>{
  const change=jest.fn();
  render(<SocialDestinationSelect value={['facebook']} options={['whatsapp','facebook','facebook']} onChange={change}/>);
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  expect(screen.queryByRole('checkbox',{name:'TikTok'})).toBeNull();
  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  fireEvent.press(screen.getByRole('button',{name:'Select all social apps'}));
  fireEvent.press(screen.getByRole('button',{name:'Done'}));
  expect(change).toHaveBeenCalledWith(['facebook','whatsapp']);
});

test('dismisses stale choices if the parent value or capability set changes',()=>{
  const change=jest.fn(),value:Channel[]=['facebook'];
  const view=render(<SocialDestinationSelect value={value} options={channels} onChange={change}/>);
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  fireEvent.press(screen.getByRole('checkbox',{name:'TikTok'}));
  view.rerender(<SocialDestinationSelect value={value} options={['facebook','instagram']} onChange={change}/>);
  expect(screen.queryByRole('button',{name:'Done'})).toBeNull();
  expect(change).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  view.rerender(<SocialDestinationSelect value={['instagram']} options={['facebook','instagram']} onChange={change}/>);
  expect(screen.queryByRole('button',{name:'Done'})).toBeNull();
  expect(screen.getByRole('button',{name:'Social apps, Instagram'})).toBeOnTheScreen();
});

test('disables empty/unavailable controls and closes the sheet when locked',()=>{
  const change=jest.fn(),value:Channel[]=['facebook'];
  const view=render(<SocialDestinationSelect value={value} options={channels} onChange={change}/>);
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  view.rerender(<SocialDestinationSelect value={value} options={channels} disabled onChange={change}/>);
  expect(screen.queryByRole('button',{name:'Done'})).toBeNull();
  expect(screen.getByRole('button',{name:'Social apps, Facebook'})).toBeDisabled();
  view.rerender(<SocialDestinationSelect value={[]} options={[]} onChange={change}/>);
  expect(screen.getByRole('button',{name:'Social apps, No apps available'})).toBeDisabled();
});

test('supports the Android back dismissal without applying pending changes',()=>{
  const previous=Platform.OS;Platform.OS='android';
  try {
    const change=jest.fn();
    render(<SocialDestinationSelect value={['facebook']} options={channels} onChange={change}/>);
    fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
    fireEvent.press(screen.getByRole('checkbox',{name:'TikTok'}));
    fireEvent(screen.getByLabelText('Social app selection'),'requestClose');
    expect(screen.queryByRole('button',{name:'Done'})).toBeNull();
    expect(change).not.toHaveBeenCalled();
  } finally { Platform.OS=previous; }
});

test('Done without any selection change does not invalidate an already prepared post',()=>{
  const change=jest.fn();
  render(<SocialDestinationSelect value={['facebook']} options={channels} onChange={change}/>);
  fireEvent.press(screen.getByRole('button',{name:'Social apps, Facebook'}));
  fireEvent.press(screen.getByRole('button',{name:'Done'}));
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Social apps, Facebook'})).toBeOnTheScreen();
});
