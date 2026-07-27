import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAlert } from '@/src/context/AlertContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { calculateEmi } from '@/src/lib/emi';
import { emiService } from '@/src/services/emiService';
import { notificationService } from '@/src/services/notificationService';

type Tab = 'All' | 'Pending' | 'Approved' | 'Rejected';
const STATUS_COLORS: Record<string, string> = { PENDING: colors.warning, REVIEW: '#3B82F6', SANCTIONED: colors.cyan, ACTIVE: colors.success, COMPLETED: colors.success, REJECTED: colors.error, EXPIRED: colors.textMuted };

export default function AdminEmis() {
  const insets = useSafeAreaInsets();
  const { toast } = useAlert();
  const [tab, setTab] = useState<Tab>('Pending');
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [rejecting, setRejecting] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editTerms, setEditTerms] = useState({ down_payment: '', emi_months: '', interest_rate: '', processing_fee: '', admin_notes: '' });
  const [dpMode, setDpMode] = useState<'flat' | 'pct'>('flat');

  const load = useCallback(async () => {
    try { setApps(await emiService.getAllEmiApplications()); } catch (e) {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = apps.filter((a) => {
    if (tab === 'All') return true;
    if (tab === 'Pending') return a.current_status === 'PENDING' || a.current_status === 'REVIEW';
    if (tab === 'Approved') return a.current_status === 'SANCTIONED' || a.current_status === 'ACTIVE' || a.current_status === 'COMPLETED';
    if (tab === 'Rejected') return a.current_status === 'REJECTED';
    return true;
  });

  const openReview = (a: any) => {
    setSelected(a);
    setEditTerms({ down_payment: String(a.down_payment), emi_months: String(a.emi_months), interest_rate: String(a.interest_rate), processing_fee: String(a.processing_fee), admin_notes: a.admin_notes || '' });
    setDpMode('flat');
  };

  const previewCalc = (() => {
    if (!selected) return { monthly: 0, totalPayable: 0, totalInterest: 0 };
    const dp = dpMode === 'pct' ? selected.product_price * Number(editTerms.down_payment) / 100 : Number(editTerms.down_payment);
    const principal = selected.product_price - dp;
    const monthly = calculateEmi(principal, Number(editTerms.interest_rate) || 14, Number(editTerms.emi_months) || 3);
    const totalPayable = monthly * Number(editTerms.emi_months) + dp + Number(editTerms.processing_fee);
    const totalInterest = monthly * Number(editTerms.emi_months) - principal;
    return { monthly, totalPayable, totalInterest };
  })();

  const handleApprove = async (a: any) => {
    try {
      await emiService.approveEmi(a.id);
      await notificationService.insertNotification({ user_id: a.user_id, title: 'Application Approved', message: `Your application for ${a.product_name} has been approved. You have 5 minutes to complete the down payment.`, product_name: a.product_name, type: 'approval' });
      toast('Application approved', 'success');
      setSelected(null);
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const handleReject = async () => {
    if (!rejecting) return;
    try {
      await emiService.rejectEmi(rejecting.id, rejectReason);
      await notificationService.insertNotification({ user_id: rejecting.user_id, title: 'Application Rejected', message: `Your application for ${rejecting.product_name} was rejected. Reason: ${rejectReason}`, product_name: rejecting.product_name, type: 'rejection' });
      toast('Application rejected', 'info');
      setRejecting(null);
      setRejectReason('');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const handlePushOffer = async () => {
    if (!selected) return;
    try {
      const dp = dpMode === 'pct' ? selected.product_price * Number(editTerms.down_payment) / 100 : Number(editTerms.down_payment);
      await emiService.pushReviewOffer(selected.id, {
        down_payment: dp,
        emi_months: Number(editTerms.emi_months),
        interest_rate: Number(editTerms.interest_rate),
        processing_fee: Number(editTerms.processing_fee),
        monthly_amount: previewCalc.monthly,
        total_amount: previewCalc.totalPayable,
        total_interest: previewCalc.totalInterest,
        admin_notes: editTerms.admin_notes,
      });
      await notificationService.insertNotification({ user_id: selected.user_id, title: 'Application Under Review', message: `Your EMI application for ${selected.product_name} is being reviewed with an offer.`, product_name: selected.product_name, type: 'general' });
      toast('Offer pushed to customer', 'success');
      setSelected(null);
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>EMI Sanctions Hub</Text>
        <Pressable onPress={() => { setLoading(true); load(); }}><Ionicons name="refresh" size={20} color={colors.primaryLight} /></Pressable>
      </View>

      <View style={styles.tabRow}>
        {(['All', 'Pending', 'Approved', 'Rejected'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}><Ionicons name="document-text-outline" size={72} color={colors.textMuted} /><Text style={styles.emptyText}>No applications</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
          {filtered.map((a) => (
            <View key={a.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Image source={{ uri: a.product_image }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.caseId}>{a.case_id}</Text>
                  <Text style={styles.prodName} numberOfLines={1}>{a.product_name}</Text>
                  <Text style={styles.custEmail}>{a.full_name} • {a.phone}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[a.current_status] || colors.textDim) + '20' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[a.current_status] || colors.textDim }]}>{a.current_status}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.amtRow}>
                <View><Text style={styles.amtLabel}>Down Payment</Text><Text style={styles.amtVal}>{formatINR(a.down_payment)}</Text></View>
                <View><Text style={styles.amtLabel}>Monthly</Text><Text style={styles.amtVal}>{formatINR(a.monthly_amount)}</Text></View>
                <View><Text style={styles.amtLabel}>Total</Text><Text style={styles.amtVal}>{formatINR(a.total_amount)}</Text></View>
              </View>
              {(a.current_status === 'PENDING' || a.current_status === 'REVIEW') && (
                <View style={styles.actionRow}>
                  <Pressable style={styles.approveBtn} onPress={() => handleApprove(a)}><Ionicons name="checkmark" size={16} color={colors.white} /><Text style={styles.approveText}>Approve</Text></Pressable>
                  <Pressable style={styles.editBtn} onPress={() => openReview(a)}><Ionicons name="create" size={16} color={colors.white} /><Text style={styles.editText}>Edit Terms</Text></Pressable>
                  <Pressable style={styles.rejectBtn} onPress={() => { setRejecting(a); setRejectReason(''); }}><Ionicons name="close" size={16} color={colors.white} /><Text style={styles.rejectText}>Reject</Text></Pressable>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Review Modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Review Application</Text>
              {selected && (
                <>
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Customer Profile</Text>
                    <Text style={styles.infoText}>{selected.full_name}</Text>
                    <Text style={styles.infoText}>{selected.phone}</Text>
                  </View>
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Current Terms</Text>
                    <Text style={styles.infoText}>Product: {selected.product_name} ({formatINR(selected.product_price)})</Text>
                    <Text style={styles.infoText}>Down Payment: {formatINR(selected.down_payment)}</Text>
                    <Text style={styles.infoText}>Tenure: {selected.emi_months} months</Text>
                    <Text style={styles.infoText}>Interest: {selected.interest_rate}% p.a.</Text>
                    <Text style={styles.infoText}>Monthly EMI: {formatINR(selected.monthly_amount)}</Text>
                  </View>

                  <Text style={styles.sectionTitle}>Scheme Editor</Text>
                  <View style={styles.dpModeRow}>
                    <Pressable style={[styles.dpModeBtn, dpMode === 'flat' && styles.dpModeActive]} onPress={() => setDpMode('flat')}><Text style={[styles.dpModeText, dpMode === 'flat' && styles.dpModeTextActive]}>₹ Flat</Text></Pressable>
                    <Pressable style={[styles.dpModeBtn, dpMode === 'pct' && styles.dpModeActive]} onPress={() => setDpMode('pct')}><Text style={[styles.dpModeText, dpMode === 'pct' && styles.dpModeTextActive]}>% Percent</Text></Pressable>
                  </View>
                  <Text style={styles.inputLabel}>Down Payment {dpMode === 'pct' ? '(%)' : '(₹)'}</Text>
                  <TextInput style={styles.modalInput} value={editTerms.down_payment} onChangeText={(t) => setEditTerms({ ...editTerms, down_payment: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.inputLabel}>Tenure (months)</Text>
                  <TextInput style={styles.modalInput} value={editTerms.emi_months} onChangeText={(t) => setEditTerms({ ...editTerms, emi_months: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.inputLabel}>Interest Rate (% p.a.)</Text>
                  <TextInput style={styles.modalInput} value={editTerms.interest_rate} onChangeText={(t) => setEditTerms({ ...editTerms, interest_rate: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.inputLabel}>Processing Fee (₹)</Text>
                  <TextInput style={styles.modalInput} value={editTerms.processing_fee} onChangeText={(t) => setEditTerms({ ...editTerms, processing_fee: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.inputLabel}>Admin Notes</Text>
                  <TextInput style={styles.modalInput} value={editTerms.admin_notes} onChangeText={(t) => setEditTerms({ ...editTerms, admin_notes: t })} multiline numberOfLines={3} placeholderTextColor={colors.textMuted} />

                  <View style={styles.previewBox}>
                    <Text style={styles.previewTitle}>Live Preview</Text>
                    <View style={styles.previewRow}><Text style={styles.previewLabel}>Monthly EMI</Text><Text style={styles.previewVal}>{formatINR(previewCalc.monthly)}</Text></View>
                    <View style={styles.previewRow}><Text style={styles.previewLabel}>Total Payable</Text><Text style={styles.previewVal}>{formatINR(previewCalc.totalPayable)}</Text></View>
                    <View style={styles.previewRow}><Text style={styles.previewLabel}>Total Interest</Text><Text style={styles.previewVal}>{formatINR(previewCalc.totalInterest)}</Text></View>
                  </View>

                  <View style={styles.modalActions}>
                    <Pressable style={styles.pushBtn} onPress={handlePushOffer}><Text style={styles.pushText}>Push Updated Offer</Text></Pressable>
                    <Pressable style={styles.approveModalBtn} onPress={() => handleApprove(selected)}><Text style={styles.approveModalText}>Approve</Text></Pressable>
                  </View>
                  <Pressable style={styles.rejectModalBtn} onPress={() => { setRejecting(selected); setRejectReason(''); setSelected(null); }}><Text style={styles.rejectModalText}>Reject</Text></Pressable>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={!!rejecting} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setRejecting(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Reject Application</Text>
            {rejecting && <Text style={styles.infoText}>{rejecting.case_id} - {rejecting.product_name}</Text>}
            <Text style={styles.inputLabel}>Rejection Reason</Text>
            <TextInput style={styles.modalInput} value={rejectReason} onChangeText={setRejectReason} multiline numberOfLines={3} placeholder="Enter reason for rejection..." placeholderTextColor={colors.textMuted} />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setRejecting(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.confirmRejectBtn} onPress={handleReject}><Text style={styles.confirmRejectText}>Confirm Reject</Text></Pressable>
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
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, height: 38, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface },
  caseId: { color: colors.textDim, fontSize: fs.xs, fontWeight: '700' },
  prodName: { color: colors.text, fontSize: fs.base, fontWeight: '600' },
  custEmail: { color: colors.textMuted, fontSize: fs.xs, marginTop: 2 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  amtRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  amtLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  amtVal: { color: colors.text, fontSize: fs.sm, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing.sm },
  approveText: { color: colors.white, fontWeight: '700', fontSize: fs.sm },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#3B82F6', borderRadius: radius.md, paddingVertical: spacing.sm },
  editText: { color: colors.white, fontWeight: '700', fontSize: fs.sm },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.error, borderRadius: radius.md, paddingVertical: spacing.sm },
  rejectText: { color: colors.white, fontWeight: '700', fontSize: fs.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, maxHeight: '90%' },
  modalTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700', marginBottom: spacing.lg },
  sectionCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: fs.base, fontWeight: '700', marginBottom: spacing.sm },
  infoText: { color: colors.textDim, fontSize: fs.sm, marginBottom: 2 },
  dpModeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  dpModeBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  dpModeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dpModeText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  dpModeTextActive: { color: colors.white },
  inputLabel: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600', marginBottom: 4, marginTop: spacing.sm },
  modalInput: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 46, color: colors.text, borderWidth: 1, borderColor: colors.border },
  previewBox: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  previewTitle: { color: colors.cyan, fontSize: fs.sm, fontWeight: '700', marginBottom: spacing.sm },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  previewLabel: { color: colors.textDim, fontSize: fs.sm },
  previewVal: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  pushBtn: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center' },
  pushText: { color: colors.black, fontWeight: '700' },
  approveModalBtn: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  approveModalText: { color: colors.white, fontWeight: '700' },
  rejectModalBtn: { height: 48, borderRadius: radius.md, backgroundColor: colors.error + '20', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, borderWidth: 1, borderColor: colors.error },
  rejectModalText: { color: colors.error, fontWeight: '700' },
  cancelBtn: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.textDim, fontWeight: '700' },
  confirmRejectBtn: { flex: 2, height: 48, borderRadius: radius.md, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  confirmRejectText: { color: colors.white, fontWeight: '700' },
});
