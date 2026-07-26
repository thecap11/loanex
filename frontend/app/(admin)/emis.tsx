import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

type Filter = 'all' | 'pending' | 'sanctioned' | 'active' | 'completed' | 'rejected';

export default function AdminEmis() {
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [modal, setModal] = useState<{ app: any; mode: 'sanction' | 'reject' } | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setApps(await api('/admin/emi/applications')); } catch {} finally { setLoading(false); }
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = filter === 'all' ? apps : apps.filter((a) => a.status === filter);

  const submit = async () => {
    if (!modal) return;
    setBusy(true);
    try {
      if (modal.mode === 'sanction') {
        await api(`/admin/emi/applications/${modal.app.id}/sanction`, { method: 'POST', body: JSON.stringify({ notes }) });
      } else {
        await api(`/admin/emi/applications/${modal.app.id}/reject`, { method: 'POST', body: JSON.stringify({ reason: notes || 'Rejected by admin' }) });
      }
      setModal(null); setNotes(''); load();
    } catch {} finally { setBusy(false); }
  };

  const scoreTier = (s: number) => s >= 750 ? { c: colors.info, l: 'Excellent' } : s >= 650 ? { c: colors.success, l: 'Good' } : s >= 500 ? { c: colors.warning, l: 'Fair' } : { c: colors.error, l: 'Poor' };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}><Text style={styles.title}>EMI Review Hub</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: 56 }} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: 'center' }}>
        {(['pending', 'sanctioned', 'active', 'completed', 'rejected', 'all'] as Filter[]).map((f) => (
          <Pressable testID={`emi-filter-${f}`} key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f.toUpperCase()}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
          {filtered.length === 0 ? <Text style={styles.empty}>No applications</Text> : filtered.map((a) => {
            const tier = scoreTier(a.user_score || 500);
            return (
              <View testID={`app-${a.id}`} key={a.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{a.user_name[0]?.toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{a.user_name}</Text>
                    <Text style={styles.userEmail}>{a.user_email}</Text>
                  </View>
                  <View style={[styles.scorePill, { borderColor: tier.c, backgroundColor: tier.c + '22' }]}>
                    <Text style={[styles.scoreVal, { color: tier.c }]}>{a.user_score}</Text>
                    <Text style={[styles.scoreLabel, { color: tier.c }]}>{tier.l}</Text>
                  </View>
                </View>
                <View style={styles.productRow}>
                  <Image source={{ uri: a.product.image }} style={styles.pimg} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pname}>{a.product.name}</Text>
                    <Text style={styles.pmeta}>{a.tenure_months} months • {a.interest_rate}% APR</Text>
                  </View>
                </View>
                <View style={styles.financeRow}>
                  <View><Text style={styles.dim}>Amount</Text><Text style={styles.val}>{formatINR(a.total_price)}</Text></View>
                  <View><Text style={styles.dim}>Down Pay</Text><Text style={styles.val}>{formatINR(a.down_payment)}</Text></View>
                  <View><Text style={styles.dim}>Monthly</Text><Text style={[styles.val, { color: colors.gold }]}>{formatINR(a.monthly_emi)}</Text></View>
                </View>
                <View style={styles.statusRow}>
                  <View style={[styles.statusChip, {
                    borderColor: a.status === 'pending' ? colors.warning : a.status === 'sanctioned' ? colors.info : a.status === 'active' ? colors.success : a.status === 'completed' ? colors.gold : colors.error,
                    backgroundColor: (a.status === 'pending' ? colors.warning : a.status === 'sanctioned' ? colors.info : a.status === 'active' ? colors.success : a.status === 'completed' ? colors.gold : colors.error) + '22'
                  }]}>
                    <Text style={[styles.statusText, {
                      color: a.status === 'pending' ? colors.warning : a.status === 'sanctioned' ? colors.info : a.status === 'active' ? colors.success : a.status === 'completed' ? colors.gold : colors.error
                    }]}>{a.status.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.appDate}>{new Date(a.created_at).toLocaleDateString()}</Text>
                </View>
                {a.admin_notes && (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Admin Notes:</Text>
                    <Text style={styles.notesText}>{a.admin_notes}</Text>
                  </View>
                )}
                {a.status === 'pending' && (
                  <View style={styles.actions}>
                    <Pressable testID={`sanction-${a.id}`} style={styles.sanctionBtn} onPress={() => { setModal({ app: a, mode: 'sanction' }); setNotes(''); }}>
                      <Ionicons name="checkmark" size={16} color={colors.black} />
                      <Text style={styles.sanctionText}>Sanction</Text>
                    </Pressable>
                    <Pressable testID={`reject-${a.id}`} style={styles.rejectBtn} onPress={() => { setModal({ app: a, mode: 'reject' }); setNotes(''); }}>
                      <Ionicons name="close" size={16} color={colors.error} />
                      <Text style={styles.rejectText}>Reject</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modal?.mode === 'sanction' ? 'Sanction EMI' : 'Reject EMI'}</Text>
              <Pressable onPress={() => setModal(null)}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
            </View>
            <Text style={styles.modalSub}>{modal?.app.user_name} • {formatINR(modal?.app.total_price || 0)}</Text>
            <Text style={styles.notesLabelM}>{modal?.mode === 'sanction' ? 'Notes (optional)' : 'Rejection reason'}</Text>
            <TextInput
              testID="review-notes-input"
              value={notes}
              onChangeText={setNotes}
              placeholder={modal?.mode === 'sanction' ? 'e.g. Approved based on strong credit profile' : 'e.g. Insufficient income proof'}
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.notesInput}
            />
            <Pressable
              testID="review-submit-btn"
              style={[styles.submitBtn, modal?.mode === 'reject' && { backgroundColor: colors.error }]}
              onPress={submit}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color={modal?.mode === 'reject' ? colors.white : colors.black} /> : (
                <Text style={[styles.submitBtnText, modal?.mode === 'reject' && { color: colors.white }]}>{modal?.mode === 'sanction' ? 'Sanction Application' : 'Reject Application'}</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: colors.textDim, fontWeight: '700', fontSize: fs.sm },
  chipTextActive: { color: colors.black },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.bg2, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontWeight: '700' },
  userName: { color: colors.text, fontWeight: '700' },
  userEmail: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  scorePill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  scoreVal: { fontWeight: '700', fontSize: fs.lg },
  scoreLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, padding: spacing.sm, backgroundColor: colors.bg3, borderRadius: radius.sm },
  pimg: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.bg },
  pname: { color: colors.text, fontWeight: '600' },
  pmeta: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  dim: { color: colors.textDim, fontSize: fs.sm },
  val: { color: colors.text, fontWeight: '700', marginTop: 2 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  statusText: { fontSize: fs.sm, fontWeight: '700' },
  appDate: { color: colors.textDim, fontSize: fs.sm },
  notesBox: { marginTop: spacing.md, padding: spacing.sm, backgroundColor: colors.bg3, borderRadius: radius.sm, borderLeftWidth: 3, borderLeftColor: colors.gold },
  notesLabel: { color: colors.gold, fontSize: fs.sm, fontWeight: '700' },
  notesText: { color: colors.text, fontSize: fs.sm, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  sanctionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40, backgroundColor: colors.white, borderRadius: radius.md },
  sanctionText: { color: colors.black, fontWeight: '700' },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40, borderWidth: 1, borderColor: colors.error, borderRadius: radius.md },
  rejectText: { color: colors.error, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  modalSub: { color: colors.textDim, marginTop: 4 },
  notesLabelM: { color: colors.textDim, fontSize: fs.sm, marginTop: spacing.lg, marginBottom: 6 },
  notesInput: { backgroundColor: colors.bg3, borderRadius: radius.md, padding: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 80 },
  submitBtn: { marginTop: spacing.lg, height: 50, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
});
