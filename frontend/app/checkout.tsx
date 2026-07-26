import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

export default function Checkout() {
  const { api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cart, setCart] = useState<any>({ items: [] });
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addressText, setAddressText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const c = await api('/cart');
    const addrs = await api('/addresses');
    setCart(c); setAddresses(addrs);
    const def = addrs.find((a: any) => a.is_default);
    if (def) setAddressId(def.id);
    else if (addrs.length > 0) setAddressId(addrs[0].id);
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subtotal = cart.items.reduce((s: number, it: any) => s + it.product.price * it.qty, 0);

  const place = async () => {
    setErr(null); setBusy(true);
    try {
      const items = cart.items.map((it: any) => ({ product_id: it.product.id, qty: it.qty }));
      const body: any = { items };
      if (addressId) body.address_id = addressId;
      else if (addressText.trim()) body.address_text = addressText.trim();
      else throw new Error('Please select or enter an address');
      const order = await api('/orders', { method: 'POST', body: JSON.stringify(body) });
      router.replace(`/order/${order.id}`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="checkout-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Text style={styles.title}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Items ({cart.items.length})</Text>
        {cart.items.map((it: any, i: number) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemName} numberOfLines={1}>{it.product.name}</Text>
            <Text style={styles.itemMeta}>Qty {it.qty}</Text>
            <Text style={styles.itemTotal}>{formatINR(it.product.price * it.qty)}</Text>
          </View>
        ))}

        <View style={styles.addressHeader}>
          <Text style={styles.section}>Delivery Address</Text>
          <Pressable testID="co-manage-addr" onPress={() => router.push('/addresses')}>
            <Text style={styles.addNew}>+ Manage</Text>
          </Pressable>
        </View>
        {addresses.length === 0 ? (
          <TextInput
            testID="co-addr-input"
            placeholder="Enter delivery address"
            placeholderTextColor={colors.textMuted}
            style={styles.textarea}
            multiline
            value={addressText}
            onChangeText={setAddressText}
          />
        ) : addresses.map((a) => (
          <Pressable testID={`co-addr-${a.id}`} key={a.id} style={[styles.addrCard, addressId === a.id && styles.addrCardActive]} onPress={() => setAddressId(a.id)}>
            <View style={[styles.radio, addressId === a.id && styles.radioOn]}>{addressId === a.id && <View style={styles.radioDot} />}</View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.addrLabel}>{a.label}</Text>
              <Text style={styles.addrLine}>{a.line1}, {a.city} - {a.pincode}</Text>
            </View>
          </Pressable>
        ))}

        <View style={styles.summary}>
          <Row label="Subtotal" value={formatINR(subtotal)} />
          <Row label="Delivery" value="FREE" />
          <View style={styles.divider} />
          <Row label="Total" value={formatINR(subtotal)} bold />
        </View>

        <View style={styles.paymentNote}>
          <Ionicons name="information-circle" size={16} color={colors.gold} />
          <Text style={styles.paymentText}>Full payment (mock). For EMI, apply from product page.</Text>
        </View>

        {err && <Text testID="checkout-err" style={styles.err}>{err}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        <Pressable testID="place-order-btn" style={[styles.placeBtn, (busy || cart.items.length === 0) && { opacity: 0.4 }]} disabled={busy || cart.items.length === 0} onPress={place}>
          {busy ? <ActivityIndicator color={colors.black} /> : <Text style={styles.placeBtnText}>Place Order • {formatINR(subtotal)}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, bold }: any) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { color: colors.text, fontWeight: '700' }]}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontSize: fs.xl }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  section: { color: colors.textDim, fontSize: fs.sm, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  itemName: { flex: 1, color: colors.text },
  itemMeta: { color: colors.textDim, fontSize: fs.sm },
  itemTotal: { color: colors.text, fontWeight: '700' },
  addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addNew: { color: colors.gold, fontWeight: '700', marginTop: spacing.md },
  textarea: { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, padding: spacing.md, minHeight: 80 },
  addrCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  addrCardActive: { borderColor: colors.gold },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.gold },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold },
  addrLabel: { color: colors.gold, fontSize: fs.sm, fontWeight: '700' },
  addrLine: { color: colors.text, marginTop: 2 },
  summary: { marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel: { color: colors.textDim },
  rowValue: { color: colors.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  paymentNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  paymentText: { color: colors.text, flex: 1, fontSize: fs.sm },
  err: { color: colors.error, marginTop: spacing.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.bg2, borderTopWidth: 1, borderTopColor: colors.border },
  placeBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  placeBtnText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
});
