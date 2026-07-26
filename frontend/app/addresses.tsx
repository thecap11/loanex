import { useCallback, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';

const LABELS = ['Home', 'Work', 'Other'];

export default function Addresses() {
  const { api } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: 'Home', full_name: '', phone: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '', is_default: false });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api('/addresses')); } catch {} finally { setLoading(false); }
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setBusy(true);
    try {
      await api('/addresses', { method: 'POST', body: JSON.stringify(form) });
      setOpen(false);
      setForm({ label: 'Home', full_name: '', phone: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '', is_default: false });
      load();
    } catch {} finally { setBusy(false); }
  };

  const del = async (id: string) => {
    await api(`/addresses/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Pressable testID="addr-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Text style={styles.title}>Addresses</Text>
        <Pressable testID="addr-add" onPress={() => setOpen(true)} style={styles.iconBtn}><Ionicons name="add" size={22} color={colors.text} /></Pressable>
      </View>
      {loading ? <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="location-outline" size={72} color={colors.textMuted} />
              <Text style={styles.emptyText}>No saved addresses</Text>
              <Pressable style={styles.addBtn} onPress={() => setOpen(true)}><Text style={styles.addBtnText}>Add address</Text></Pressable>
            </View>
          ) : items.map((a) => (
            <View testID={`addr-${a.id}`} key={a.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={styles.labelBadge}><Text style={styles.labelText}>{a.label}</Text></View>
                {a.is_default && <Text style={styles.defaultTag}>DEFAULT</Text>}
              </View>
              <Text style={styles.name}>{a.full_name} • {a.phone}</Text>
              <Text style={styles.line}>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</Text>
              <Text style={styles.line}>{a.city}, {a.state} - {a.pincode}</Text>
              <Pressable testID={`addr-del-${a.id}`} style={styles.delBtn} onPress={() => del(a.id)}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text style={styles.delText}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add address</Text>
              <Pressable onPress={() => setOpen(false)}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.labelsRow}>
                {LABELS.map((l) => (
                  <Pressable key={l} style={[styles.labelBtn, form.label === l && styles.labelBtnActive]} onPress={() => setForm({ ...form, label: l })}>
                    <Text style={[styles.labelBtnText, form.label === l && { color: colors.black }]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
              <F t="Full Name" v={form.full_name} onC={(v) => setForm({ ...form, full_name: v })} tid="af-name" />
              <F t="Phone" v={form.phone} onC={(v) => setForm({ ...form, phone: v })} kb="phone-pad" tid="af-phone" />
              <F t="Address Line 1" v={form.line1} onC={(v) => setForm({ ...form, line1: v })} tid="af-line1" />
              <F t="Line 2 / Landmark" v={form.line2} onC={(v) => setForm({ ...form, line2: v })} tid="af-line2" />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}><F t="City" v={form.city} onC={(v) => setForm({ ...form, city: v })} tid="af-city" /></View>
                <View style={{ flex: 1 }}><F t="State" v={form.state} onC={(v) => setForm({ ...form, state: v })} tid="af-state" /></View>
              </View>
              <F t="Pincode" v={form.pincode} onC={(v) => setForm({ ...form, pincode: v })} kb="number-pad" tid="af-pincode" />
              <Pressable style={styles.defRow} onPress={() => setForm({ ...form, is_default: !form.is_default })}>
                <View style={[styles.checkbox, form.is_default && styles.checkboxOn]}>{form.is_default && <Ionicons name="checkmark" size={14} color={colors.black} />}</View>
                <Text style={styles.defTxt}>Set as default</Text>
              </Pressable>
              <Pressable testID="af-save" style={styles.save} onPress={save} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.black} /> : <Text style={styles.saveText}>Save Address</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function F({ t, v, onC, kb, tid }: any) {
  return (
    <>
      <Text style={styles.fLabel}>{t}</Text>
      <TextInput testID={tid} value={v} onChangeText={onC} keyboardType={kb || 'default'} style={styles.fInput} placeholderTextColor={colors.textMuted} />
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.md, paddingTop: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  empty: { alignItems: 'center', gap: spacing.md, marginTop: 60 },
  emptyText: { color: colors.textDim, fontSize: fs.lg },
  addBtn: { backgroundColor: colors.white, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  addBtnText: { color: colors.black, fontWeight: '700' },
  card: { backgroundColor: colors.bg2, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  labelBadge: { alignSelf: 'flex-start', backgroundColor: colors.bg3, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  labelText: { color: colors.text, fontSize: fs.sm, fontWeight: '700' },
  defaultTag: { color: colors.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  name: { color: colors.text, fontWeight: '700', marginTop: spacing.sm },
  line: { color: colors.textDim, marginTop: 2 },
  delBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, alignSelf: 'flex-start' },
  delText: { color: colors.error, fontSize: fs.sm },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700' },
  labelsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  labelBtn: { flex: 1, height: 40, borderRadius: radius.md, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  labelBtnActive: { backgroundColor: colors.white, borderColor: colors.white },
  labelBtnText: { color: colors.text, fontWeight: '600' },
  fLabel: { color: colors.textDim, fontSize: fs.sm, marginTop: spacing.md, marginBottom: 6 },
  fInput: { backgroundColor: colors.bg3, borderRadius: radius.md, padding: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
  defRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.white, borderColor: colors.white },
  defTxt: { color: colors.text },
  save: { marginTop: spacing.xl, height: 50, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.black, fontWeight: '700', fontSize: fs.lg },
});
