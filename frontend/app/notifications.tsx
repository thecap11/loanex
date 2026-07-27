import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatDateTime } from '@/src/lib/emi';
import { notificationService } from '@/src/services/notificationService';

export default function Notifications() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try { setNotifs(await notificationService.getNotifications(user.id)); } catch (e) {} finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleMarkAll = async () => {
    if (!user) return;
    try { await notificationService.markAllAsRead(user.id); load(); } catch (e) {}
  };

  const handlePress = async (n: any) => {
    if (!n.is_read) { try { await notificationService.markAsRead(n.id); load(); } catch (e) {} }
  };

  const iconForType = (type: string) => {
    if (type === 'approval') return { icon: 'checkmark-circle', color: colors.success };
    if (type === 'rejection') return { icon: 'close-circle', color: colors.error };
    return { icon: 'notifications', color: '#3B82F6' };
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {notifs.some((n) => !n.is_read) && (
          <Pressable onPress={handleMarkAll}><Text style={styles.markAll}>Mark all as read</Text></Pressable>
        )}
      </View>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>
      ) : notifs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-outline" size={72} color={colors.textMuted} />
          <Text style={styles.emptyText}>No notifications</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
          {notifs.map((n) => {
            const ic = iconForType(n.type);
            return (
              <Pressable key={n.id} style={[styles.card, !n.is_read && styles.cardUnread]} onPress={() => handlePress(n)}>
                {!n.is_read && <View style={styles.unreadDot} />}
                <View style={[styles.iconBadge, { backgroundColor: ic.color + '20' }]}>
                  <Ionicons name={ic.icon as any} size={20} color={ic.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifTitle}>{n.title}</Text>
                  <Text style={styles.notifMsg}>{n.message}</Text>
                  <Text style={styles.notifTime}>{formatDateTime(n.created_at)}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  markAll: { color: colors.primaryLight, fontSize: fs.sm, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  card: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, alignItems: 'flex-start' },
  cardUnread: { borderColor: colors.primary + '40' },
  unreadDot: { position: 'absolute', left: 6, top: '50%', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  iconBadge: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  notifMsg: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  notifTime: { color: colors.textMuted, fontSize: fs.xs, marginTop: 4 },
});
