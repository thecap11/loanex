import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

const STATUS_STYLE: any = {
  pending: { color: colors.warning, label: 'PENDING' },
  sanctioned: { color: colors.info, label: 'SANCTIONED' },
  active: { color: colors.success, label: 'ACTIVE' },
  completed: { color: colors.gold, label: 'COMPLETED' },
  rejected: { color: colors.error, label: 'REJECTED' },
  expired: { color: colors.textMuted, label: 'EXPIRED' },
};

export default function EmiAppDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [app, setApp] = useState<any>(null);
  const [busy, setBusy] = useState<any>(null);

  const load = useCallback(async () => {
    try { setApp(await api(`/emi/applications/${id}`)); } catch {}
  }, [api, id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const payDown = async () => {
    setBusy('down');
    try { await api(`/emi/applications/${id}/pay-downpayment`, { method: 'POST' }); await load(); }
    catch {} finally { setBusy(null); }
  };
  const payInst = async (n: number) => {
    setBusy(n);
    try { await api(`/emi/applications/${id}/pay/${n}`, { method: 'POST' }); await load(); }
    catch {} finally { setBusy(null); }
  };

  if (!app) return <View style={styles.center}><ActivityIndicator color={colors.white} /></View>;
  const st = STATUS_STYLE[app.status];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="emi-detail-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Text style={styles.title}>EMI Application</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }}>
        <View style={[styles.statusCard, { borderColor: st.color, backgroundColor: st.color + '11' }]}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          <Text style={styles.appId}>#{app.id.slice(0, 8).toUpperCase()}</Text>
        </View>

        <View style={styles.productRow}>
          <Image source={{ uri: app.product.image }} style={styles.pimg} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.pbrand}>{app.product.brand}</Text>
            <Text style={styles.pname}>{app.product.name}</Text>
            <Text style={styles.pprice}>{formatINR(app.total_price)}</Text>
          </View>
        </View>

        <Text style={styles.section}>Loan Terms</Text>
        <View style={styles.terms}>
          <Row l="Tenure" v={`${app.tenure_months} months`} />
          <Row l="Interest Rate" v={`${app.interest_rate}% APR`} />
          <Row l="Down Payment" v={formatINR(app.down_payment)} accent />
          <Row l="Loan Principal" v={formatINR(app.principal)} />
          <Row l="Total Interest" v={formatINR(app.total_interest)} warn />
          <Row l="Processing Fee" v={formatINR(app.processing_fee)} />
          {app.custom_charges && app.custom_charges.map((c: any, i: number) => (
            <Row key={i} l={c.label} v={formatINR(c.amount)} warn />
          ))}
          <View style={styles.divider} />
          <Row l="Monthly EMI" v={formatINR(app.monthly_emi)} bold />
          <Row l="Total Payable" v={formatINR(app.total_payable)} />
        </View>

        {app.admin_notes && (
          <View style={[styles.notesBox, app.status === 'rejected' && { borderColor: colors.error }]}>
            <Text style={styles.notesTitle}>{app.status === 'rejected' ? 'Rejection Reason' : 'Admin Notes'}</Text>
            <Text style={styles.notesText}>{app.admin_notes}</Text>
          </View>
        )}

        {app.status === 'sanctioned' && (
          <Pressable testID="pay-down-btn" style={styles.payDownBtn} onPress={payDown} disabled={busy === 'down'}>
            {busy === 'down' ? <ActivityIndicator color={colors.black} /> : (
              <>
                <Text style={styles.payDownText}>Pay Down Payment</Text>
                <Text style={styles.payDownAmt}>{formatINR(app.down_payment)}</Text>
              </>
            )}
          </Pressable>
        )}

        {(app.status === 'active' || app.status === 'completed') && app.schedule && (
          <>
            <Text style={styles.section}>Payment Schedule</Text>
            {app.schedule.map((s: any) => (
              <View testID={`inst-${s.installment}`} key={s.installment} style={styles.instRow}>
                <View style={[styles.dot, { backgroundColor: s.status === 'paid' ? colors.success : colors.bg3 }]}>
                  {s.status === 'paid' && <Ionicons name="checkmark" size={12} color={colors.white} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.instTitle}>Installment {s.installment}</Text>
                  <Text style={styles.instDate}>Due {new Date(s.due_date).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.instAmount}>{formatINR(s.amount)}</Text>
                {s.status === 'paid' ? (
                  <View style={styles.paidBadge}><Text style={styles.paidText}>PAID</Text></View>
                ) : (
                  <Pressable testID={`pay-inst-${s.installment}`} style={styles.payBtn} onPress={() => payInst(s.installment)} disabled={busy === s.installment}>
                    {busy === s.installment ? <ActivityIndicator color={colors.black} size="small" /> : <Text style={styles.payBtnText}>Pay</Text>}
                  </Pressable>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ l, v, bold, warn, accent }: any) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { color: colors.text, fontWeight: '700' }]}>{l}</Text>
      <Text style={[styles.rowValue, bold && { fontSize: fs.xl, color: colors.gold }, warn && { color: colors.warning }, accent && { color: colors.gold }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  statusCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md },
  statusText: { fontSize: fs.lg, fontWeight: '700', letterSpacing: 2 },
  appId: { color: colors.text, fontWeight: '700' },
  productRow: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  pimg: { width: 70, height: 70, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  pbrand: { color: colors.gold, fontSize: fs.sm, fontWeight: '700' },
  pname: { color: colors.text, fontWeight: '700', marginTop: 2 },
  pprice: { color: colors.text, marginTop: 4, fontWeight: '700' },
  section: { color: colors.textDim, fontSize: fs.sm, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  terms: { padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel: { color: colors.textDim },
  rowValue: { color: colors.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  notesBox: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold },
  notesTitle: { color: colors.gold, fontWeight: '700', fontSize: fs.sm },
  notesText: { color: colors.text, marginTop: 4, fontSize: fs.sm },
  payDownBtn: { marginTop: spacing.lg, backgroundColor: colors.white, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  payDownText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
  payDownAmt: { color: colors.black, fontSize: fs.base, opacity: 0.7, marginTop: 2 },
  instRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  instTitle: { color: colors.text, fontWeight: '600' },
  instDate: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  instAmount: { color: colors.text, fontWeight: '700', marginRight: spacing.sm },
  paidBadge: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: colors.success, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  paidText: { color: colors.success, fontSize: fs.sm, fontWeight: '700' },
  payBtn: { backgroundColor: colors.white, paddingHorizontal: spacing.md, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', minWidth: 60 },
  payBtnText: { color: colors.black, fontWeight: '700' },
});
