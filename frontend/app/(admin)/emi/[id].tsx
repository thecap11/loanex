import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

export default function AdminEmiDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [app, setApp] = useState<any>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Editable schema state
  const [notes, setNotes] = useState('');
  const [rate, setRate] = useState('');
  const [dp, setDp] = useState('');
  const [fee, setFee] = useState('');
  const [charges, setCharges] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);

  const load = useCallback(async () => {
    const a = await api(`/admin/emi/applications/${id}`);
    setApp(a);
    setRate(String(a.interest_rate));
    setDp(String(a.down_payment));
    setFee(String(a.processing_fee));
    setCharges(a.custom_charges || []);
  }, [api, id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const recompute = () => {
    if (!app) return;
    const price = app.total_price;
    const dpAmt = parseFloat(dp) || 0;
    const principal = Math.max(0, price - dpAmt);
    const r = (parseFloat(rate) || 0) / 12 / 100;
    const n = app.tenure_months;
    let monthly = r === 0 ? principal / n : principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    const chargesTotal = charges.reduce((s, c) => s + (c.type === 'percent' ? price * (parseFloat(c.amount) || 0) / 100 : (parseFloat(c.amount) || 0)), 0);
    const totalPay = dpAmt + monthly * n + (parseFloat(fee) || 0) + chargesTotal;
    setPreview({ monthly: monthly.toFixed(2), total_interest: (monthly * n - principal).toFixed(2), charges_total: chargesTotal.toFixed(2), total_payable: totalPay.toFixed(2), principal: principal.toFixed(2) });
  };

  const addCharge = () => setCharges([...charges, { label: 'New Charge', amount: 0, type: 'fixed' }]);
  const removeCharge = (i: number) => setCharges(charges.filter((_, idx) => idx !== i));
  const updateCharge = (i: number, key: string, val: any) => {
    const next = [...charges]; next[i] = { ...next[i], [key]: val }; setCharges(next);
  };

  const doSanction = async () => {
    setBusy(true); setMsg(null);
    try {
      await api(`/admin/emi/applications/${id}/sanction`, {
        method: 'POST',
        body: JSON.stringify({
          notes,
          interest_rate: parseFloat(rate),
          down_payment_amount: parseFloat(dp),
          processing_fee: parseFloat(fee),
          custom_charges: charges.map((c) => ({ label: c.label, amount: parseFloat(c.amount) || 0, type: c.type })),
        }),
      });
      setMsg('Sanctioned successfully');
      setTimeout(() => router.back(), 1000);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const doReject = async () => {
    setBusy(true);
    try {
      await api(`/admin/emi/applications/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason || 'Rejected' }) });
      setRejectOpen(false); router.back();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  if (!app) return <View style={styles.center}><ActivityIndicator color={colors.white} /></View>;

  const editable = app.status === 'pending';
  const tierColor = (s: number) => s >= 750 ? colors.info : s >= 650 ? colors.success : s >= 500 ? colors.warning : colors.error;
  const kyc = app.user_kyc || {};

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="admin-emi-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Text style={styles.title}>Application #{app.id.slice(0, 8).toUpperCase()}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: editable ? 200 : 100 }}>
        <View style={[styles.statusPill, { backgroundColor: app.status === 'pending' ? colors.warning + '22' : app.status === 'sanctioned' ? colors.info + '22' : app.status === 'rejected' ? colors.error + '22' : colors.success + '22', borderColor: app.status === 'pending' ? colors.warning : app.status === 'sanctioned' ? colors.info : app.status === 'rejected' ? colors.error : colors.success }]}>
          <Text style={[styles.statusText, { color: app.status === 'pending' ? colors.warning : app.status === 'sanctioned' ? colors.info : app.status === 'rejected' ? colors.error : colors.success }]}>{app.status.toUpperCase()}</Text>
          {app.admin_edited && <Text style={styles.edited}>• Edited by admin</Text>}
        </View>

        {/* Customer profile */}
        <Text style={styles.section}>Customer Profile</Text>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{app.user_name?.[0]?.toUpperCase()}</Text></View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.userName}>{app.user_name}</Text>
              <Text style={styles.userMeta}>{app.user_email}</Text>
              {(app.user_phone || app.user_current?.phone) && <Text style={styles.userMeta}>📱 {app.user_phone || app.user_current.phone}</Text>}
            </View>
            <View style={[styles.scoreCard, { borderColor: tierColor(app.user_score) }]}>
              <Text style={[styles.scoreVal, { color: tierColor(app.user_score) }]}>{app.user_score}</Text>
              <Text style={styles.scoreLabel}>CIBIL</Text>
            </View>
          </View>
          <View style={styles.limitGrid}>
            <View style={styles.limitBox}><Text style={styles.dim}>Approved</Text><Text style={styles.limitVal}>{formatINR(app.user_approved_limit || 0)}</Text></View>
            <View style={styles.limitBox}><Text style={styles.dim}>Available</Text><Text style={[styles.limitVal, { color: colors.success }]}>{formatINR(app.user_current?.available_limit ?? app.user_available_limit ?? 0)}</Text></View>
            <View style={styles.limitBox}><Text style={styles.dim}>Used</Text><Text style={[styles.limitVal, { color: colors.warning }]}>{formatINR(app.user_current?.used_limit ?? app.user_used_limit ?? 0)}</Text></View>
          </View>
          {app.user_stats && (
            <View style={styles.statsRow}>
              <Text style={styles.stat}>✓ {app.user_stats.completed_emis} completed</Text>
              <Text style={styles.stat}>⚡ {app.user_stats.active_emis} active</Text>
              <Text style={[styles.stat, { color: colors.error }]}>✗ {app.user_stats.rejected_emis} rejected</Text>
            </View>
          )}
        </View>

        {/* KYC */}
        <Text style={styles.section}>KYC Details</Text>
        <View style={styles.card}>
          {kyc.aadhar || kyc.pan ? (
            <>
              <KV k="Aadhar" v={kyc.aadhar ? `XXXX-XXXX-${String(kyc.aadhar).slice(-4)}` : '—'} />
              <KV k="PAN" v={kyc.pan || '—'} />
              <KV k="Housing" v={(kyc.housing_type || '—').replace('_', ' ')} />
              <KV k="Monthly Income" v={kyc.monthly_income ? formatINR(kyc.monthly_income) : '—'} accent />
              {kyc.employer && <KV k="Employer" v={kyc.employer} />}
              <KV k="Verified" v={kyc.status === 'verified' ? '✓ Yes' : '⚠ No'} />
            </>
          ) : (
            <Text style={styles.emptyKyc}>No KYC data on file</Text>
          )}
        </View>

        {/* Product */}
        <Text style={styles.section}>Product</Text>
        <View style={styles.productRow}>
          <Image source={{ uri: app.product.image }} style={styles.pimg} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.pbrand}>{app.product.brand}</Text>
            <Text style={styles.pname}>{app.product.name}</Text>
            <Text style={styles.pprice}>{formatINR(app.total_price)} • Qty {app.qty} • {app.tenure_months} months</Text>
          </View>
        </View>

        {/* Address */}
        <Text style={styles.section}>Delivery Address</Text>
        <View style={styles.card}>
          <Text style={styles.addrLabel}>{app.address.label}</Text>
          <Text style={styles.addrName}>{app.address.full_name} • {app.address.phone}</Text>
          <Text style={styles.addrLine}>{app.address.line1}{app.address.line2 ? `, ${app.address.line2}` : ''}</Text>
          <Text style={styles.addrLine}>{app.address.city}, {app.address.state} - {app.address.pincode}</Text>
        </View>

        {/* Editable EMI schema */}
        <Text style={styles.section}>EMI Schema {editable && <Text style={styles.editHint}>(editable)</Text>}</Text>
        <View style={styles.card}>
          <Field label="Interest Rate (% APR)" value={rate} onChange={setRate} disabled={!editable} kb="decimal-pad" tid="edit-rate" />
          <Field label="Down Payment (₹)" value={dp} onChange={setDp} disabled={!editable} kb="decimal-pad" tid="edit-dp" />
          <Field label="Processing Fee (₹)" value={fee} onChange={setFee} disabled={!editable} kb="decimal-pad" tid="edit-fee" />

          {/* Custom charges */}
          <View style={styles.chargesHeader}>
            <Text style={styles.chargesTitle}>Custom Charges</Text>
            {editable && (
              <Pressable testID="add-charge-btn" onPress={addCharge} style={styles.addChargeBtn}>
                <Ionicons name="add" size={14} color={colors.black} />
                <Text style={styles.addChargeText}>Add</Text>
              </Pressable>
            )}
          </View>
          {charges.length === 0 ? (
            <Text style={styles.noCharges}>No custom charges</Text>
          ) : charges.map((c, i) => (
            <View testID={`charge-${i}`} key={i} style={styles.chargeRow}>
              <TextInput
                testID={`charge-label-${i}`}
                value={c.label}
                onChangeText={(v) => updateCharge(i, 'label', v)}
                editable={editable}
                placeholder="Label"
                placeholderTextColor={colors.textMuted}
                style={[styles.chargeInput, { flex: 2 }]}
              />
              <TextInput
                testID={`charge-amt-${i}`}
                value={String(c.amount)}
                onChangeText={(v) => updateCharge(i, 'amount', v)}
                editable={editable}
                keyboardType="decimal-pad"
                style={[styles.chargeInput, { flex: 1 }]}
              />
              <Pressable
                testID={`charge-type-${i}`}
                disabled={!editable}
                onPress={() => updateCharge(i, 'type', c.type === 'fixed' ? 'percent' : 'fixed')}
                style={styles.typeToggle}
              >
                <Text style={styles.typeText}>{c.type === 'percent' ? '%' : '₹'}</Text>
              </Pressable>
              {editable && (
                <Pressable testID={`charge-del-${i}`} onPress={() => removeCharge(i)} style={styles.delChargeBtn}>
                  <Ionicons name="trash" size={14} color={colors.error} />
                </Pressable>
              )}
            </View>
          ))}

          {editable && (
            <Pressable testID="recompute-btn" style={styles.recomputeBtn} onPress={recompute}>
              <Ionicons name="calculator-outline" size={16} color={colors.gold} />
              <Text style={styles.recomputeText}>Preview Recalculated EMI</Text>
            </Pressable>
          )}

          {preview && (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>Preview</Text>
              <View style={styles.previewRow}><Text style={styles.dim}>Monthly EMI</Text><Text style={styles.previewVal}>{formatINR(parseFloat(preview.monthly))}</Text></View>
              <View style={styles.previewRow}><Text style={styles.dim}>Interest</Text><Text style={styles.previewVal}>{formatINR(parseFloat(preview.total_interest))}</Text></View>
              <View style={styles.previewRow}><Text style={styles.dim}>Extra Charges</Text><Text style={styles.previewVal}>{formatINR(parseFloat(preview.charges_total))}</Text></View>
              <View style={styles.previewRow}><Text style={styles.dim}>Total Payable</Text><Text style={[styles.previewVal, { color: colors.gold, fontSize: fs.lg }]}>{formatINR(parseFloat(preview.total_payable))}</Text></View>
            </View>
          )}
        </View>

        {/* Sanction notes */}
        {editable && (
          <>
            <Text style={styles.section}>Sanction Notes (optional)</Text>
            <TextInput
              testID="sanction-notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g., Approved based on strong credit profile with rate reduction"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.notesInput}
            />
          </>
        )}

        {msg && <Text style={[styles.msg, msg.includes('successfully') ? { color: colors.success } : { color: colors.error }]}>{msg}</Text>}
      </ScrollView>

      {editable && (
        <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
          <Pressable testID="reject-btn" style={styles.rejectBtn} onPress={() => { setReason(notes); setRejectOpen(true); }} disabled={busy}>
            <Ionicons name="close" size={18} color={colors.error} />
            <Text style={styles.rejectText}>Reject</Text>
          </Pressable>
          <Pressable testID="sanction-btn" style={styles.sanctionBtn} onPress={doSanction} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.black} /> : (
              <>
                <Ionicons name="checkmark" size={18} color={colors.black} />
                <Text style={styles.sanctionText}>Sanction</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      <Modal visible={rejectOpen} transparent animationType="slide" onRequestClose={() => setRejectOpen(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.modalTitle}>Reject Application</Text>
            <Text style={styles.modalSub}>Reason will be shown to the customer</Text>
            <TextInput
              testID="reject-reason"
              value={reason}
              onChangeText={setReason}
              placeholder="e.g., Income proof insufficient"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.notesInput}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
              <Pressable style={styles.cancelBtn} onPress={() => setRejectOpen(false)}><Text style={{ color: colors.text }}>Cancel</Text></Pressable>
              <Pressable testID="reject-confirm" style={styles.confirmReject} onPress={doReject} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmRejectText}>Confirm Reject</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, disabled, kb, tid }: any) {
  return (
    <>
      <Text style={styles.fLabel}>{label}</Text>
      <TextInput
        testID={tid}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        keyboardType={kb || 'default'}
        style={[styles.fInput, disabled && { opacity: 0.6 }]}
        placeholderTextColor={colors.textMuted}
      />
    </>
  );
}

function KV({ k, v, accent }: any) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvVal, accent && { color: colors.gold, fontWeight: '700' }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, marginBottom: spacing.md },
  statusText: { fontSize: fs.sm, fontWeight: '700', letterSpacing: 2 },
  edited: { color: colors.gold, fontSize: 10, fontWeight: '700' },
  section: { color: colors.textDim, fontSize: fs.sm, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  editHint: { color: colors.gold, textTransform: 'none' },
  card: { backgroundColor: colors.bg2, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontWeight: '700', fontSize: fs.lg },
  userName: { color: colors.text, fontWeight: '700', fontSize: fs.base },
  userMeta: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  scoreCard: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  scoreVal: { fontWeight: '700', fontSize: fs.xl },
  scoreLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 1 },
  limitGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  limitBox: { flex: 1, padding: spacing.sm, backgroundColor: colors.bg3, borderRadius: radius.sm },
  dim: { color: colors.textDim, fontSize: fs.sm },
  limitVal: { color: colors.text, fontWeight: '700', marginTop: 2, fontSize: fs.base },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  stat: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  emptyKyc: { color: colors.textDim, textAlign: 'center', fontStyle: 'italic' },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.divider },
  kvKey: { color: colors.textDim },
  kvVal: { color: colors.text, fontWeight: '600' },
  productRow: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  pimg: { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  pbrand: { color: colors.gold, fontSize: fs.sm, fontWeight: '700' },
  pname: { color: colors.text, fontWeight: '700', marginTop: 2 },
  pprice: { color: colors.text, marginTop: 4 },
  addrLabel: { color: colors.gold, fontSize: fs.sm, fontWeight: '700' },
  addrName: { color: colors.text, fontWeight: '600', marginTop: 4 },
  addrLine: { color: colors.textDim, marginTop: 2 },
  fLabel: { color: colors.textDim, fontSize: fs.sm, marginTop: spacing.md, marginBottom: 6 },
  fInput: { backgroundColor: colors.bg3, borderRadius: radius.md, padding: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: fs.base },
  chargesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg },
  chargesTitle: { color: colors.text, fontWeight: '700' },
  addChargeBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.gold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  addChargeText: { color: colors.black, fontWeight: '700', fontSize: fs.sm },
  noCharges: { color: colors.textMuted, fontSize: fs.sm, fontStyle: 'italic', marginTop: spacing.sm },
  chargeRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: spacing.sm },
  chargeInput: { backgroundColor: colors.bg3, borderRadius: radius.sm, padding: 8, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: fs.sm },
  typeToggle: { width: 36, height: 36, backgroundColor: colors.bg3, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  typeText: { color: colors.text, fontWeight: '700' },
  delChargeBtn: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center' },
  recomputeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold },
  recomputeText: { color: colors.gold, fontWeight: '700', fontSize: fs.sm },
  previewBox: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.bg3, borderRadius: radius.md, borderLeftWidth: 3, borderLeftColor: colors.gold },
  previewTitle: { color: colors.gold, fontSize: fs.sm, fontWeight: '700', marginBottom: 4 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  previewVal: { color: colors.text, fontWeight: '700' },
  notesInput: { backgroundColor: colors.bg2, borderRadius: radius.md, padding: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 80 },
  msg: { textAlign: 'center', marginTop: spacing.md, fontWeight: '600' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.bg2, borderTopWidth: 1, borderTopColor: colors.border },
  rejectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 50, paddingHorizontal: spacing.xl, borderWidth: 1, borderColor: colors.error, borderRadius: radius.md },
  rejectText: { color: colors.error, fontWeight: '700', fontSize: fs.base },
  sanctionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 50, backgroundColor: colors.white, borderRadius: radius.md },
  sanctionText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl },
  modalTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  modalSub: { color: colors.textDim, marginTop: 4, marginBottom: spacing.md },
  cancelBtn: { flex: 1, height: 46, borderRadius: radius.md, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center' },
  confirmReject: { flex: 1, height: 46, borderRadius: radius.md, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  confirmRejectText: { color: colors.white, fontWeight: '700' },
});
