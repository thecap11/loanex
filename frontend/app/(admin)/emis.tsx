import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

type Filter = 'all' | 'pending' | 'sanctioned' | 'active' | 'completed' | 'rejected';

export default function AdminEmis() {
  const { api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');

  const load = useCallback(async () => {
    try { setApps(await api('/admin/emi/applications')); } catch {} finally { setLoading(false); }
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = filter === 'all' ? apps : apps.filter((a) => a.status === filter);
  const counts: any = {}; apps.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });

  const scoreTier = (s: number) => s >= 750 ? { c: colors.info, l: 'Excellent' } : s >= 650 ? { c: colors.success, l: 'Good' } : s >= 500 ? { c: colors.warning, l: 'Fair' } : { c: colors.error, l: 'Poor' };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>EMI Review Hub</Text>
        <Text style={styles.sub}>Tap any application to review, edit and decide</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: 56 }} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: 'center' }}>
        {(['pending', 'sanctioned', 'active', 'completed', 'rejected', 'all'] as Filter[]).map((f) => (
          <Pressable testID={`emi-filter-${f}`} key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f.toUpperCase()}</Text>
            {counts[f] > 0 && <View style={[styles.count, filter === f && { backgroundColor: colors.black }]}><Text style={[styles.countText, filter === f && { color: colors.white }]}>{counts[f]}</Text></View>}
          </Pressable>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
          {filtered.length === 0 ? <Text style={styles.empty}>No applications</Text> : filtered.map((a) => {
            const tier = scoreTier(a.user_score || 500);
            return (
              <Pressable testID={`app-${a.id}`} key={a.id} style={styles.card} onPress={() => router.push(`/(admin)/emi/${a.id}`)}>
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
                    <Text style={styles.pmeta}>{a.tenure_months} months • {a.interest_rate}% APR{a.admin_edited ? ' • Edited' : ''}</Text>
                  </View>
                </View>
                <View style={styles.financeRow}>
                  <View><Text style={styles.dim}>Amount</Text><Text style={styles.val}>{formatINR(a.total_price)}</Text></View>
                  <View><Text style={styles.dim}>Down Pay</Text><Text style={styles.val}>{formatINR(a.down_payment)}</Text></View>
                  <View><Text style={styles.dim}>Monthly</Text><Text style={[styles.val, { color: colors.gold }]}>{formatINR(a.monthly_emi)}</Text></View>
                </View>
                <View style={styles.footer}>
                  <View style={[styles.statusChip, {
                    borderColor: a.status === 'pending' ? colors.warning : a.status === 'sanctioned' ? colors.info : a.status === 'active' ? colors.success : a.status === 'completed' ? colors.gold : colors.error,
                    backgroundColor: (a.status === 'pending' ? colors.warning : a.status === 'sanctioned' ? colors.info : a.status === 'active' ? colors.success : a.status === 'completed' ? colors.gold : colors.error) + '22'
                  }]}>
                    <Text style={[styles.statusText, {
                      color: a.status === 'pending' ? colors.warning : a.status === 'sanctioned' ? colors.info : a.status === 'active' ? colors.success : a.status === 'completed' ? colors.gold : colors.error
                    }]}>{a.status.toUpperCase()}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.reviewText}>Review</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.gold} />
                  </View>
                </View>
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
  chipText: { color: colors.textDim, fontWeight: '700', fontSize: fs.sm },
  chipTextActive: { color: colors.black },
  count: { backgroundColor: colors.bg3, borderRadius: radius.pill, paddingHorizontal: 6, minWidth: 20, alignItems: 'center' },
  countText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.bg2, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontWeight: '700' },
  userName: { color: colors.text, fontWeight: '700' },
  userEmail: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  scorePill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  scoreVal: { fontWeight: '700', fontSize: fs.lg },
  scoreLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, padding: spacing.sm, backgroundColor: colors.bg3, borderRadius: radius.sm },
  pimg: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.bg },
  pname: { color: colors.text, fontWeight: '600' },
  pmeta: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  dim: { color: colors.textDim, fontSize: fs.sm },
  val: { color: colors.text, fontWeight: '700', marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  statusText: { fontSize: fs.sm, fontWeight: '700' },
  reviewText: { color: colors.gold, fontWeight: '700', fontSize: fs.sm },
});
