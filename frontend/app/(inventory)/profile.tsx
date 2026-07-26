import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

export default function InventoryProfile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const doLogout = async () => { await logout(); router.replace('/auth/login'); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 100 }}>
      <View style={styles.card}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text></View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{user?.role.replace('_', ' ').toUpperCase()}</Text></View>
      </View>
      <Pressable testID="inv-logout" style={styles.logoutBtn} onPress={doLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', padding: spacing.xl, marginHorizontal: spacing.xl, backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarText: { color: colors.black, fontSize: 28, fontWeight: '700' },
  name: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  email: { color: colors.textDim, marginTop: 2 },
  badge: { marginTop: spacing.md, backgroundColor: colors.bg3, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: colors.success, fontSize: fs.sm, fontWeight: '700', letterSpacing: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error, backgroundColor: 'rgba(239,68,68,0.08)' },
  logoutText: { color: colors.error, fontWeight: '700', fontSize: fs.base },
});
