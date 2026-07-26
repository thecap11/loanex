import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

export default function AdminEmis() {
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const load = useCallback(async () => {
    try { setOrders(await api('/admin/emis')); } catch {} finally { setLoading(false); }
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = orders.filter((o) => filter === 'all' || o.emi?.approval_status === filter);

  const act = async (oid: string, action: 'approve' | 'reject') => {
    await api(`/admin/emis/${oid}/${action}`, { method: 'POST' });
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}><Text style={styles.title}>EMI Approvals</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: 56 }} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: 'center' }}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
          <Pressable testID={`emi-filter-${f}`} key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f.toUpperCase()}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
          {filtered.length === 0 ? <Text style={styles.empty}>No EMIs in this bucket</Text> : filtered.map((o) => (
            <View testID={`emi-${o.id}`} key={o.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={styles.orderId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                  <Text style={styles.user}>{o.user_name} • {o.user_email}</Text>
                </View>
                <View style={[styles.statusChip, {
                  backgroundColor: o.emi.approval_status === 'approved' ? 'rgba(16,185,129,0.15)' : o.emi.approval_status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                  borderColor: o.emi.approval_status === 'approved' ? colors.success : o.emi.approval_status === 'rejected' ? colors.error : colors.warning,
                }]}>
                  <Text style={[styles.statusText, {
                    color: o.emi.approval_status === 'approved' ? colors.success : o.emi.approval_status === 'rejected' ? colors.error : colors.warning
                  }]}>{o.emi.approval_status.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.emiInfo}>
                <View><Text style={styles.dim}>Amount</Text><Text style={styles.val}>${o.subtotal.toFixed(2)}</Text></View>
                <View><Text style={styles.dim}>Tenure</Text><Text style={styles.val}>{o.emi.tenure}m @ {o.emi.interest_rate}%</Text></View>
                <View><Text style={styles.dim}>Monthly</Text><Text style={styles.val}>${o.emi.monthly}</Text></View>
              </View>
              {o.emi.approval_status === 'pending' && (
                <View style={styles.actions}>
                  <Pressable testID={`approve-${o.id}`} style={styles.approve} onPress={() => act(o.id, 'approve')}>
                    <Ionicons name="checkmark" size={16} color={colors.black} />
                    <Text style={styles.approveText}>Approve</Text>
                  </Pressable>
                  <Pressable testID={`reject-${o.id}`} style={styles.reject} onPress={() => act(o.id, 'reject')}>
                    <Ionicons name="close" size={16} color={colors.error} />
                    <Text style={styles.rejectText}>Reject</Text>
                  </Pressable>
                </View>
              )}
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
  chip: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: colors.textDim, fontWeight: '700', fontSize: fs.sm },
  chipTextActive: { color: colors.black },
  empty: { color: colors.textDim, textAlign: 'center' },
  card: { backgroundColor: colors.bg2, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  orderId: { color: colors.text, fontWeight: '700' },
  user: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  statusText: { fontSize: fs.sm, fontWeight: '700' },
  emiInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  dim: { color: colors.textDim, fontSize: fs.sm },
  val: { color: colors.text, fontWeight: '700', marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  approve: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40, backgroundColor: colors.white, borderRadius: radius.md },
  approveText: { color: colors.black, fontWeight: '700' },
  reject: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40, borderWidth: 1, borderColor: colors.error, borderRadius: radius.md },
  rejectText: { color: colors.error, fontWeight: '700' },
});
