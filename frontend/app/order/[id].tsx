import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const o = await api(`/orders/${id}`);
    setOrder(o);
  }, [api, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pay = async (inst: number) => {
    setBusy(inst);
    try {
      await api(`/orders/${id}/pay-emi/${inst}`, { method: 'POST' });
      await load();
    } catch (e) {} finally { setBusy(null); }
  };

  if (!order) return <View style={styles.center}><ActivityIndicator color={colors.white} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="order-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Text style={styles.title}>Order #{order.id.slice(0, 8).toUpperCase()}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <View style={styles.statusCard}>
          <Ionicons name="checkmark-circle" size={32} color={colors.success} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.statusTitle}>Order Confirmed</Text>
            <Text style={styles.statusSub}>{new Date(order.created_at).toLocaleString()}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Items</Text>
        {order.items.map((it: any, i: number) => (
          <View key={i} style={styles.itemRow}>
            <Image source={{ uri: it.image }} style={styles.itemImg} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.name}</Text>
              <Text style={styles.itemMeta}>Qty {it.qty} • ${it.price.toFixed(2)}</Text>
            </View>
            <Text style={styles.itemTotal}>${(it.price * it.qty).toFixed(2)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Delivery</Text>
        <View style={styles.addressCard}>
          <Ionicons name="location" size={18} color={colors.gold} />
          <Text style={styles.addressText}>{order.address}</Text>
        </View>

        {order.emi ? (
          <>
            <Text style={styles.sectionTitle}>EMI Schedule ({order.emi.tenure} months)</Text>
            <View style={styles.emiSummary}>
              <View style={styles.emiSummaryRow}><Text style={styles.dim}>Monthly</Text><Text style={styles.emiVal}>${order.emi.monthly}</Text></View>
              <View style={styles.emiSummaryRow}><Text style={styles.dim}>Total</Text><Text style={styles.emiVal}>${order.emi.total_with_interest}</Text></View>
              <View style={styles.emiSummaryRow}><Text style={styles.dim}>Approval</Text>
                <Text style={[styles.emiVal, { color: order.emi.approval_status === 'approved' ? colors.success : order.emi.approval_status === 'rejected' ? colors.error : colors.warning }]}>
                  {order.emi.approval_status.toUpperCase()}
                </Text>
              </View>
            </View>
            {order.emi.schedule.map((s: any) => (
              <View testID={`emi-${s.installment}`} key={s.installment} style={styles.instRow}>
                <View style={[styles.dot, { backgroundColor: s.status === 'paid' ? colors.success : colors.bg3 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.instTitle}>Installment {s.installment}</Text>
                  <Text style={styles.instDate}>Due {new Date(s.due_date).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.instAmount}>${s.amount}</Text>
                {s.status === 'paid' ? (
                  <View style={styles.paidBadge}><Text style={styles.paidText}>PAID</Text></View>
                ) : (
                  <Pressable testID={`pay-emi-${s.installment}`} style={styles.payBtn} onPress={() => pay(s.installment)} disabled={busy === s.installment}>
                    {busy === s.installment ? <ActivityIndicator color={colors.black} size="small" /> : <Text style={styles.payBtnText}>Pay</Text>}
                  </Pressable>
                )}
              </View>
            ))}
          </>
        ) : (
          <View style={[styles.addressCard, { marginTop: spacing.md }]}>
            <Ionicons name="card" size={18} color={colors.success} />
            <Text style={styles.addressText}>Paid in full • ${order.subtotal.toFixed(2)}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  statusCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: 'rgba(16,185,129,0.1)', borderColor: colors.success, borderWidth: 1, borderRadius: radius.md },
  statusTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  statusSub: { color: colors.textDim, fontSize: fs.sm },
  sectionTitle: { color: colors.textDim, fontSize: fs.sm, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  itemImg: { width: 50, height: 50, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  itemName: { color: colors.text, fontWeight: '600' },
  itemMeta: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  itemTotal: { color: colors.text, fontWeight: '700' },
  addressCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  addressText: { color: colors.text, flex: 1 },
  emiSummary: { padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, marginBottom: spacing.md, gap: 4 },
  emiSummaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dim: { color: colors.textDim },
  emiVal: { color: colors.text, fontWeight: '700' },
  instRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  dot: { width: 12, height: 12, borderRadius: 6 },
  instTitle: { color: colors.text, fontWeight: '600' },
  instDate: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  instAmount: { color: colors.text, fontWeight: '700', marginRight: spacing.sm },
  paidBadge: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: colors.success, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  paidText: { color: colors.success, fontSize: fs.sm, fontWeight: '700' },
  payBtn: { backgroundColor: colors.white, paddingHorizontal: spacing.md, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', minWidth: 60 },
  payBtnText: { color: colors.black, fontWeight: '700' },
});
