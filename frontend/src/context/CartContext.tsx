import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from '@/src/utils/storage';

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  brand: string;
  emiEnabled: boolean;
  qty: number;
};

type CartCtx = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  count: number;
};

const Ctx = createContext<CartCtx | null>(null);
export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart outside provider');
  return c;
};

const CART_KEY = 'loanex_cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(CART_KEY, '');
      if (saved) {
        try { setItems(JSON.parse(saved) as CartItem[]); } catch {}
      }
    })();
  }, []);

  const persist = useCallback((newItems: CartItem[]) => {
    setItems(newItems);
    storage.setItem(CART_KEY, JSON.stringify(newItems));
  }, []);

  const saveItems = useCallback((next: CartItem[]) => {
    storage.setItem(CART_KEY, JSON.stringify(next));
  }, []);

  const addItem = useCallback((item: Omit<CartItem, 'qty'>, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      let next;
      if (existing) {
        next = prev.map((i) => i.productId === item.productId ? { ...i, qty: i.qty + qty } : i);
      } else {
        next = [...prev, { ...item, qty }];
      }
      saveItems(next);
      return next;
    });
  }, [saveItems]);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.productId !== productId);
      saveItems(next);
      return next;
    });
  }, [saveItems]);

  const updateQty = useCallback((productId: string, qty: number) => {
    setItems((prev) => {
      if (qty <= 0) {
        const next = prev.filter((i) => i.productId !== productId);
        saveItems(next);
        return next;
      }
      const next = prev.map((i) => i.productId === productId ? { ...i, qty } : i);
      saveItems(next);
      return next;
    });
  }, [saveItems]);

  const clearCart = useCallback(() => {
    persist([]);
  }, [persist]);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <Ctx.Provider value={{ items, addItem, removeItem, updateQty, clearCart, total, count }}>
      {children}
    </Ctx.Provider>
  );
}
