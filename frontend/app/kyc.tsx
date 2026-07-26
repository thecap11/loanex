import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

const HOUSING = [
  { key: 'owned', label: 'Owned' },
  { key: 'rented', label: 'Rented' },
  { key: 'with_parents', label: 'With Parents' },
];

export default function Kyc() {
  const { api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ aadhar: '', pan: '', housing_type: 'owned', monthly_income: '', employer: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      if (form.aadhar.length !== 12) throw new Error('Aadhar must be 12 digits');
      if (form.pan.length !== 10) throw new Error('PAN must be 10 characters');
      if (!form.monthly_income) throw new Error('Monthly income required');
      const r = await api('/kyc/submit', {
        method: 'POST',
        body: JSON.stringify({ ...form, monthly_income: parseFloat(form.monthly_income) }),
      });
      setResult(r);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (result) {
    return (
      <View style={[styles.successBox, { paddingTop: insets.top + 80 }]}>
        <Ionicons name="checkmark-circle" size={80} color={colors.success} />
        <Text style={styles.successTitle}>KYC Verified!</Text>
        <Text style={styles.successSub}>Your account is now fully activated.</Text>
        <View style={styles.successStats}>
          <View style={styles.successStat}><Text style={styles.dim}>Credit Score</Text><Text style={styles.statVal}>{result.credit_score}</Text></View>
          <View style={styles.successStat}><Text style={styles.dim}>Approved Limit</Text><Text style={styles.statVal}>{formatINR(result.approved_limit)}</Text></View>
        </View>
        <Pressable testID="kyc-done" style={styles.doneBtn} onPress={() => router.replace('/(customer)/credit')}>
          <Text style={styles.doneBtnText}>Continue</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="kyc-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Text style={styles.title}>KYC Verification</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={20} color={colors.gold} />
          <Text style={styles.infoText}>Complete KYC to unlock EMI purchases and higher credit limits.</Text>
        </View>

        <Text style={styles.label}>Aadhar Number</Text>
        <TextInput testID="kyc-aadhar" style={styles.input} value={form.aadhar} onChangeText={(v) => setForm({ ...form, aadhar: v.replace(/\D/g, '').slice(0, 12) })} placeholder="12-digit Aadhar" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />

        <Text style={styles.label}>PAN Card</Text>
        <TextInput testID="kyc-pan" style={styles.input} value={form.pan} onChangeText={(v) => setForm({ ...form, pan: v.toUpperCase().slice(0, 10) })} placeholder="ABCDE1234F" placeholderTextColor={colors.textMuted} autoCapitalize="characters" />

        <Text style={styles.label}>Housing Type</Text>
        <View style={styles.housingRow}>
          {HOUSING.map((h) => (
            <Pressable testID={`kyc-housing-${h.key}`} key={h.key} style={[styles.hBtn, form.housing_type === h.key && styles.hBtnActive]} onPress={() => setForm({ ...form, housing_type: h.key })}>
              <Text style={[styles.hText, form.housing_type === h.key && { color: colors.black }]}>{h.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Monthly Income (₹)</Text>
        <TextInput testID="kyc-income" style={styles.input} value={form.monthly_income} onChangeText={(v) => setForm({ ...form, monthly_income: v })} placeholder="50000" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />

        <Text style={styles.label}>Employer (optional)</Text>
        <TextInput testID="kyc-employer" style={styles.input} value={form.employer} onChangeText={(v) => setForm({ ...form, employer: v })} placeholder="Company name" placeholderTextColor={colors.textMuted} />

        {err && <Text style={styles.err}>{err}</Text>}

        <Pressable testID="kyc-submit" style={styles.submit} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.black} /> : <Text style={styles.submitText}>Submit KYC</Text>}
        </Pressable>
        <Text style={styles.disclaimer}>* This is a mock KYC. Data is not sent to any real verification agency.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, marginBottom: spacing.lg },
  infoText: { flex: 1, color: colors.text, fontSize: fs.sm },
  label: { color: colors.textDim, fontSize: fs.sm, marginTop: spacing.md, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' },
  input: { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, padding: spacing.md, fontSize: fs.lg },
  housingRow: { flexDirection: 'row', gap: spacing.sm },
  hBtn: { flex: 1, height: 44, borderRadius: radius.md, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  hBtnActive: { backgroundColor: colors.white, borderColor: colors.white },
  hText: { color: colors.text, fontWeight: '600', fontSize: fs.sm },
  err: { color: colors.error, marginTop: spacing.md },
  submit: { marginTop: spacing.xl, height: 54, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
  disclaimer: { color: colors.textMuted, fontSize: fs.sm, textAlign: 'center', marginTop: spacing.md, fontStyle: 'italic' },
  successBox: { flex: 1, alignItems: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  successTitle: { color: colors.text, fontSize: fs.xxxl, fontWeight: '700', marginTop: spacing.lg },
  successSub: { color: colors.textDim, marginTop: 4, textAlign: 'center' },
  successStats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, width: '100%' },
  successStat: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  dim: { color: colors.textDim, fontSize: fs.sm },
  statVal: { color: colors.text, fontSize: fs.xl, fontWeight: '700', marginTop: 4 },
  doneBtn: { marginTop: spacing.xl, backgroundColor: colors.white, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, borderRadius: radius.md },
  doneBtnText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
});
