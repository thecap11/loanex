import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions, Modal, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/context/CartContext';
import { useAlert } from '@/src/context/AlertContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { calculateEmi } from '@/src/lib/emi';
import { productService } from '@/src/services/productService';
import { creditService } from '@/src/services/creditService';

const { width } = Dimensions.get('window');

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { toast } = useAlert();

  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [showImgModal, setShowImgModal] = useState(false);
  const [tenure, setTenure] = useState(3);
  const [tab, setTab] = useState<'overview' | 'specs' | 'reviews' | 'returns' | 'qa'>('overview');
  const [pincode, setPincode] = useState('560001');
  const [editingPin, setEditingPin] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const p = await productService.getProduct(id);
      setProduct(p);
      if (p?.available_tenures?.length) setTenure(p.available_tenures[0]);
      const revs = await productService.getReviews(id);
      setReviews(revs);
    } catch (e) {} finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const discountPct = useMemo(() => {
    if (!product || !product.original_price || product.original_price <= product.price) return 0;
    return Math.round(((product.original_price - product.price) / product.original_price) * 100);
  }, [product]);

  const emiCalc = useMemo(() => {
    if (!product) return { monthly: 0, totalInterest: 0, totalPayable: 0, principal: 0 };
    const principal = product.price - (product.down_payment || 0);
    const monthly = calculateEmi(principal, product.interest_rate || 14, tenure);
    const totalPayable = monthly * tenure + (product.down_payment || 0);
    const totalInterest = totalPayable - product.price;
    return { monthly, totalInterest, totalPayable, principal };
  }, [product, tenure]);

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

  const handleAddToCart = () => {
    if (!product) return;
    addItem({ productId: product.id, name: product.name, price: product.price, originalPrice: product.original_price, image: product.images?.[0] || '', brand: product.brand, emiEnabled: product.is_emi_enabled });
    toast('Added to cart', 'success');
  };

  const handlePostReview = async () => {
    if (!reviewComment.trim()) { toast('Write a comment', 'error'); return; }
    try {
      await productService.postReview({ product_id: id, user_id: user!.id, reviewer_name: user?.name || 'User', rating: reviewRating, comment: reviewComment });
      toast('Review posted', 'success');
      setReviewComment('');
      setReviewRating(5);
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>;
  if (!product) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.textDim }}>Product not found</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Product</Text>
        <Pressable onPress={handleAddToCart}><Ionicons name="cart-outline" size={22} color={colors.text} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Breadcrumb */}
        <View style={styles.breadcrumb}>
          <Pressable onPress={() => router.push('/(customer)/home')}><Text style={styles.breadcrumbText}>Home</Text></Pressable>
          <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
          <Text style={styles.breadcrumbText}>{product.brand}</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
          <Text style={[styles.breadcrumbText, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
        </View>

        {/* Image Gallery */}
        <Pressable style={styles.mainImgWrap} onPress={() => setShowImgModal(true)}>
          <Image source={{ uri: product.images?.[activeImg] }} style={styles.mainImg} contentFit="cover" />
          <View style={styles.imgBadge}><Text style={styles.imgBadgeText}>{activeImg + 1}/{product.images?.length || 1}</Text></View>
          <Text style={styles.zoomHint}>Pinch to zoom</Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
          {product.images?.map((img: string, i: number) => (
            <Pressable key={i} style={[styles.thumb, activeImg === i && styles.thumbActive]} onPress={() => setActiveImg(i)}>
              <Image source={{ uri: img }} style={styles.thumbImg} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>

        {/* Product Info */}
        <View style={styles.infoSection}>
          <Text style={styles.brandText}>{product.brand}</Text>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.ratingRow}>
            <View style={styles.stars}>{[1,2,3,4,5].map((s) => <Ionicons key={s} name={s <= Math.round(Number(avgRating)) ? 'star' : 'star-outline'} size={16} color={colors.accent} />)}</View>
            <Text style={styles.ratingText}>{avgRating} ({reviews.length} reviews)</Text>
          </View>
          <View style={[styles.stockBadge, { backgroundColor: product.stock > 0 ? colors.success + '20' : colors.error + '20' }]}>
            <Text style={[styles.stockText, { color: product.stock > 0 ? colors.success : colors.error }]}>{product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatINR(product.price)}</Text>
            {product.original_price > product.price && <Text style={styles.mrp}>{formatINR(product.original_price)}</Text>}
            {discountPct > 0 && <View style={styles.discTag}><Text style={styles.discTagText}>{discountPct}% off</Text></View>}
          </View>
          <Text style={styles.taxNote}>Inclusive of all taxes</Text>
        </View>

        {/* Deliver To */}
        <View style={styles.deliverSection}>
          <Text style={styles.deliverLabel}>Deliver to</Text>
          {editingPin ? (
            <View style={styles.pinEditRow}>
              <TextInput style={styles.pinInput} value={pincode} onChangeText={setPincode} keyboardType="numeric" maxLength={6} />
              <Pressable style={styles.pinSaveBtn} onPress={() => { setEditingPin(false); }}><Text style={styles.pinSaveText}>Save</Text></Pressable>
            </View>
          ) : (
            <View style={styles.pinRow}>
              <Text style={styles.pincode}>{pincode}</Text>
              <Pressable onPress={() => setEditingPin(true)}><Text style={styles.changeText}>Change</Text></Pressable>
            </View>
          )}
          <View style={styles.deliveryBadge}><Ionicons name="bicycle" size={14} color={colors.success} /><Text style={styles.deliveryText}>Usually delivered in 3-5 business days</Text></View>
        </View>

        {/* Color Variants */}
        {product.color_variants?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Colors</Text>
            <View style={styles.colorRow}>
              {product.color_variants.map((c: string, i: number) => (
                <Pressable key={i} style={styles.colorChip}><Text style={styles.colorChipText}>{c}</Text></Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Highlights */}
        {product.highlights?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Highlights</Text>
            {product.highlights.map((h: string, i: number) => (
              <View key={i} style={styles.highlightRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.highlightText}>{h}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Warranty + Trust Badges */}
        <View style={styles.warrantyRow}>
          <Ionicons name="shield-checkmark" size={18} color={colors.success} />
          <Text style={styles.warrantyText}>{product.warranty_period} Manufacturer Warranty</Text>
        </View>
        <View style={styles.trustRow}>
          {[
            { icon: 'verified', label: 'Genuine Product' },
            { icon: 'bicycle', label: 'Free Delivery' },
            { icon: 'lock-closed', label: 'Secure Payment' },
            { icon: 'refresh', label: 'Easy Returns' },
          ].map((t) => (
            <View key={t.label} style={styles.trustBadge}>
              <Ionicons name={t.icon as any} size={20} color={colors.primaryLight} />
              <Text style={styles.trustText}>{t.label}</Text>
            </View>
          ))}
        </View>

        {/* EMI Config Card */}
        {product.is_emi_enabled && (
          <View style={styles.emiCard}>
            <Text style={styles.emiCardTitle}>EMI Plans Available</Text>
            <View style={styles.dpBox}>
              <Text style={styles.dpLabel}>Down Payment (Fixed)</Text>
              <Text style={styles.dpVal}>{formatINR(product.down_payment)}</Text>
            </View>
            <Text style={styles.tenureLabel}>Select Tenure</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tenureRow}>
              {(product.available_tenures || [3,6,9,12,18,24]).map((t: number) => (
                <Pressable key={t} style={[styles.tenurePill, tenure === t && styles.tenurePillActive]} onPress={() => setTenure(t)}>
                  <Text style={[styles.tenurePillText, tenure === t && styles.tenurePillTextActive]}>{t} mo</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.emiBreakdown}>
              <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Product Price</Text><Text style={styles.breakdownVal}>{formatINR(product.price)}</Text></View>
              <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Down Payment</Text><Text style={styles.breakdownVal}>{formatINR(product.down_payment)}</Text></View>
              <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Loan Principal</Text><Text style={styles.breakdownVal}>{formatINR(emiCalc.principal)}</Text></View>
              <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Interest Rate</Text><Text style={styles.breakdownVal}>{product.interest_rate}% p.a.</Text></View>
              <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Processing Fee</Text><Text style={styles.breakdownVal}>{formatINR(product.processing_fee)}</Text></View>
              <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Monthly EMI</Text><Text style={[styles.breakdownVal, { color: colors.cyan, fontWeight: '700' }]}>{formatINR(emiCalc.monthly)}/mo</Text></View>
              <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Total Interest</Text><Text style={styles.breakdownVal}>{formatINR(emiCalc.totalInterest)}</Text></View>
              <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }]}>
                <Text style={styles.totalLabel}>Total Payable</Text><Text style={styles.totalVal}>{formatINR(emiCalc.totalPayable)}</Text>
              </View>
            </View>

            <Pressable style={styles.applyEmiBtn} onPress={() => router.push({ pathname: '/emi/apply/[id]', params: { id: product.id, tenure: String(tenure) } })}>
              <Text style={styles.applyEmiText}>Apply for EMI</Text>
            </Pressable>
            <Pressable style={styles.buyFullBtn} onPress={() => { handleAddToCart(); router.push('/checkout'); }}>
              <Text style={styles.buyFullText}>Buy Full Payment</Text>
            </Pressable>
          </View>
        )}

        {/* Tabbed Content */}
        <View style={styles.tabSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
            {([
              { key: 'overview', label: 'Overview' },
              { key: 'specs', label: 'Specifications' },
              { key: 'reviews', label: 'Reviews' },
              { key: 'returns', label: 'Returns' },
              { key: 'qa', label: 'Q&A' },
            ] as const).map((t) => (
              <Pressable key={t.key} style={[styles.tabItem, tab === t.key && styles.tabItemActive]} onPress={() => setTab(t.key)}>
                <Text style={[styles.tabItemText, tab === t.key && styles.tabItemTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.tabContent}>
            {tab === 'overview' && <Text style={styles.descText}>{product.full_description || product.short_description}</Text>}
            {tab === 'specs' && (
              <View>
                {Object.entries(product.specifications || {}).map(([k, v]) => (
                  <View key={k} style={styles.specRow}><Text style={styles.specKey}>{k}</Text><Text style={styles.specVal}>{String(v)}</Text></View>
                ))}
              </View>
            )}
            {tab === 'reviews' && (
              <View>
                <View style={styles.reviewSummary}>
                  <Text style={styles.avgRating}>{avgRating}</Text>
                  <View>{[1,2,3,4,5].map((s) => <Ionicons key={s} name={s <= Math.round(Number(avgRating)) ? 'star' : 'star-outline'} size={16} color={colors.accent} />)}</View>
                  <Text style={styles.reviewCount}>{reviews.length} reviews</Text>
                </View>
                <Text style={styles.writeReviewTitle}>Write a Review</Text>
                <View style={styles.starPicker}>
                  {[1,2,3,4,5].map((s) => (
                    <Pressable key={s} onPress={() => setReviewRating(s)}>
                      <Ionicons name={s <= reviewRating ? 'star' : 'star-outline'} size={28} color={colors.accent} />
                    </Pressable>
                  ))}
                </View>
                <TextInput style={styles.reviewInput} placeholder="Write your review..." placeholderTextColor={colors.textMuted} value={reviewComment} onChangeText={setReviewComment} multiline numberOfLines={3} />
                <Pressable style={styles.postReviewBtn} onPress={handlePostReview}><Text style={styles.postReviewText}>Post Review</Text></Pressable>
                {reviews.map((r) => (
                  <View key={r.id} style={styles.reviewCard}>
                    <View style={styles.reviewCardTop}>
                      <View style={styles.reviewAvatar}><Text style={styles.reviewAvatarText}>{r.reviewer_name?.[0]?.toUpperCase() || 'U'}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewerName}>{r.reviewer_name}</Text>
                        <View style={styles.reviewStars}>{[1,2,3,4,5].map((s) => <Ionicons key={s} name={s <= r.rating ? 'star' : 'star-outline'} size={12} color={colors.accent} />)}</View>
                      </View>
                      <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                    </View>
                    <Text style={styles.reviewComment}>{r.comment}</Text>
                  </View>
                ))}
              </View>
            )}
            {tab === 'returns' && <Text style={styles.descText}>7-day easy return policy. Items must be in original condition with all accessories. Refunds processed within 5-7 business days.</Text>}
            {tab === 'qa' && <Text style={styles.descText}>Frequently asked questions will appear here.</Text>}
          </View>
        </View>

        {/* Box Contents */}
        {product.box_contents?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Box Contents</Text>
            {product.box_contents.map((b: string, i: number) => (
              <View key={i} style={styles.highlightRow}>
                <Ionicons name="checkmark" size={16} color={colors.success} />
                <Text style={styles.highlightText}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Delivery Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Timeline</Text>
          {['Order Placed', 'Packed', 'Shipped', 'Delivered'].map((step, i) => (
            <View key={step} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: i === 0 ? colors.success : colors.border }]} />
              {i < 3 && <View style={[styles.timelineLine, { backgroundColor: i === 0 ? colors.success : colors.border }]} />}
              <View style={{ flex: 1, paddingBottom: spacing.md }}>
                <Text style={styles.timelineTitle}>{step}</Text>
                <Text style={styles.timelineDesc}>Est: {new Date(Date.now() + i * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: 20 + insets.bottom }]}>
        <Pressable style={styles.bottomAddBtn} onPress={handleAddToCart}>
          <Ionicons name="cart-outline" size={20} color={colors.text} />
          <Text style={styles.bottomAddText}>Add to Cart</Text>
        </Pressable>
        <Pressable style={styles.bottomBuyBtn} onPress={() => { handleAddToCart(); router.push('/checkout'); }}>
          <Text style={styles.bottomBuyText}>Buy Now</Text>
        </Pressable>
      </View>

      {/* Image Modal */}
      <Modal visible={showImgModal} transparent>
        <View style={styles.imgModal}>
          <Pressable style={styles.imgModalClose} onPress={() => setShowImgModal(false)}>
            <Ionicons name="close" size={28} color={colors.white} />
          </Pressable>
          <Image source={{ uri: product.images?.[activeImg] }} style={styles.imgModalImg} contentFit="contain" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imgModalThumbs}>
            {product.images?.map((img: string, i: number) => (
              <Pressable key={i} onPress={() => setActiveImg(i)}>
                <Image source={{ uri: img }} style={[styles.imgModalThumb, activeImg === i && styles.imgModalThumbActive]} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  breadcrumbText: { color: colors.textMuted, fontSize: fs.xs },
  mainImgWrap: { width, height: 320, backgroundColor: colors.surface, position: 'relative' },
  mainImg: { width: '100%', height: '100%' },
  imgBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  imgBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  zoomHint: { position: 'absolute', bottom: 12, left: 12, color: colors.textDim, fontSize: 10 },
  thumbRow: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  thumb: { width: 60, height: 60, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: colors.primary },
  thumbImg: { width: '100%', height: '100%' },
  infoSection: { padding: spacing.xl },
  brandText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  productName: { color: colors.text, fontSize: fs.xxl, fontWeight: '700', marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  stars: { flexDirection: 'row' },
  ratingText: { color: colors.textDim, fontSize: fs.sm },
  stockBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, marginTop: spacing.sm },
  stockText: { fontSize: 10, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  price: { color: colors.text, fontSize: fs.xxxl, fontWeight: '700' },
  mrp: { color: colors.textMuted, fontSize: fs.base, textDecorationLine: 'line-through' },
  discTag: { backgroundColor: colors.error + '20', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  discTagText: { color: colors.error, fontSize: fs.sm, fontWeight: '700' },
  taxNote: { color: colors.textMuted, fontSize: fs.xs, marginTop: 4 },
  deliverSection: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
  deliverLabel: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 4 },
  pincode: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  changeText: { color: colors.primaryLight, fontSize: fs.sm, fontWeight: '600' },
  pinEditRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  pinInput: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, color: colors.text, borderWidth: 1, borderColor: colors.border },
  pinSaveBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  pinSaveText: { color: colors.white, fontWeight: '700' },
  deliveryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, backgroundColor: colors.success + '15', borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6, alignSelf: 'flex-start' },
  deliveryText: { color: colors.success, fontSize: fs.sm, fontWeight: '600' },
  section: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginBottom: spacing.sm },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  colorChipText: { color: colors.text, fontSize: fs.sm },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  highlightText: { color: colors.textDim, fontSize: fs.sm },
  warrantyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  warrantyText: { color: colors.success, fontSize: fs.sm, fontWeight: '600' },
  trustRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  trustBadge: { alignItems: 'center', gap: 4 },
  trustText: { color: colors.textDim, fontSize: 10, fontWeight: '600' },
  emiCard: { margin: spacing.xl, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  emiCardTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700', marginBottom: spacing.md },
  dpBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  dpLabel: { color: colors.textDim, fontSize: fs.sm },
  dpVal: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  tenureLabel: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600', marginBottom: spacing.sm },
  tenureRow: { gap: spacing.sm, marginBottom: spacing.md },
  tenurePill: { height: 40, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tenurePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tenurePillText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  tenurePillTextActive: { color: colors.white },
  emiBreakdown: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  breakdownLabel: { color: colors.textDim, fontSize: fs.sm },
  breakdownVal: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  totalLabel: { color: colors.text, fontSize: fs.base, fontWeight: '700' },
  totalVal: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  applyEmiBtn: { backgroundColor: colors.primary, borderRadius: radius.md, height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  applyEmiText: { color: colors.white, fontWeight: '700', fontSize: fs.base },
  buyFullBtn: { backgroundColor: colors.surface, borderRadius: radius.md, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  buyFullText: { color: colors.text, fontWeight: '600' },
  tabSection: { borderTopWidth: 1, borderTopColor: colors.border },
  tabBar: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  tabItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabItemText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  tabItemTextActive: { color: colors.white },
  tabContent: { padding: spacing.xl, minHeight: 200 },
  descText: { color: colors.textDim, fontSize: fs.sm, lineHeight: 22 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.divider },
  specKey: { color: colors.textDim, fontSize: fs.sm },
  specVal: { color: colors.text, fontSize: fs.sm, fontWeight: '600', flex: 1, textAlign: 'right' },
  reviewSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avgRating: { color: colors.text, fontSize: 32, fontWeight: '700' },
  reviewCount: { color: colors.textDim, fontSize: fs.sm },
  writeReviewTitle: { color: colors.text, fontSize: fs.base, fontWeight: '700', marginBottom: spacing.sm },
  starPicker: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  reviewInput: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, color: colors.text, minHeight: 80, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  postReviewBtn: { backgroundColor: colors.primary, borderRadius: radius.md, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  postReviewText: { color: colors.white, fontWeight: '700' },
  reviewCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  reviewCardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  reviewAvatar: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  reviewerName: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  reviewStars: { flexDirection: 'row', marginTop: 2 },
  reviewDate: { color: colors.textMuted, fontSize: fs.xs },
  reviewComment: { color: colors.textDim, fontSize: fs.sm, marginTop: 4 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineLine: { position: 'absolute', left: 5, top: 16, width: 2, height: '100%', minHeight: 40 },
  timelineTitle: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  timelineDesc: { color: colors.textMuted, fontSize: fs.xs, marginTop: 2 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  bottomAddBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 50, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  bottomAddText: { color: colors.text, fontWeight: '700' },
  bottomBuyBtn: { flex: 1, height: 50, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  bottomBuyText: { color: colors.white, fontWeight: '700' },
  imgModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  imgModalClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  imgModalImg: { width: '90%', height: '60%' },
  imgModalThumbs: { gap: spacing.sm, marginTop: spacing.lg },
  imgModalThumb: { width: 50, height: 50, borderRadius: radius.sm, borderWidth: 2, borderColor: 'transparent' },
  imgModalThumbActive: { borderColor: colors.primary },
});
