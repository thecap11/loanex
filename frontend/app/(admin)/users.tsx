import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAlert } from '@/src/context/AlertContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { getCreditRating, calculateEmi } from '@/src/lib/emi';
import { creditService } from '@/src/services/creditService';

export default function AdminCustomers() {
  const insets = useSafeAreaInsets();
  const { toast } = useAlert();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ custom_down_payment_pct: '', custom_interest_rate: '', custom_max_tenure: '24', custom_processing_fee: '499' });

  const load = useCallback(async () => {
    try { setCustomers(await creditService.getAllCustomers()); } catch (e) {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCustomer = (c: any) => {
    setSelected(c);
    setForm({
      custom_down_payment_pct: c.custom_down_payment_pct ? String(c.custom_down_payment_pct) : '',
      custom_interest_rate: c.custom_interest_rate ? String(c.custom_interest_rate) : '',
      custom_max_tenure: c.custom_max_tenure ? String(c.custom_max_tenure) : '24',
      custom_processing_fee: c.custom_processing_fee ? String(c.custom_processing_fee) : '499',
    });
  };

  const handleSave = async () => {
    try {
      await creditService.updateCustomerEmiTerms(selected.user_id, {
        custom_down_payment_pct: form.custom_down_payment_pct ? Number(form.custom_down_payment_pct) : null,
        custom_interest_rate: form.custom_interest_rate ? Number(form.custom_interest_rate) : null,
        custom_max_tenure: Number(form.custom_max_tenure) || 24,
        custom_processing_fee: Number(form.custom_processing_fee) || 499,
      });
      toast('Custom EMI terms saved', 'success');
      setSelected(null);
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const previewEmi = (() => {
    const dp = form.custom_down_payment_pct ? 50000 * Number(form.custom_down_payment_pct) / 100 : 5000;
    const rate = form.custom_interest_rate ? Number(form.custom_interest_rate) : 14;
    const months = Number(form.custom_max_tenure) || 24;
    const principal = 50000 - dp;
    const monthly = calculateEmi(principal, rate, months);
    const totalPayable = monthly * months + dp;
    const totalInterest = monthly * months - principal;
    return { monthly, totalPayable, totalInterest };
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>Customers</Text>
        <Pressable onPress={() => { setLoading(true); load(); }}><Ionicons name="refresh" size={20} color={colors.primaryLight} /></Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>
      ) : customers.length === 0 ? (
        <View style={styles.empty}><Ionicons name="people-outline" size={72} color={colors.textMuted} /><Text style={styles.emptyText}>No customers yet</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
          {customers.map((c) => {
            const rating = getCreditRating(c.cibil_score);
            return (
              <Pressable key={c.user_id} style={styles.card} onPress={() => openCustomer(c)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.custName}>{c.full_name || c.email}</Text>
                  <Text style={styles.custEmail}>{c.email}</Text>
                  <Text style={styles.custPhone}>{c.mobile}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.scoreBadge, { backgroundColor: rating.color + '20' }]}>
                      <Text style={[styles.scoreText, { color: rating.color }]}>{c.cibil_score} CIBIL</Text>
                    </View>
                    <View style={[styles.kycBadge, { backgroundColor: c.kyc_status === 'VERIFIED' ? colors.success + '20' : colors.warning + '20' }]}>
                      <Text style={[styles.kycText, { color: c.kyc_status === 'VERIFIED' ? colors.success : colors.warning }]}>{c.kyc_status}</Text>
                    </View>
                  </View>
                  {(c.custom_down_payment_pct || c.custom_interest_rate) && (
                    <View style={styles.overrideRow}>
                      {c.custom_down_payment_pct && <Text style={styles.overrideTag}>DP: {c.custom_down_payment_pct}%</Text>}
                      {c.custom_interest_rate && <Text style={styles.overrideTag}>Rate: {c.custom_interest_rate}%</Text>}
                      {c.custom_max_tenure && <Text style={styles.overrideTag}>Max: {c.custom_max_tenure}mo</Text>}
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Custom EMI Override Modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Custom EMI Override</Text>
            {selected && (
              <View style={styles.modalInfo}>
                <Text style={styles.modalInfoText}>{selected.full_name || selected.email}</Text>
                <Text style={styles.modalInfoText}>CIBIL: {selected.cibil_score}</Text>
              </View>
            )}
            <Text style={styles.modalLabel}>Down Payment %</Text>
            <TextInput style={styles.modalInput} value={form.custom_down_payment_pct} onChangeText={(t) => setForm({ ...form, custom_down_payment_pct: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
            <Text style={styles.modalLabel}>Interest Rate % (annual)</Text>
            <TextInput style={styles.modalInput} value={form.custom_interest_rate} onChangeText={(t) => setForm({ ...form, custom_interest_rate: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
            <Text style={styles.modalLabel}>Max Tenure Months</Text>
            <TextInput style={styles.modalInput} value={form.custom_max_tenure} onChangeText={(t) => setForm({ ...form, custom_max_tenure: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
            <Text style={styles.modalLabel}>Processing Fee ₹</Text>
            <TextInput style={styles.modalInput} value={form.custom_processing_fee} onChangeText={(t) => setForm({ ...form, custom_processing_fee: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />

            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Preview (₹50,000 product)</Text>
              <View style={styles.previewRow}><Text style={styles.previewLabel}>Monthly EMI</Text><Text style={styles.previewVal}>{formatINR(previewEmi.monthly)}</Text></View>
              <View style={styles.previewRow}><Text style={styles.previewLabel}>Total Payable</Text><Text style={styles.previewVal}>{formatINR(previewEmi.totalPayable)}</Text></View>
              <View style={styles.previewRow}><Text style={styles.previewLabel}>Total Interest</Text><Text style={styles.previewVal}>{formatINR(previewEmi.totalInterest)}</Text></View>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setSelected(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave}><Text style={styles.saveText}>Save Terms</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  custName: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  custEmail: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  custPhone: { color: colors.textMuted, fontSize: fs.sm },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  scoreText: { fontSize: 10, fontWeight: '700' },
  kycBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  kycText: { fontSize: 10, fontWeight: '700' },
  overrideRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  overrideTag: { color: colors.accent, fontSize: 10, fontWeight: '600', backgroundColor: colors.accent + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, maxHeight: '85%' },
  modalTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700', marginBottom: spacing.md },
  modalInfo: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, gap: 4 },
  modalInfoText: { color: colors.textDim, fontSize: fs.sm },
  modalLabel: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600', marginBottom: 4 },
  modalInput: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 46, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  previewCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginVertical: spacing.md },
  previewTitle: { color: colors.cyan, fontSize: fs.sm, fontWeight: '700', marginBottom: spacing.sm },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  previewLabel: { color: colors.textDim, fontSize: fs.sm },
  previewVal: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.textDim, fontWeight: '700' },
  saveBtn: { flex: 2, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.white, fontWeight: '700' },
});
