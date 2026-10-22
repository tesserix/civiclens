import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { DeletionRequest } from '../shared/generated';
import { ApiError, request } from './api';
import { Button, Notice } from './ui';

export function AccountDeletion({ token }: { token: string }) {
  const [receipt, setReceipt] = useState<DeletionRequest | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setReceipt(null); setConfirm(false);
    request<DeletionRequest>('/v1/me/deletion-request', { token })
      .then(value => { if (active) setReceipt(value); })
      .catch(e => { if (active && !(e instanceof ApiError && e.status === 404)) setError('Could not check your deletion request. Retry when connected.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, attempt]);
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const value = await request<DeletionRequest>('/v1/me/deletion-request', { token, method: 'POST', body: {} });
      if (!value.id || !['pending', 'completed'].includes(value.status) || !Number.isFinite(Date.parse(value.dueAt))) throw new Error('Invalid receipt');
      setReceipt(value); setConfirm(false);
    } catch { setError('Your deletion request could not be submitted. Reconnect and retry.'); }
    finally { setBusy(false); }
  };
  return <View className="gap-3 rounded-2xl border border-line bg-white p-5">
    <Text className="text-lg font-semibold text-ink">Account deletion</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Checking deletion request" color="#3858F5" /> : receipt ? <>
      <Text accessibilityRole="header" className="font-semibold text-ink">{receipt.status === 'completed' ? 'Deletion completed' : 'Deletion requested'}</Text>
      <Text className="text-sm leading-6 text-muted">{receipt.status === 'completed' ? 'Our team has recorded completion. Check your confirmation for details and any retention exceptions.' : `Tesserix support will fulfil your request by ${new Date(receipt.dueAt).toLocaleDateString()}. This receipt confirms your request, not completed deletion. You do not need to send an email to start the process.`}</Text>
      <Text selectable className="text-sm text-muted">Request: {receipt.id} · {receipt.owner}</Text>
      <Button title="Refresh request status" secondary onPress={() => setAttempt(a => a + 1)} />
    </> : confirm ? <>
      <Text accessibilityRole="header" className="font-semibold text-ink">Delete your CivicLens account?</Text>
      <Text className="text-sm leading-6 text-muted">Tesserix support will delete your CivicLens account and associated personal data and confirm completion within 30 days. Deletion is permanent. Your other Tesserix accounts and your Apple, Google or Meta account are preserved.</Text>
      <Text className="text-sm leading-6 text-muted">We coordinate identity and social-provider cleanup. Copies shared by other people may remain outside our control. Any required retention and backup expiry will be explained in your confirmation. Remove CivicLens app data on each device to clear local drafts and photos.</Text>
      <Button title="Request account deletion" busy={busy} onPress={() => void submit()} />
      <Button title="Keep my account" secondary disabled={busy} onPress={() => { setConfirm(false); setError(''); }} />
    </> : error ? <Button title="Retry deletion status" secondary onPress={() => setAttempt(a => a + 1)} /> : <Button title="Delete my account" secondary onPress={() => setConfirm(true)} />}
    {error ? <Notice>{error}</Notice> : null}
  </View>;
}
