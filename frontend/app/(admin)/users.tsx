import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

export default function AdminUsers() {
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setUsers(await api('/admin/users')); } catch {} finally { setLoading(false); }
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}><Text style={styles.title}>Users ({users.length})</Text></View>
      {loading ? <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
          {users.map((u) => (
            <View testID={`user-${u.id}`} key={u.id} style={styles.row}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{u.name[0].toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{u.name}</Text>
                <Text style={styles.email}>{u.email}</Text>
              </View>
              <View style={[styles.roleBadge, u.role === 'admin' && { borderColor: colors.gold }, u.role === 'inventory_manager' && { borderColor: colors.success }]}>
                <Text style={[styles.roleText, u.role === 'admin' && { color: colors.gold }, u.role === 'inventory_manager' && { color: colors.success }]}>
                  {u.role.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg2, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontWeight: '700' },
  name: { color: colors.text, fontWeight: '600' },
  email: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  roleBadge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  roleText: { color: colors.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});
