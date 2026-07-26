import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

export default function Orders() {
  const { api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setOrders(await api('/orders')); } catch {} finally { setLoading(false); }
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}><Text style={styles.title}>My Orders & EMIs</Text></View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.white} /></View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={72} color={colors.textMuted} />
          <Text style={styles.emptyText}>No orders yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
          {orders.map((o) => {
            const nextEmi = o.emi?.schedule?.find((s: any) => s.status === 'pending');
            return (
              <Pressable testID={`order-${o.id}`} key={o.id} style={styles.card} onPress={() => router.push(`/order/${o.id}`)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.orderId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                  <Text style={styles.date}>{new Date(o.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                  <Image source={{ uri: o.items[0]?.image }} style={styles.img} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{o.items[0]?.name}{o.items.length > 1 ? ` +${o.items.length - 1} more` : ''}</Text>
                    <Text style={styles.total}>Total: ${o.subtotal.toFixed(2)}</Text>
                    {o.emi ? (
                      <View style={styles.emiChip}>
                        <Ionicons name="calendar" size={12} color={colors.gold} />
                        <Text style={styles.emiChipText}>{o.emi.tenure}-month EMI • ${o.emi.monthly}/mo</Text>
                      </View>
                    ) : (
                      <View style={[styles.emiChip, { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: colors.success }]}>
                        <Text style={[styles.emiChipText, { color: colors.success }]}>Paid in full</Text>
                      </View>
                    )}
                  </View>
                </View>
                {nextEmi && (
                  <View style={styles.emiFooter}>
                    <Text style={styles.emiFooterLabel}>Next EMI</Text>
                    <Text style={styles.emiFooterAmount}>${nextEmi.amount} due {new Date(nextEmi.due_date).toLocaleDateString()}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  card: { backgroundColor: colors.bg2, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  orderId: { color: colors.text, fontWeight: '700', fontSize: fs.base },
  date: { color: colors.textDim, fontSize: fs.sm },
  img: { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  itemName: { color: colors.text, fontSize: fs.base, fontWeight: '600' },
  total: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  emiChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(212,175,55,0.15)', borderColor: colors.gold, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4, marginTop: spacing.sm },
  emiChipText: { color: colors.gold, fontSize: fs.sm, fontWeight: '600' },
  emiFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  emiFooterLabel: { color: colors.textDim, fontSize: fs.sm },
  emiFooterAmount: { color: colors.gold, fontWeight: '700', fontSize: fs.base },
});
