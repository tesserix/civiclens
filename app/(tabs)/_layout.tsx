import { ActivityIndicator, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../src/session';

export default function TabLayout() {
  const { session, loading } = useSession();
  if (loading) return <View className="flex-1 items-center justify-center bg-canvas"><ActivityIndicator color="#3858F5" /></View>;
  if (!session) return <Redirect href="/" />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#3858F5', tabBarInactiveTintColor: '#8B91A1',
    tabBarStyle: { borderTopColor: '#E5E7EB', backgroundColor: '#FFF' }, tabBarLabelStyle: { fontSize: 12, fontWeight: '600' } }}>
    <Tabs.Screen name="index" options={{ title: 'Report', tabBarIcon: ({ color }) => <Ionicons name="add-circle-outline" size={25} color={color} /> }} />
    <Tabs.Screen name="reports" options={{ title: 'My reports', tabBarIcon: ({ color }) => <Ionicons name="albums-outline" size={23} color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={25} color={color} /> }} />
  </Tabs>;
}
