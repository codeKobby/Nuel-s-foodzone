
"use client";

import React, { createContext, useState, useCallback, ReactNode } from 'react';
import type { Order, OrderEditingContextType } from '@/lib/types';

export const OrderEditingContext = createContext<OrderEditingContextType | undefined>(undefined);

export const OrderEditingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);

    const loadOrderForEditing = useCallback((order: Order) => {
        setEditingOrder(order);
    }, []);

    const clearEditingOrder = useCallback(() => {
        setEditingOrder(null);
    }, []);

    const contextValue = {
        editingOrder,
        loadOrderForEditing,
        clearEditingOrder
    };

    return (
        <OrderEditingContext.Provider value={contextValue}>
            {children}
        </OrderEditingContext.Provider>
    );
};
