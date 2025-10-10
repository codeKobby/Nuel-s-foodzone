

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
  paymentMethod: 'cash' | 'momo' | 'split' | 'Unpaid';
  paymentBreakdown: { cash: number; momo: number };
  paymentStatus: 'Paid' | 'Unpaid' | 'Partially Paid';
  amountPaid: number;
  changeGiven: number; 
  balanceDue: number; 
  pardonedAmount: number;
  status: 'Pending' | 'Completed';
  timestamp: Timestamp;
  creditSource?: string[];
  rewardDiscount?: number;
  rewardCustomerTag?: string;
  lastPaymentTimestamp?: Timestamp;
  lastPaymentAmount?: number;
  settledOn?: Timestamp;
  notes?: string;
  cashierId: string;
  cashierName: string;
}

export interface CustomerReward {
  id: string;
  customerTag: string;
  phone?: string;
  bagCount: number;
  joinedDate: Timestamp;
  totalRedeemed: number;
  updatedAt: Timestamp;
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
    period: string; // e.g., '2024-08-15'
    totalSales: number; // Based on completed orders created in the period
    
    // Revenue based on actual money counted
    expectedCash: number;
    expectedMomo: number;
    totalExpectedRevenue: number;

    countedCash: number;
    countedMomo: number;
    totalCountedRevenue: number;

    // Discrepancy analysis
    totalDiscrepancy: number; // totalCountedRevenue - totalExpectedRevenue
    
    notes: string;
    
    // Change tracking
    changeOwedForPeriod: number;
    changeOwedSetAside: boolean;
    
    // Cashier info
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
  role: "user" | "model";
  content: Array<{text: string}>;
}

export interface ChatSession {
    id: string;
    title: string;
    timestamp: Timestamp;
    messages: ChatMessage[];
    userId: string;
}

export type AnalyzeBusinessOutput = z.infer<typeof AnalyzeBusinessOutputSchema>;

export interface OrderEditingContextType {
    editingOrder: Order | null;
    loadOrderForEditing: (order: Order) => void;
    clearEditingOrder: () => void;
}


// Dashboard specific types
export interface EnhancedReconciliationReport extends ReconciliationReport {
    cashDiscrepancy: number;
    momoDiscrepancy: number;
}

export interface ChangeFund {
    openingBalance: number;
    changeGenerated: number; // Sum of all negative balances (change owed to customer)
    changeSettled: number; // Sum of all change settled from previous days
    totalAvailable: number; // opening + generated
    setAsideAmount: number; // Amount from reconciliation marked as "set aside"
    wasSetAside: boolean;
}

export interface PreviousDaySettlement {
    orderId: string;
    amount: number;
    paymentMethod: 'cash' | 'momo';
}

export interface EnhancedPeriodStats {
    date: string; // YYYY-MM-DD
    todayNewSales: number;
    todayNewItemsSold: number;
    todayNewCashSales: number;
    todayNewMomoSales: number;
    previousDaysCashCollected: number;
    previousDaysMomoCollected: number;
    previousDaysOrdersSettled: PreviousDaySettlement[];
    totalCashReceived: number;
    totalMomoReceived: number;
    totalExpectedCash: number;
    totalExpectedMomo: number;
    miscCashExpenses: number;
    miscMomoExpenses: number;
    changeFund: ChangeFund;
    changeImpactOnNet: number;
    netRevenueFromNewSales: number;
    totalNetRevenue: number;
    allTimeUnpaidOrdersValue: number;
    todayUnpaidOrdersValue: number;
    overdueOrdersCount: number;
    totalPardonedAmount: number;
    orders: Order[];
    itemStats: Record<string, { count: number; totalValue: number }>;
}

export interface BusinessMetrics {
    avgOrderValue: number;
    cashVsDigitalRatio: number; // e.g., 0.7 for 70% cash
    onTimePaymentRate: number;
    collectionRate: number;
}

export interface OrderAgeAnalysis {
    orderId: string;
    orderNumber: string;
    cashierName?: string;
    daysOverdue: number;
    amount: number;
    riskLevel: 'low' | 'medium' | 'high';
    recommendedAction: string;
}

export interface DashboardStats {
    totalSales: number;
    netRevenueFromNewSales: number;
    totalNetRevenue: number;
    previousDayCollections: number;
    cashSales: number;
    momoSales: number;
    changeFundImpact: number;
    changeFundHealth: 'healthy' | 'low' | 'critical';
    totalOrders: number;
    totalItemsSold: number;
    unpaidOrdersValue: number;
    overdueOrdersCount: number;
    totalMiscExpenses: number;
    totalPardonedAmount: number;
    totalVariance: number;
    totalSurplus: number;
    totalDeficit: number;
    enhancedReports: EnhancedReconciliationReport[];
    dailyStats: EnhancedPeriodStats[];
    salesData: { date: string; newSales: number; collections: number; netRevenue: number }[];
    itemPerformance: { name: string; count: number; totalValue: number }[];
    businessMetrics: BusinessMetrics[];
    orderAgeAnalysis: OrderAgeAnalysis[];
    incompleteAccountingDays: string[];
    pardonedOrders: Order[];
}
