import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fs } from '@/src/theme';
import { formatINR } from '@/src/utils/currency';

export default function InventoryStock() {
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [restockOpen, setRestockOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [qty, setQty] = useState('10');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([api('/products'), api('/inventory/stats')]);
      setItems(p); setStats(s);
    } catch {} finally { setLoading(false); }
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = items.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  const restock = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/products/${selected.id}/restock`, { method: 'POST', body: JSON.stringify({ quantity: parseInt(qty) }) });
      setRestockOpen(false); setSelected(null); load();
    } catch {} finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.sub}>Inventory Console</Text>
        <Text style={styles.title}>All Stock</Text>
      </View>

      {stats && (
        <View style={styles.metricRow}>
          <View style={styles.metric}><Text style={styles.mLabel}>Total</Text><Text style={styles.mVal}>{stats.total_products}</Text></View>
          <View style={styles.metric}><Text style={styles.mLabel}>Low</Text><Text style={[styles.mVal, { color: colors.warning }]}>{stats.low_stock}</Text></View>
          <View style={styles.metric}><Text style={styles.mLabel}>Out</Text><Text style={[styles.mVal, { color: colors.error }]}>{stats.out_of_stock}</Text></View>
        </View>
      )}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textDim} />
        <TextInput testID="inv-search" style={styles.search} placeholder="Search products..." placeholderTextColor={colors.textMuted} value={q} onChangeText={setQ} />
      </View>

      {loading ? <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
          {filtered.map((p) => (
            <View testID={`inv-item-${p.id}`} key={p.id} style={styles.row}>
              <Image source={{ uri: p.image }} style={styles.img} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.meta}>{p.brand} • {formatINR(p.price)}</Text>
                <View style={styles.stockPill}>
                  <View style={[styles.dot, { backgroundColor: p.stock === 0 ? colors.error : p.stock < 5 ? colors.warning : colors.success }]} />
                  <Text style={styles.stockText}>Stock: {p.stock}</Text>
                </View>
              </View>
              <Pressable testID={`restock-${p.id}`} style={styles.restockBtn} onPress={() => { setSelected(p); setQty('10'); setRestockOpen(true); }}>
                <Ionicons name="add" size={16} color={colors.black} />
                <Text style={styles.restockText}>Restock</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={restockOpen} transparent animationType="fade" onRequestClose={() => setRestockOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Restock {selected?.name}</Text>
            <Text style={styles.modalSub}>Current stock: {selected?.stock}</Text>
            <TextInput testID="restock-qty" style={styles.input} value={qty} onChangeText={setQty} keyboardType="number-pad" />
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
              <Pressable style={styles.cancel} onPress={() => setRestockOpen(false)}><Text style={{ color: colors.text }}>Cancel</Text></Pressable>
              <Pressable testID="restock-confirm" style={styles.confirm} onPress={restock} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.black} /> : <Text style={{ color: colors.black, fontWeight: '700' }}>Add {qty} units</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  sub: { color: colors.success, fontSize: fs.sm, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' },
  title: { color: colors.text, fontSize: fs.xxl, fontWeight: '700', marginTop: 2 },
  metricRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  metric: { flex: 1, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  mLabel: { color: colors.textDim, fontSize: fs.sm },
  mVal: { color: colors.text, fontSize: fs.xxl, fontWeight: '700', marginTop: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, paddingHorizontal: spacing.lg, backgroundColor: colors.bg2, borderRadius: radius.md, height: 46, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  search: { flex: 1, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg2, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  img: { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  name: { color: colors.text, fontWeight: '600' },
  meta: { color: colors.textDim, fontSize: fs.sm, marginTop: 2 },
  stockPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stockText: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
  restockBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: spacing.md, backgroundColor: colors.white, borderRadius: radius.pill },
  restockText: { color: colors.black, fontWeight: '700', fontSize: fs.sm },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modal: { width: '100%', backgroundColor: colors.bg2, padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  modalTitle: { color: colors.text, fontSize: fs.lg, fontWeight: '700' },
  modalSub: { color: colors.textDim, marginTop: 4, marginBottom: spacing.lg },
  input: { backgroundColor: colors.bg3, borderRadius: radius.md, padding: spacing.md, color: colors.text, fontSize: fs.xl, textAlign: 'center' },
  cancel: { flex: 1, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg3 },
  confirm: { flex: 1, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
});
