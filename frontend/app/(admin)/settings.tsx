import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

export default function AdminSettings() {
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const [cfg, setCfg] = useState<any>(null);
  const [rate, setRate] = useState('');
  const [threshold, setThreshold] = useState('');
  const [tenures, setTenures] = useState('');
  const [dp, setDp] = useState('');
  const [fee, setFee] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const c = await api('/emi/config');
    setCfg(c);
    setRate(String(c.interest_rate));
    setThreshold(String(c.threshold));
    setTenures(c.tenures.join(','));
    setDp(String(c.down_payment_percent));
    setFee(String(c.processing_fee));
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await api('/emi/config', {
        method: 'PUT',
        body: JSON.stringify({
          interest_rate: parseFloat(rate),
          threshold: parseFloat(threshold),
          tenures: tenures.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)),
          down_payment_percent: parseFloat(dp),
          processing_fee: parseFloat(fee),
        }),
      });
      setMsg('Saved successfully');
      setTimeout(() => setMsg(null), 2000);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, padding: spacing.xl, paddingBottom: 100 }}>
      <Text style={styles.title}>EMI Configuration</Text>
      <Text style={styles.sub}>Control the EMI engine across the store</Text>

      {!cfg ? <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} /> : (
        <>
          <Text style={styles.label}>Annual Interest Rate (%)</Text>
          <TextInput testID="cfg-rate" style={styles.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
          <Text style={styles.label}>Down Payment (%)</Text>
          <TextInput testID="cfg-dp" style={styles.input} value={dp} onChangeText={setDp} keyboardType="decimal-pad" />
          <Text style={styles.label}>Processing Fee (₹)</Text>
          <TextInput testID="cfg-fee" style={styles.input} value={fee} onChangeText={setFee} keyboardType="decimal-pad" />
          <Text style={styles.label}>Minimum Order for EMI (₹)</Text>
          <TextInput testID="cfg-threshold" style={styles.input} value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad" />
          <Text style={styles.label}>Tenures (months, comma-separated)</Text>
          <TextInput testID="cfg-tenures" style={styles.input} value={tenures} onChangeText={setTenures} />

          <Pressable testID="cfg-save" style={styles.btn} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.black} /> : <Text style={styles.btnText}>Save Configuration</Text>}
          </Pressable>
          {msg && <Text style={styles.msg}>{msg}</Text>}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  sub: { color: colors.textDim, marginTop: 4, marginBottom: spacing.xl },
  label: { color: colors.textDim, fontSize: fs.sm, marginTop: spacing.lg, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' },
  input: { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, padding: spacing.md, fontSize: fs.lg },
  btn: { marginTop: spacing.xl, height: 54, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.black, fontSize: fs.lg, fontWeight: '700' },
  msg: { color: colors.success, textAlign: 'center', marginTop: spacing.md, fontWeight: '600' },
});
