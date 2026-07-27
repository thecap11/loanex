import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { formatDate } from '@/src/lib/emi';
import { orderService } from '@/src/services/orderService';

const STEPS = [
  { title: 'Order Confirmed', desc: 'Your order and payment have been verified by LoanEX.' },
  { title: 'Dispatched', desc: 'Package picked up by BlueDart Express.' },
  { title: 'In Transit', desc: 'Package arrived at regional sorting facility.' },
  { title: 'Out for Delivery', desc: 'Delivery executive is en route to your shipping address.' },
  { title: 'Delivered', desc: 'Package delivered safely with OTP verification.' },
];

const STATUS_ORDER = ['CONFIRMED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try { setOrder(await orderService.getOrder(id)); } catch (e) {} finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>;
  if (!order) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.textDim }}>Order not found</Text></View>;

  const currentStepIdx = STATUS_ORDER.indexOf(order.order_status);
  const isCancelled = order.order_status === 'CANCELLED';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Order Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
        {/* Courier Banner */}
        <View style={styles.courierBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.courierName}>{order.courier_name}</Text>
            <Text style={styles.trackingId}>AWB: {order.tracking_id}</Text>
          </View>
          <Pressable style={styles.invoiceBtn}><Ionicons name="download-outline" size={16} color={colors.primaryLight} /><Text style={styles.invoiceText}>Invoice</Text></Pressable>
        </View>

        {/* Expected Delivery */}
        <View style={styles.deliveryBox}>
          <Ionicons name="calendar-outline" size={20} color={colors.success} />
          <View>
            <Text style={styles.deliveryLabel}>Expected Delivery</Text>
            <Text style={styles.deliveryDate}>{order.expected_delivery ? formatDate(order.expected_delivery) : 'N/A'}</Text>
          </View>
        </View>

        {/* Tracking Timeline */}
        {!isCancelled && (
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Order Tracking</Text>
            {STEPS.map((step, i) => {
              const isCompleted = i < currentStepIdx;
              const isCurrent = i === currentStepIdx;
              return (
                <View key={i} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, isCompleted && styles.timelineDotCompleted, isCurrent && styles.timelineDotCurrent]} />
                    {i < STEPS.length - 1 && <View style={[styles.timelineLine, (isCompleted || isCurrent) && styles.timelineLineActive]} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: spacing.md }}>
                    <Text style={[styles.timelineStepTitle, (isCompleted || isCurrent) && { color: colors.text }]}>{step.title}</Text>
                    <Text style={styles.timelineStepDesc}>{step.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {isCancelled && <View style={styles.cancelledBox}><Ionicons name="close-circle" size={40} color={colors.error} /><Text style={styles.cancelledText}>Order Cancelled</Text></View>}

        {/* Item Details */}
        <Text style={styles.sectionTitle}>Item Details</Text>
        <View style={styles.itemCard}>
          <Image source={{ uri: order.product_image }} style={styles.itemImg} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName} numberOfLines={2}>{order.product_name}</Text>
            <Text style={styles.itemQty}>Qty: {order.quantity}</Text>
            <Text style={styles.itemPrice}>{formatINR(order.unit_price)}</Text>
          </View>
        </View>

        {/* Shipping & Payment */}
        <Text style={styles.sectionTitle}>Shipping & Payment</Text>
        <View style={styles.shipCard}>
          <Text style={styles.shipLabel}>Delivery Address</Text>
          <Text style={styles.shipText}>{order.shipping_address}</Text>
          <View style={styles.divider} />
          <Text style={styles.shipLabel}>Payment Method</Text>
          <Text style={styles.shipText}>{order.payment_mode}</Text>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabelText}>Total Amount</Text>
            <Text style={styles.totalValText}>{formatINR(order.total_amount)}</Text>
          </View>
        </View>

        <Pressable style={styles.helpBtn}>
          <Ionicons name="help-circle-outline" size={20} color={colors.primaryLight} />
          <Text style={styles.helpText}>Need Help with this Order?</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  courierBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  courierName: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  trackingId: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  invoiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '20', borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  invoiceText: { color: colors.primaryLight, fontSize: fs.sm, fontWeight: '600' },
  deliveryBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.success + '15', borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg },
  deliveryLabel: { color: colors.textDim, fontSize: fs.sm },
  deliveryDate: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  timelineCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  timelineTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginBottom: spacing.lg },
  timelineRow: { flexDirection: 'row', gap: spacing.md },
  timelineLeft: { alignItems: 'center' },
  timelineDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.border, borderWidth: 2, borderColor: colors.bg },
  timelineDotCompleted: { backgroundColor: colors.success, borderColor: colors.success },
  timelineDotCurrent: { backgroundColor: colors.success, borderColor: colors.success },
  timelineLine: { width: 2, flex: 1, minHeight: 30, backgroundColor: colors.border, marginTop: 2 },
  timelineLineActive: { backgroundColor: colors.success },
  timelineStepTitle: { color: colors.textMuted, fontSize: fs.sm, fontWeight: '600' },
  timelineStepDesc: { color: colors.textMuted, fontSize: fs.xs, marginTop: 2 },
  cancelledBox: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  cancelledText: { color: colors.error, fontSize: fs.lg, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginBottom: spacing.sm },
  itemCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  itemImg: { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.surface },
  itemName: { color: colors.text, fontSize: fs.base, fontWeight: '600' },
  itemQty: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  itemPrice: { color: colors.accent, fontSize: fs.base, fontWeight: '700', marginTop: 2 },
  shipCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  shipLabel: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  shipText: { color: colors.text, fontSize: fs.sm, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabelText: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  totalValText: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  helpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: spacing.lg, borderWidth: 1, borderColor: colors.border },
  helpText: { color: colors.primaryLight, fontWeight: '600' },
});
