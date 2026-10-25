import { View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../src/session';
import { Loading, palette } from '../../src/ui';

export default function TabLayout() {
  const { session, loading } = useSession();
  if (loading) return <View className="flex-1 justify-center bg-canvas"><Loading label="Checking your sign-in" /></View>;
  if (!session) return <Redirect href="/sign-in" />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: palette.ink, tabBarInactiveTintColor: palette.faint,
    tabBarStyle: { borderTopColor: palette.line, backgroundColor: palette.surface }, tabBarLabelStyle: { fontSize: 12, fontWeight: '600' } }}>
    <Tabs.Screen name="index" options={{ title: 'Report', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'scan' : 'scan-outline'} size={24} color={color} /> }} />
    <Tabs.Screen name="reports" options={{ title: 'My reports', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'albums' : 'albums-outline'} size={23} color={color} /> }} />
    <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'people' : 'people-outline'} size={23} color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Account', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={25} color={color} /> }} />
  </Tabs>;
}
