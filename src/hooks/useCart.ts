import { useState, useCallback, useMemo } from "react";
import { MenuItem, OrderItem } from "@/lib/types";

export const useCart = () => {
  const [currentOrder, setCurrentOrder] = useState<Record<string, OrderItem>>(
    {}
  );

  const total = useMemo(() => {
    return Object.values(currentOrder).reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    );
  }, [currentOrder]);

  const totalItems = useMemo(() => {
    return Object.values(currentOrder).reduce(
      (acc, item) => acc + item.quantity,
      0
    );
  }, [currentOrder]);

  const addToOrder = useCallback((item: MenuItem | OrderItem) => {
    setCurrentOrder((prev) => {
      // Check if item already exists by name (and maybe other properties if needed)
      // For simple items, name check is usually enough.
      // If items have modifiers, we might need a more complex key or check.
      const existingEntry = Object.entries(prev).find(
        ([, i]) => i.name === item.name
      );

      if (existingEntry) {
        const [existingId, existingItem] = existingEntry;
        return {
          ...prev,
          [existingId]: {
            ...existingItem,
            quantity: existingItem.quantity + 1,
          },
        };
      } else {
        // Always use a fresh id for new cart entries so modified variants
        // (e.g. "English Breakfast with Tea") don't overwrite other
        // entries that share the original menu id.
        const newItemId = crypto.randomUUID();
        const { id: _oldId, ...rest } = item as any;
        // Ensure the item has all OrderItem properties and do NOT include the
        // original `id` from the menu item (that would cause key collisions).
        const newItem: OrderItem = {
          id: newItemId,
          name: item.name,
          price: item.price,
          quantity: 1,
          category: (item as MenuItem).category || "Custom",
          ...rest,
        };
        return { ...prev, [newItemId]: newItem };
      }
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, amount: number) => {
    setCurrentOrder((prev) => {
      const item = prev[itemId];
      if (!item) return prev;
      const newQuantity = item.quantity + amount;
      if (newQuantity <= 0) {
        const { [itemId]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: { ...item, quantity: newQuantity } };
    });
  }, []);

  const setQuantity = useCallback((itemId: string, quantity: number) => {
    setCurrentOrder((prev) => {
      if (!prev[itemId]) return prev;
      if (quantity <= 0) {
        const { [itemId]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: { ...prev[itemId], quantity: quantity } };
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCurrentOrder((prev) => {
      const { [itemId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearOrder = useCallback(() => {
    setCurrentOrder({});
  }, []);

  const setCart = useCallback((items: Record<string, OrderItem>) => {
    setCurrentOrder(items);
  }, []);

  return {
    currentOrder,
    total,
    totalItems,
    addToOrder,
    updateQuantity,
    setQuantity,
    removeItem,
    clearOrder,
    setCart,
  };
};
