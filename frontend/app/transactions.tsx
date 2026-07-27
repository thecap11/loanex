import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { formatDateTime } from '@/src/lib/emi';
import { transactionService } from '@/src/services/transactionService';

const TYPE_COLORS: Record<string, string> = { 'Down Payment': colors.primary, 'Monthly EMI': colors.success, 'Direct Purchase': colors.cyan };

export default function Transactions() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try { setTxns(await transactionService.getTransactions(user.id)); } catch (e) {} finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}><Text style={styles.title}>Transactions</Text></View>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>
      ) : txns.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={72} color={colors.textMuted} />
          <Text style={styles.emptyText}>No transactions recorded yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
          {txns.map((t) => (
            <View key={t.id} style={styles.card}>
              <View style={[styles.typeBadge, { backgroundColor: (TYPE_COLORS[t.type] || colors.textDim) + '20' }]}>
                <Text style={[styles.typeText, { color: TYPE_COLORS[t.type] || colors.textDim }]}>{t.type}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title2}>{t.title}</Text>
                <Text style={styles.ref}>Ref: {t.reference_id}</Text>
                <Text style={styles.meta}>{t.payment_method} • {formatDateTime(t.created_at)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amt}>{formatINR(t.amount)}</Text>
                <View style={styles.statusRow}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={styles.statusText}>Success</Text></View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  card: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, alignItems: 'flex-start' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  typeText: { fontSize: 10, fontWeight: '700' },
  title2: { color: colors.text, fontSize: fs.base, fontWeight: '600' },
  ref: { color: colors.textDim, fontSize: fs.xs, marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: fs.xs, marginTop: 2 },
  amt: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statusText: { color: colors.success, fontSize: fs.xs, fontWeight: '600' },
});
