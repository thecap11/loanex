import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, Switch, FlatList } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { useAlert } from '@/src/context/AlertContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { formatDate } from '@/src/lib/emi';
import { emiService } from '@/src/services/emiService';

type Tab = 'Applications' | 'Active EMIs' | 'Completed' | 'Rejected' | 'Expired';

export default function EmiHub() {
  const { user } = useAuth();
  const { toast } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('Applications');
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [paying, setPaying] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [payTarget, setPayTarget] = useState<{ scheduleId: string; caseId: string; amount: number } | null>(null);
  const [payMethod, setPayMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [payState, setPayState] = useState<'select' | 'processing' | 'success' | 'fail'>('select');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await emiService.getEmiApplications(user.id);
      setApps(data);
    } catch (e) {} finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = apps.filter((a) => {
    switch (tab) {
      case 'Applications': return a.current_status === 'PENDING' || a.current_status === 'REVIEW' || a.current_status === 'SANCTIONED';
      case 'Active EMIs': return a.current_status === 'ACTIVE';
      case 'Completed': return a.current_status === 'COMPLETED';
      case 'Rejected': return a.current_status === 'REJECTED';
      case 'Expired': return a.current_status === 'EXPIRED';
      default: return true;
    }
  });

  const upcomingDue = apps.find((a) => a.current_status === 'ACTIVE');

  const toggleExpand = async (caseId: string) => {
    if (expanded === caseId) { setExpanded(null); return; }
    setExpanded(caseId);
    try {
      const scheds = await emiService.getSchedules(caseId);
      setSchedules(scheds);
    } catch (e) {}
  };

  const handleAccept = async (caseId: string) => {
    try { await emiService.acceptOffer(caseId); toast('Offer accepted!', 'success'); load(); } catch (e: any) { toast(e.message, 'error'); }
  };
  const handleReject = async (caseId: string) => {
    try { await emiService.rejectOffer(caseId); toast('Offer rejected', 'info'); load(); } catch (e: any) { toast(e.message, 'error'); }
  };

  const handlePayDown = (caseId: string) => {
    setPayTarget({ scheduleId: '', caseId, amount: apps.find((a) => a.id === caseId)?.down_payment || 0 });
    setPayState('select');
    setShowPay(true);
  };

  const handlePayInstallment = (scheduleId: string, caseId: string, amount: number) => {
    setPayTarget({ scheduleId, caseId, amount });
    setPayState('select');
    setShowPay(true);
  };

  const executePayment = async () => {
    if (!payTarget || !user) return;
    setPayState('processing');
    await new Promise((r) => setTimeout(r, 800));
    try {
      const method = payMethod === 'upi' ? 'UPI' : payMethod === 'card' ? 'Card' : 'Net Banking';
      if (payTarget.scheduleId === '') {
        await emiService.payDownPayment(payTarget.caseId, user.id, method);
      } else {
        await emiService.payIndividualEmi(payTarget.scheduleId, payTarget.caseId, user.id, method);
      }
      setPayState('success');
      toast('Payment successful!', 'success');
      load();
    } catch (e: any) {
      setPayState('fail');
      toast('Payment failed: ' + e.message, 'error');
    }
  };

  const toggleAutopay = async (caseId: string, current: boolean) => {
    try { await emiService.toggleAutopay(caseId, !current); toast(!current ? 'AutoPay ON' : 'AutoPay OFF', 'success'); load(); } catch (e: any) { toast(e.message, 'error'); }
  };

  const statusColor = (s: string) => ({ PENDING: colors.warning, REVIEW: '#3B82F6', SANCTIONED: colors.cyan, ACTIVE: colors.success, COMPLETED: colors.success, REJECTED: colors.error, EXPIRED: colors.textMuted } as any)[s] || colors.textDim;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}><Text style={styles.title}>My EMIs</Text></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={styles.tabContent}>
        {(['Applications', 'Active EMIs', 'Completed', 'Rejected', 'Expired'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={72} color={colors.textMuted} />
          <Text style={styles.emptyText}>No {tab.toLowerCase()} applications</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
          {filtered.map((a) => (
            <View key={a.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Image source={{ uri: a.product_image }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.caseId}>{a.case_id}</Text>
                  <Text style={styles.prodName} numberOfLines={1}>{a.product_name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(a.current_status) + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor(a.current_status) }]}>{a.current_status}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.amtRow}>
                <View><Text style={styles.amtLabel}>Monthly</Text><Text style={styles.amtVal}>{formatINR(a.monthly_amount)}/mo</Text></View>
                <View><Text style={styles.amtLabel}>Total</Text><Text style={styles.amtVal}>{formatINR(a.total_amount)}</Text></View>
                <View><Text style={styles.amtLabel}>Tenure</Text><Text style={styles.amtVal}>{a.emi_months} mo</Text></View>
              </View>

              {a.current_status === 'PENDING' && <Text style={styles.note}>Awaiting admin review</Text>}

              {a.current_status === 'REVIEW' && (
                <View style={styles.offerBox}>
                  <Text style={styles.offerTitle}>Revised Offer</Text>
                  <Text style={styles.offerLine}>Down Payment: {formatINR(a.down_payment)}</Text>
                  <Text style={styles.offerLine}>Interest: {a.interest_rate}% p.a.</Text>
                  <Text style={styles.offerLine}>Monthly EMI: {formatINR(a.monthly_amount)}</Text>
                  <View style={styles.offerBtns}>
                    <Pressable style={styles.acceptBtn} onPress={() => handleAccept(a.id)}><Text style={styles.acceptText}>Accept Offer</Text></Pressable>
                    <Pressable style={styles.rejectBtn} onPress={() => handleReject(a.id)}><Text style={styles.rejectText}>Reject Offer</Text></Pressable>
                  </View>
                </View>
              )}

              {a.current_status === 'SANCTIONED' && (
                <View style={styles.sanctionBox}>
                  <Text style={styles.sanctionText}>Down Payment: {formatINR(a.down_payment)}</Text>
                  <Pressable style={styles.payDownBtn} onPress={() => handlePayDown(a.id)}>
                    <Text style={styles.payDownText}>Pay Down Payment</Text>
                  </Pressable>
                </View>
              )}

              {a.current_status === 'ACTIVE' && (
                <View>
                  <View style={styles.activeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.progressText}>{a.paid_installments_count} of {a.emi_months} Paid</Text>
                      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${(a.paid_installments_count / a.emi_months) * 100}%` }]} /></View>
                    </View>
                    <View style={styles.autopayRow}>
                      <Text style={[styles.autopayLabel, { color: a.autopay_enabled ? colors.success : colors.textMuted }]}>{a.autopay_enabled ? 'AutoPay ON' : 'AutoPay OFF'}</Text>
                      <Switch value={a.autopay_enabled} onValueChange={() => toggleAutopay(a.id, a.autopay_enabled)} trackColor={{ false: colors.border, true: colors.success + '40' }} thumbColor={a.autopay_enabled ? colors.success : colors.textMuted} />
                    </View>
                  </View>
                  <Pressable style={styles.expandBtn} onPress={() => toggleExpand(a.id)}>
                    <Text style={styles.expandText}>{expanded === a.id ? 'Hide Schedule' : 'View Payment Schedule'}</Text>
                    <Ionicons name={expanded === a.id ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primaryLight} />
                  </Pressable>
                  {expanded === a.id && (
                    <View style={styles.schedTable}>
                      <View style={styles.schedHeader}>
                        <Text style={styles.schedHdrText}>#</Text>
                        <Text style={styles.schedHdrText}>Due Date</Text>
                        <Text style={styles.schedHdrText}>Amount</Text>
                        <Text style={styles.schedHdrText}>Status</Text>
                        <Text style={styles.schedHdrText}>Action</Text>
                      </View>
                      {schedules.map((s) => (
                        <View key={s.id} style={styles.schedRow}>
                          <Text style={styles.schedCell}>{s.installment_number}</Text>
                          <Text style={styles.schedCell}>{formatDate(s.due_date)}</Text>
                          <Text style={styles.schedCell}>{formatINR(s.amount)}</Text>
                          <Text style={[styles.schedCell, { color: s.status === 'paid' ? colors.success : s.status === 'pending' ? colors.warning : colors.textMuted }]}>{s.status === 'paid' ? '✅' : s.status === 'pending' ? '🟡' : '⚪'}</Text>
                          <View style={{ width: 70 }}>
                            {s.status === 'pending' && (
                              <Pressable style={styles.payNowBtn} onPress={() => handlePayInstallment(s.id, a.id, s.amount)}>
                                <Text style={styles.payNowText}>Pay Now</Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {a.current_status === 'COMPLETED' && <Text style={styles.completedText}>✓ All installments paid</Text>}
              {a.current_status === 'REJECTED' && a.admin_notes && <Text style={styles.rejectReason}>Reason: {a.admin_notes}</Text>}
            </View>
          ))}
        </ScrollView>
      )}

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
                      {payMethod === m.key && <View style={[styles.radioInner, { backgroundColor: colors.primaryLight }]} />}
                    </View>
                  </Pressable>
                ))}
                <Pressable style={styles.payConfirmBtn} onPress={executePayment}>
                  <Text style={styles.payConfirmText}>Pay {formatINR(payTarget?.amount || 0)}</Text>
                </Pressable>
              </>
            )}
            {payState === 'processing' && <View style={styles.payProcessing}><ActivityIndicator color={colors.white} size="large" /><Text style={styles.payProcessingText}>Processing payment...</Text></View>}
            {payState === 'success' && (
              <View style={styles.payResult}>
                <View style={styles.payResultIcon}><Ionicons name="checkmark" size={48} color={colors.success} /></View>
                <Text style={styles.payResultTitle}>Payment Successful!</Text>
                <Pressable style={styles.payResultBtn} onPress={() => { setShowPay(false); setPayState('select'); }}>
                  <Text style={styles.payResultBtnText}>Done</Text>
                </Pressable>
              </View>
            )}
            {payState === 'fail' && (
              <View style={styles.payResult}>
                <View style={[styles.payResultIcon, { borderColor: colors.error }]}><Ionicons name="close" size={48} color={colors.error} /></View>
                <Text style={styles.payResultTitle}>Payment Failed</Text>
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
  header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  tabRow: { maxHeight: 50, marginBottom: spacing.sm },
  tabContent: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  tab: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  thumb: { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.surface },
  caseId: { color: colors.textDim, fontSize: fs.xs, fontWeight: '700' },
  prodName: { color: colors.text, fontSize: fs.base, fontWeight: '600', marginTop: 2 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  amtRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  amtLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  amtVal: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  note: { color: colors.warning, fontSize: fs.sm, fontStyle: 'italic' },
  offerBox: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  offerTitle: { color: '#3B82F6', fontWeight: '700', marginBottom: 4 },
  offerLine: { color: colors.textDim, fontSize: fs.sm },
  offerBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  acceptBtn: { flex: 1, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  acceptText: { color: colors.white, fontWeight: '700', fontSize: fs.sm },
  rejectBtn: { flex: 1, backgroundColor: colors.error + '20', borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.error },
  rejectText: { color: colors.error, fontWeight: '700', fontSize: fs.sm },
  sanctionBox: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, alignItems: 'center', gap: spacing.sm },
  sanctionText: { color: colors.cyan, fontSize: fs.lg, fontWeight: '700' },
  payDownBtn: { backgroundColor: colors.cyan, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignItems: 'center' },
  payDownText: { color: colors.black, fontWeight: '700' },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  progressText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: radius.pill, marginTop: 4 },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: radius.pill },
  autopayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  autopayLabel: { fontSize: fs.xs, fontWeight: '700' },
  expandBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, marginTop: spacing.xs },
  expandText: { color: colors.primaryLight, fontSize: fs.sm, fontWeight: '600' },
  schedTable: { marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm },
  schedHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  schedHdrText: { flex: 1, color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  schedRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.divider },
  schedCell: { flex: 1, color: colors.text, fontSize: fs.xs },
  payNowBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 8, alignItems: 'center' },
  payNowText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  completedText: { color: colors.success, fontWeight: '700', textAlign: 'center' },
  rejectReason: { color: colors.error, fontSize: fs.sm, marginTop: 4 },
  payOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  paySheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, minHeight: 300 },
  payHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: radius.pill, alignSelf: 'center', marginBottom: spacing.lg },
  payTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700', marginBottom: spacing.lg },
  payMethod: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  payMethodActive: { borderColor: colors.primary },
  payMethodLabel: { color: colors.text, fontSize: fs.base, fontWeight: '600' },
  payMethodSub: { color: colors.textDim, fontSize: fs.xs, marginTop: 2 },
  radioOuter: { width: 20, height: 20, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: colors.primaryLight },
  radioInner: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
  payConfirmBtn: { backgroundColor: colors.primary, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  payConfirmText: { color: colors.white, fontWeight: '700', fontSize: fs.base },
  payProcessing: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  payProcessingText: { color: colors.textDim, fontSize: fs.base },
  payResult: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  payResultIcon: { width: 80, height: 80, borderRadius: radius.pill, borderWidth: 3, borderColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  payResultTitle: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  payResultBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  payResultBtnText: { color: colors.white, fontWeight: '700' },
});
