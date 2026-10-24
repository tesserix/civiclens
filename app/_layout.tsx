import '../src/global.css';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { SessionProvider } from '../src/session';
import { palette } from '../src/ui';

export default function RootLayout() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 }, mutations: { retry: false } } }));
  useEffect(() => {
    const net = NetInfo.addEventListener(state => onlineManager.setOnline(state.isConnected !== false && state.isInternetReachable !== false));
    const app = AppState.addEventListener('change',state => { if (Platform.OS !== 'web') focusManager.setFocused(state === 'active'); });
    return () => { net(); app.remove(); };
  }, []);
  return <SafeAreaProvider><QueryClientProvider client={client}><SessionProvider>
    <StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.canvas } }} />
  </SessionProvider></QueryClientProvider></SafeAreaProvider>;
}
