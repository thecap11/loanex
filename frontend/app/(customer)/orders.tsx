import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

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
      <View style={styles.header}>
        <Pressable testID="orders-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Text style={styles.title}>My Orders</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.white} /></View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={72} color={colors.textMuted} />
          <Text style={styles.emptyText}>No orders yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
          {orders.map((o) => (
            <Pressable testID={`order-${o.id}`} key={o.id} style={styles.card} onPress={() => router.push(`/order/${o.id}`)}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                <View style={[styles.methodTag, o.payment_method === 'emi' && { backgroundColor: 'rgba(212,175,55,0.15)', borderColor: colors.gold }]}>
                  <Text style={[styles.methodText, o.payment_method === 'emi' && { color: colors.gold }]}>{o.payment_method === 'emi' ? 'EMI' : 'PAID'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                <Image source={{ uri: o.items[0]?.image }} style={styles.img} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{o.items[0]?.name}{o.items.length > 1 ? ` +${o.items.length - 1} more` : ''}</Text>
                  <Text style={styles.total}>{formatINR(o.subtotal)}</Text>
                  <Text style={styles.date}>{new Date(o.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  card: { backgroundColor: colors.bg2, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { color: colors.text, fontWeight: '700' },
  methodTag: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: colors.success, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  methodText: { color: colors.success, fontSize: fs.sm, fontWeight: '700' },
  img: { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  itemName: { color: colors.text, fontWeight: '600' },
  total: { color: colors.gold, fontWeight: '700', marginTop: 4 },
  date: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
});
