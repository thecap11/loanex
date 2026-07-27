import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { formatDate } from '@/src/lib/emi';
import { orderService } from '@/src/services/orderService';

type Tab = 'Active' | 'Delivered' | 'All Orders';
const ORDER_STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#3B82F6', DISPATCHED: '#06B6D4', IN_TRANSIT: '#7C3AED', OUT_FOR_DELIVERY: '#F59E0B', DELIVERED: '#10B981', CANCELLED: '#EF4444',
};

export default function Orders() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('Active');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try { setOrders(await orderService.getOrders(user.id)); } catch (e) {} finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = orders.filter((o) => {
    if (tab === 'Active') return ['CONFIRMED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(o.order_status);
    if (tab === 'Delivered') return o.order_status === 'DELIVERED';
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}><Text style={styles.title}>My Orders</Text></View>

      <View style={styles.tabRow}>
        {(['Active', 'Delivered', 'All Orders'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cube-outline" size={72} color={colors.textMuted} />
          <Text style={styles.emptyText}>No orders yet</Text>
          <Pressable style={styles.browseBtn} onPress={() => router.push('/(customer)/home')}>
            <Text style={styles.browseBtnText}>Start Shopping</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
          {filtered.map((o) => (
            <Pressable key={o.id} style={styles.card} onPress={() => router.push(`/order/${o.id}`)}>
              <View style={styles.cardTop}>
                <Image source={{ uri: o.product_image }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.prodName} numberOfLines={2}>{o.product_name}</Text>
                  <Text style={styles.orderDate}>{formatDate(o.created_at)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (ORDER_STATUS_COLORS[o.order_status] || colors.textDim) + '20' }]}>
                  <Text style={[styles.statusText, { color: ORDER_STATUS_COLORS[o.order_status] || colors.textDim }]}>{o.order_status.replace(/_/g, ' ')}</Text>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.total}>Total: {formatINR(o.total_amount)}</Text>
                <View style={styles.trackBtn}><Text style={styles.trackText}>Track Order</Text><Ionicons name="chevron-forward" size={14} color={colors.primaryLight} /></View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, height: 38, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  browseBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  browseBtnText: { color: colors.white, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface },
  prodName: { color: colors.text, fontSize: fs.base, fontWeight: '600' },
  orderDate: { color: colors.textDim, fontSize: fs.xs, marginTop: 2 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  total: { color: colors.text, fontWeight: '700' },
  trackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackText: { color: colors.primaryLight, fontSize: fs.sm, fontWeight: '600' },
});
