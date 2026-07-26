import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINRShort, formatINR } from '@/src/utils/currency';

const { width } = Dimensions.get('window');

export default function AdminDashboard() {
  const { api, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([api('/admin/stats'), api('/admin/orders')]);
      setStats(s); setOrders(o.slice(0, 10));
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doLogout = async () => { await logout(); router.replace('/auth/login'); };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.white} /></View>;

  const maxTrend = Math.max(...(stats?.trend || []).map((t: any) => t.revenue), 1);
  const chartW = width - spacing.xl * 4;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.white} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.sub}>Admin Console</Text>
          <Text style={styles.title}>LoanEX Overview</Text>
        </View>
        <Pressable testID="admin-logout" onPress={doLogout} style={styles.logout}><Ionicons name="log-out-outline" size={18} color={colors.text} /></Pressable>
      </View>

      <View style={styles.metrics}>
        <MetricCard testID="stat-revenue" label="Revenue" value={formatINRShort(stats?.revenue || 0)} icon="cash" color={colors.gold} />
        <MetricCard testID="stat-orders" label="Orders" value={stats?.orders || 0} icon="cart" color={colors.success} />
        <MetricCard testID="stat-users" label="Users" value={stats?.users || 0} icon="people" color={colors.text} />
        <MetricCard testID="stat-products" label="Products" value={stats?.products || 0} icon="cube" color={colors.text} />
        <MetricCard testID="stat-emis" label="Pending EMIs" value={stats?.pending_emis || 0} icon="hourglass" color={colors.warning} />
        <MetricCard testID="stat-active" label="Active EMIs" value={stats?.active_emis || 0} icon="flash" color={colors.info} />
      </View>

      {/* Trend chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Revenue • Last 7 days</Text>
        <View style={styles.chart}>
          {(stats?.trend || []).map((t: any, i: number) => (
            <View key={i} style={styles.chartCol}>
              <View style={styles.chartBarWrap}>
                <View style={[styles.chartBar, { height: `${(t.revenue / maxTrend) * 100 || 2}%` }]} />
              </View>
              <Text style={styles.chartDay}>{t.day}</Text>
              <Text style={styles.chartVal}>{formatINRShort(t.revenue)}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.section}>Recent Orders</Text>
      {orders.length === 0 ? (
        <Text style={styles.empty}>No orders yet</Text>
      ) : orders.map((o) => (
        <View testID={`admin-order-${o.id}`} key={o.id} style={styles.orderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.orderUser}>{o.user_name} • {o.items.length} item{o.items.length > 1 ? 's' : ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.orderAmt}>{formatINR(o.subtotal)}</Text>
            <View style={[styles.chip, o.payment_method === 'emi' && { backgroundColor: 'rgba(212,175,55,0.15)', borderColor: colors.gold }]}>
              <Text style={[styles.chipText, o.payment_method === 'emi' && { color: colors.gold }]}>{o.payment_method === 'emi' ? 'EMI' : 'PAID'}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function MetricCard({ testID, label, value, icon, color }: any) {
  return (
    <View testID={testID} style={styles.metricCard}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  sub: { color: colors.gold, fontSize: fs.sm, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700', marginTop: 2 },
  logout: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.xl },
  metricCard: { width: '47%', flexGrow: 1, backgroundColor: colors.bg2, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, minHeight: 90 },
  metricLabel: { color: colors.textDim, fontSize: fs.sm, marginTop: 6 },
  metricValue: { fontSize: fs.xxl, fontWeight: '700', marginTop: 2 },
  chartCard: { marginHorizontal: spacing.xl, marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  chartTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.md },
  chart: { flexDirection: 'row', height: 140, alignItems: 'flex-end', justifyContent: 'space-between' },
  chartCol: { flex: 1, alignItems: 'center' },
  chartBarWrap: { flex: 1, width: 20, justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 4, backgroundColor: colors.gold, minHeight: 2 },
  chartDay: { color: colors.textDim, fontSize: fs.sm, marginTop: 4 },
  chartVal: { color: colors.text, fontSize: 10, fontWeight: '700', marginTop: 2 },
  section: { color: colors.text, fontSize: fs.lg, fontWeight: '700', paddingHorizontal: spacing.xl, marginTop: spacing.xl, marginBottom: spacing.md },
  empty: { color: colors.textDim, textAlign: 'center', paddingHorizontal: spacing.xl },
  orderRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.xl, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  orderId: { color: colors.text, fontWeight: '700' },
  orderUser: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  orderAmt: { color: colors.text, fontWeight: '700' },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, marginTop: 4, backgroundColor: 'rgba(16,185,129,0.15)', borderColor: colors.success },
  chipText: { fontSize: 10, fontWeight: '700', color: colors.success },
});
