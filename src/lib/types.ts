

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
  changeGiven: number; // This tracks cash that has been physically returned or settled.
  balanceDue: number; // Positive if customer owes money, negative if change is owed to customer
  pardonedAmount: number; // For tracking accepted deficits
  status: 'Pending' | 'Completed';
  timestamp: Timestamp;
  creditSource?: string[]; // Note for traceability, e.g., "Converted to credit for [customerTag]"
  lastPaymentTimestamp?: Timestamp;
  lastPaymentAmount?: number;
  settledOn?: Timestamp; // The date when an outstanding balance/change was fully settled.
  notes?: string;
}

export interface MiscExpense {
  id: string;
  purpose: string;
  amount: number;
  source: 'cash' | 'momo';
  timestamp: Timestamp;
  settled: boolean;
}

export interface ReconciliationReport {
    id: string;
    timestamp: Timestamp;
    period: string;
    totalSales: number; // For context, but not part of main calculation
    
    // Expected figures
    expectedCash: number;
    expectedMomo: number;
    totalExpectedRevenue: number;

    // Counted figures
    countedCash: number;
    countedMomo: number;
    totalCountedRevenue: number;

    // Final result
    totalDiscrepancy: number;
    notes: string;

    // Change Owed Handling
    changeOwedForPeriod: number;
    changeOwedSetAside: boolean;
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

