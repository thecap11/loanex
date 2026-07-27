import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR, formatINRShort } from '@/src/utils/currency';
import { getCreditRating } from '@/src/lib/emi';
import { creditService } from '@/src/services/creditService';

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [credit, setCredit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try { setCredit(await creditService.getCreditProfile(user.id)); } catch (e) {} finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rating = credit ? getCreditRating(credit.cibil_score) : { label: 'Good', color: colors.success };
  const initials = (user?.name || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const quickActions = [
    { label: 'My Orders', icon: 'receipt', route: '/(customer)/orders' },
    { label: 'My EMIs', icon: 'card', route: '/(customer)/emi' },
    { label: 'Addresses', icon: 'location', route: '/addresses' },
    { label: 'Transactions', icon: 'wallet', route: '/transactions' },
  ];

  const menuLinks = ['Edit Personal Details', 'Notification Preferences', 'Security', 'Support & Help', 'Privacy Policy'];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}><Text style={styles.title}>Account</Text></View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
          {/* User Identity Card */}
          <View style={styles.userCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user?.name || 'User'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <Text style={styles.userPhone}>{user?.mobile}</Text>
              <View style={[styles.kycBadge, { backgroundColor: credit?.kyc_status === 'VERIFIED' ? colors.success + '20' : colors.warning + '20' }]}>
                <Text style={[styles.kycText, { color: credit?.kyc_status === 'VERIFIED' ? colors.success : colors.warning }]}>
                  KYC {credit?.kyc_status || 'PENDING'}
                </Text>
              </View>
            </View>
          </View>

          {/* Credit Summary */}
          <Pressable style={styles.creditBanner} onPress={() => router.push('/(customer)/credit')}>
            <LinearGradient colors={[colors.card, colors.cardHover]} style={StyleSheet.absoluteFill} />
            <View style={{ flex: 1 }}>
              <Text style={styles.creditLabel}>Available Credit Limit</Text>
              <Text style={styles.creditLimit}>{formatINR(credit?.available_limit || 50000)}</Text>
              <Text style={styles.creditApproved}>Approved: {formatINRShort(credit?.approved_limit || 50000)}</Text>
            </View>
            <View style={styles.scoreCircle}>
              <Text style={[styles.scoreNum, { color: rating.color }]}>{credit?.cibil_score || 750}</Text>
              <Text style={styles.scoreLabel}>CIBIL</Text>
            </View>
          </Pressable>

          {/* Quick Actions */}
          <View style={styles.quickGrid}>
            {quickActions.map((a) => (
              <Pressable key={a.label} style={styles.quickCard} onPress={() => router.push(a.route as any)}>
                <View style={styles.quickIcon}><Ionicons name={a.icon as any} size={24} color={colors.primaryLight} /></View>
                <Text style={styles.quickLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Menu Links */}
          <View style={styles.menuCard}>
            {menuLinks.map((m, i) => (
              <Pressable key={m} style={[styles.menuRow, i < menuLinks.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={styles.menuText}>{m}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>

          {/* Sign Out */}
          <Pressable style={styles.signOutBtn} onPress={async () => { await logout(); router.replace('/auth/login'); }}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.signOutText}>Sign Out of LoanEX</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  userCard: { flexDirection: 'row', gap: spacing.lg, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  avatar: { width: 60, height: 60, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: fs.xxl, fontWeight: '700' },
  userName: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  userEmail: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  userPhone: { color: colors.textDim, fontSize: fs.sm },
  kycBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, marginTop: spacing.sm },
  kycText: { fontSize: 10, fontWeight: '700' },
  creditBanner: { flexDirection: 'row', padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.lg },
  creditLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  creditLimit: { color: colors.white, fontSize: fs.xxl, fontWeight: '700' },
  creditApproved: { color: colors.textDim, fontSize: fs.sm },
  scoreCircle: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border },
  scoreNum: { fontSize: fs.xl, fontWeight: '700' },
  scoreLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 1, fontWeight: '700' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  quickCard: { width: '47%', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  quickIcon: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  menuCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  menuText: { color: colors.text, fontSize: fs.base },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg, backgroundColor: colors.error + '10', borderRadius: radius.md, borderWidth: 1, borderColor: colors.error + '30' },
  signOutText: { color: colors.error, fontWeight: '700', fontSize: fs.base },
});
