import { useCallback, useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Dimensions, Modal, FlatList, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/context/CartContext';
import { useAlert } from '@/src/context/AlertContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR, formatINRShort } from '@/src/utils/currency';
import { productService } from '@/src/services/productService';
import { creditService } from '@/src/services/creditService';
import { notificationService } from '@/src/services/notificationService';
import { getCreditRating } from '@/src/lib/emi';

const { width } = Dimensions.get('window');
const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;

type SortOption = 'popularity' | 'price_low' | 'price_high' | 'newest' | 'discount';
type PriceRange = 'all' | 'under10k' | '10k25k' | '25k50k' | 'above50k';

export default function Home() {
  const { user, logout } = useAuth();
  const { addItem } = useCart();
  const { toast } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [credit, setCredit] = useState<any>(null);
  const [activeCat, setActiveCat] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showFilter, setShowFilter] = useState(false);
  const [sort, setSort] = useState<SortOption>('popularity');
  const [priceRange, setPriceRange] = useState<PriceRange>('all');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [countdown, setCountdown] = useState('');

  const load = useCallback(async () => {
    try {
      const [cats, prods] = await Promise.all([
        productService.getCategories(),
        productService.getProducts(),
      ]);
      setCategories(cats);
      setProducts(prods);
      if (user) {
        try {
          const cr = await creditService.getCreditProfile(user.id);
          setCredit(cr);
          const count = await notificationService.getUnreadCount(user.id);
          setUnreadCount(count);
        } catch (e) {}
      }
    } catch (e) {
      console.warn('[home] load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const brands = useMemo(() => {
    const set = new Set(products.map((p) => p.brand).filter(Boolean));
    return Array.from(set);
  }, [products]);

  const filtered = useMemo(() => {
    let result = [...products];
    if (activeCat !== 'All') {
      const cat = categories.find((c) => c.name === activeCat);
      if (cat) result = result.filter((p) => p.category_id === cat.id);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
    }
    if (selectedBrand) result = result.filter((p) => p.brand === selectedBrand);
    switch (priceRange) {
      case 'under10k': result = result.filter((p) => p.price < 10000); break;
      case '10k25k': result = result.filter((p) => p.price >= 10000 && p.price < 25000); break;
      case '25k50k': result = result.filter((p) => p.price >= 25000 && p.price < 50000); break;
      case 'above50k': result = result.filter((p) => p.price >= 50000); break;
    }
    switch (sort) {
      case 'price_low': result.sort((a, b) => a.price - b.price); break;
      case 'price_high': result.sort((a, b) => b.price - a.price); break;
      case 'newest': result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'discount': result.sort((a, b) => {
        const da = a.original_price > 0 ? (a.original_price - a.price) / a.original_price : 0;
        const db = b.original_price > 0 ? (b.original_price - b.price) / b.original_price : 0;
        return db - da;
      }); break;
    }
    return result;
  }, [products, activeCat, search, selectedBrand, priceRange, sort, categories]);

  const flashDeals = useMemo(() => products.filter((p) => p.is_flash_deal), [products]);
  const bestSellers = useMemo(() => products.filter((p) => p.is_best_seller), [products]);

  const getDiscountPct = (p: any) => {
    if (!p.original_price || p.original_price <= p.price) return 0;
    return Math.round(((p.original_price - p.price) / p.original_price) * 100);
  };

  const handleAddToCart = (p: any) => {
    addItem({
      productId: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.original_price,
      image: p.images?.[0] || '',
      brand: p.brand,
      emiEnabled: p.is_emi_enabled,
    });
    toast('Added to cart', 'success');
  };

  const renderProductCard = (p: any) => {
    const disc = getDiscountPct(p);
    return (
      <Pressable key={p.id} style={styles.card} onPress={() => router.push(`/product/${p.id}`)}>
        <View style={styles.cardImgWrap}>
          <Image source={{ uri: p.images?.[0] }} style={styles.cardImg} contentFit="cover" />
          {disc > 0 && <View style={styles.discBadge}><Text style={styles.discBadgeText}>-{disc}%</Text></View>}
          {p.is_emi_enabled && <View style={styles.emiBadge}><Text style={styles.emiBadgeText}>EMI</Text></View>}
        </View>
        <Text style={styles.brand}>{p.brand}</Text>
        <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.price}>{formatINR(p.price)}</Text>
            {p.original_price > p.price && <Text style={styles.mrp}>{formatINR(p.original_price)}</Text>}
          </View>
        </View>
        <Pressable style={styles.addBtn} onPress={() => handleAddToCart(p)}>
          <Text style={styles.addBtnText}>Add to Cart</Text>
        </Pressable>
      </Pressable>
    );
  };

  const rating = credit ? getCreditRating(credit.cibil_score) : { label: 'Good', color: colors.success };
  const utilPct = credit && credit.approved_limit > 0 ? ((credit.approved_limit - credit.available_limit) / credit.approved_limit) * 100 : 0;

  const drawerItems = [
    { label: 'Store Home', icon: 'home', route: '/(customer)/home' },
    { label: 'Cart', icon: 'cart', route: '/(customer)/cart' },
    { label: 'My EMIs', icon: 'card', route: '/(customer)/emi' },
    { label: 'My Orders', icon: 'receipt', route: '/(customer)/orders' },
    { label: 'Addresses', icon: 'location', route: '/addresses' },
    { label: 'Transactions', icon: 'wallet', route: '/transactions' },
    { label: 'Credit Score', icon: 'speedometer', route: '/(customer)/credit' },
    { label: 'Notifications', icon: 'notifications', route: '/notifications' },
    ...(user?.role === 'admin' ? [{ label: 'Admin Panel', icon: 'shield', route: '/(admin)/dashboard' }] : []),
    { label: 'Sign Out', icon: 'log-out', route: '__logout__' },
  ];

  const handleDrawerPress = async (route: string) => {
    setDrawerOpen(false);
    if (route === '__logout__') {
      await logout();
      router.replace('/auth/login');
      return;
    }
    router.push(route as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => setDrawerOpen(true)} style={styles.iconBtn}>
          <Ionicons name="menu" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>LoanEX</Text>
        <Pressable onPress={() => router.push('/notifications')} style={styles.iconBtn}>
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
        </Pressable>
      </View>

      {/* Drawer */}
      <Modal visible={drawerOpen} transparent animationType="slide">
        <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)}>
          <Pressable style={styles.drawer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>LoanEX</Text>
              <Text style={styles.drawerSub}>{user?.name || 'Guest'}</Text>
            </View>
            {drawerItems.map((item) => (
              <Pressable key={item.label} style={styles.drawerItem} onPress={() => handleDrawerPress(item.route)}>
                <Ionicons name={item.icon as any} size={20} color={colors.textDim} />
                <Text style={styles.drawerItemText}>{item.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.white} />}
      >
        {/* Credit Card Banner */}
        <Pressable style={styles.creditBanner} onPress={() => router.push('/(customer)/credit')}>
          <LinearGradient colors={[colors.card, colors.cardHover]} style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1 }}>
            <Text style={styles.creditHello}>Hi, {user?.name?.split(' ')[0] || 'there'}</Text>
            <Text style={styles.creditLabel}>Available Credit Limit</Text>
            <Text style={styles.creditLimit}>{formatINR(credit?.available_limit || 50000)}</Text>
            <Text style={styles.creditApproved}>Approved: {formatINRShort(credit?.approved_limit || 50000)}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${100 - utilPct}%` }]} />
            </View>
          </View>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreNum, { color: rating.color }]}>{credit?.cibil_score || 750}</Text>
            <Text style={styles.scoreLabel}>CIBIL</Text>
          </View>
        </Pressable>

        {/* Search + Filter */}
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={colors.textDim} />
            <TextInput
              testID="search-input"
              style={styles.search}
              placeholder="Search mobiles, laptops, watches..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.textDim} />
              </Pressable>
            )}
          </View>
          <Pressable style={styles.filterBtn} onPress={() => setShowFilter(true)}>
            <Ionicons name="filter" size={20} color={colors.white} />
          </Pressable>
        </View>

        {/* Category Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipContent}>
          <Pressable style={[styles.chip, activeCat === 'All' && styles.chipActive]} onPress={() => setActiveCat('All')}>
            <Text style={[styles.chipText, activeCat === 'All' && styles.chipTextActive]}>All</Text>
          </Pressable>
          {categories.map((c) => (
            <Pressable key={c.id} style={[styles.chip, activeCat === c.name && styles.chipActive]} onPress={() => setActiveCat(c.name)}>
              <Text style={[styles.chipText, activeCat === c.name && styles.chipTextActive]}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.white} size="large" /></View>
        ) : (
          <>
            {/* Flash Deals */}
            {flashDeals.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>⚡ Flash Deals</Text>
                  <Text style={styles.countdown}>{countdown}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.xl }}>
                  {flashDeals.map(renderProductCard)}
                </ScrollView>
              </View>
            )}

            {/* Best Sellers */}
            {bestSellers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🏆 Best Sellers</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.xl }}>
                  {bestSellers.map(renderProductCard)}
                </ScrollView>
              </View>
            )}

            {/* Full Product Grid */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Products</Text>
              <View style={styles.grid}>
                {filtered.map(renderProductCard)}
              </View>
              {filtered.length === 0 && <Text style={styles.empty}>No products found</Text>}
            </View>
          </>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal visible={showFilter} transparent animationType="slide">
        <Pressable style={styles.filterOverlay} onPress={() => setShowFilter(false)}>
          <Pressable style={styles.filterSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.filterHandle} />
            <Text style={styles.filterTitle}>Filter & Sort</Text>

            <Text style={styles.filterLabel}>Sort By</Text>
            <View style={styles.filterChips}>
              {(['popularity', 'price_low', 'price_high', 'newest', 'discount'] as SortOption[]).map((s) => (
                <Pressable key={s} style={[styles.filterChip, sort === s && styles.filterChipActive]} onPress={() => setSort(s)}>
                  <Text style={[styles.filterChipText, sort === s && styles.filterChipTextActive]}>
                    {s === 'price_low' ? 'Price: Low to High' : s === 'price_high' ? 'Price: High to Low' : s === 'newest' ? 'Newest First' : s === 'discount' ? 'Discount' : 'Popularity'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterLabel}>Price Range</Text>
            <View style={styles.filterChips}>
              {(['all', 'under10k', '10k25k', '25k50k', 'above50k'] as PriceRange[]).map((r) => (
                <Pressable key={r} style={[styles.filterChip, priceRange === r && styles.filterChipActive]} onPress={() => setPriceRange(r)}>
                  <Text style={[styles.filterChipText, priceRange === r && styles.filterChipTextActive]}>
                    {r === 'all' ? 'All' : r === 'under10k' ? 'Under ₹10,000' : r === '10k25k' ? '₹10,000-25,000' : r === '25k50k' ? '₹25,000-50,000' : 'Above ₹50,000'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterLabel}>Brand</Text>
            <View style={styles.filterChips}>
              <Pressable style={[styles.filterChip, !selectedBrand && styles.filterChipActive]} onPress={() => setSelectedBrand(null)}>
                <Text style={[styles.filterChipText, !selectedBrand && styles.filterChipTextActive]}>All</Text>
              </Pressable>
              {brands.map((b) => (
                <Pressable key={b} style={[styles.filterChip, selectedBrand === b && styles.filterChipActive]} onPress={() => setSelectedBrand(b)}>
                  <Text style={[styles.filterChipText, selectedBrand === b && styles.filterChipTextActive]}>{b}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.filterActions}>
              <Pressable style={styles.resetBtn} onPress={() => { setSort('popularity'); setPriceRange('all'); setSelectedBrand(null); }}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
              <Pressable style={styles.applyBtn} onPress={() => setShowFilter(false)}>
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  headerTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  badge: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.error, borderRadius: radius.pill, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.75, backgroundColor: colors.surface, paddingVertical: spacing.xl },
  drawerHeader: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  drawerTitle: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  drawerSub: { color: colors.textDim, fontSize: fs.sm, marginTop: spacing.xs },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  drawerItemText: { color: colors.text, fontSize: fs.base, fontWeight: '500' },
  creditBanner: { flexDirection: 'row', marginHorizontal: spacing.xl, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.md },
  creditHello: { color: colors.text, fontSize: fs.base, fontWeight: '600' },
  creditLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 1, fontWeight: '700', marginTop: spacing.sm },
  creditLimit: { color: colors.white, fontSize: fs.xxl, fontWeight: '700' },
  creditApproved: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: radius.pill, marginTop: spacing.sm, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  scoreCircle: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border },
  scoreNum: { fontSize: fs.xl, fontWeight: '700' },
  scoreLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 1, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 46, borderWidth: 1, borderColor: colors.border },
  search: { flex: 1, color: colors.text, fontSize: fs.base },
  filterBtn: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  chipRow: { maxHeight: 50, marginBottom: spacing.sm },
  chipContent: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: 'center' },
  chip: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  countdown: { color: colors.accent, fontSize: fs.sm, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.xl },
  card: { width: CARD_W, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardImgWrap: { height: 130, borderRadius: radius.sm, overflow: 'hidden', marginBottom: spacing.sm, backgroundColor: colors.surface },
  cardImg: { width: '100%', height: '100%' },
  discBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: colors.error, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  discBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  emiBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.cyan, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  emiBadgeText: { color: colors.black, fontSize: 10, fontWeight: '700' },
  brand: { color: colors.textDim, fontSize: fs.xs },
  name: { color: colors.text, fontSize: fs.sm, fontWeight: '600', marginTop: 2, minHeight: 34 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  price: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  mrp: { color: colors.textMuted, fontSize: fs.xs, textDecorationLine: 'line-through' },
  addBtn: { marginTop: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing.sm, alignItems: 'center' },
  addBtnText: { color: colors.white, fontSize: fs.xs, fontWeight: '700' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: spacing.xl },
  filterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  filterSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, maxHeight: '80%' },
  filterHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: radius.pill, alignSelf: 'center', marginBottom: spacing.lg },
  filterTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700', marginBottom: spacing.lg },
  filterLabel: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.md },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  filterChipTextActive: { color: colors.white },
  filterActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  resetBtn: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  resetBtnText: { color: colors.textDim, fontWeight: '700' },
  applyBtn: { flex: 2, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { color: colors.white, fontWeight: '700' },
});
