import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, FlatList, Alert, Modal, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/src/context/AlertContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';
import { productService } from '@/src/services/productService';

export default function AdminProducts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useAlert();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', brand: '', category_id: '', subcategory: '', short_description: '', full_description: '',
    price: '', original_price: '', stock: '', is_emi_enabled: true, down_payment: '', interest_rate: '14',
    processing_fee: '499', available_tenures: '3,6,9,12,18,24', is_flash_deal: false, is_best_seller: false, is_featured: false,
    images: '', highlights: '', specifications: '', box_contents: '', warranty_period: '1 Year',
  });

  const load = useCallback(async () => {
    try {
      const [prods, cats] = await Promise.all([productService.getProducts(), productService.getCategories()]);
      setProducts(prods);
      setCategories(cats);
    } catch (e) {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', brand: '', category_id: categories[0]?.id || '', subcategory: '', short_description: '', full_description: '', price: '', original_price: '', stock: '', is_emi_enabled: true, down_payment: '', interest_rate: '14', processing_fee: '499', available_tenures: '3,6,9,12,18,24', is_flash_deal: false, is_best_seller: false, is_featured: false, images: '', highlights: '', specifications: '', box_contents: '', warranty_period: '1 Year' });
    setShowForm(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name || '', brand: p.brand || '', category_id: p.category_id || '', subcategory: p.subcategory || '',
      short_description: p.short_description || '', full_description: p.full_description || '',
      price: String(p.price || ''), original_price: String(p.original_price || ''), stock: String(p.stock || ''),
      is_emi_enabled: p.is_emi_enabled, down_payment: String(p.down_payment || ''), interest_rate: String(p.interest_rate || '14'),
      processing_fee: String(p.processing_fee || '499'), available_tenures: (p.available_tenures || []).join(','),
      is_flash_deal: p.is_flash_deal, is_best_seller: p.is_best_seller, is_featured: p.is_featured,
      images: (p.images || []).join('\n'), highlights: (p.highlights || []).join('\n'),
      specifications: JSON.stringify(p.specifications || {}), box_contents: (p.box_contents || []).join('\n'),
      warranty_period: p.warranty_period || '1 Year',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { toast('Name and price are required', 'error'); return; }
    try {
      const data = {
        name: form.name, brand: form.brand, category_id: form.category_id || null, subcategory: form.subcategory,
        short_description: form.short_description, full_description: form.full_description,
        price: Number(form.price), original_price: Number(form.original_price) || Number(form.price),
        stock: Number(form.stock) || 0, is_emi_enabled: form.is_emi_enabled,
        down_payment: Number(form.down_payment) || 0, interest_rate: Number(form.interest_rate) || 14,
        processing_fee: Number(form.processing_fee) || 499,
        available_tenures: form.available_tenures.split(',').map((t) => Number(t.trim())).filter(Boolean),
        is_flash_deal: form.is_flash_deal, is_best_seller: form.is_best_seller, is_featured: form.is_featured,
        images: form.images.split('\n').map((s) => s.trim()).filter(Boolean),
        highlights: form.highlights.split('\n').map((s) => s.trim()).filter(Boolean),
        specifications: form.specifications ? JSON.parse(form.specifications) : {},
        box_contents: form.box_contents.split('\n').map((s) => s.trim()).filter(Boolean),
        warranty_period: form.warranty_period,
      };
      if (editing) { await productService.updateProduct(editing.id, data); toast('Product updated', 'success'); }
      else { await productService.createProduct(data); toast('Product created', 'success'); }
      setShowForm(false);
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const handleDelete = (p: any) => {
    Alert.alert('Delete Product', `Delete "${p.name}"?`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await productService.deleteProduct(p.id); toast('Product deleted', 'info'); load(); } catch (e: any) { toast(e.message, 'error'); } } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.addBtnText}>Add Product</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>
      ) : products.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cube-outline" size={72} color={colors.textMuted} />
          <Text style={styles.emptyText}>No products in catalog</Text>
          <Pressable style={styles.emptyBtn} onPress={openAdd}><Text style={styles.emptyBtnText}>Add Product</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
          {products.map((p) => (
            <View key={p.id} style={styles.card}>
              <Image source={{ uri: p.images?.[0] }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.prodName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.prodCat}>{p.brand}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{formatINR(p.price)}</Text>
                  {p.original_price > p.price && <Text style={styles.mrp}>{formatINR(p.original_price)}</Text>}
                </View>
                <View style={styles.badgeRow}>
                  <View style={[styles.stockBadge, { backgroundColor: p.stock > 0 ? colors.success + '20' : colors.error + '20' }]}>
                    <Text style={[styles.stockText, { color: p.stock > 0 ? colors.success : colors.error }]}>{p.stock > 0 ? `In Stock (${p.stock})` : 'Out of Stock'}</Text>
                  </View>
                  {p.is_emi_enabled && <View style={styles.emiBadge}><Text style={styles.emiText}>EMI</Text></View>}
                  {p.is_featured && <View style={styles.featBadge}><Text style={styles.featText}>Featured</Text></View>}
                </View>
              </View>
              <View style={styles.actionCol}>
                <Pressable style={styles.editBtn} onPress={() => openEdit(p)}><Ionicons name="create-outline" size={18} color={colors.primaryLight} /></Pressable>
                <Pressable style={styles.delBtn} onPress={() => handleDelete(p)}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Product Form Modal */}
      <Modal visible={showForm} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowForm(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Product' : 'Add Product'}</Text>
              <Text style={styles.modalLabel}>Product Name</Text>
              <TextInput style={styles.modalInput} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Brand</Text>
              <TextInput style={styles.modalInput} value={form.brand} onChangeText={(t) => setForm({ ...form, brand: t })} placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Category</Text>
              <View style={styles.catRow}>
                {categories.map((c) => (
                  <Pressable key={c.id} style={[styles.catChip, form.category_id === c.id && styles.catChipActive]} onPress={() => setForm({ ...form, category_id: c.id })}>
                    <Text style={[styles.catChipText, form.category_id === c.id && styles.catChipTextActive]}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.modalLabel}>Short Description</Text>
              <TextInput style={styles.modalInput} value={form.short_description} onChangeText={(t) => setForm({ ...form, short_description: t })} placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Full Description</Text>
              <TextInput style={styles.modalInput} value={form.full_description} onChangeText={(t) => setForm({ ...form, full_description: t })} multiline numberOfLines={3} placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Discounted Price</Text>
              <TextInput style={styles.modalInput} value={form.price} onChangeText={(t) => setForm({ ...form, price: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Original Price (MRP)</Text>
              <TextInput style={styles.modalInput} value={form.original_price} onChangeText={(t) => setForm({ ...form, original_price: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Stock Quantity</Text>
              <TextInput style={styles.modalInput} value={form.stock} onChangeText={(t) => setForm({ ...form, stock: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Image URLs (one per line)</Text>
              <TextInput style={styles.modalInput} value={form.images} onChangeText={(t) => setForm({ ...form, images: t })} multiline numberOfLines={3} placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Highlights (one per line)</Text>
              <TextInput style={styles.modalInput} value={form.highlights} onChangeText={(t) => setForm({ ...form, highlights: t })} multiline numberOfLines={3} placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Specifications (JSON)</Text>
              <TextInput style={styles.modalInput} value={form.specifications} onChangeText={(t) => setForm({ ...form, specifications: t })} multiline numberOfLines={3} placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Box Contents (one per line)</Text>
              <TextInput style={styles.modalInput} value={form.box_contents} onChangeText={(t) => setForm({ ...form, box_contents: t })} multiline numberOfLines={3} placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Warranty Period</Text>
              <TextInput style={styles.modalInput} value={form.warranty_period} onChangeText={(t) => setForm({ ...form, warranty_period: t })} placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Down Payment</Text>
              <TextInput style={styles.modalInput} value={form.down_payment} onChangeText={(t) => setForm({ ...form, down_payment: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Interest Rate (% p.a.)</Text>
              <TextInput style={styles.modalInput} value={form.interest_rate} onChangeText={(t) => setForm({ ...form, interest_rate: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Processing Fee</Text>
              <TextInput style={styles.modalInput} value={form.processing_fee} onChangeText={(t) => setForm({ ...form, processing_fee: t })} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
              <Text style={styles.modalLabel}>Available Tenures (comma-separated)</Text>
              <TextInput style={styles.modalInput} value={form.available_tenures} onChangeText={(t) => setForm({ ...form, available_tenures: t })} placeholderTextColor={colors.textMuted} />
              <View style={styles.toggleRow}>
                {[
                  { key: 'is_emi_enabled', label: 'EMI Enabled' },
                  { key: 'is_flash_deal', label: 'Flash Deal' },
                  { key: 'is_best_seller', label: 'Best Seller' },
                  { key: 'is_featured', label: 'Featured' },
                ].map((t) => (
                  <Pressable key={t.key} style={[styles.toggleChip, (form as any)[t.key] && styles.toggleChipActive]} onPress={() => setForm({ ...form, [t.key]: !(form as any)[t.key] })}>
                    <Text style={[styles.toggleChipText, (form as any)[t.key] && styles.toggleChipTextActive]}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setShowForm(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                <Pressable style={styles.saveBtn} onPress={handleSave}><Text style={styles.saveText}>{editing ? 'Update' : 'Create'}</Text></Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: fs.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  emptyBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
  emptyBtnText: { color: colors.white, fontWeight: '700' },
  card: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 70, height: 70, borderRadius: radius.sm, backgroundColor: colors.surface },
  prodName: { color: colors.text, fontSize: fs.base, fontWeight: '600', flex: 1 },
  prodCat: { color: colors.textDim, fontSize: fs.xs, marginTop: 2 },
  priceRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  price: { color: colors.text, fontWeight: '700' },
  mrp: { color: colors.textMuted, fontSize: fs.xs, textDecorationLine: 'line-through' },
  badgeRow: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  stockBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  stockText: { fontSize: 10, fontWeight: '700' },
  emiBadge: { backgroundColor: colors.cyan + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  emiText: { color: colors.cyan, fontSize: 10, fontWeight: '700' },
  featBadge: { backgroundColor: colors.warning + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  featText: { color: colors.warning, fontSize: 10, fontWeight: '700' },
  actionCol: { justifyContent: 'center', gap: spacing.sm },
  editBtn: { padding: 8, backgroundColor: colors.surface, borderRadius: radius.sm },
  delBtn: { padding: 8, backgroundColor: colors.error + '15', borderRadius: radius.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, maxHeight: '90%' },
  modalTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700', marginBottom: spacing.lg },
  modalLabel: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600', marginBottom: 4, marginTop: spacing.sm },
  modalInput: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 46, color: colors.text, borderWidth: 1, borderColor: colors.border },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { color: colors.textDim, fontSize: fs.sm },
  catChipTextActive: { color: colors.white },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  toggleChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  toggleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleChipText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  toggleChipTextActive: { color: colors.white },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, paddingBottom: spacing.lg },
  cancelBtn: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.textDim, fontWeight: '700' },
  saveBtn: { flex: 2, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.white, fontWeight: '700' },
});
