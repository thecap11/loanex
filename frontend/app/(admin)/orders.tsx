import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAlert } from '@/src/context/AlertContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { formatDate } from '@/src/lib/emi';
import { orderService } from '@/src/services/orderService';

const ORDER_STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#3B82F6', DISPATCHED: '#06B6D4', IN_TRANSIT: '#7C3AED', OUT_FOR_DELIVERY: '#F59E0B', DELIVERED: '#10B981', CANCELLED: '#EF4444',
};

type Tab = 'Direct Purchase' | 'EMI Orders';
const STATUS_FILTERS = ['All', 'CONFIRMED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const { toast } = useAlert();
  const [tab, setTab] = useState<Tab>('Direct Purchase');
  const [statusFilter, setStatusFilter] = useState('All');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const load = useCallback(async () => {
    try { setOrders(await orderService.getAllOrders()); } catch (e) {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = orders.filter((o) => {
    if (tab === 'EMI Orders' && !o.is_emi) return false;
    if (tab === 'Direct Purchase' && o.is_emi) return false;
    if (statusFilter !== 'All' && o.order_status !== statusFilter) return false;
    return true;
  });

  const handleStatusUpdate = async (status: string) => {
    try { await orderService.updateOrderStatus(selected.id, status); toast('Status updated', 'success'); setSelected(null); load(); } catch (e: any) { toast(e.message, 'error'); }
  };

  const statusButtons = [
    { status: 'CONFIRMED', color: '#3B82F6' },
    { status: 'DISPATCHED', color: '#06B6D4' },
    { status: 'IN_TRANSIT', color: '#7C3AED' },
    { status: 'OUT_FOR_DELIVERY', color: '#F59E0B' },
    { status: 'DELIVERED', color: '#10B981' },
    { status: 'CANCELLED', color: '#EF4444' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}><Text style={styles.title}>Orders Management</Text></View>

      <View style={styles.tabRow}>
        {(['Direct Purchase', 'EMI Orders'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {STATUS_FILTERS.map((s) => (
          <Pressable key={s} style={[styles.filterChip, statusFilter === s && styles.filterChipActive]} onPress={() => setStatusFilter(s)}>
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>{s.replace(/_/g, ' ')}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}><Ionicons name="cube-outline" size={72} color={colors.textMuted} /><Text style={styles.emptyText}>No orders found</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
          {filtered.map((o) => (
            <Pressable key={o.id} style={styles.card} onPress={() => setSelected(o)}>
              <Image source={{ uri: o.product_image }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.prodName} numberOfLines={1}>{o.product_name}</Text>
                <Text style={styles.orderId}>{o.order_id}</Text>
                <Text style={styles.date}>{formatDate(o.created_at)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: (ORDER_STATUS_COLORS[o.order_status] || colors.textDim) + '20' }]}>
                  <Text style={[styles.statusText, { color: ORDER_STATUS_COLORS[o.order_status] || colors.textDim }]}>{o.order_status.replace(/_/g, ' ')}</Text>
                </View>
              </View>
              <Text style={styles.total}>{formatINR(o.total_amount)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Status Update Modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Update Order Status</Text>
            {selected && (
              <View style={styles.modalInfo}>
                <Text style={styles.modalInfoText}>Order: {selected.order_id}</Text>
                <Text style={styles.modalInfoText}>Product: {selected.product_name}</Text>
                <Text style={styles.modalInfoText}>Total: {formatINR(selected.total_amount)}</Text>
                <Text style={styles.modalInfoText}>Current: {selected.order_status.replace(/_/g, ' ')}</Text>
              </View>
            )}
            <View style={styles.statusGrid}>
              {statusButtons.map((s) => (
                <Pressable key={s.status} style={[styles.statusBtn, { backgroundColor: s.color + '20', borderColor: s.color }]} onPress={() => handleStatusUpdate(s.status)}>
                  <Text style={[styles.statusBtnText, { color: s.color }]}>{s.status.replace(/_/g, ' ')}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.sm },
  tab: { flex: 1, height: 40, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  filterRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md },
  filterChip: { height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.textDim, fontSize: fs.xs, fontWeight: '600' },
  filterChipTextActive: { color: colors.white },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  card: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, alignItems: 'flex-start' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface },
  prodName: { color: colors.text, fontSize: fs.base, fontWeight: '600' },
  orderId: { color: colors.textDim, fontSize: fs.xs, marginTop: 2 },
  date: { color: colors.textMuted, fontSize: fs.xs, marginTop: 2 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  total: { color: colors.text, fontWeight: '700', fontSize: fs.base },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl },
  modalTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700', marginBottom: spacing.lg },
  modalInfo: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, gap: 4 },
  modalInfoText: { color: colors.textDim, fontSize: fs.sm },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusBtn: { width: '48%', height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statusBtnText: { fontWeight: '700', fontSize: fs.sm },
});
