import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccountDeletion } from './account-deletion';

const receipt = { id: '0199d7b0-0000-7000-8000-000000000001', status: 'pending', requestedAt: '2026-10-22T00:00:00Z', dueAt: '2026-11-21T00:00:00Z', owner: 'sales@tesserix.app' };
const response = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

test('requires confirmation and shows a durable pending receipt, not completed deletion', async () => {
  const fetch = jest.fn().mockResolvedValueOnce(response(404, { code: 'NOT_FOUND' })).mockResolvedValueOnce(response(202, receipt));
  globalThis.fetch = fetch;
  render(<AccountDeletion token={'a'.repeat(64)} />);
  fireEvent.press(await screen.findByRole('button', { name: 'Delete my account' }));
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Request account deletion' }));
  expect(await screen.findByText('Deletion requested')).toBeOnTheScreen();
  expect(screen.queryByText('Deletion completed')).toBeNull();
  expect(screen.getByText(new RegExp(receipt.id))).toBeOnTheScreen();
  expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST', body: '{}', headers: { Authorization: `Session ${'a'.repeat(64)}` } });
});

test('failed requests remain retryable and never show a successful receipt', async () => {
  globalThis.fetch = jest.fn().mockResolvedValueOnce(response(404, {})).mockRejectedValueOnce(new Error('offline'));
  render(<AccountDeletion token={'b'.repeat(64)} />);
  fireEvent.press(await screen.findByRole('button', { name: 'Delete my account' }));
  fireEvent.press(screen.getByRole('button', { name: 'Request account deletion' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Request account deletion' })).toBeEnabled());
  expect(screen.getByText(/could not be submitted/i)).toBeOnTheScreen();
  expect(screen.queryByText('Deletion requested')).toBeNull();
});

test('restores an existing request after reopening the account page', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(response(200, receipt));
  render(<AccountDeletion token={'c'.repeat(64)} />);
  expect(await screen.findByText('Deletion requested')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Delete my account' })).toBeNull();
});
