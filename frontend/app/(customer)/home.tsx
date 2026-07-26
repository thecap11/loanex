import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR, formatINRShort } from '@/src/utils/currency';

const { width } = Dimensions.get('window');
const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;

export default function Home() {
  const { user, api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [credit, setCredit] = useState<any>(null);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cats, prods, cr] = await Promise.all([
        api('/categories'),
        api(`/products${cat !== 'All' ? `?category=${encodeURIComponent(cat)}` : ''}${q ? `${cat !== 'All' ? '&' : '?'}q=${encodeURIComponent(q)}` : ''}`),
        api('/credit/profile'),
      ]);
      setCategories(cats); setProducts(prods); setCredit(cr);
    } catch (e) {} finally { setLoading(false); setRefreshing(false); }
  }, [api, cat, q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const featured = products[0];
  const tierColor = credit?.tier === 'excellent' ? colors.info : credit?.tier === 'good' ? colors.success : credit?.tier === 'fair' ? colors.warning : colors.error;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Hello, {user?.name?.split(' ')[0] || 'there'}</Text>
          <Text style={styles.title}>LoanEX</Text>
        </View>
        <Pressable testID="notif-btn" style={styles.iconBtn}>
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <Pressable testID="credit-banner" style={styles.creditBanner} onPress={() => router.push('/(customer)/credit')}>
        <LinearGradient colors={[colors.bg3, colors.bg2]} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1 }}>
          <Text style={styles.creditLabel}>CREDIT SCORE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={[styles.creditScore, { color: tierColor }]}>{credit?.credit_score || '—'}</Text>
            <Text style={styles.creditMax}>/900</Text>
          </View>
          <Text style={[styles.tierBadge, { color: tierColor }]}>{(credit?.tier || 'fair').toUpperCase()}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.creditLabel}>AVAILABLE</Text>
          <Text style={styles.creditLimit}>{formatINRShort(credit?.available_limit || 0)}</Text>
          <Text style={styles.approvedLimit}>of {formatINRShort(credit?.approved_limit || 0)}</Text>
        </View>
      </Pressable>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textDim} />
        <TextInput testID="search-input" placeholder="Search phones, laptops, TVs..." placeholderTextColor={colors.textMuted} style={styles.search} value={q} onChangeText={setQ} onSubmitEditing={load} returnKeyType="search" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipContent}>
        {categories.map((c) => (
          <Pressable testID={`chip-${c}`} key={c} style={[styles.chip, cat === c && styles.chipActive]} onPress={() => setCat(c)}>
            <Text style={[styles.chipText, cat === c && styles.chipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.white} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.white} />}
        >
          {featured && (
            <Pressable testID={`featured-${featured.id}`} style={styles.hero} onPress={() => router.push(`/product/${featured.id}`)}>
              <Image source={{ uri: featured.image }} style={styles.heroImg} contentFit="cover" />
              <LinearGradient colors={['transparent', 'rgba(10,10,10,0.95)']} style={styles.heroOverlay} />
              <View style={styles.heroContent}>
                <View style={styles.emiBadge}><Text style={styles.emiBadgeText}>EMI from {formatINR(featured.price / 12 * 1.06)}/mo</Text></View>
                <Text style={styles.heroName}>{featured.name}</Text>
                <Text style={styles.heroPrice}>{formatINR(featured.price)}</Text>
              </View>
            </Pressable>
          )}

          <Text style={styles.sectionTitle}>All Products</Text>
          <View style={styles.grid}>
            {products.slice(1).map((p) => (
              <Pressable testID={`product-${p.id}`} key={p.id} style={styles.card} onPress={() => router.push(`/product/${p.id}`)}>
                <View style={styles.cardImgWrap}>
                  <Image source={{ uri: p.image }} style={styles.cardImg} contentFit="cover" />
                  {p.stock < 5 && p.stock > 0 && (
                    <View style={styles.stockBadge}><Text style={styles.stockBadgeText}>Only {p.stock} left</Text></View>
                  )}
                  {p.stock === 0 && (
                    <View style={[styles.stockBadge, { backgroundColor: colors.error }]}><Text style={styles.stockBadgeText}>Out of stock</Text></View>
                  )}
                </View>
                <Text style={styles.brand}>{p.brand}</Text>
                <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.price}>{formatINR(p.price)}</Text>
                    {p.mrp && p.mrp > p.price && <Text style={styles.mrp}>{formatINR(p.mrp)}</Text>}
                  </View>
                  {p.emi_eligible && <Text style={styles.emiHint}>EMI</Text>}
                </View>
              </Pressable>
            ))}
          </View>
          {products.length === 0 && <Text style={styles.empty}>No products found</Text>}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  hello: { color: colors.textDim, fontSize: fs.sm },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700', marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  creditBanner: { flexDirection: 'row', marginHorizontal: spacing.xl, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, overflow: 'hidden' },
  creditLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  creditScore: { fontSize: fs.xxxl, fontWeight: '700', marginTop: 2 },
  creditMax: { color: colors.textDim, fontSize: fs.base, marginLeft: 2 },
  tierBadge: { fontSize: fs.sm, fontWeight: '700', marginTop: 2, letterSpacing: 1 },
  creditLimit: { color: colors.gold, fontSize: fs.xxl, fontWeight: '700', marginTop: 2 },
  approvedLimit: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, marginTop: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, height: 46, borderWidth: 1, borderColor: colors.border },
  search: { flex: 1, color: colors.text, fontSize: fs.base },
  chipRow: { height: 56, marginTop: spacing.md, flexGrow: 0 },
  chipContent: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: 'center' },
  chip: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  chipTextActive: { color: colors.black },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 220, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.xl, backgroundColor: colors.bg2 },
  heroImg: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  heroContent: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  emiBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(212,175,55,0.2)', borderColor: colors.gold, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4, marginBottom: spacing.sm },
  emiBadgeText: { color: colors.gold, fontSize: fs.sm, fontWeight: '700' },
  heroName: { color: colors.white, fontSize: fs.xxl, fontWeight: '700' },
  heroPrice: { color: colors.white, fontSize: fs.lg, marginTop: 2, opacity: 0.9 },
  sectionTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700', marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { width: CARD_W, backgroundColor: colors.bg2, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardImgWrap: { height: 120, borderRadius: radius.sm, overflow: 'hidden', marginBottom: spacing.sm, backgroundColor: colors.bg3 },
  cardImg: { width: '100%', height: '100%' },
  stockBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: colors.warning, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  stockBadgeText: { color: colors.black, fontSize: 10, fontWeight: '700' },
  brand: { color: colors.textDim, fontSize: fs.sm },
  name: { color: colors.text, fontSize: fs.base, fontWeight: '600', marginTop: 2, minHeight: 36 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  price: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  mrp: { color: colors.textMuted, fontSize: fs.sm, textDecorationLine: 'line-through' },
  emiHint: { color: colors.gold, fontSize: fs.sm, fontWeight: '700' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: spacing.xl },
});
