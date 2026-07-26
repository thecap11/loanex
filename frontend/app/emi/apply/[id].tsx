import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

export default function EmiApply() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [credit, setCredit] = useState<any>(null);
  const [tenure, setTenure] = useState<number>(6);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [emiCalc, setEmiCalc] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [p, cfg, addrs, cr] = await Promise.all([
        api(`/products/${id}`),
        api('/emi/config'),
        api('/addresses'),
        api('/credit/profile'),
      ]);
      setProduct(p); setConfig(cfg); setAddresses(addrs); setCredit(cr);
      setTenure(cfg.tenures[1] || 6);
      const def = addrs.find((a: any) => a.is_default);
      if (def) setAddressId(def.id);
      else if (addrs.length > 0) setAddressId(addrs[0].id);
    })();
  }, [id]);

  useEffect(() => {
    if (!product) return;
    (async () => setEmiCalc(await api(`/emi/calculate?price=${product.price}&tenure=${tenure}`)))();
  }, [product, tenure]);

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      if (!addressId) throw new Error('Please select an address');
      const r = await api('/emi/apply', {
        method: 'POST',
        body: JSON.stringify({ product_id: id, qty: 1, tenure_months: tenure, address_id: addressId }),
      });
      router.replace(`/emi/${r.id}`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!product || !config || !emiCalc) return <View style={styles.center}><ActivityIndicator color={colors.white} /></View>;

  const affordable = product.price <= (credit?.available_limit || 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="apply-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Text style={styles.title}>Apply for EMI</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 160 }}>
        {/* Product summary */}
        <View style={styles.productRow}>
          <Image source={{ uri: product.image }} style={styles.pimg} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.pbrand}>{product.brand}</Text>
            <Text style={styles.pname}>{product.name}</Text>
            <Text style={styles.pprice}>{formatINR(product.price)}</Text>
          </View>
        </View>

        {/* Credit check */}
        <View style={[styles.creditBox, { borderColor: affordable ? colors.success : colors.error }]}>
          <Ionicons name={affordable ? 'checkmark-circle' : 'alert-circle'} size={20} color={affordable ? colors.success : colors.error} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.creditTitle}>Credit Score: {credit?.credit_score}</Text>
            <Text style={styles.creditSub}>Available limit: {formatINR(credit?.available_limit || 0)}</Text>
            {!affordable && <Text style={styles.creditErr}>Order exceeds your available limit</Text>}
          </View>
        </View>

        {/* Tenure */}
        <Text style={styles.section}>Select Tenure</Text>
        <View style={styles.tenureRow}>
          {config.tenures.map((t: number) => (
            <Pressable testID={`apply-tenure-${t}`} key={t} style={[styles.tBtn, tenure === t && styles.tBtnActive]} onPress={() => setTenure(t)}>
              <Text style={[styles.tText, tenure === t && { color: colors.black }]}>{t}</Text>
              <Text style={[styles.tSub, tenure === t && { color: colors.black }]}>months</Text>
            </Pressable>
          ))}
        </View>

        {/* Financial summary */}
        <Text style={styles.section}>Financial Summary</Text>
        <View style={styles.summary}>
          <Row label="Product Price" value={formatINR(product.price)} />
          <Row label="Down Payment (20%)" value={formatINR(emiCalc.down_payment)} accent />
          <Row label="Loan Principal" value={formatINR(emiCalc.principal)} />
          <Row label={`Interest @ ${emiCalc.interest_rate}% APR`} value={formatINR(emiCalc.total_interest)} warn />
          <Row label="Processing Fee" value={formatINR(emiCalc.processing_fee)} />
          <View style={styles.divider} />
          <Row label="Monthly EMI" value={formatINR(emiCalc.monthly)} bold />
          <Row label="Total Payable" value={formatINR(emiCalc.total_payable)} />
        </View>

        {/* Address */}
        <View style={styles.addressHeader}>
          <Text style={styles.section}>Delivery Address</Text>
          <Pressable testID="add-addr-btn" onPress={() => router.push('/addresses')}>
            <Text style={styles.addNew}>+ Add new</Text>
          </Pressable>
        </View>
        {addresses.length === 0 ? (
          <Pressable style={styles.noAddrBox} onPress={() => router.push('/addresses')}>
            <Ionicons name="location-outline" size={22} color={colors.textDim} />
            <Text style={styles.noAddrText}>Add a delivery address to continue</Text>
          </Pressable>
        ) : addresses.map((a) => (
          <Pressable testID={`addr-opt-${a.id}`} key={a.id} style={[styles.addrCard, addressId === a.id && styles.addrCardActive]} onPress={() => setAddressId(a.id)}>
            <View style={[styles.radio, addressId === a.id && styles.radioOn]}>{addressId === a.id && <View style={styles.radioDot} />}</View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <View style={styles.addrTop}>
                <Text style={styles.addrLabel}>{a.label}</Text>
                <Text style={styles.addrName}>{a.full_name}</Text>
              </View>
              <Text style={styles.addrLine}>{a.line1}, {a.city} - {a.pincode}</Text>
            </View>
          </Pressable>
        ))}

        {err && <Text style={styles.err}>{err}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        <Pressable
          testID="submit-apply-btn"
          style={[styles.submitBtn, (!addressId || !affordable || busy) && { opacity: 0.4 }]}
          disabled={!addressId || !affordable || busy}
          onPress={submit}
        >
          {busy ? <ActivityIndicator color={colors.black} /> : (
            <>
              <Text style={styles.submitText}>Submit EMI Application</Text>
              <Text style={styles.submitSub}>Awaiting admin approval</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value, bold, warn, accent }: any) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { color: colors.text, fontWeight: '700' }]}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontSize: fs.xl, color: colors.gold }, warn && { color: colors.warning }, accent && { color: colors.gold }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  productRow: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  pimg: { width: 70, height: 70, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  pbrand: { color: colors.gold, fontSize: fs.sm, fontWeight: '700' },
  pname: { color: colors.text, fontWeight: '700', marginTop: 2 },
  pprice: { color: colors.text, marginTop: 4, fontWeight: '700' },
  creditBox: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1 },
  creditTitle: { color: colors.text, fontWeight: '700' },
  creditSub: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  creditErr: { color: colors.error, fontSize: fs.sm, marginTop: 4, fontWeight: '600' },
  section: { color: colors.textDim, fontSize: fs.sm, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  tenureRow: { flexDirection: 'row', gap: spacing.sm },
  tBtn: { flex: 1, height: 64, borderRadius: radius.md, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tBtnActive: { backgroundColor: colors.white, borderColor: colors.white },
  tText: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  tSub: { color: colors.textDim, fontSize: fs.sm },
  summary: { padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel: { color: colors.textDim },
  rowValue: { color: colors.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addNew: { color: colors.gold, fontWeight: '700', marginTop: spacing.xl },
  noAddrBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  noAddrText: { color: colors.textDim, flex: 1 },
  addrCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  addrCardActive: { borderColor: colors.gold },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.gold },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold },
  addrTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'baseline' },
  addrLabel: { color: colors.gold, fontSize: fs.sm, fontWeight: '700' },
  addrName: { color: colors.text, fontWeight: '600' },
  addrLine: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  err: { color: colors.error, marginTop: spacing.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.bg2, borderTopWidth: 1, borderTopColor: colors.border },
  submitBtn: { minHeight: 54, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  submitText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
  submitSub: { color: colors.black, fontSize: fs.sm, opacity: 0.7, marginTop: 2 },
});
