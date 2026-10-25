import { useState } from 'react';
import { Dimensions, TextInput, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text, TypographyProvider } from './text';
import { Button, Title } from './ui';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

test('reflows typography across live font changes while keeping form edits and actions', () => {
  const initial = Dimensions.get('window');
  const submit = jest.fn();
  function Form() {
    const [value, setValue] = useState('');
    return <View><Title subtitle="Check the details before sharing.">Report an issue</Title><Text>Notes</Text><TextInput accessibilityLabel="Notes" value={value} onChangeText={setValue} /><Button title="Save notes" onPress={() => submit(value)} /></View>;
  }
  try {
    render(<TypographyProvider><Form /></TypographyProvider>);
    fireEvent.changeText(screen.getByLabelText('Notes'), 'Keep this draft');
    for (const fontScale of [3.1, 1, 2, initial.fontScale]) {
      act(() => Dimensions.set({ window: { ...initial, fontScale } }));
      expect(screen.getByRole('header', { name: 'Report an issue' })).toBeOnTheScreen();
      expect(screen.getByLabelText('Notes')).toHaveProp('value', 'Keep this draft');
    }
    fireEvent.press(screen.getByRole('button', { name: 'Save notes' }));
    expect(submit).toHaveBeenCalledWith('Keep this draft');
  } finally { act(() => Dimensions.set({ window: initial })); }
});
