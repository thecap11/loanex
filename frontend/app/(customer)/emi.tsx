import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

type Tab = 'pending' | 'sanctioned' | 'active' | 'completed' | 'rejected';

export default function EmiHub() {
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pending');
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setApps(await api('/emi/applications')); } catch {} finally { setLoading(false); }
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const tabs: { key: Tab; label: string; icon: string; color: string }[] = [
    { key: 'pending', label: 'Pending', icon: 'time', color: colors.warning },
    { key: 'sanctioned', label: 'Sanctioned', icon: 'checkmark-circle', color: colors.info },
    { key: 'active', label: 'Active', icon: 'flash', color: colors.success },
    { key: 'completed', label: 'Done', icon: 'trophy', color: colors.gold },
    { key: 'rejected', label: 'Rejected', icon: 'close-circle', color: colors.error },
  ];

  const filtered = apps.filter((a) => a.status === tab);
  const counts: any = {}; apps.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>EMI Hub</Text>
        <Text style={styles.sub}>Track your loan applications</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: 56 }} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: 'center' }}>
        {tabs.map((t) => (
          <Pressable testID={`emi-tab-${t.key}`} key={t.key} style={[styles.chip, tab === t.key && styles.chipActive]} onPress={() => setTab(t.key)}>
            <Ionicons name={t.icon as any} size={14} color={tab === t.key ? colors.black : t.color} />
            <Text style={[styles.chipText, tab === t.key && styles.chipTextActive]}>{t.label}</Text>
            {counts[t.key] > 0 && <View style={[styles.count, tab === t.key && { backgroundColor: colors.black }]}><Text style={[styles.countText, tab === t.key && { color: colors.white }]}>{counts[t.key]}</Text></View>}
          </Pressable>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={72} color={colors.textMuted} />
              <Text style={styles.emptyText}>No {tab} EMIs</Text>
              {tab === 'pending' && (
                <Pressable testID="browse-btn" style={styles.browseBtn} onPress={() => router.push('/(customer)/home')}>
                  <Text style={styles.browseText}>Browse products</Text>
                </Pressable>
              )}
            </View>
          ) : filtered.map((a) => {
            const paid = a.schedule?.filter((s: any) => s.status === 'paid').length || 0;
            const total = a.tenure_months;
            const nextEmi = a.schedule?.find((s: any) => s.status === 'pending');
            return (
              <Pressable testID={`emi-app-${a.id}`} key={a.id} style={styles.card} onPress={() => router.push(`/emi/${a.id}`)}>
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Image source={{ uri: a.product.image }} style={styles.img} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodName} numberOfLines={2}>{a.product.name}</Text>
                    <Text style={styles.meta}>{a.tenure_months} months • {formatINR(a.monthly_emi)}/mo</Text>
                    <Text style={styles.total}>Total: {formatINR(a.total_price)}</Text>
                  </View>
                </View>

                {a.status === 'active' && (
                  <>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${(paid / total) * 100}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{paid} of {total} installments paid</Text>
                    {nextEmi && <Text style={styles.nextEmi}>Next: {formatINR(nextEmi.amount)} due {new Date(nextEmi.due_date).toLocaleDateString()}</Text>}
                  </>
                )}

                {a.status === 'sanctioned' && (
                  <View style={styles.sanctionCta}>
                    <Text style={styles.sanctionText}>Sanctioned! Pay down payment of {formatINR(a.down_payment)} to activate.</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.gold} />
                  </View>
                )}

                {a.status === 'rejected' && a.admin_notes && (
                  <View style={styles.rejectBox}>
                    <Text style={styles.rejectLabel}>Rejection reason:</Text>
                    <Text style={styles.rejectText}>{a.admin_notes}</Text>
                  </View>
                )}

                {a.status === 'pending' && (
                  <View style={styles.pendingBox}>
                    <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
                    <Text style={styles.pendingText}>Awaiting admin review • Applied {new Date(a.created_at).toLocaleDateString()}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  sub: { color: colors.textDim, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  chipTextActive: { color: colors.black },
  count: { backgroundColor: colors.bg3, borderRadius: radius.pill, paddingHorizontal: 6, minWidth: 20, alignItems: 'center' },
  countText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', gap: spacing.md, marginTop: 60 },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  browseBtn: { backgroundColor: colors.white, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  browseText: { color: colors.black, fontWeight: '700' },
  card: { backgroundColor: colors.bg2, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  img: { width: 70, height: 70, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  prodName: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  total: { color: colors.gold, fontWeight: '700', marginTop: 2 },
  progressBar: { height: 6, backgroundColor: colors.bg3, borderRadius: 3, marginTop: spacing.md, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success },
  progressText: { color: colors.textDim, fontSize: fs.sm, marginTop: 6 },
  nextEmi: { color: colors.gold, fontWeight: '600', marginTop: 4 },
  sanctionCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.sm, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: colors.gold },
  sanctionText: { color: colors.text, flex: 1, fontSize: fs.sm },
  rejectBox: { marginTop: spacing.md, padding: spacing.md, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.error },
  rejectLabel: { color: colors.error, fontSize: fs.sm, fontWeight: '700' },
  rejectText: { color: colors.text, fontSize: fs.sm, marginTop: 4 },
  pendingBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  pendingText: { color: colors.warning, fontSize: fs.sm, fontWeight: '600' },
});
