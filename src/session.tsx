import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { request } from './api';
import type { Session } from '../shared/contracts';

const key = 'civiclens-session-v1';
type SessionContext = { session: Session | null; loading: boolean; error: string | null; retry: () => void; signIn: (session: Session) => Promise<void>; signOut: () => Promise<void> };
const Context = createContext<SessionContext | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    const restore = async () => {
      if (Platform.OS === 'web') return;
      const saved = await SecureStore.getItemAsync(key);
      if (saved) {
        const parsed: Session = JSON.parse(saved);
        if (parsed.token && parsed.user?.id && Date.parse(parsed.expiresAt) > Date.now()) {
          if (active) setSession(parsed);
        } else await SecureStore.deleteItemAsync(key);
      }
    };
    restore().catch(() => { if (active) setError('Could not unlock your saved session. Please retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const signIn = async (next: Session) => {
    if (Platform.OS !== 'web') await SecureStore.setItemAsync(key, JSON.stringify(next), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    setSession(next);
  };
  const signOut = async () => {
    if (session) await request('/v1/auth/logout', { token: session.token, method: 'POST' });
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(key);
    setSession(null);
  };
  return <Context.Provider value={{ session, loading, error, retry: () => setAttempt(a => a + 1), signIn, signOut }}>{children}</Context.Provider>;
}

export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error('SessionProvider is required');
  return context;
}
