import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { useAlert } from '@/src/context/AlertContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { addressService } from '@/src/services/addressService';

export default function Addresses() {
  const { user } = useAuth();
  const { toast } = useAlert();
  const insets = useSafeAreaInsets();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tag: 'Home', house_no: '', street: '', landmark: '', city: '', pincode: '', state: '' });

  const load = useCallback(async () => {
    if (!user) return;
    try { setAddresses(await addressService.getAddresses(user.id)); } catch (e) {} finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async () => {
    if (!form.house_no || !form.street || !form.city || !form.pincode || !form.state) { toast('Fill all required fields', 'error'); return; }
    if (form.pincode.length !== 6) { toast('Pincode must be 6 digits', 'error'); return; }
    try {
      await addressService.addAddress({ user_id: user!.id, ...form, is_default: addresses.length === 0 });
      toast('Address saved', 'success');
      setShowForm(false);
      setForm({ tag: 'Home', house_no: '', street: '', landmark: '', city: '', pincode: '', state: '' });
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const handleSetDefault = async (id: string) => {
    try { await addressService.setDefault(user!.id, id); toast('Default address updated', 'success'); load(); } catch (e: any) { toast(e.message, 'error'); }
  };

  const handleDelete = async (id: string) => {
    try { await addressService.deleteAddress(id); toast('Address deleted', 'info'); load(); } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>Addresses</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.addBtnText}>Add New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.white} size="large" /></View>
      ) : addresses.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="location-outline" size={72} color={colors.textMuted} />
          <Text style={styles.emptyText}>No saved addresses</Text>
          <Pressable style={styles.emptyBtn} onPress={() => setShowForm(true)}><Text style={styles.emptyBtnText}>Add New Address</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
          {addresses.map((a) => (
            <View key={a.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.tagBadge}><Text style={styles.tagText}>{a.tag?.toUpperCase()}</Text></View>
                {a.is_default && <Text style={styles.defaultBadge}>Default</Text>}
              </View>
              <Text style={styles.addrText}>{a.house_no}, {a.street}</Text>
              {a.landmark ? <Text style={styles.addrText}>Landmark: {a.landmark}</Text> : null}
              <Text style={styles.addrText}>{a.city}, {a.state} {a.pincode}</Text>
              <View style={styles.cardActions}>
                {!a.is_default && <Pressable style={styles.defaultBtn} onPress={() => handleSetDefault(a.id)}><Text style={styles.defaultBtnText}>Make Default</Text></Pressable>}
                <Pressable style={styles.deleteBtn} onPress={() => handleDelete(a.id)}><Ionicons name="trash-outline" size={16} color={colors.error} /></Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showForm} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowForm(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add Delivery Address</Text>
            <Text style={styles.modalLabel}>Tag</Text>
            <View style={styles.tagRow}>
              {['Home', 'Work', 'Other'].map((t) => (
                <Pressable key={t} style={[styles.tagChip, form.tag === t && styles.tagChipActive]} onPress={() => setForm({ ...form, tag: t })}>
                  <Text style={[styles.tagChipText, form.tag === t && styles.tagChipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalLabel}>House / Flat No.</Text>
            <TextInput style={styles.input} value={form.house_no} onChangeText={(t) => setForm({ ...form, house_no: t })} placeholderTextColor={colors.textMuted} />
            <Text style={styles.modalLabel}>Street / Locality</Text>
            <TextInput style={styles.input} value={form.street} onChangeText={(t) => setForm({ ...form, street: t })} placeholderTextColor={colors.textMuted} />
            <Text style={styles.modalLabel}>Landmark</Text>
            <TextInput style={styles.input} value={form.landmark} onChangeText={(t) => setForm({ ...form, landmark: t })} placeholderTextColor={colors.textMuted} />
            <Text style={styles.modalLabel}>City</Text>
            <TextInput style={styles.input} value={form.city} onChangeText={(t) => setForm({ ...form, city: t })} placeholderTextColor={colors.textMuted} />
            <Text style={styles.modalLabel}>Pincode</Text>
            <TextInput style={styles.input} value={form.pincode} onChangeText={(t) => setForm({ ...form, pincode: t.replace(/[^0-9]/g, '') })} keyboardType="numeric" maxLength={6} placeholderTextColor={colors.textMuted} />
            <Text style={styles.modalLabel}>State</Text>
            <TextInput style={styles.input} value={form.state} onChangeText={(t) => setForm({ ...form, state: t })} placeholderTextColor={colors.textMuted} />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowForm(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave}><Text style={styles.saveText}>Save Address</Text></Pressable>
            </View>
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
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tagBadge: { backgroundColor: colors.primary + '20', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: colors.primaryLight, fontSize: 10, fontWeight: '700' },
  defaultBadge: { color: colors.success, fontSize: 10, fontWeight: '700' },
  addrText: { color: colors.textDim, fontSize: fs.sm, marginBottom: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  defaultBtn: { backgroundColor: colors.primary + '20', borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  defaultBtnText: { color: colors.primaryLight, fontSize: fs.xs, fontWeight: '700' },
  deleteBtn: { padding: 6, marginLeft: 'auto' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, maxHeight: '85%' },
  modalTitle: { color: colors.text, fontSize: fs.xl, fontWeight: '700', marginBottom: spacing.lg },
  modalLabel: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600', marginBottom: 4, marginTop: spacing.sm },
  tagRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tagChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tagChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagChipText: { color: colors.textDim, fontSize: fs.sm, fontWeight: '600' },
  tagChipTextActive: { color: colors.white },
  input: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 46, color: colors.text, borderWidth: 1, borderColor: colors.border },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  cancelBtn: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.textDim, fontWeight: '700' },
  saveBtn: { flex: 2, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.white, fontWeight: '700' },
});
