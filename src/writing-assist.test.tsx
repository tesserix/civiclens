import {useState,type ReactElement} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { WritingAssist } from './writing-assist';

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
const sent = () => JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body);

function renderOpenAssist(element: ReactElement) {
  const view = render(element);
  fireEvent.press(screen.getByRole('button', { name: 'Writing help' }));
  return view;
}

function setup(description: string, onUse = jest.fn()) {
  renderOpenAssist(<WritingAssist userId="u1" token="t1" category="roads" description={description} hasPhoto readPhoto={async () => 'cGhvdG8='} onUse={onUse} />);
  return onUse;
}

beforeEach(() => AsyncStorage.clear());

test('drafts in the chosen language and changes the text only when accepted', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply(200, { text: 'ถนนมีหลุมขนาดใหญ่หน้าตลาด' }));
  const onUse = setup('near the market');
  fireEvent.press(await screen.findByRole('button', { name: /Writing language/ }));
  fireEvent.press(await screen.findByRole('radio', { name: 'ไทย, Thai' }));
  fireEvent.press(screen.getByRole('button', { name: 'Write it for me' }));
  expect(await screen.findByText('ถนนมีหลุมขนาดใหญ่หน้าตลาด')).toBeOnTheScreen();
  const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
  expect(url).toMatch(/\/v1\/assist$/);
  expect(init.headers.Authorization).toBe('Session t1');
  expect(sent()).toEqual({ mode: 'draft', category: 'roads', language: 'th', text: 'near the market', photoBase64: 'cGhvdG8=' });
  expect(onUse).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Use this' })).toBeDisabled();
  fireEvent.press(screen.getByRole('checkbox', { name: 'I checked the caption and photo for identifying details' }));
  fireEvent.press(screen.getByRole('button', { name: 'Use this' }));
  expect(onUse).toHaveBeenCalledWith('ถนนมีหลุมขนาดใหญ่หน้าตลาด');
  expect(await AsyncStorage.getItem('civiclens-writing-language-u1')).toBe('th');
}, 15000);

test('fixes spelling from the text alone and keeps it unchanged when help is unavailable', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply(503, { code: 'UNAVAILABLE', message: 'Not configured.' }));
  const onUse = setup('Garbge bin overflowng');
  fireEvent.press(await screen.findByRole('button', { name: 'Fix spelling' }));
  expect(await screen.findByText(/Writing help isn’t available right now/)).toBeOnTheScreen();
  expect(sent()).toMatchObject({ mode: 'correct', text: 'Garbge bin overflowng', photoBase64: null });
  expect(onUse).not.toHaveBeenCalled();
});

test('restores the saved language and holds spelling fixes until there is enough text', async () => {
  await AsyncStorage.setItem('civiclens-writing-language-u1', 'or');
  setup('short');
  expect(await screen.findByRole('button', { name: /Writing language: ଓଡ଼ିଆ/ })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Fix spelling' })).toBeDisabled();
});

test('discards a suggestion when its source text changes while the request is running', async () => {
  let finish!: (response: unknown) => void;
  globalThis.fetch = jest.fn().mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const onUse = jest.fn();
  const props = { userId: 'u1', token: 't1', category: 'roads' as const, hasPhoto: true, readPhoto: async () => 'cGhvdG8=', onUse };
  const view = renderOpenAssist(<WritingAssist {...props} description="Original notes" />);
  fireEvent.press(await screen.findByRole('button', { name: 'Write it for me' }));
  await screen.findByRole('button', { name: 'Write it for me' });
  view.rerender(<WritingAssist {...props} description="Changed notes" />);
  await act(async () => { finish(reply(200, { text: 'A stale description of a different issue' })); });
  expect(screen.queryByText('A stale description of a different issue')).not.toBeOnTheScreen();
  expect(onUse).not.toHaveBeenCalled();
});

test('removes reviewed suggestions when the photo or language changes', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply(200, { text: 'Rubbish is scattered beside the footpath.' }));
  const props = { userId: 'u1', token: 't1', category: 'waste' as const, description: '', hasPhoto: true, readPhoto: async () => 'cGhvdG8=', onUse: jest.fn() };
  const view = renderOpenAssist(<WritingAssist {...props} sourceId="photo-1" />);
  fireEvent.press(await screen.findByRole('button', { name: 'Write it for me' }));
  expect(await screen.findByText('Rubbish is scattered beside the footpath.')).toBeOnTheScreen();
  view.rerender(<WritingAssist {...props} sourceId="photo-2" />);
  expect(screen.queryByRole('button', { name: 'Use this' })).not.toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Write it for me' }));
  expect(await screen.findByText('Rubbish is scattered beside the footpath.')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: /Writing language/ }));
  fireEvent.press(await screen.findByRole('radio', { name: 'ଓଡ଼ିଆ, Odia' }));
  expect(screen.queryByRole('button', { name: 'Use this' })).not.toBeOnTheScreen();
});

