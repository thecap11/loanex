import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme';

export default function InventoryLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/auth/login" />;
  if (user.role !== 'inventory_manager' && user.role !== 'admin') return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bg2, borderTopColor: colors.border, height: 68, paddingTop: 8, paddingBottom: 12 },
        tabBarActiveTintColor: colors.success,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="stock" options={{ title: 'Stock', tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} /> }} />
      <Tabs.Screen name="lowstock" options={{ title: 'Low Stock', tabBarIcon: ({ color, size }) => <Ionicons name="alert-circle" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}
