import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR, formatINRShort } from '@/src/utils/currency';

export default function Credit() {
  const { api, user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setProfile(await api('/credit/profile')); } catch {} finally { setLoading(false); }
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !profile) return <View style={styles.center}><ActivityIndicator color={colors.white} /></View>;

  const tierColor = profile.tier === 'excellent' ? colors.info : profile.tier === 'good' ? colors.success : profile.tier === 'fair' ? colors.warning : colors.error;
  const pct = Math.max(0, Math.min(1, (profile.credit_score - 300) / 600));
  const utilizationPct = profile.utilization / 100;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 100 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Credit Profile</Text>
        <Text style={styles.sub}>Your creditworthiness at a glance</Text>
      </View>

      {/* Score gauge */}
      <View style={styles.gaugeCard}>
        <LinearGradient colors={[colors.bg2, colors.bg3]} style={StyleSheet.absoluteFill} />
        <View style={styles.gauge}>
          <View style={styles.gaugeBg} />
          <View style={[styles.gaugeFill, { width: `${pct * 100}%`, backgroundColor: tierColor }]} />
        </View>
        <View style={styles.gaugeLabels}>
          <Text style={styles.gaugeMin}>300</Text>
          <Text style={styles.gaugeMax}>900</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreNum, { color: tierColor }]}>{profile.credit_score}</Text>
          <View style={[styles.tierBadge, { borderColor: tierColor, backgroundColor: tierColor + '22' }]}>
            <Text style={[styles.tierText, { color: tierColor }]}>{profile.tier.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Limits */}
      <View style={styles.limitsCard}>
        <Text style={styles.sectionLabel}>CREDIT LIMIT</Text>
        <Text style={styles.limitTotal}>{formatINR(profile.approved_limit)}</Text>
        <View style={styles.utilBar}>
          <View style={[styles.utilFill, { width: `${utilizationPct * 100}%` }]} />
        </View>
        <View style={styles.limitRow}>
          <View>
            <Text style={styles.dim}>Available</Text>
            <Text style={[styles.limitVal, { color: colors.success }]}>{formatINR(profile.available_limit)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.dim}>Used</Text>
            <Text style={[styles.limitVal, { color: colors.warning }]}>{formatINR(profile.used_limit)}</Text>
          </View>
        </View>
        <Text style={styles.utilLabel}>Utilization: {profile.utilization}%</Text>
      </View>

      {/* KYC prompt */}
      {user?.kyc_status !== 'verified' && (
        <Pressable testID="kyc-cta" style={styles.kycCard} onPress={() => router.push('/kyc')}>
          <Ionicons name="shield-outline" size={24} color={colors.gold} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.kycTitle}>Complete KYC to boost your limit</Text>
            <Text style={styles.kycSub}>Verified users get higher credit limits and lower interest rates.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      )}

      {/* Factors */}
      <Text style={styles.section}>Score Factors</Text>
      {profile.factors.map((f: any, i: number) => (
        <View key={i} style={styles.factorRow}>
          <View style={[styles.factorDot, {
            backgroundColor: f.status === 'good' ? colors.success : f.status === 'warn' ? colors.warning : f.status === 'bad' ? colors.error : colors.textMuted
          }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.factorName}>{f.name}</Text>
            <Text style={styles.factorImpact}>{f.impact} Impact{f.value ? ` • ${f.value}` : ''}</Text>
          </View>
          <Ionicons
            name={f.status === 'good' ? 'checkmark-circle' : f.status === 'warn' ? 'warning' : 'alert-circle'}
            size={20}
            color={f.status === 'good' ? colors.success : f.status === 'warn' ? colors.warning : colors.error}
          />
        </View>
      ))}

      {/* EMI summary */}
      <Text style={styles.section}>EMI Summary</Text>
      <View style={styles.emiSummary}>
        <View style={styles.emiStat}>
          <Text style={styles.dim}>Active</Text>
          <Text style={[styles.emiStatVal, { color: colors.gold }]}>{profile.active_emis}</Text>
        </View>
        <View style={styles.emiStat}>
          <Text style={styles.dim}>Completed</Text>
          <Text style={[styles.emiStatVal, { color: colors.success }]}>{profile.completed_emis}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  sub: { color: colors.textDim, marginTop: 4 },
  gaugeCard: { marginHorizontal: spacing.xl, padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, overflow: 'hidden', alignItems: 'center' },
  gauge: { width: '100%', height: 10, borderRadius: 5, backgroundColor: colors.bg3, overflow: 'hidden' },
  gaugeBg: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg3 },
  gaugeFill: { height: '100%', borderRadius: 5 },
  gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 4 },
  gaugeMin: { color: colors.textMuted, fontSize: fs.sm },
  gaugeMax: { color: colors.textMuted, fontSize: fs.sm },
  scoreBlock: { alignItems: 'center', marginTop: spacing.lg },
  scoreNum: { fontSize: 56, fontWeight: '700', lineHeight: 62 },
  tierBadge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.sm },
  tierText: { fontSize: fs.sm, fontWeight: '700', letterSpacing: 1 },
  limitsCard: { marginHorizontal: spacing.xl, marginTop: spacing.md, padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  sectionLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  limitTotal: { color: colors.text, fontSize: fs.xxxl, fontWeight: '700', marginTop: 4 },
  utilBar: { height: 8, backgroundColor: colors.bg3, borderRadius: 4, marginTop: spacing.md, overflow: 'hidden' },
  utilFill: { height: '100%', backgroundColor: colors.warning, borderRadius: 4 },
  limitRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  dim: { color: colors.textDim, fontSize: fs.sm },
  limitVal: { fontWeight: '700', fontSize: fs.lg, marginTop: 2 },
  utilLabel: { color: colors.textDim, marginTop: spacing.sm, fontSize: fs.sm },
  kycCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.xl, marginTop: spacing.md, padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold },
  kycTitle: { color: colors.text, fontWeight: '700' },
  kycSub: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  section: { color: colors.text, fontSize: fs.lg, fontWeight: '700', paddingHorizontal: spacing.xl, marginTop: spacing.xl, marginBottom: spacing.sm },
  factorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.xl, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  factorDot: { width: 10, height: 10, borderRadius: 5 },
  factorName: { color: colors.text, fontWeight: '600' },
  factorImpact: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  emiSummary: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl },
  emiStat: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  emiStatVal: { fontSize: fs.xxxl, fontWeight: '700', marginTop: 4 },
});
