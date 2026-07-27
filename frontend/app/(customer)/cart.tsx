import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/src/context/CartContext';
import { useAlert } from '@/src/context/AlertContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

const { width } = Dimensions.get('window');

export default function Cart() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, removeItem, updateQty, clearCart, total } = useCart();
  const { toast } = useAlert();

  const deliveryFee = total > 5000 ? 0 : 499;
  const grandTotal = total + deliveryFee;
  const firstEmiItem = items.find((i) => i.emiEnabled);

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={styles.header}><Text style={styles.title}>Your Cart</Text></View>
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={72} color={colors.textMuted} />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Pressable style={styles.browseBtn} onPress={() => router.push('/(customer)/home')}>
            <Text style={styles.browseBtnText}>Browse Products</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Cart</Text>
        <Pressable onPress={() => { clearCart(); toast('Cart cleared', 'info'); }}>
          <Text style={styles.clearAll}>Clear All</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 200 }}>
        {firstEmiItem && (
          <Pressable style={styles.emiBanner} onPress={() => router.push({ pathname: '/emi/apply/[id]', params: { id: firstEmiItem.productId } })}>
            <Ionicons name="card" size={20} color={colors.cyan} />
            <Text style={styles.emiBannerText}>Apply for Instant EMI on {firstEmiItem.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.cyan} />
          </Pressable>
        )}

        {items.map((it) => (
          <View key={it.productId} style={styles.row}>
            <Image source={{ uri: it.image }} style={styles.img} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>{it.brand}</Text>
              <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
              <Text style={styles.itemPrice}>{formatINR(it.price)}</Text>
              <View style={styles.qtyRow}>
                <Pressable style={styles.qtyBtn} onPress={() => updateQty(it.productId, it.qty - 1)}>
                  <Ionicons name="remove" size={16} color={colors.text} />
                </Pressable>
                <Text style={styles.qty}>{it.qty}</Text>
                <Pressable style={styles.qtyBtn} onPress={() => updateQty(it.productId, it.qty + 1)}>
                  <Ionicons name="add" size={16} color={colors.text} />
                </Pressable>
                <Pressable style={styles.trash} onPress={() => removeItem(it.productId)}>
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        <View style={styles.breakdown}>
          <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Subtotal</Text><Text style={styles.breakdownVal}>{formatINR(total)}</Text></View>
          <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Delivery Fee</Text><Text style={styles.breakdownVal}>{deliveryFee === 0 ? 'FREE' : formatINR(deliveryFee)}</Text></View>
          <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs }]}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalVal}>{formatINR(grandTotal)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 88 + insets.bottom }]}>
        {firstEmiItem && (
          <Pressable style={styles.emiCheckoutBtn} onPress={() => router.push({ pathname: '/emi/apply/[id]', params: { id: firstEmiItem.productId } })}>
            <Text style={styles.emiCheckoutText}>Buy on EMI</Text>
          </Pressable>
        )}
        <Pressable style={styles.checkoutBtn} onPress={() => router.push('/checkout')}>
          <Text style={styles.checkoutText}>Direct Checkout</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.black} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  clearAll: { color: colors.error, fontSize: fs.sm, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  browseBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  browseBtnText: { color: colors.white, fontWeight: '700' },
  emiBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cyan + '40' },
  emiBannerText: { flex: 1, color: colors.cyan, fontSize: fs.sm, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  img: { width: 80, height: 80, borderRadius: radius.sm, backgroundColor: colors.surface },
  brand: { color: colors.textDim, fontSize: fs.xs },
  itemName: { color: colors.text, fontSize: fs.base, fontWeight: '600' },
  itemPrice: { color: colors.accent, fontSize: fs.base, fontWeight: '700', marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  qtyBtn: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  qty: { color: colors.text, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  trash: { marginLeft: 'auto', padding: 6 },
  breakdown: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  breakdownLabel: { color: colors.textDim, fontSize: fs.sm },
  breakdownVal: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  totalLabel: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  totalVal: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  emiCheckoutBtn: { height: 48, borderRadius: radius.md, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center' },
  emiCheckoutText: { color: colors.black, fontWeight: '700', fontSize: fs.base },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.white, height: 48, borderRadius: radius.md },
  checkoutText: { color: colors.black, fontWeight: '700', fontSize: fs.base },
});
