import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

const CATS = ['Mobiles', 'Laptops', 'TVs', 'Audio', 'Gaming', 'Wearables', 'Appliances'];

export default function AdminProducts() {
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: '', brand: '', category: 'Mobiles', price: '', description: '', image: '', stock: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api('/products')); } catch {} finally { setLoading(false); }
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => { setEditing(null); setForm({ name: '', brand: '', category: 'Mobiles', price: '', description: '', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=940', stock: '10' }); setModalOpen(true); };
  const openEdit = (p: any) => { setEditing(p); setForm({ ...p, price: String(p.price), stock: String(p.stock) }); setModalOpen(true); };

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...form, price: parseFloat(form.price), stock: parseInt(form.stock), emi_eligible: true };
      if (editing) await api(`/products/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await api('/products', { method: 'POST', body: JSON.stringify(body) });
      setModalOpen(false); load();
    } catch (e) {} finally { setBusy(false); }
  };

  const del = async (id: string) => {
    await api(`/products/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <Pressable testID="add-product-btn" style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={20} color={colors.black} />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.white} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
          {items.map((p) => (
            <View testID={`admin-prod-${p.id}`} key={p.id} style={styles.row}>
              <Image source={{ uri: p.image }} style={styles.img} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.brand}>{p.brand} • {p.category}</Text>
                <Text style={styles.price}>{formatINR(p.price)} • Stock: {p.stock}</Text>
              </View>
              <Pressable style={styles.actionBtn} onPress={() => openEdit(p)}><Ionicons name="pencil" size={16} color={colors.text} /></Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.15)' }]} onPress={() => del(p.id)}><Ionicons name="trash" size={16} color={colors.error} /></Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit product' : 'Add product'}</Text>
              <Pressable onPress={() => setModalOpen(false)}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
            </View>
            <ScrollView>
              <Field label="Name" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} tid="pf-name" />
              <Field label="Brand" value={form.brand} onChange={(v: string) => setForm({ ...form, brand: v })} tid="pf-brand" />
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {CATS.map((c) => (
                  <Pressable key={c} style={[styles.catChip, form.category === c && styles.catChipActive]} onPress={() => setForm({ ...form, category: c })}>
                    <Text style={[styles.catChipText, form.category === c && { color: colors.black }]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Field label="Price (₹)" value={form.price} onChange={(v: string) => setForm({ ...form, price: v })} kb="decimal-pad" tid="pf-price" />
              <Field label="Stock" value={form.stock} onChange={(v: string) => setForm({ ...form, stock: v })} kb="number-pad" tid="pf-stock" />
              <Field label="Image URL" value={form.image} onChange={(v: string) => setForm({ ...form, image: v })} tid="pf-image" />
              <Field label="Description" value={form.description} onChange={(v: string) => setForm({ ...form, description: v })} multi tid="pf-desc" />
              <Pressable testID="pf-save" style={styles.saveBtn} onPress={save} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.black} /> : <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Create'}</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChange, kb, multi, tid }: any) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput testID={tid} value={value} onChangeText={onChange} keyboardType={kb || 'default'} multiline={multi} style={[styles.field, multi && { minHeight: 60 }]} placeholderTextColor={colors.textMuted} />
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.white, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill },
  addBtnText: { color: colors.black, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg2, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  img: { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  name: { color: colors.text, fontWeight: '600' },
  brand: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  price: { color: colors.gold, fontSize: fs.sm, fontWeight: '700', marginTop: 2 },
  actionBtn: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  fieldLabel: { color: colors.textDim, fontSize: fs.sm, marginTop: spacing.md, marginBottom: 6 },
  field: { backgroundColor: colors.bg3, borderRadius: radius.md, padding: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
  catChip: { paddingHorizontal: 12, height: 32, borderRadius: radius.pill, backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  catChipActive: { backgroundColor: colors.white, borderColor: colors.white },
  catChipText: { color: colors.textDim, fontWeight: '600', fontSize: fs.sm },
  saveBtn: { marginTop: spacing.xl, height: 50, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
});
