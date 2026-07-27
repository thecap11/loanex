import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { useAlert } from '@/src/context/AlertContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { calculateEmi, generateCaseId } from '@/src/lib/emi';
import { productService } from '@/src/services/productService';
import { creditService } from '@/src/services/creditService';
import { emiService } from '@/src/services/emiService';
import { addressService } from '@/src/services/addressService';
import { notificationService } from '@/src/services/notificationService';

export default function EmiApply() {
  const { id, tenure: tenureParam } = useLocalSearchParams<{ id: string; tenure?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { toast } = useAlert();

  const [product, setProduct] = useState<any>(null);
  const [credit, setCredit] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [existingApp, setExistingApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tenure, setTenure] = useState(Number(tenureParam) || 3);
  const [showKyc, setShowKyc] = useState(false);
  const [kyc, setKyc] = useState({ full_name: '', email: '', gender: '', aadhaar_number: '', pan_number: '', house_no: '', street: '', city: '', pincode: '', state: '', housing_type: '' });

  const load = useCallback(async () => {
    if (!user || !id) return;
    try {
      const [p, cr, addrs, existing] = await Promise.all([
        productService.getProduct(id),
        creditService.getCreditProfile(user.id),
        addressService.getAddresses(user.id),
        emiService.checkExistingApplication(user.id, id),
      ]);
      setProduct(p);
      setCredit(cr);
      setAddresses(addrs);
      setExistingApp(existing);
      if (p?.available_tenures?.length && !tenureParam) setTenure(p.available_tenures[0]);
      const def = addrs.find((a) => a.is_default);
      setSelectedAddr(def?.id || addrs[0]?.id || null);
      setShowKyc(cr?.kyc_status !== 'VERIFIED');
      if (cr) setKyc((prev) => ({ ...prev, full_name: cr.full_name || '', email: cr.email || user.email, house_no: cr.house_no || '', street: cr.street || '', city: cr.city || '', pincode: cr.pincode || '', state: cr.state || '' }));
    } catch (e) {} finally { setLoading(false); }
  }, [user, id, tenureParam]);

  useEffect(() => { load(); }, [load]);

  const emiCalc = useMemo(() => {
    if (!product) return { monthly: 0, totalInterest: 0, totalPayable: 0, principal: 0 };
    const downPmt = credit?.custom_down_payment_pct ? (product.price * credit.custom_down_payment_pct / 100) : product.down_payment;
    const rate = credit?.custom_interest_rate || product.interest_rate || 14;
    const fee = credit?.custom_processing_fee || product.processing_fee || 499;
    const principal = product.price - downPmt;
    const monthly = calculateEmi(principal, rate, tenure);
    const totalPayable = monthly * tenure + downPmt + fee;
    const totalInterest = monthly * tenure - principal;
    return { monthly, totalInterest, totalPayable, principal, downPmt, rate, fee };
  }, [product, credit, tenure]);

  const handleSaveKyc = async () => {
    if (!kyc.full_name || !kyc.email || !kyc.aadhaar_number || !kyc.pan_number || !kyc.house_no || !kyc.street || !kyc.city || !kyc.pincode || !kyc.state || !kyc.housing_type) {
      toast('Fill all KYC fields', 'error'); return;
    }
    if (kyc.aadhaar_number.length !== 12) { toast('Aadhaar must be 12 digits', 'error'); return; }
    if (kyc.pan_number.length !== 10) { toast('PAN must be 10 characters', 'error'); return; }
    try {
      await creditService.updateCustomerProfile(user!.id, kyc);
      toast('KYC verified!', 'success');
      setShowKyc(false);
      setCredit({ ...credit, kyc_status: 'VERIFIED' });
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const handleSubmit = async () => {
    if (!user || !product) return;
    if (!selectedAddr) { toast('Select a delivery address', 'error'); return; }
    const addr = addresses.find((a) => a.id === selectedAddr);
    const shippingText = addr ? `${addr.house_no}, ${addr.street}, ${addr.city}, ${addr.state} ${addr.pincode}` : '';
    setSubmitting(true);
    try {
      await emiService.submitEmiApplication({
        user_id: user.id,
        product_id: product.id,
        product_name: product.name,
        product_image: product.images?.[0] || '',
        product_price: product.price,
        down_payment: emiCalc.downPmt,
        emi_months: tenure,
        monthly_amount: emiCalc.monthly,
        total_amount: emiCalc.totalPayable,
        total_interest: emiCalc.totalInterest,
        interest_rate: emiCalc.rate,
        processing_fee: emiCalc.fee,
        full_name: credit?.full_name || kyc.full_name,
        phone: user.mobile,
        address: shippingText,
        shipping_address: shippingText,
      });
      toast('EMI application submitted!', 'success');
      router.replace('/(customer)/emi');
    } catch (e: any) { toast(e.message, 'error'); } finally { setSubmitting(false); }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>;
  if (!product) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.textDim }}>Product not found</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>EMI Application</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
        {/* Product Brief */}
        <View style={styles.briefCard}>
          <Image source={{ uri: product.images?.[0] }} style={styles.briefImg} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.briefName} numberOfLines={2}>{product.name}</Text>
            <Text style={styles.briefPrice}>{formatINR(product.price)}</Text>
          </View>
        </View>

        {/* Existing Application Warning */}
        {existingApp && (
          <View style={styles.warnBox}>
            <Ionicons name="warning" size={20} color={colors.warning} />
            <Text style={styles.warnText}>You already have an active application for this product.</Text>
          </View>
        )}

        {/* KYC Form */}
        {showKyc && (
          <View style={styles.kycCard}>
            <Text style={styles.kycTitle}>KYC Verification Required</Text>
            <Text style={styles.kycLabel}>Full Name</Text>
            <TextInput style={styles.kycInput} value={kyc.full_name} onChangeText={(t) => setKyc({ ...kyc, full_name: t })} placeholderTextColor={colors.textMuted} />
            <Text style={styles.kycLabel}>Email</Text>
            <TextInput style={styles.kycInput} value={kyc.email} onChangeText={(t) => setKyc({ ...kyc, email: t })} keyboardType="email-address" placeholderTextColor={colors.textMuted} />
            <Text style={styles.kycLabel}>Gender</Text>
            <View style={styles.chipRow}>
              {['Male', 'Female', 'Other'].map((g) => (
                <Pressable key={g} style={[styles.kycChip, kyc.gender === g && styles.kycChipActive]} onPress={() => setKyc({ ...kyc, gender: g })}>
                  <Text style={[styles.kycChipText, kyc.gender === g && styles.kycChipTextActive]}>{g}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.kycLabel}>Aadhaar Number (12 digits)</Text>
            <TextInput style={styles.kycInput} value={kyc.aadhaar_number} onChangeText={(t) => setKyc({ ...kyc, aadhaar_number: t.replace(/[^0-9]/g, '') })} keyboardType="numeric" maxLength={12} placeholderTextColor={colors.textMuted} />
            <Text style={styles.kycLabel}>PAN Number (10 chars)</Text>
            <TextInput style={styles.kycInput} value={kyc.pan_number} onChangeText={(t) => setKyc({ ...kyc, pan_number: t.toUpperCase().slice(0, 10) })} maxLength={10} placeholderTextColor={colors.textMuted} />
            <Text style={styles.kycLabel}>House / Flat No.</Text>
            <TextInput style={styles.kycInput} value={kyc.house_no} onChangeText={(t) => setKyc({ ...kyc, house_no: t })} placeholderTextColor={colors.textMuted} />
            <Text style={styles.kycLabel}>Street / Locality</Text>
            <TextInput style={styles.kycInput} value={kyc.street} onChangeText={(t) => setKyc({ ...kyc, street: t })} placeholderTextColor={colors.textMuted} />
            <Text style={styles.kycLabel}>City</Text>
            <TextInput style={styles.kycInput} value={kyc.city} onChangeText={(t) => setKyc({ ...kyc, city: t })} placeholderTextColor={colors.textMuted} />
            <Text style={styles.kycLabel}>Pincode (6 digits)</Text>
            <TextInput style={styles.kycInput} value={kyc.pincode} onChangeText={(t) => setKyc({ ...kyc, pincode: t.replace(/[^0-9]/g, '') })} keyboardType="numeric" maxLength={6} placeholderTextColor={colors.textMuted} />
            <Text style={styles.kycLabel}>State</Text>
            <TextInput style={styles.kycInput} value={kyc.state} onChangeText={(t) => setKyc({ ...kyc, state: t })} placeholderTextColor={colors.textMuted} />
            <Text style={styles.kycLabel}>Housing Type</Text>
            <View style={styles.chipRow}>
              {['Owned', 'Rented', 'Family', 'PG'].map((h) => (
                <Pressable key={h} style={[styles.kycChip, kyc.housing_type === h && styles.kycChipActive]} onPress={() => setKyc({ ...kyc, housing_type: h })}>
                  <Text style={[styles.kycChipText, kyc.housing_type === h && styles.kycChipTextActive]}>{h}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.saveKycBtn} onPress={handleSaveKyc}>
              <Text style={styles.saveKycText}>Save & Proceed</Text>
            </Pressable>
          </View>
        )}

        {/* Tenure Selection */}
        <Text style={styles.sectionTitle}>Select Tenure</Text>
        <View style={styles.tenureGrid}>
          {(product.available_tenures || [3,6,9,12,18,24]).map((t: number) => (
            <Pressable key={t} style={[styles.tenureChip, tenure === t && styles.tenureChipActive]} onPress={() => setTenure(t)}>
              <Text style={[styles.tenureChipText, tenure === t && styles.tenureChipTextActive]}>{t} mo</Text>
            </Pressable>
          ))}
        </View>

        {/* Financial Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Financial Summary</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Product Price</Text><Text style={styles.summaryVal}>{formatINR(product.price)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Down Payment</Text><Text style={styles.summaryVal}>{formatINR(emiCalc.downPmt)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Financed Principal</Text><Text style={styles.summaryVal}>{formatINR(emiCalc.principal)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Interest Rate</Text><Text style={styles.summaryVal}>{emiCalc.rate}% p.a.</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Processing Fee</Text><Text style={styles.summaryVal}>{formatINR(emiCalc.fee)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Monthly EMI</Text><Text style={[styles.summaryVal, { color: colors.cyan, fontWeight: '700' }]}>{formatINR(emiCalc.monthly)}/mo</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Interest</Text><Text style={styles.summaryVal}>{formatINR(emiCalc.totalInterest)}</Text></View>
          <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }]}>
            <Text style={styles.totalLabel}>Total Payable</Text><Text style={styles.totalVal}>{formatINR(emiCalc.totalPayable)}</Text>
          </View>
        </View>

        {/* Borrower Details */}
        <Text style={styles.sectionTitle}>Borrower Details</Text>
        <View style={styles.borrowerCard}>
          <Text style={styles.borrowerName}>{credit?.full_name || kyc.full_name || 'N/A'}</Text>
          <Text style={styles.borrowerPhone}>{user?.mobile}</Text>
          <Text style={styles.borrowerAddr} numberOfLines={2}>{credit?.house_no}, {credit?.street}, {credit?.city}, {credit?.state} {credit?.pincode}</Text>
        </View>

        {/* Delivery Address Selector */}
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        {addresses.length === 0 ? (
          <Pressable style={styles.addAddrBtn} onPress={() => router.push('/addresses')}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primaryLight} />
            <Text style={styles.addAddrText}>Add Delivery Address</Text>
          </Pressable>
        ) : (
          addresses.map((a) => (
            <Pressable key={a.id} style={[styles.addrCard, selectedAddr === a.id && styles.addrCardActive]} onPress={() => setSelectedAddr(a.id)}>
              <View style={styles.radioOuter}>{selectedAddr === a.id && <View style={styles.radioInner} />}</View>
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

        <Pressable style={[styles.submitBtn, (existingApp || submitting) && { opacity: 0.5 }]} onPress={handleSubmit} disabled={!!existingApp || submitting}>
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Submit EMI Application</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  briefCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  briefImg: { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.surface },
  briefName: { color: colors.text, fontSize: fs.base, fontWeight: '600' },
  briefPrice: { color: colors.accent, fontSize: fs.lg, fontWeight: '700', marginTop: 4 },
  warnBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warning + '15', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.warning + '40' },
  warnText: { color: colors.warning, fontSize: fs.sm, fontWeight: '600', flex: 1 },
  kycCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  kycTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginBottom: spacing.md },
  kycLabel: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600', marginBottom: 4, marginTop: spacing.sm },
  kycInput: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 46, color: colors.text, borderWidth: 1, borderColor: colors.border },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  kycChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  kycChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  kycChipText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  kycChipTextActive: { color: colors.white },
  saveKycBtn: { backgroundColor: colors.primary, borderRadius: radius.md, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  saveKycText: { color: colors.white, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginBottom: spacing.sm, marginTop: spacing.lg },
  tenureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tenureChip: { height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tenureChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tenureChipText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  tenureChipTextActive: { color: colors.white },
  summaryCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  summaryTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { color: colors.textDim, fontSize: fs.sm },
  summaryVal: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  totalLabel: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  totalVal: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  borrowerCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  borrowerName: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  borrowerPhone: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  borrowerAddr: { color: colors.textMuted, fontSize: fs.sm, marginTop: 2 },
  addAddrBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary + '40' },
  addAddrText: { color: colors.primaryLight, fontWeight: '600' },
  addrCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  addrCardActive: { borderColor: colors.primary },
  radioOuter: { width: 20, height: 20, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
  addrTagRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 4 },
  addrTag: { backgroundColor: colors.primary + '20', borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  addrTagText: { color: colors.primaryLight, fontSize: 10, fontWeight: '700' },
  defaultBadge: { color: colors.success, fontSize: 10, fontWeight: '700' },
  addrText: { color: colors.textDim, fontSize: fs.sm },
  submitBtn: { backgroundColor: colors.primary, borderRadius: radius.md, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  submitText: { color: colors.white, fontWeight: '700', fontSize: fs.base },
});
