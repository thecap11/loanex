import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { colors, spacing, radius, fs } from '@/src/theme';

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };

type AlertCtx = {
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

const Ctx = createContext<AlertCtx | null>(null);
export const useAlert = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAlert outside provider');
  return c;
};

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <View style={styles.container} pointerEvents="none">
        {toasts.map((t) => (
          <View key={t.id} style={[styles.toast, t.type === 'error' && styles.toastError, t.type === 'success' && styles.toastSuccess]}>
            <Text style={styles.toastText}>{t.message}</Text>
          </View>
        ))}
      </View>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9999 },
  toast: { backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, minWidth: 200, alignItems: 'center' },
  toastError: { borderColor: colors.error },
  toastSuccess: { borderColor: colors.success },
  toastText: { color: colors.text, fontSize: fs.sm, fontWeight: '600' },
});
