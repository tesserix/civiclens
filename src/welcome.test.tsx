import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from './session';
import Welcome from '../app/index';

test('offers an optional nickname and holds sign-in when providers are unconfigured', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ google: false, facebook: false, publishing: { facebook: false, instagram: false, whatsapp: false } }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><SessionProvider><Welcome /></SessionProvider></QueryClientProvider>);
  const field = await screen.findByLabelText('Public nickname · optional', {}, { timeout: 5000 });
  fireEvent.changeText(field, 'RiverFox');
  expect(field.props.value).toBe('RiverFox');
  expect(screen.getByText('Leave it blank and we’ll assign a unique nickname for you.')).toBeOnTheScreen();
  await waitFor(() => expect(screen.getByRole('button',{ name:'Continue with Google' })).toBeDisabled());
  expect(screen.getByRole('button',{ name:'Continue with Facebook' })).toBeDisabled();
  expect(await screen.findByText(/Sign-in setup is in progress/)).toBeOnTheScreen();
  client.clear();
});

test('shows a connection error and a retry action when the API is offline', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><SessionProvider><Welcome /></SessionProvider></QueryClientProvider>);
  expect(await screen.findByRole('button',{ name:'Retry connection' })).toBeOnTheScreen();
  expect(screen.getByText(/API could not be reached/)).toBeOnTheScreen();
  client.clear();
});
