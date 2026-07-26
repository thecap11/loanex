import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handle = async () => {
    setErr(null); setBusy(true);
    try {
      const u = await login(email.trim(), password);
      if (u.role === 'admin') router.replace('/(admin)/dashboard');
      else if (u.role === 'inventory_manager') router.replace('/(inventory)/stock');
      else router.replace('/(customer)/home');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const quickFill = (e: string, p: string) => { setEmail(e); setPassword(p); };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.logoDot} />
          <Text style={styles.brand}>LOANEX</Text>
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to your Instant EMI account</Text>

        <View style={styles.field}>
          <Ionicons name="mail-outline" size={18} color={colors.textDim} />
          <TextInput testID="login-email-input" style={styles.input} placeholder="Email" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        </View>
        <View style={styles.field}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textDim} />
          <TextInput testID="login-password-input" style={styles.input} placeholder="Password" placeholderTextColor={colors.textMuted} secureTextEntry value={password} onChangeText={setPassword} />
        </View>

        {err && <Text testID="login-error" style={styles.error}>{err}</Text>}

        <Pressable testID="login-submit-button" style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]} onPress={handle} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.black} /> : <Text style={styles.btnText}>Sign In</Text>}
        </Pressable>

        <View style={styles.registerRow}>
          <Text style={{ color: colors.textDim }}>New here?</Text>
          <Link href="/auth/register" asChild>
            <Pressable testID="go-register-link"><Text style={styles.link}> Create account</Text></Pressable>
          </Link>
        </View>

        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Quick Demo Access</Text>
          <Pressable testID="demo-customer" style={styles.demoRow} onPress={() => quickFill('customer@loanex.com', 'customer123')}>
            <Ionicons name="person-outline" color={colors.text} size={16} />
            <Text style={styles.demoText}>Customer: customer@loanex.com / customer123</Text>
          </Pressable>
          <Pressable testID="demo-admin" style={styles.demoRow} onPress={() => quickFill('admin@loanex.com', 'admin123')}>
            <Ionicons name="shield-checkmark-outline" color={colors.gold} size={16} />
            <Text style={styles.demoText}>Admin: admin@loanex.com / admin123</Text>
          </Pressable>
          <Pressable testID="demo-inventory" style={styles.demoRow} onPress={() => quickFill('inventory@loanex.com', 'inventory123')}>
            <Ionicons name="cube-outline" color={colors.success} size={16} />
            <Text style={styles.demoText}>Inventory: inventory@loanex.com / inventory123</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.xxxl * 1.5 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxl },
  logoDot: { width: 12, height: 12, backgroundColor: colors.gold, borderRadius: radius.pill },
  brand: { color: colors.text, fontSize: fs.lg, fontWeight: '700', letterSpacing: 4 },
  title: { color: colors.text, fontSize: fs.xxxl, fontWeight: '700', marginBottom: spacing.xs },
  sub: { color: colors.textDim, fontSize: fs.base, marginBottom: spacing.xl },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, height: 54 },
  input: { flex: 1, color: colors.text, fontSize: fs.lg },
  error: { color: colors.error, marginBottom: spacing.md },
  btn: { backgroundColor: colors.white, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  btnText: { color: colors.black, fontSize: fs.lg, fontWeight: '700' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  link: { color: colors.gold, fontWeight: '600' },
  demoBox: { marginTop: spacing.xxl, padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  demoTitle: { color: colors.textDim, fontSize: fs.sm, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  demoText: { color: colors.text, fontSize: fs.sm },
});
