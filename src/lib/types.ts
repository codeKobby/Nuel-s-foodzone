
import type { Timestamp } from 'firebase/firestore';

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

export interface Order {
  id: string;
  simplifiedId: string;
  tag: string;
  orderType: 'Dine-In' | 'Takeout' | 'Delivery';
  items: Omit<OrderItem, 'id' | 'category'>[];
  total: number;
  paymentMethod: 'cash' | 'momo' | 'Unpaid';
  paymentStatus: 'Paid' | 'Unpaid' | 'Partially Paid';
  amountPaid: number;
  changeGiven: number;
  balanceDue: number; // For amount owed by customer OR change owed to customer
  status: 'Pending' | 'Completed';
  timestamp: Timestamp;
}

export interface MiscExpense {
  id: string;
  purpose: string;
  amount: number;
  timestamp: Timestamp;
  settled: boolean;
}

export interface ReconciliationReport {
    id: string;
    timestamp: Timestamp;
    period: string;
    totalSales: number;
    cashSales: number;
    momoSales: number;
    miscExpenses: number;
    expectedCash: number;
    countedCash: number;
    countedMomo: number;
    cashDifference: number;
    changeOwed: number;
    changeSetAside: boolean;
    cashForDeposit: number;
    notes: string;
}
