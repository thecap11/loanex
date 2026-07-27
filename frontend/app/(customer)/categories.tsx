import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fs } from '@/src/theme';
import { productService } from '@/src/services/productService';

const { width } = Dimensions.get('window');
const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;

export default function Categories() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const [cats, prods] = await Promise.all([productService.getCategories(), productService.getProducts()]);
        setCategories(cats);
        setProducts(prods);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []));

  const getProductCount = (catId: string) => products.filter((p) => p.category_id === catId).length;

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
        <View style={styles.grid}>
          {categories.map((c) => (
            <Pressable key={c.id} style={styles.card} onPress={() => router.push({ pathname: '/(customer)/home', params: { cat: c.name } })}>
              <View style={[styles.iconCircle, { backgroundColor: c.color + '20' }]}>
                <Ionicons name={c.icon as any} size={28} color={c.color} />
              </View>
              <Text style={styles.catName}>{c.name}</Text>
              <Text style={styles.count}>{getProductCount(c.id)} products</Text>
              <View style={styles.subRow}>
                {c.subcategories?.slice(0, 2).map((s: string) => (
                  <View key={s} style={styles.subChip}><Text style={styles.subText}>{s}</Text></View>
                ))}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { width: CARD_W, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  iconCircle: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  catName: { color: colors.text, fontSize: fs.base, fontWeight: '700', textAlign: 'center' },
  count: { color: colors.textDim, fontSize: fs.xs, marginTop: 2 },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm, justifyContent: 'center' },
  subChip: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  subText: { color: colors.textDim, fontSize: 10 },
});
