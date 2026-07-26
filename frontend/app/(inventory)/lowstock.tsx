import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

export default function LowStock() {
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setItems(await api('/inventory/low-stock')); } catch {} finally { setLoading(false); }
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>Low Stock Alert</Text>
        <Text style={styles.sub}>{items.length} product{items.length !== 1 ? 's' : ''} need restocking</Text>
      </View>
      {loading ? <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} /> :
        items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle" size={72} color={colors.success} />
            <Text style={styles.emptyTxt}>All stock is healthy</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
            {items.map((p) => (
              <View testID={`low-${p.id}`} key={p.id} style={[styles.row, p.stock === 0 && { borderColor: colors.error }]}>
                <Image source={{ uri: p.image }} style={styles.img} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.meta}>{p.brand} • {formatINR(p.price)}</Text>
                  <View style={styles.badge}>
                    <Ionicons name="warning" size={12} color={p.stock === 0 ? colors.error : colors.warning} />
                    <Text style={[styles.badgeText, { color: p.stock === 0 ? colors.error : colors.warning }]}>
                      {p.stock === 0 ? 'OUT OF STOCK' : `Only ${p.stock} left`}
                    </Text>
                  </View>
                </View>
                <Pressable style={styles.gotoBtn} onPress={() => router.push('/(inventory)/stock')}>
                  <Ionicons name="arrow-forward" size={16} color={colors.text} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  sub: { color: colors.textDim, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyTxt: { color: colors.textDim, fontSize: fs.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg2, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.warning },
  img: { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  name: { color: colors.text, fontWeight: '600' },
  meta: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  badgeText: { fontSize: fs.sm, fontWeight: '700' },
  gotoBtn: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center' },
});
