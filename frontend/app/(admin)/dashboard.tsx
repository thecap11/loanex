import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { adminService } from '@/src/services/adminService';

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setStats(await adminService.getAdminStats()); } catch (e) {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const kpis = [
    { label: 'Total Products', value: stats?.totalProducts ?? 0, icon: 'cube', color: colors.primary },
    { label: 'Total Orders', value: stats?.totalOrders ?? 0, icon: 'bag', color: colors.cyan },
    { label: 'Pending Orders', value: stats?.pendingOrders ?? 0, icon: 'bicycle', color: colors.warning },
    { label: 'EMI Pending', value: stats?.emiPending ?? 0, icon: 'card', color: colors.success },
  ];

  const quickActions = [
    { label: 'Add Product', icon: 'add-circle', route: '/(admin)/products' },
    { label: 'Products', icon: 'cube', route: '/(admin)/products' },
    { label: 'Orders', icon: 'bag', route: '/(admin)/orders' },
    { label: 'EMI Review', icon: 'card', route: '/(admin)/emis' },
    { label: 'Customers', icon: 'people', route: '/(admin)/users' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>
        <Pressable style={styles.viewStoreBtn} onPress={() => router.push('/(customer)/home')}>
          <Ionicons name="storefront-outline" size={16} color={colors.primaryLight} />
          <Text style={styles.viewStoreText}>View Store</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.white} />}>
        <View style={styles.welcomeBanner}>
          <Text style={styles.welcomeTitle}>Welcome, Admin</Text>
          <Text style={styles.welcomeSub}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </View>

        {loading ? <ActivityIndicator color={colors.white} size="large" style={{ marginTop: spacing.xxl }} /> : (
          <>
            {/* KPI Grid */}
            <View style={styles.kpiGrid}>
              {kpis.map((k) => (
                <View key={k.label} style={styles.kpiCard}>
                  <View style={[styles.kpiIcon, { backgroundColor: k.color + '20' }]}>
                    <Ionicons name={k.icon as any} size={24} color={k.color} />
                  </View>
                  <Text style={styles.kpiValue}>{k.value}</Text>
                  <Text style={styles.kpiLabel}>{k.label}</Text>
                </View>
              ))}
            </View>

            {/* Revenue */}
            <View style={styles.revenueCard}>
              <Ionicons name="trending-up" size={28} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.revenueLabel}>Total Revenue</Text>
                <Text style={styles.revenueValue}>{formatINR(stats?.totalRevenue ?? 0)}</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickGrid}>
              {quickActions.map((a) => (
                <Pressable key={a.label} style={styles.quickCard} onPress={() => router.push(a.route as any)}>
                  <View style={styles.quickIcon}><Ionicons name={a.icon as any} size={24} color={colors.primaryLight} /></View>
                  <Text style={styles.quickLabel}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  viewStoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '20', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  viewStoreText: { color: colors.primaryLight, fontSize: fs.sm, fontWeight: '600' },
  welcomeBanner: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  welcomeTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  welcomeSub: { color: colors.textDim, fontSize: fs.sm, marginTop: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  kpiCard: { width: '47%', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: spacing.sm },
  kpiIcon: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { color: colors.text, fontSize: fs.xxxl, fontWeight: '700' },
  kpiLabel: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  revenueCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.success + '15', borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.success + '30', marginBottom: spacing.lg },
  revenueLabel: { color: colors.textDim, fontSize: fs.sm },
  revenueValue: { color: colors.text, fontSize: fs.huge, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginBottom: spacing.sm },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quickCard: { width: '31%', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  quickIcon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: colors.text, fontSize: fs.xs, fontWeight: '600', textAlign: 'center' },
});