test('keeps manual writing available and makes unavailable AI actions explicit', async () => {
  globalThis.fetch = jest.fn();
  render(<WritingAssist userId="u1" token="t1" category="waste" description="Rubbish beside the footpath" hasPhoto readPhoto={async () => ''} onUse={jest.fn()} available={false} />);
  expect(await screen.findByText(/Writing help is temporarily unavailable/)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Write it for me' })).not.toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Fix spelling' })).not.toBeOnTheScreen();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('explains rejected language without exposing the blocked suggestion or changing the draft', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply(422, { code: 'CONTENT_REJECTED', message: 'Please use respectful, factual language without profanity, insults, threats or private details.' }));
  const onUse = setup('Unacceptable draft text');
  fireEvent.press(await screen.findByRole('button', { name: 'Write it for me' }));
  expect(await screen.findByText(/Please use respectful, factual language/)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Use this' })).not.toBeOnTheScreen();
  expect(onUse).not.toHaveBeenCalled();
});


test('keeps optional tools in an accessible sheet instead of crowding the report form', async () => {
  render(<WritingAssist userId="u1" token="t1" category="waste" description="" hasPhoto readPhoto={async () => ''} onUse={jest.fn()} />);
  expect(screen.queryByRole('button', { name: /Writing language/ })).not.toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Writing help' }));
  expect(await screen.findByRole('button', { name: /Writing language/ })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Close writing help' }));
  expect(screen.queryByRole('button', { name: /Writing language/ })).not.toBeOnTheScreen();
});

test('sends a selected tone and coarse place without coordinates and invalidates suggestions when the place changes', async()=>{
  globalThis.fetch=jest.fn().mockResolvedValue(reply(200,{text:'Plastic bottles are scattered on the grass in Melbourne.'}));
  const props={userId:'u1',token:'t1',category:'waste' as const,description:'',hasPhoto:true,readPhoto:async()=>'cGhvdG8=',onUse:jest.fn(),contextual:true,location:{latitude:-37.814,longitude:144.9633,locality:'Melbourne, VIC',countryCode:'AU'}};
  const view=renderOpenAssist(<WritingAssist {...props}/>);
  fireEvent.press(await screen.findByRole('radio',{name:'Light satire'}));
  fireEvent.press(screen.getByRole('button',{name:'Write it for me'}));
  expect(await screen.findByText('Plastic bottles are scattered on the grass in Melbourne.')).toBeOnTheScreen();
  expect(sent()).toMatchObject({tone:'satirical',place:{locality:'Melbourne, VIC',countryCode:'AU'}});
  expect(JSON.stringify(sent())).not.toContain('144.9633');
  view.rerender(<WritingAssist {...props} location={{...props.location,locality:'Sydney, NSW',longitude:151.2}}/>);
  expect(screen.queryByRole('button',{name:'Use this'})).not.toBeOnTheScreen();
});


test('does not revive a reviewed caption when a tone is changed and then changed back',async()=>{
  globalThis.fetch=jest.fn().mockResolvedValue(reply(200,{text:'Litter is scattered on the grass. Please arrange a clean-up.'}));
  renderOpenAssist(<WritingAssist userId="u1" token="t1" category="waste" description="" hasPhoto readPhoto={async()=> 'photo'} onUse={jest.fn()} contextual/>);
  fireEvent.press(await screen.findByRole('button',{name:'Write it for me'}));
  expect(await screen.findByText('Litter is scattered on the grass. Please arrange a clean-up.')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('checkbox',{name:'I checked the caption and photo for identifying details'}));
  fireEvent.press(screen.getByRole('radio',{name:'Serious'}));
  fireEvent.press(screen.getByRole('radio',{name:'Balanced'}));
  expect(screen.queryByRole('button',{name:'Use this'})).not.toBeOnTheScreen();
});


test('shows selectable hashtags beside the caption and keeps the prose while tags change',async()=>{
  globalThis.fetch=jest.fn().mockResolvedValue(reply(200,{text:'Rubbish is scattered on the grass. Please arrange a clean-up.'}));
  const use=jest.fn();
  function Tool(){
    const [selected,setSelected]=useState<string[]|undefined>();
    return <WritingAssist userId="u1" token="t1" category="waste" description="" hasPhoto readPhoto={async()=> 'photo'} sourceId="photo-1" onUse={use} suggestedHashtags={['#Litter','#Melbourne','#CityofMelbourne']} selectedHashtags={selected} onHashtagsChange={setSelected}/>;
  }
  renderOpenAssist(<Tool/>);
  fireEvent.press(await screen.findByRole('button',{name:'Write it for me'}));
  expect(await screen.findByText('Rubbish is scattered on the grass. Please arrange a clean-up.')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button',{name:'Clear hashtags'}));
  fireEvent.press(screen.getByRole('checkbox',{name:'#Melbourne'}));
  expect(screen.getByText('Rubbish is scattered on the grass. Please arrange a clean-up.')).toBeOnTheScreen();
  expect(screen.getByRole('checkbox',{name:'#Melbourne'})).toBeChecked();
  expect(screen.getByRole('checkbox',{name:'#Litter'})).not.toBeChecked();
  fireEvent.press(screen.getByRole('checkbox',{name:'I checked the caption and photo for identifying details'}));
  fireEvent.press(screen.getByRole('button',{name:'Use this'}));
  expect(use).toHaveBeenCalledWith('Rubbish is scattered on the grass. Please arrange a clean-up.');
  expect(sent()).not.toHaveProperty('hashtags');
});
