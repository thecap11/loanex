import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const doLogout = async () => { await logout(); router.replace('/auth/login'); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 100 }}>
      <View style={styles.header}><Text style={styles.title}>Profile</Text></View>
      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text></View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}><Text style={styles.roleText}>{user?.role.toUpperCase().replace('_', ' ')}</Text></View>
        {user?.kyc_status === 'verified' && (
          <View style={styles.kycTag}>
            <Ionicons name="shield-checkmark" size={12} color={colors.success} />
            <Text style={styles.kycTagText}>KYC VERIFIED</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <MenuRow tid="menu-kyc" icon={user?.kyc_status === 'verified' ? 'shield-checkmark-outline' : 'shield-outline'}
          label={user?.kyc_status === 'verified' ? 'KYC Verified' : 'Complete KYC'}
          onPress={() => router.push('/kyc')}
          tint={user?.kyc_status === 'verified' ? colors.success : colors.gold}
        />
        <MenuRow tid="menu-addr" icon="location-outline" label="Delivery Addresses" onPress={() => router.push('/addresses')} />
        <MenuRow tid="menu-orders" icon="receipt-outline" label="Direct Orders" onPress={() => router.push('/(customer)/orders')} />
        <MenuRow tid="menu-credit" icon="card-outline" label="Credit Profile" onPress={() => router.push('/(customer)/credit')} />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <MenuRow icon="help-circle-outline" label="Help & FAQ" onPress={() => {}} />
        <MenuRow icon="chatbubble-outline" label="Contact us" onPress={() => {}} />
        <MenuRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => {}} />
      </View>

      <Pressable testID="logout-btn" style={styles.logoutBtn} onPress={doLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function MenuRow({ icon, label, onPress, tint, tid }: any) {
  return (
    <Pressable testID={tid} style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={20} color={tint || colors.text} />
      <Text style={[styles.rowLabel, tint && { color: tint }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  profileCard: { alignItems: 'center', padding: spacing.xl, marginHorizontal: spacing.xl, backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarText: { color: colors.black, fontSize: 28, fontWeight: '700' },
  name: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  email: { color: colors.textDim, marginTop: 2 },
  roleBadge: { marginTop: spacing.md, backgroundColor: colors.bg3, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  roleText: { color: colors.gold, fontSize: fs.sm, fontWeight: '700', letterSpacing: 1 },
  kycTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  kycTagText: { color: colors.success, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  section: { marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  sectionTitle: { color: colors.textDim, fontSize: fs.sm, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg2, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  rowLabel: { flex: 1, color: colors.text, fontSize: fs.base },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error, backgroundColor: 'rgba(239,68,68,0.08)' },
  logoutText: { color: colors.error, fontWeight: '700', fontSize: fs.base },
});
