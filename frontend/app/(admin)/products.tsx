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

type EmiOverrides = {
  enabled: boolean;
  interest_rate: string;
  down_payment_percent: string;
  processing_fee: string;
  tenures: string;
  custom_charges: { label: string; amount: string; type: 'fixed' | 'percent' }[];
};

const emptyOverrides: EmiOverrides = { enabled: false, interest_rate: '', down_payment_percent: '', processing_fee: '', tenures: '', custom_charges: [] };

export default function AdminProducts() {
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: '', brand: '', category: 'Mobiles', price: '', description: '', image: '', stock: '' });
  const [emi, setEmi] = useState<EmiOverrides>(emptyOverrides);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api('/products')); } catch {} finally { setLoading(false); }
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', brand: '', category: 'Mobiles', price: '', description: '', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=940', stock: '10' });
    setEmi(emptyOverrides);
    setModalOpen(true);
  };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ ...p, price: String(p.price), stock: String(p.stock) });
    const ov = p.emi_overrides;
    if (ov) {
      setEmi({
        enabled: true,
        interest_rate: ov.interest_rate != null ? String(ov.interest_rate) : '',
        down_payment_percent: ov.down_payment_percent != null ? String(ov.down_payment_percent) : '',
        processing_fee: ov.processing_fee != null ? String(ov.processing_fee) : '',
        tenures: ov.tenures ? ov.tenures.join(',') : '',
        custom_charges: (ov.custom_charges || []).map((c: any) => ({ label: c.label, amount: String(c.amount), type: c.type || 'fixed' })),
      });
    } else setEmi(emptyOverrides);
    setModalOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const body: any = { ...form, price: parseFloat(form.price), stock: parseInt(form.stock), emi_eligible: true };
      if (emi.enabled) {
        const ov: any = {};
        if (emi.interest_rate) ov.interest_rate = parseFloat(emi.interest_rate);
        if (emi.down_payment_percent) ov.down_payment_percent = parseFloat(emi.down_payment_percent);
        if (emi.processing_fee) ov.processing_fee = parseFloat(emi.processing_fee);
        if (emi.tenures) ov.tenures = emi.tenures.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
        if (emi.custom_charges.length) ov.custom_charges = emi.custom_charges.map((c) => ({ label: c.label, amount: parseFloat(c.amount) || 0, type: c.type }));
        body.emi_overrides = ov;
      } else {
        body.emi_overrides = null;
      }
      if (editing) await api(`/products/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await api('/products', { method: 'POST', body: JSON.stringify(body) });
      setModalOpen(false); load();
    } catch (e) {} finally { setBusy(false); }
  };

  const del = async (id: string) => {
    await api(`/products/${id}`, { method: 'DELETE' });
    load();
  };

  const addCharge = () => setEmi({ ...emi, custom_charges: [...emi.custom_charges, { label: '', amount: '', type: 'fixed' }] });
  const updCharge = (i: number, key: string, val: any) => {
    const next = [...emi.custom_charges]; (next[i] as any)[key] = val; setEmi({ ...emi, custom_charges: next });
  };
  const delCharge = (i: number) => setEmi({ ...emi, custom_charges: emi.custom_charges.filter((_, idx) => idx !== i) });

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
                {p.emi_overrides && <View style={styles.customEmiTag}><Text style={styles.customEmiText}>CUSTOM EMI</Text></View>}
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
            <ScrollView keyboardShouldPersistTaps="handled">
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

              {/* Custom EMI schema section */}
              <Pressable testID="toggle-emi-ovr" style={styles.emiToggle} onPress={() => setEmi({ ...emi, enabled: !emi.enabled })}>
                <View style={styles.emiToggleLeft}>
                  <Ionicons name="calendar" size={18} color={colors.gold} />
                  <View style={{ marginLeft: spacing.sm }}>
                    <Text style={styles.emiToggleTitle}>Custom EMI Schema</Text>
                    <Text style={styles.emiToggleSub}>{emi.enabled ? 'Overrides global config' : 'Uses global config'}</Text>
                  </View>
                </View>
                <View style={[styles.switch, emi.enabled && styles.switchOn]}>
                  <View style={[styles.switchDot, emi.enabled && styles.switchDotOn]} />
                </View>
              </Pressable>

              {emi.enabled && (
                <View style={styles.emiBox}>
                  <Text style={styles.emiHint}>Leave blank to use global default</Text>
                  <Field label="Interest Rate (% APR)" value={emi.interest_rate} onChange={(v: string) => setEmi({ ...emi, interest_rate: v })} kb="decimal-pad" tid="ovr-rate" />
                  <Field label="Down Payment (%)" value={emi.down_payment_percent} onChange={(v: string) => setEmi({ ...emi, down_payment_percent: v })} kb="decimal-pad" tid="ovr-dp" />
                  <Field label="Processing Fee (₹)" value={emi.processing_fee} onChange={(v: string) => setEmi({ ...emi, processing_fee: v })} kb="decimal-pad" tid="ovr-fee" />
                  <Field label="Tenures (months, comma-separated)" value={emi.tenures} onChange={(v: string) => setEmi({ ...emi, tenures: v })} tid="ovr-tenures" />

                  <View style={styles.chargesHeader}>
                    <Text style={styles.fieldLabel}>Custom Charges</Text>
                    <Pressable testID="ovr-add-charge" onPress={addCharge} style={styles.addChargeBtn}>
                      <Ionicons name="add" size={14} color={colors.black} />
                      <Text style={styles.addChargeText}>Add</Text>
                    </Pressable>
                  </View>
                  {emi.custom_charges.length === 0 ? (
                    <Text style={styles.noCharges}>No custom charges added</Text>
                  ) : emi.custom_charges.map((c, i) => (
                    <View testID={`ovr-charge-${i}`} key={i} style={styles.chargeRow}>
                      <TextInput
                        testID={`ovr-charge-label-${i}`}
                        placeholder="Label (e.g., Insurance)"
                        placeholderTextColor={colors.textMuted}
                        value={c.label}
                        onChangeText={(v) => updCharge(i, 'label', v)}
                        style={[styles.chargeInput, { flex: 2 }]}
                      />
                      <TextInput
                        testID={`ovr-charge-amt-${i}`}
                        placeholder="Amount"
                        placeholderTextColor={colors.textMuted}
                        value={c.amount}
                        onChangeText={(v) => updCharge(i, 'amount', v)}
                        keyboardType="decimal-pad"
                        style={[styles.chargeInput, { flex: 1 }]}
                      />
                      <Pressable testID={`ovr-charge-type-${i}`} onPress={() => updCharge(i, 'type', c.type === 'fixed' ? 'percent' : 'fixed')} style={styles.typeToggle}>
                        <Text style={styles.typeText}>{c.type === 'percent' ? '%' : '₹'}</Text>
                      </Pressable>
                      <Pressable testID={`ovr-charge-del-${i}`} onPress={() => delCharge(i)} style={styles.delChargeBtn}>
                        <Ionicons name="trash" size={14} color={colors.error} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

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
  customEmiTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(212,175,55,0.15)', borderColor: colors.gold, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, marginTop: 4 },
  customEmiText: { color: colors.gold, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  actionBtn: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  fieldLabel: { color: colors.textDim, fontSize: fs.sm, marginTop: spacing.md, marginBottom: 6 },
  field: { backgroundColor: colors.bg3, borderRadius: radius.md, padding: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
  catChip: { paddingHorizontal: 12, height: 32, borderRadius: radius.pill, backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  catChipActive: { backgroundColor: colors.white, borderColor: colors.white },
  catChipText: { color: colors.textDim, fontWeight: '600', fontSize: fs.sm },
  emiToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.bg3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  emiToggleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  emiToggleTitle: { color: colors.text, fontWeight: '700' },
  emiToggleSub: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  switch: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.bg, padding: 2, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.gold },
  switchDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  switchDotOn: { backgroundColor: colors.black, alignSelf: 'flex-end' },
  emiBox: { marginTop: spacing.sm, padding: spacing.md, backgroundColor: colors.bg3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold },
  emiHint: { color: colors.textDim, fontSize: fs.sm, fontStyle: 'italic' },
  chargesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addChargeBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.gold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.md },
  addChargeText: { color: colors.black, fontWeight: '700', fontSize: fs.sm },
  noCharges: { color: colors.textMuted, fontSize: fs.sm, fontStyle: 'italic', marginTop: spacing.sm },
  chargeRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: spacing.sm },
  chargeInput: { backgroundColor: colors.bg2, borderRadius: radius.sm, padding: 8, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: fs.sm },
  typeToggle: { width: 36, height: 36, backgroundColor: colors.bg2, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  typeText: { color: colors.text, fontWeight: '700' },
  delChargeBtn: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center' },
  saveBtn: { marginTop: spacing.xl, height: 50, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
});
