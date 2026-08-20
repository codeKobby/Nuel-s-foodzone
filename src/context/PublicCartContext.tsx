"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MenuItem, OrderItem } from "@/lib/types";

interface PublicCartContextValue {
  items: Record<string, OrderItem>;
  itemList: OrderItem[];
  totalItems: number;
  subtotal: number;
  addItem: (item: MenuItem) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
}

const PublicCartContext = createContext<PublicCartContextValue | null>(null);
const STORAGE_KEY = "nuels-foodzone-dinner-cart";

export function PublicCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Record<string, OrderItem>>({});

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved) as Record<string, OrderItem>);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // A full cart should still work in restricted/private browser storage.
    }
  }, [items]);

  const addItem = useCallback((item: MenuItem) => {
    setItems((previous) => {
      const existing = Object.entries(previous).find(
        ([, cartItem]) => cartItem.name === item.name && cartItem.price === item.price
      );

      if (existing) {
        const [id, cartItem] = existing;
        return {
          ...previous,
          [id]: { ...cartItem, quantity: cartItem.quantity + 1 },
        };
      }

      const id = crypto.randomUUID();
      return {
        ...previous,
        [id]: {
          id,
          name: item.name,
          price: item.price,
          category: item.category,
          menuItemId: item.id,
          quantity: 1,
        },
      };
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((previous) => {
      if (!previous[id]) return previous;
      if (quantity <= 0) {
        const { [id]: removed, ...rest } = previous;
        return rest;
      }
      return { ...previous, [id]: { ...previous[id], quantity } };
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((previous) => {
      const { [id]: removed, ...rest } = previous;
      return rest;
    });
  }, []);

  const clearCart = useCallback(() => setItems({}), []);

  const value = useMemo<PublicCartContextValue>(() => {
    const itemList = Object.values(items);
    return {
      items,
      itemList,
      totalItems: itemList.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: itemList.reduce((sum, item) => sum + item.price * item.quantity, 0),
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    };
  }, [items, addItem, updateQuantity, removeItem, clearCart]);

  return <PublicCartContext.Provider value={value}>{children}</PublicCartContext.Provider>;
}

export function usePublicCart() {
  const context = useContext(PublicCartContext);
  if (!context) throw new Error("usePublicCart must be used within PublicCartProvider");
  return context;
}
