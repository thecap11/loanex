import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/context/CartContext';
import { useAlert } from '@/src/context/AlertContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { addressService } from '@/src/services/addressService';
import { orderService } from '@/src/services/orderService';

export default function Checkout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { items, total, clearCart } = useCart();
  const { toast } = useAlert();

  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [payMethod, setPayMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [payState, setPayState] = useState<'select' | 'processing' | 'success' | 'fail'>('select');
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  const deliveryFee = total > 5000 ? 0 : 499;
  const grandTotal = total + deliveryFee;

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const addrs = await addressService.getAddresses(user.id);
      setAddresses(addrs);
      const def = addrs.find((a) => a.is_default);
      setSelectedAddr(def?.id || addrs[0]?.id || null);
    } catch (e) {} finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handlePay = async () => {
    setPayState('processing');
    await new Promise((r) => setTimeout(r, 800));

    try {
      const addr = addresses.find((a) => a.id === selectedAddr);
      const shippingText = addr ? `${addr.house_no}, ${addr.street}, ${addr.city}, ${addr.state} ${addr.pincode}` : '';
      const payMethodLabel = payMethod === 'upi' ? 'UPI' : payMethod === 'card' ? 'Card' : 'Net Banking';

      const order = await orderService.createOrder({
        user_id: user!.id,
        product_name: items.map((i) => i.name).join(', '),
        product_image: items[0]?.image || '',
        quantity: items.reduce((s, i) => s + i.qty, 0),
        unit_price: items[0]?.price || 0,
        total_amount: grandTotal,
        delivery_fee: deliveryFee,
        shipping_address: shippingText,
        payment_mode: payMethodLabel,
        is_emi: false,
      });

      setCreatedOrder(order);
      setPayState('success');
      clearCart();
      toast('Order placed successfully!', 'success');
    } catch (e: any) {
      setPayState('fail');
      toast('Payment failed: ' + e.message, 'error');
    }
  };

  const selectedAddrObj = addresses.find((a) => a.id === selectedAddr);

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Checkout</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 200 }}>
        <Text style={styles.sectionTitle}>Order Items</Text>
        {items.map((it, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Image source={{ uri: it.image }} style={styles.img} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
              <Text style={styles.itemQty}>Qty: {it.qty} × {formatINR(it.price)}</Text>
            </View>
            <Text style={styles.itemTotal}>{formatINR(it.price * it.qty)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Shipping Address</Text>
        {addresses.length === 0 ? (
          <Pressable style={styles.addAddrBtn} onPress={() => router.push('/addresses')}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primaryLight} />
            <Text style={styles.addAddrText}>Add Delivery Address</Text>
          </Pressable>
        ) : (
          addresses.map((a) => (
            <Pressable key={a.id} style={[styles.addrCard, selectedAddr === a.id && styles.addrCardActive]} onPress={() => setSelectedAddr(a.id)}>
              <View style={styles.radioOuter}>
                {selectedAddr === a.id && <View style={styles.radioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.addrTagRow}>
                  <View style={styles.addrTag}><Text style={styles.addrTagText}>{a.tag?.toUpperCase()}</Text></View>
                  {a.is_default && <Text style={styles.defaultBadge}>Default</Text>}
                </View>
                <Text style={styles.addrText}>{a.house_no}, {a.street}</Text>
                <Text style={styles.addrText}>{a.city}, {a.state} {a.pincode}</Text>
              </View>
            </Pressable>
          ))
        )}

        <Text style={styles.sectionTitle}>Payment Summary</Text>
        <View style={styles.summary}>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryVal}>{formatINR(total)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Delivery Charge</Text><Text style={styles.summaryVal}>{deliveryFee === 0 ? 'FREE' : formatINR(deliveryFee)}</Text></View>
          <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }]}>
            <Text style={styles.totalLabel}>Total Payable</Text><Text style={styles.totalVal}>{formatINR(grandTotal)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        <Pressable style={styles.payBtn} onPress={() => { if (!selectedAddrObj) { toast('Select a delivery address', 'error'); return; } setShowPay(true); }}>
          <Text style={styles.payBtnText}>Proceed to Payment</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </Pressable>
      </View>

      {/* Payment Modal */}
      <Modal visible={showPay} transparent animationType="slide">
        <Pressable style={styles.payOverlay} onPress={() => { if (payState !== 'processing') { setShowPay(false); setPayState('select'); } }}>
          <Pressable style={styles.paySheet} onPress={(e) => e.stopPropagation()}>
            {payState === 'select' && (
              <>
                <View style={styles.payHandle} />
                <Text style={styles.payTitle}>Select Payment Method</Text>
                {[
                  { key: 'upi', label: 'UPI', sub: 'Google Pay, PhonePe, Paytm', icon: 'phone-portrait' },
                  { key: 'card', label: 'Credit/Debit Card', sub: 'Visa, Mastercard', icon: 'card' },
                  { key: 'netbanking', label: 'Net Banking', sub: 'All major banks', icon: 'business' },
                ].map((m) => (
                  <Pressable key={m.key} style={[styles.payMethod, payMethod === m.key && styles.payMethodActive]} onPress={() => setPayMethod(m.key as any)}>
                    <Ionicons name={m.icon as any} size={24} color={payMethod === m.key ? colors.primaryLight : colors.textDim} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payMethodLabel}>{m.label}</Text>
                      <Text style={styles.payMethodSub}>{m.sub}</Text>
                    </View>
                    <View style={[styles.radioOuter, payMethod === m.key && styles.radioOuterActive]}>
                      {payMethod === m.key && <View style={[styles.radioInner, { backgroundColor: colors.primaryLight}]} />}
                    </View>
                  </Pressable>
                ))}
                <Pressable style={styles.payConfirmBtn} onPress={handlePay}>
                  <Text style={styles.payConfirmText}>Pay {formatINR(grandTotal)}</Text>
                </Pressable>
              </>
            )}
            {payState === 'processing' && (
              <View style={styles.payProcessing}>
                <ActivityIndicator color={colors.white} size="large" />
                <Text style={styles.payProcessingText}>Processing payment...</Text>
              </View>
            )}
            {payState === 'success' && (
              <View style={styles.payResult}>
                <View style={styles.payResultIcon}><Ionicons name="checkmark" size={48} color={colors.success} /></View>
                <Text style={styles.payResultTitle}>Payment Successful!</Text>
                <Text style={styles.payResultSub}>Order ID: {createdOrder?.order_id}</Text>
                <Pressable style={styles.payResultBtn} onPress={() => { setShowPay(false); setPayState('select'); router.replace(`/order/${createdOrder?.id}`); }}>
                  <Text style={styles.payResultBtnText}>View Order</Text>
                </Pressable>
              </View>
            )}
            {payState === 'fail' && (
              <View style={styles.payResult}>
                <View style={[styles.payResultIcon, { borderColor: colors.error }]}><Ionicons name="close" size={48} color={colors.error} /></View>
                <Text style={styles.payResultTitle}>Payment Failed</Text>
                <Text style={styles.payResultSub}>Your payment could not be processed. No amount has been deducted.</Text>
                <Pressable style={[styles.payResultBtn, { backgroundColor: colors.error }]} onPress={() => setPayState('select')}>
                  <Text style={styles.payResultBtnText}>Retry</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  img: { width: 50, height: 50, borderRadius: radius.sm, backgroundColor: colors.surface },
  itemName: { color: colors.text, fontSize: fs.sm, fontWeight: '600', flex: 1 },
  itemQty: { color: colors.textDim, fontSize: fs.xs, marginTop: 2 },
  itemTotal: { color: colors.text, fontWeight: '700' },
  addAddrBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary + '40' },
  addAddrText: { color: colors.primaryLight, fontWeight: '600' },
  addrCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  addrCardActive: { borderColor: colors.primary },
  radioOuter: { width: 20, height: 20, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: colors.primaryLight },
  radioInner: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
  addrTagRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 4 },
  addrTag: { backgroundColor: colors.primary + '20', borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  addrTagText: { color: colors.primaryLight, fontSize: 10, fontWeight: '700' },
  defaultBadge: { color: colors.success, fontSize: 10, fontWeight: '700' },
  addrText: { color: colors.textDim, fontSize: fs.sm },
  summary: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  summaryLabel: { color: colors.textDim, fontSize: fs.sm },
  summaryVal: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  totalLabel: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  totalVal: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, height: 52, borderRadius: radius.md },
  payBtnText: { color: colors.white, fontWeight: '700', fontSize: fs.base },
  payOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  paySheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, minHeight: 300 },
  payHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: radius.pill, alignSelf: 'center', marginBottom: spacing.lg },
  payTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700', marginBottom: spacing.lg },
  payMethod: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  payMethodActive: { borderColor: colors.primary },
  payMethodLabel: { color: colors.text, fontSize: fs.base, fontWeight: '600' },
  payMethodSub: { color: colors.textDim, fontSize: fs.xs, marginTop: 2 },
  payConfirmBtn: { backgroundColor: colors.primary, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  payConfirmText: { color: colors.white, fontWeight: '700', fontSize: fs.base },
  payProcessing: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  payProcessingText: { color: colors.textDim, fontSize: fs.base },
  payResult: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  payResultIcon: { width: 80, height: 80, borderRadius: radius.pill, borderWidth: 3, borderColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  payResultTitle: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  payResultSub: { color: colors.textDim, fontSize: fs.sm, textAlign: 'center' },
  payResultBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  payResultBtnText: { color: colors.white, fontWeight: '700' },
});
