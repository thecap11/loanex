import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { useAlert } from '@/src/context/AlertContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { getCreditRating } from '@/src/lib/emi';
import { creditService } from '@/src/services/creditService';

export default function CreditProfile() {
  const { user } = useAuth();
  const { toast } = useAlert();
  const insets = useSafeAreaInsets();
  const [credit, setCredit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [income, setIncome] = useState('');
  const [requestedLimit, setRequestedLimit] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try { setCredit(await creditService.getCreditProfile(user.id)); } catch (e) {} finally { setLoading(false); }
  }, [user]);

  useCallback(() => { load(); }, [load]);

  const rating = credit ? getCreditRating(credit.cibil_score) : { label: 'Good', color: colors.success };
  const utilPct = credit && credit.approved_limit > 0 ? ((credit.approved_limit - credit.available_limit) / credit.approved_limit) * 100 : 0;

  const handleRequest = async () => {
    const req = Number(requestedLimit);
    if (!req || req <= (credit?.approved_limit || 0)) { toast('Requested limit must be higher than current approved limit.', 'error'); return; }
    if (req > 200000) { toast('Maximum limit is ₹2,00,000', 'error'); return; }
    try {
      await creditService.updateCreditLimit(user!.id, req, req - (credit?.approved_limit || 0) + (credit?.available_limit || 0));
      toast('Credit limit updated!', 'success');
      setShowRequest(false);
      setIncome(''); setRequestedLimit('');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Pressable onPress={() => {}}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Credit Profile</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
        {/* Score Gauge */}
        <View style={styles.gaugeCard}>
          <LinearGradient colors={[colors.card, colors.cardHover]} style={StyleSheet.absoluteFill} />
          <Text style={styles.scoreNum}>{credit?.cibil_score || 750}</Text>
          <Text style={styles.scoreDenom}>/ 900</Text>
          <View style={[styles.ratingBadge, { backgroundColor: rating.color + '20' }]}>
            <Text style={[styles.ratingText, { color: rating.color }]}>{rating.label}</Text>
          </View>
        </View>

        {/* Credit Limit Bar */}
        <View style={styles.limitCard}>
          <Text style={styles.limitLabel}>Available Limit</Text>
          <View style={styles.limitTrack}><View style={[styles.limitFill, { width: `${100 - utilPct}%` }]} /></View>
          <View style={styles.limitRow}>
            <View><Text style={styles.limitVal}>{formatINR(credit?.available_limit || 50000)}</Text><Text style={styles.limitSub}>Available</Text></View>
            <View><Text style={styles.limitVal}>{formatINR(credit?.approved_limit || 50000)}</Text><Text style={styles.limitSub}>Approved</Text></View>
          </View>
          <Pressable style={styles.reqBtn} onPress={() => setShowRequest(true)}>
            <Ionicons name="trending-up" size={18} color={colors.white} />
            <Text style={styles.reqBtnText}>Request Credit Limit Increase</Text>
          </Pressable>
        </View>

        {/* Score Factors */}
        <Text style={styles.sectionTitle}>Score Factors</Text>
        <View style={styles.factorsCard}>
          {[
            { label: 'Payment History', impact: 'Positive', color: colors.success },
            { label: 'Credit Utilization', impact: 'Positive', color: colors.success },
            { label: 'Account Age', impact: 'Neutral', color: colors.textDim },
            { label: 'Credit Mix', impact: 'Positive', color: colors.success },
          ].map((f) => (
            <View key={f.label} style={styles.factorRow}>
              <Text style={styles.factorLabel}>{f.label}</Text>
              <View style={[styles.factorBadge, { backgroundColor: f.color + '20' }]}>
                <Text style={[styles.factorText, { color: f.color }]}>{f.impact}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Score History */}
        <Text style={styles.sectionTitle}>Score History</Text>
        <View style={styles.historyCard}>
          <View style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyTitle}>On-Time Monthly EMI Payment</Text>
              <Text style={styles.historyDate}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            </View>
            <View style={[styles.historyBadge, { backgroundColor: colors.success + '20' }]}>
              <Text style={[styles.historyBadgeText, { color: colors.success }]}>+1 Score</Text>
            </View>
            <View style={[styles.historyType, { backgroundColor: colors.cyan + '20' }]}><Text style={[styles.historyTypeText, { color: colors.cyan }]}>Timely</Text></View>
          </View>
        </View>
      </ScrollView>

      {/* Request Limit Modal */}
      <Modal visible={showRequest} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowRequest(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Request Credit Limit Increase</Text>
            <Text style={styles.modalLabel}>Monthly Income</Text>
            <TextInput style={styles.modalInput} placeholder="Enter monthly income" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={income} onChangeText={setIncome} />
            <Text style={styles.modalLabel}>Requested New Limit</Text>
            <TextInput style={styles.modalInput} placeholder="Max ₹2,00,000" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={requestedLimit} onChangeText={setRequestedLimit} />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowRequest(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.submitBtn} onPress={handleRequest}><Text style={styles.submitText}>Submit Request</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  gaugeCard: { alignItems: 'center', paddingVertical: spacing.xxl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.lg },
  scoreNum: { color: colors.white, fontSize: 56, fontWeight: '700' },
  scoreDenom: { color: colors.textDim, fontSize: fs.lg },
  ratingBadge: { paddingHorizontal: spacing.lg, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.sm },
  ratingText: { fontWeight: '700' },
  limitCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  limitLabel: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600', marginBottom: spacing.sm },
  limitTrack: { height: 8, backgroundColor: colors.border, borderRadius: radius.pill, overflow: 'hidden' },
  limitFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  limitRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  limitVal: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  limitSub: { color: colors.textMuted, fontSize: fs.xs },
  reqBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.lg },
  reqBtnText: { color: colors.white, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginBottom: spacing.sm },
  factorsCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  factorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  factorLabel: { color: colors.text, fontSize: fs.sm },
  factorBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  factorText: { fontSize: 10, fontWeight: '700' },
  historyCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyTitle: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  historyDate: { color: colors.textDim, fontSize: fs.xs, marginTop: 2 },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  historyBadgeText: { fontSize: 10, fontWeight: '700' },
  historyType: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  historyTypeText: { fontSize: 10, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl },
  modalTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700', marginBottom: spacing.lg },
  modalLabel: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600', marginBottom: spacing.sm },
  modalInput: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 48, color: colors.text, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cancelBtn: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.textDim, fontWeight: '700' },
  submitBtn: { flex: 2, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: colors.white, fontWeight: '700' },
});
