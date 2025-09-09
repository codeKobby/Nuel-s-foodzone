

import type { Timestamp } from 'firebase/firestore';
import type { AnalyzeBusinessOutputSchema } from '@/ai/schemas';
import { z } from 'zod';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  requiresChoice?: boolean;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

export interface FulfilledItem {
    name: string;
    quantity: number;
}

export interface Order {
  id:string;
  simplifiedId: string;
  tag: string;
  orderType: 'Dine-In' | 'Takeout' | 'Delivery';
  items: Omit<OrderItem, 'id' | 'category'>[];
  fulfilledItems: FulfilledItem[];
  total: number;
  paymentMethod: 'cash' | 'momo' | 'Unpaid';
  paymentStatus: 'Paid' | 'Unpaid' | 'Partially Paid';
  amountPaid: number;
  changeGiven: number; 
  balanceDue: number; 
  pardonedAmount: number;
  status: 'Pending' | 'Completed';
  timestamp: Timestamp;
  creditSource?: string[];
  lastPaymentTimestamp?: Timestamp;
  lastPaymentAmount?: number;
  settledOn?: Timestamp;
  notes?: string;
  cashierId: string;
  cashierName: string;
}

export interface MiscExpense {
  id: string;
  purpose: string;
  amount: number;
  source: 'cash' | 'momo';
  timestamp: Timestamp;
  settled: boolean;
  cashierId: string;
  cashierName: string;
}

export interface ReconciliationReport {
    id: string;
    timestamp: Timestamp;
    period: string;
    totalSales: number;
    expectedCash: number;
    expectedMomo: number;
    totalExpectedRevenue: number;
    countedCash: number;
    countedMomo: number;
    totalCountedRevenue: number;
    totalDiscrepancy: number;
    notes: string;
    changeOwedForPeriod: number;
    changeOwedSetAside: boolean;
    cashierId: string;
    cashierName: string;
}

export interface CashierAccount {
    id: string;
    fullName: string;
    username: string;
    passwordHash: string;
    isTemporaryPassword?: boolean;
    createdAt: Timestamp;
    status: 'active' | 'revoked';
}

export interface UserSession {
    uid: string;
    role: 'manager' | 'cashier';
    fullName?: string;
    username?: string;
}


export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export interface ChatSession {
    id: string;
    title: string;
    timestamp: Timestamp;
    messages: ChatMessage[];
}

export type AnalyzeBusinessOutput = z.infer<typeof AnalyzeBusinessOutputSchema>;

export interface OrderEditingContextType {
    editingOrder: Order | null;
    loadOrderForEditing: (order: Order) => void;
    clearEditingOrder: () => void;
}
