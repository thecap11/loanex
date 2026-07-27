import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

export default function Login() {
  const router = useRouter();
  const { sendOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSendOtp = async () => {
    setErr(null);
    if (mobile.length !== 10) {
      setErr('Enter a valid 10-digit mobile number');
      return;
    }
    try {
      setBusy(true);
      await sendOtp(mobile);
      setStep(2);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setErr(null);
    if (otp.length !== 4) {
      setErr('Invalid OTP. Use 1234 for demo.');
      return;
    }
    try {
      setBusy(true);
      const u = await verifyOtp(mobile, otp);
      if (u.role === 'admin') router.replace('/(admin)/dashboard');
      else router.replace('/(customer)/home');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="shield-checkmark" size={36} color={colors.white} />
          </View>
        </View>
        <Text style={styles.brand}>LoanEX</Text>
        <Text style={styles.tagline}>Shop Smart, Pay in Parts</Text>

        <View style={styles.card}>
          {step === 1 ? (
            <>
              <Text style={styles.stepTitle}>Enter Mobile Number</Text>
              <View style={styles.field}>
                <Ionicons name="call-outline" size={18} color={colors.textDim} />
                <TextInput
                  testID="login-mobile-input"
                  style={styles.input}
                  placeholder="Mobile Number"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={mobile}
                  onChangeText={(t) => { setMobile(t.replace(/[^0-9]/g, '')); setErr(null); }}
                />
              </View>
              {err && <Text testID="login-error" style={styles.error}>{err}</Text>}
              <Pressable testID="send-otp-btn" style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]} onPress={handleSendOtp} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnText}>Send OTP</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.stepTitle}>Enter OTP</Text>
              <Text style={styles.hint}>Enter the code sent to {mobile}</Text>
              <View style={styles.field}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textDim} />
                <TextInput
                  testID="login-otp-input"
                  style={styles.input}
                  placeholder="Enter OTP"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={otp}
                  onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '')); setErr(null); }}
                />
              </View>
              {err && <Text testID="login-error" style={styles.error}>{err}</Text>}
              <Pressable testID="verify-otp-btn" style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]} onPress={handleVerify} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnText}>Verify & Login</Text>}
              </Pressable>
              <Pressable testID="change-mobile-link" style={styles.backLink} onPress={() => { setStep(1); setOtp(''); setErr(null); }}>
                <Text style={styles.backText}>Change Mobile Number</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.trustRow}>
          <View style={styles.trustChip}><Ionicons name="bicycle-outline" size={14} color={colors.accent} /><Text style={styles.trustText}>Fast Delivery</Text></View>
          <View style={styles.trustChip}><Ionicons name="card-outline" size={14} color={colors.primaryLight} /><Text style={styles.trustText}>Easy EMI</Text></View>
          <View style={styles.trustChip}><Ionicons name="lock-closed-outline" size={14} color={colors.success} /><Text style={styles.trustText}>Secure Payments</Text></View>
        </View>

        <Text style={styles.demoHint}>Demo OTP: 1234 | Admin: 0000000000</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.xxl * 1.5, alignItems: 'center' },
  logoWrap: { marginBottom: spacing.lg },
  logoCircle: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  brand: { color: colors.text, fontSize: fs.huge, fontWeight: '700', letterSpacing: 2 },
  tagline: { color: colors.textDim, fontSize: fs.base, marginTop: spacing.xs, marginBottom: spacing.xxl },
  card: { width: '100%', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  stepTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginBottom: spacing.md },
  hint: { color: colors.textDim, fontSize: fs.sm, marginBottom: spacing.md },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, height: 54 },
  input: { flex: 1, color: colors.text, fontSize: fs.lg },
  error: { color: colors.error, marginBottom: spacing.md, fontSize: fs.sm },
  btn: { backgroundColor: colors.primary, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.white, fontSize: fs.lg, fontWeight: '700' },
  backLink: { alignItems: 'center', paddingVertical: spacing.md },
  backText: { color: colors.primaryLight, fontSize: fs.sm, fontWeight: '600' },
  trustRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xxl },
  trustChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  trustText: { color: colors.textDim, fontSize: fs.xs, fontWeight: '600' },
  demoHint: { color: colors.textMuted, fontSize: fs.xs, marginTop: spacing.lg },
});
