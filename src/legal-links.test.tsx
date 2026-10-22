import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { LegalLinks } from './legal-links';

test('opens public legal pages without a session', () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  render(<LegalLinks />);
  fireEvent.press(screen.getByRole('link', { name: 'Privacy policy' }));
  expect(open).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/privacy$/));
  fireEvent.press(screen.getByRole('link', { name: 'Terms and community rules' }));
  expect(open).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/terms$/));
  fireEvent.press(screen.getByRole('link', { name: 'Account deletion details' }));
  expect(open).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/account-deletion$/));
  open.mockRestore();
});
