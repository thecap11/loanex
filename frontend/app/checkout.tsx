import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

export default function Checkout() {
  const { api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cart, setCart] = useState<any>({ items: [] });
  const [config, setConfig] = useState<any>(null);
  const [addr, setAddr] = useState('');
  const [payment, setPayment] = useState<'full' | 'emi'>('full');
  const [tenure, setTenure] = useState<number>(6);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emiCalc, setEmiCalc] = useState<any>(null);

  const load = useCallback(async () => {
    const c = await api('/cart');
    const cfg = await api('/emi/config');
    setCart(c); setConfig(cfg); setTenure(cfg.tenures[1] || 6);
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subtotal = cart.items.reduce((s: number, it: any) => s + it.product.price * it.qty, 0);

  const refreshEmi = useCallback(async () => {
    if (!config || subtotal <= 0) return;
    const c = await api(`/emi/calculate?price=${subtotal}&tenure=${tenure}`);
    setEmiCalc(c);
  }, [config, subtotal, tenure, api]);

  useFocusEffect(useCallback(() => { refreshEmi(); }, [refreshEmi]));

  const place = async () => {
    setErr(null); setBusy(true);
    try {
      const items = cart.items.map((it: any) => ({ product_id: it.product.id, qty: it.qty }));
      const order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({ items, address: addr, payment_method: payment, emi_tenure: payment === 'emi' ? tenure : null }),
      });
      router.replace(`/order/${order.id}`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const emiEligible = emiCalc?.eligible;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="checkout-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Text style={styles.title}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 160 }}>
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        <TextInput
          testID="address-input"
          placeholder="123 Main St, City, ZIP"
          placeholderTextColor={colors.textMuted}
          style={styles.textarea}
          multiline
          value={addr}
          onChangeText={setAddr}
        />

        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.payRow}>
          <Pressable testID="pay-full" style={[styles.payOpt, payment === 'full' && styles.payOptActive]} onPress={() => setPayment('full')}>
            <Ionicons name="card" size={22} color={payment === 'full' ? colors.black : colors.text} />
            <Text style={[styles.payOptTitle, payment === 'full' && { color: colors.black }]}>Pay in Full</Text>
            <Text style={[styles.payOptSub, payment === 'full' && { color: colors.black }]}>Mock payment</Text>
          </Pressable>
          <Pressable testID="pay-emi" style={[styles.payOpt, payment === 'emi' && styles.payOptActive]} onPress={() => setPayment('emi')}>
            <Ionicons name="calendar" size={22} color={payment === 'emi' ? colors.black : colors.text} />
            <Text style={[styles.payOptTitle, payment === 'emi' && { color: colors.black }]}>EMI Plan</Text>
            <Text style={[styles.payOptSub, payment === 'emi' && { color: colors.black }]}>3-12 months</Text>
          </Pressable>
        </View>

        {payment === 'emi' && (
          <View style={styles.emiBox}>
            {!emiEligible ? (
              <Text style={styles.emiWarn}>Minimum order ${emiCalc?.threshold} required for EMI</Text>
            ) : (
              <>
                <Text style={styles.emiSub}>Select tenure</Text>
                <View style={styles.tenureRow}>
                  {config?.tenures.map((t: number) => (
                    <Pressable testID={`co-tenure-${t}`} key={t} style={[styles.tenureBtn, tenure === t && styles.tenureBtnActive]} onPress={() => setTenure(t)}>
                      <Text style={[styles.tenureText, tenure === t && styles.tenureTextActive]}>{t}m</Text>
                    </Pressable>
                  ))}
                </View>
                {emiCalc && (
                  <View style={styles.emiSummary}>
                    <Row label="Monthly" value={`$${emiCalc.monthly.toFixed(2)}`} bold />
                    <Row label={`Total (${tenure} months)`} value={`$${emiCalc.total.toFixed(2)}`} />
                    <Row label={`Interest @ ${emiCalc.interest_rate}%`} value={`$${(emiCalc.total - subtotal).toFixed(2)}`} warn />
                  </View>
                )}
              </>
            )}
          </View>
        )}

        <View style={styles.summary}>
          <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
          <Row label="Delivery" value="Free" />
          <View style={styles.divider} />
          <Row label="Total" value={`$${subtotal.toFixed(2)}`} bold />
        </View>

        {err && <Text testID="checkout-err" style={styles.err}>{err}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        <Pressable
          testID="place-order-btn"
          style={[styles.placeBtn, (!addr || busy || cart.items.length === 0) && { opacity: 0.4 }]}
          disabled={!addr || busy || cart.items.length === 0}
          onPress={place}
        >
          {busy ? <ActivityIndicator color={colors.black} /> : <Text style={styles.placeBtnText}>Place Order</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, bold, warn }: any) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { color: colors.text, fontWeight: '700' }]}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontSize: fs.xl }, warn && { color: colors.warning }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  sectionTitle: { color: colors.textDim, fontSize: fs.sm, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.md },
  textarea: { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, padding: spacing.md, minHeight: 80 },
  payRow: { flexDirection: 'row', gap: spacing.md },
  payOpt: { flex: 1, alignItems: 'center', padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  payOptActive: { backgroundColor: colors.white, borderColor: colors.white },
  payOptTitle: { color: colors.text, fontWeight: '700', marginTop: 4 },
  payOptSub: { color: colors.textDim, fontSize: fs.sm },
  emiBox: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold },
  emiWarn: { color: colors.warning, fontWeight: '600' },
  emiSub: { color: colors.textDim, marginBottom: spacing.sm },
  tenureRow: { flexDirection: 'row', gap: spacing.sm },
  tenureBtn: { flex: 1, height: 44, borderRadius: radius.md, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  tenureBtnActive: { backgroundColor: colors.white, borderColor: colors.white },
  tenureText: { color: colors.textDim, fontWeight: '700' },
  tenureTextActive: { color: colors.black },
  emiSummary: { marginTop: spacing.md, gap: spacing.xs },
  summary: { marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel: { color: colors.textDim },
  rowValue: { color: colors.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  err: { color: colors.error, marginTop: spacing.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.bg2, borderTopWidth: 1, borderTopColor: colors.border },
  placeBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  placeBtnText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
});
