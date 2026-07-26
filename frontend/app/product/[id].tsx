import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

const { width } = Dimensions.get('window');

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [tenure, setTenure] = useState<number>(6);
  const [emiCalc, setEmiCalc] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = await api(`/products/${id}`);
      const cfg = await api('/emi/config');
      setProduct(p); setConfig(cfg); setTenure(cfg.tenures[1] || 6);
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

  if (!product) return <View style={styles.center}><ActivityIndicator color={colors.white} /></View>;

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
          <View style={styles.priceRow}>
            <Text style={styles.price}>${product.price.toFixed(2)}</Text>
            {product.stock > 0 ? (
              <View style={styles.stockOk}><Text style={styles.stockOkText}>In stock: {product.stock}</Text></View>
            ) : (
              <View style={styles.stockBad}><Text style={styles.stockBadText}>Out of stock</Text></View>
            )}
          </View>
          <Text style={styles.desc}>{product.description}</Text>

          {product.emi_eligible && emiCalc && (
            <View style={styles.emiCard}>
              <View style={styles.emiHeader}>
                <View>
                  <Text style={styles.emiTitle}>EMI Calculator</Text>
                  <Text style={styles.emiSub}>{emiCalc.eligible ? `Split into ${tenure} monthly installments` : `Requires order ≥ $${emiCalc.threshold}`}</Text>
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
                <View style={styles.emiStat}>
                  <Text style={styles.emiStatLabel}>Monthly</Text>
                  <Text style={styles.emiStatVal}>${emiCalc.monthly.toFixed(2)}</Text>
                </View>
                <View style={styles.emiStat}>
                  <Text style={styles.emiStatLabel}>Total</Text>
                  <Text style={styles.emiStatVal}>${emiCalc.total.toFixed(2)}</Text>
                </View>
                <View style={styles.emiStat}>
                  <Text style={styles.emiStatLabel}>Interest</Text>
                  <Text style={[styles.emiStatVal, { color: colors.warning }]}>${(emiCalc.total - product.price).toFixed(2)}</Text>
                </View>
              </View>
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
        <Pressable
          testID="add-to-cart-btn"
          style={[styles.addBtn, product.stock === 0 && { opacity: 0.4 }]}
          disabled={busy || product.stock === 0}
          onPress={addToCart}
        >
          <Ionicons name="cart" size={20} color={colors.black} />
          <Text style={styles.addBtnText}>{product.stock === 0 ? 'Unavailable' : 'Add to Cart'}</Text>
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
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  price: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  stockOk: { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  stockOkText: { color: colors.success, fontSize: fs.sm, fontWeight: '600' },
  stockBad: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  stockBadText: { color: colors.error, fontSize: fs.sm, fontWeight: '600' },
  desc: { color: colors.textDim, fontSize: fs.base, lineHeight: 22, marginTop: spacing.lg },
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
  emiStats: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.md },
  emiStat: { flex: 1, backgroundColor: colors.bg3, padding: spacing.md, borderRadius: radius.md },
  emiStatLabel: { color: colors.textDim, fontSize: fs.sm },
  emiStatVal: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginTop: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.bg2, borderTopWidth: 1, borderTopColor: colors.border },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, borderRadius: radius.md, backgroundColor: colors.white },
  addBtnText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
  toast: { position: 'absolute', left: spacing.xl, right: spacing.xl, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.gold, alignItems: 'center' },
  toastText: { color: colors.text, fontWeight: '600' },
});
