import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

export default function Cart() {
  const { api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api('/cart');
      setItems(data.items || []);
    } catch (e) {} finally { setLoading(false); }
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = items.reduce((s, it) => s + it.product.price * it.qty, 0);

  const remove = async (pid: string) => {
    await api('/cart/remove', { method: 'POST', body: JSON.stringify({ product_id: pid, qty: 0 }) });
    load();
  };

  const changeQty = async (pid: string, delta: number) => {
    await api('/cart/add', { method: 'POST', body: JSON.stringify({ product_id: pid, qty: delta }) });
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}><Text style={styles.title}>Your Cart</Text></View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.white} /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cart-outline" size={72} color={colors.textMuted} />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Pressable testID="browse-btn" style={styles.browseBtn} onPress={() => router.push('/(customer)/home')}>
            <Text style={styles.browseBtnText}>Browse products</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 200 }}>
            {items.map((it) => (
              <View testID={`cart-item-${it.product.id}`} key={it.product.id} style={styles.row}>
                <Image source={{ uri: it.product.image }} style={styles.img} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={2}>{it.product.name}</Text>
                  <Text style={styles.itemPrice}>{formatINR(it.product.price)}</Text>
                  <View style={styles.qtyRow}>
                    <Pressable testID={`qty-dec-${it.product.id}`} style={styles.qtyBtn} onPress={() => it.qty > 1 && changeQty(it.product.id, -1)}>
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </Pressable>
                    <Text style={styles.qty}>{it.qty}</Text>
                    <Pressable testID={`qty-inc-${it.product.id}`} style={styles.qtyBtn} onPress={() => changeQty(it.product.id, 1)}>
                      <Ionicons name="add" size={16} color={colors.text} />
                    </Pressable>
                    <Pressable testID={`remove-${it.product.id}`} style={styles.trash} onPress={() => remove(it.product.id)}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: 88 + insets.bottom }]}>
            <View>
              <Text style={styles.totalLabel}>Total</Text>
              <Text testID="cart-total" style={styles.total}>{formatINR(total)}</Text>
            </View>
            <Pressable testID="checkout-btn" style={styles.checkoutBtn} onPress={() => router.push('/checkout')}>
              <Text style={styles.checkoutText}>Checkout</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.black} />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  browseBtn: { backgroundColor: colors.white, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  browseBtnText: { color: colors.black, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.bg2, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  img: { width: 80, height: 80, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  itemName: { color: colors.text, fontSize: fs.base, fontWeight: '600' },
  itemPrice: { color: colors.gold, fontSize: fs.base, fontWeight: '700', marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  qtyBtn: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center' },
  qty: { color: colors.text, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  trash: { marginLeft: 'auto', padding: 6 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.xl, backgroundColor: colors.bg2, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { color: colors.textDim, fontSize: fs.sm },
  total: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, paddingHorizontal: spacing.xl, height: 48, borderRadius: radius.md },
  checkoutText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
});
