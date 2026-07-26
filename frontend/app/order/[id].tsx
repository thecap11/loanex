import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any>(null);

  const load = useCallback(async () => {
    const o = await api(`/orders/${id}`); setOrder(o);
  }, [api, id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

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

        <Text style={styles.section}>Items</Text>
        {order.items.map((it: any, i: number) => (
          <View key={i} style={styles.itemRow}>
            <Image source={{ uri: it.image }} style={styles.itemImg} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.name}</Text>
              <Text style={styles.itemMeta}>Qty {it.qty} • {formatINR(it.price)}</Text>
            </View>
            <Text style={styles.itemTotal}>{formatINR(it.price * it.qty)}</Text>
          </View>
        ))}

        <Text style={styles.section}>Delivery</Text>
        <View style={styles.addressCard}>
          <Ionicons name="location" size={18} color={colors.gold} />
          <Text style={styles.addressText}>{order.address}</Text>
        </View>

        <Text style={styles.section}>Payment</Text>
        <View style={styles.paymentCard}>
          <Ionicons name={order.payment_method === 'emi' ? 'calendar' : 'card'} size={18} color={colors.gold} />
          <Text style={styles.addressText}>{order.payment_method === 'emi' ? `EMI order — Manage in EMI Hub` : `Paid in full — ${formatINR(order.subtotal)}`}</Text>
        </View>

        {order.emi_application_id && (
          <Pressable testID="view-emi-btn" style={styles.viewEmi} onPress={() => router.push(`/emi/${order.emi_application_id}`)}>
            <Text style={styles.viewEmiText}>View EMI Schedule</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.black} />
          </Pressable>
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
  section: { color: colors.textDim, fontSize: fs.sm, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  itemImg: { width: 50, height: 50, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  itemName: { color: colors.text, fontWeight: '600' },
  itemMeta: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  itemTotal: { color: colors.text, fontWeight: '700' },
  addressCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  addressText: { color: colors.text, flex: 1 },
  paymentCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  viewEmi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg, height: 50, borderRadius: radius.md, backgroundColor: colors.white },
  viewEmiText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
});
