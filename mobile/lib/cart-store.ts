import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  vendorId: number;
  vendorName: string;
  imageUrl: string | null;
  quantity: number;
  stockQty: number;
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

/** The cart is kept on the device (map of product → quantity), grouped by vendor at checkout. */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === item.productId);
          if (existing) {
            return { items: s.items.map((i) => (i.productId === item.productId ? { ...i, ...item, quantity: Math.min(i.quantity + qty, item.stockQty) } : i)) };
          }
          return { items: [...s.items, { ...item, quantity: Math.min(qty, item.stockQty) }] };
        }),
      setQty: (productId, qty) =>
        set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, Math.min(qty, i.stockQty)) } : i)) })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'serendibgo.cart', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const cartTotal = (items: CartItem[]) => items.reduce((s, i) => s + i.price * i.quantity, 0);
export const cartCount = (items: CartItem[]) => items.reduce((s, i) => s + i.quantity, 0);
