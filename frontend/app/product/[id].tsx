import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

const { width } = Dimensions.get('window');

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [tenure, setTenure] = useState<number>(6);
  const [emiCalc, setEmiCalc] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [p, cfg, revs] = await Promise.all([
        api(`/products/${id}`),
        api('/emi/config'),
        api(`/products/${id}/reviews`),
      ]);
      setProduct(p); setConfig(cfg); setReviews(revs); setTenure(cfg.tenures[1] || 6);
    })();
  }, [id]);

  useEffect(() => {
    if (!product || !config) return;
    (async () => {
      const c = await api(`/emi/calculate?price=${product.price}&tenure=${tenure}`);
      setEmiCalc(c);
    })();
  }, [product, tenure, config]);

  const addToCart = async () => {
    setBusy(true);
    try {
      await api('/cart/add', { method: 'POST', body: JSON.stringify({ product_id: id, qty: 1 }) });
      setToast('Added to cart');
      setTimeout(() => setToast(null), 1500);
    } catch (e: any) { setToast(e.message); setTimeout(() => setToast(null), 2000); }
    finally { setBusy(false); }
  };

  const applyEmi = () => {
    if (user?.kyc_status !== 'verified') {
      router.push('/kyc');
      return;
    }
    router.push(`/emi/apply/${id}`);
  };

  if (!product) return <View style={styles.center}><ActivityIndicator color={colors.white} /></View>;
  const discount = product.mrp && product.mrp > product.price ? Math.round((1 - product.price / product.mrp) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: product.image }} style={{ width, height: width * 0.9 }} contentFit="cover" />
          <LinearGradient colors={['rgba(10,10,10,0.7)', 'transparent', 'rgba(10,10,10,0.9)']} style={StyleSheet.absoluteFill} />
          <Pressable testID="back-btn" style={[styles.iconBtn, { top: insets.top + 8, left: spacing.lg }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.brand}>{product.brand}</Text>
          <Text style={styles.name}>{product.name}</Text>

          {product.review_count > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={colors.gold} />
              <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({product.review_count} reviews)</Text>
            </View>
          )}

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.price}>{formatINR(product.price)}</Text>
              {product.mrp && product.mrp > product.price && (
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                  <Text style={styles.mrp}>{formatINR(product.mrp)}</Text>
                  <Text style={styles.discount}>{discount}% OFF</Text>
                </View>
              )}
            </View>
            {product.stock > 0 ? (
              <View style={styles.stockOk}><Text style={styles.stockOkText}>In stock: {product.stock}</Text></View>
            ) : (
              <View style={styles.stockBad}><Text style={styles.stockBadText}>Out of stock</Text></View>
            )}
          </View>
          <Text style={styles.desc}>{product.description}</Text>

          {product.specifications && (
            <View style={styles.specs}>
              <Text style={styles.specTitle}>Specifications</Text>
              {Object.entries(product.specifications).map(([k, v]) => (
                <View key={k} style={styles.specRow}>
                  <Text style={styles.specKey}>{k}</Text>
                  <Text style={styles.specVal}>{String(v)}</Text>
                </View>
              ))}
            </View>
          )}

          {product.emi_eligible && emiCalc && (
            <View style={styles.emiCard}>
              <View style={styles.emiHeader}>
                <View>
                  <Text style={styles.emiTitle}>EMI Calculator</Text>
                  <Text style={styles.emiSub}>{emiCalc.eligible ? `${tenure} monthly installments` : `Requires ≥ ${formatINR(emiCalc.threshold)}`}</Text>
                </View>
                <View style={styles.emiBadge}><Text style={styles.emiBadgeText}>{emiCalc.interest_rate}% APR</Text></View>
              </View>

              <View style={styles.tenureRow}>
                {config.tenures.map((t: number) => (
                  <Pressable testID={`tenure-${t}`} key={t} style={[styles.tenureBtn, tenure === t && styles.tenureBtnActive]} onPress={() => setTenure(t)}>
                    <Text style={[styles.tenureText, tenure === t && styles.tenureTextActive]}>{t}m</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.emiStats}>
                <View style={styles.emiStat}><Text style={styles.emiStatLabel}>Down Pay</Text><Text style={styles.emiStatVal}>{formatINR(emiCalc.down_payment)}</Text></View>
                <View style={styles.emiStat}><Text style={styles.emiStatLabel}>Monthly</Text><Text style={[styles.emiStatVal, { color: colors.gold }]}>{formatINR(emiCalc.monthly)}</Text></View>
                <View style={styles.emiStat}><Text style={styles.emiStatLabel}>Interest</Text><Text style={[styles.emiStatVal, { color: colors.warning }]}>{formatINR(emiCalc.total_interest)}</Text></View>
              </View>
            </View>
          )}

          {reviews.length > 0 && (
            <View style={styles.reviews}>
              <Text style={styles.reviewsTitle}>Customer Reviews</Text>
              {reviews.slice(0, 3).map((r: any) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.reviewer}>{r.user_name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      {[...Array(5)].map((_, i) => (
                        <Ionicons key={i} name="star" size={12} color={i < r.rating ? colors.gold : colors.bg3} />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewText}>{r.comment}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {toast && (
        <View style={[styles.toast, { bottom: 120 + insets.bottom }]} testID="toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        <Pressable testID="add-to-cart-btn" style={[styles.addBtn, product.stock === 0 && { opacity: 0.4 }]} disabled={busy || product.stock === 0} onPress={addToCart}>
          <Ionicons name="cart-outline" size={20} color={colors.text} />
          <Text style={styles.addBtnText}>Cart</Text>
        </Pressable>
        <Pressable
          testID="apply-emi-btn"
          style={[styles.emiBtn, (product.stock === 0 || !product.emi_eligible || !emiCalc?.eligible) && { opacity: 0.4 }]}
          disabled={product.stock === 0 || !product.emi_eligible || !emiCalc?.eligible}
          onPress={applyEmi}
        >
          <Ionicons name="calendar" size={20} color={colors.black} />
          <Text style={styles.emiBtnText}>Apply for EMI</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  imageWrap: { backgroundColor: colors.bg2 },
  iconBtn: { position: 'absolute', width: 40, height: 40, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl },
  brand: { color: colors.gold, fontSize: fs.sm, fontWeight: '700', letterSpacing: 1 },
  name: { color: colors.text, fontSize: fs.xxxl, fontWeight: '700', marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  ratingText: { color: colors.text, fontWeight: '700' },
  reviewCount: { color: colors.textDim, fontSize: fs.sm },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: spacing.md },
  price: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  mrp: { color: colors.textMuted, fontSize: fs.base, textDecorationLine: 'line-through' },
  discount: { color: colors.success, fontSize: fs.sm, fontWeight: '700' },
  stockOk: { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  stockOkText: { color: colors.success, fontSize: fs.sm, fontWeight: '600' },
  stockBad: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  stockBadText: { color: colors.error, fontSize: fs.sm, fontWeight: '600' },
  desc: { color: colors.textDim, fontSize: fs.base, lineHeight: 22, marginTop: spacing.lg },
  specs: { marginTop: spacing.lg, padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  specTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.divider },
  specKey: { color: colors.textDim },
  specVal: { color: colors.text, fontWeight: '600' },
  emiCard: { marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold },
  emiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  emiTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  emiSub: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  emiBadge: { backgroundColor: 'rgba(212,175,55,0.15)', borderColor: colors.gold, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  emiBadgeText: { color: colors.gold, fontSize: fs.sm, fontWeight: '700' },
  tenureRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  tenureBtn: { flex: 1, height: 44, borderRadius: radius.md, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  tenureBtnActive: { backgroundColor: colors.white, borderColor: colors.white },
  tenureText: { color: colors.textDim, fontWeight: '700' },
  tenureTextActive: { color: colors.black },
  emiStats: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm },
  emiStat: { flex: 1, backgroundColor: colors.bg3, padding: spacing.md, borderRadius: radius.md },
  emiStatLabel: { color: colors.textDim, fontSize: fs.sm },
  emiStatVal: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginTop: 2 },
  reviews: { marginTop: spacing.xl },
  reviewsTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginBottom: spacing.md },
  reviewCard: { padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  reviewer: { color: colors.text, fontWeight: '700' },
  reviewText: { color: colors.textDim, marginTop: 4, fontSize: fs.sm },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.bg2, borderTopWidth: 1, borderTopColor: colors.border },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border },
  addBtnText: { color: colors.text, fontWeight: '700', fontSize: fs.base },
  emiBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, borderRadius: radius.md, backgroundColor: colors.white },
  emiBtnText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
  toast: { position: 'absolute', left: spacing.xl, right: spacing.xl, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.gold, alignItems: 'center' },
  toastText: { color: colors.text, fontWeight: '600' },
});
