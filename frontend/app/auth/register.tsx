import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handle = async () => {
    setErr(null); setBusy(true);
    try {
      await register(email.trim(), password, name.trim(), 'customer');
      router.replace('/(customer)/home');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable testID="register-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.sub}>Start shopping premium electronics with EMI</Text>

        <View style={styles.field}>
          <Ionicons name="person-outline" size={18} color={colors.textDim} />
          <TextInput testID="register-name-input" style={styles.input} placeholder="Full name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
        </View>
        <View style={styles.field}>
          <Ionicons name="mail-outline" size={18} color={colors.textDim} />
          <TextInput testID="register-email-input" style={styles.input} placeholder="Email" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        </View>
        <View style={styles.field}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textDim} />
          <TextInput testID="register-password-input" style={styles.input} placeholder="Password (min 6)" placeholderTextColor={colors.textMuted} secureTextEntry value={password} onChangeText={setPassword} />
        </View>

        {err && <Text testID="register-error" style={styles.error}>{err}</Text>}

        <Pressable testID="register-submit-button" style={styles.btn} onPress={handle} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.black} /> : <Text style={styles.btnText}>Create account</Text>}
        </Pressable>

        <View style={styles.registerRow}>
          <Text style={{ color: colors.textDim }}>Have an account?</Text>
          <Link href="/auth/login" asChild>
            <Pressable testID="go-login-link"><Text style={styles.link}> Sign in</Text></Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.xxxl },
  back: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: fs.xxxl, fontWeight: '700', marginBottom: spacing.xs },
  sub: { color: colors.textDim, fontSize: fs.base, marginBottom: spacing.xl },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, height: 54 },
  input: { flex: 1, color: colors.text, fontSize: fs.lg },
  error: { color: colors.error, marginBottom: spacing.md },
  btn: { backgroundColor: colors.white, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  btnText: { color: colors.black, fontSize: fs.lg, fontWeight: '700' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  link: { color: colors.gold, fontWeight: '600' },
});
