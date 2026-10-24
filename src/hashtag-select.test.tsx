import {useState} from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react-native';
import {HashtagSelect} from './hashtag-select';

const tags=['#Litter','#Melbourne','#CityofMelbourne'];
function Picker(){
  const [selected,setSelected]=useState<string[]|undefined>();
  return <HashtagSelect suggestions={tags} selected={selected} onChange={setSelected}/>;
}
test('lets the reporter quickly clear, pick individual tags and select all verified suggestions',async()=>{
  render(<Picker/>);
  await act(async()=>{});
  expect(screen.getByRole('checkbox',{name:'#Melbourne'})).toBeChecked();
  fireEvent.press(screen.getByRole('button',{name:'Clear hashtags'}));
  expect(screen.getByRole('checkbox',{name:'#Melbourne'})).not.toBeChecked();
  fireEvent.press(screen.getByRole('checkbox',{name:'#Melbourne'}));
  expect(screen.getByRole('checkbox',{name:'#Melbourne'})).toBeChecked();
  expect(screen.getByRole('checkbox',{name:'#Litter'})).not.toBeChecked();
  fireEvent.press(screen.getByRole('button',{name:'Select all hashtags'}));
  expect(screen.getByRole('checkbox',{name:'#CityofMelbourne'})).toBeChecked();
  expect(screen.getByRole('checkbox',{name:'#Litter'})).toBeChecked();
});

test('disables choices while locked and gives a retry after a failed lookup',async()=>{
  const change=jest.fn(); const retry=jest.fn();
  const view=render(<HashtagSelect suggestions={tags} onChange={change} disabled/>);
  await act(async()=>{});
  fireEvent.press(screen.getByRole('checkbox',{name:'#Litter'}));
  expect(change).not.toHaveBeenCalled();
  view.rerender(<HashtagSelect suggestions={[]} onChange={change} loading/>);
  expect(screen.getByText('Finding hashtags for this location…')).toBeOnTheScreen();
  view.rerender(<HashtagSelect suggestions={[]} onChange={change} error onRetry={retry}/>);
  fireEvent.press(screen.getByRole('button',{name:'Retry hashtags'}));
  expect(retry).toHaveBeenCalledTimes(1);
  view.rerender(<HashtagSelect suggestions={[]} onChange={change}/>);
  expect(screen.getByText('No verified hashtag suggestions for this place and issue yet.')).toBeOnTheScreen();
});
