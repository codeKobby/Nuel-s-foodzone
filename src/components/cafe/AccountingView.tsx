
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense, ReconciliationReport } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, FileSignature, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import FinancialSummaryView from '@/components/cafe/FinancialSummaryView';
import ReconciliationView from '@/components/cafe/ReconciliationView';
import HistoryView from '@/components/cafe/HistoryView';

interface PeriodStats {
    totalSales: number;
    cashSales: number;
    momoSales: number;
    collectionsFromPreviousDays: number;
    miscCashExpenses: number;
    miscMomoExpenses: number;
    totalPardonedAmount: number;
    itemPerformance: { name: string, count: number, totalValue: number }[];
    changeOwedForPeriod: number;
}

const AccountingView: React.FC<{setActiveView: (view: string) => void}> = ({setActiveView}) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [miscExpenses, setMiscExpenses] = useState<MiscExpense[]>([]);
    const [stats, setStats] = useState<PeriodStats | null>(null);
    const [allUnpaidOrdersTotal, setAllUnpaidOrdersTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showReconciliation, setShowReconciliation] = useState(false);
    const [isTodayClosedOut, setIsTodayClosedOut] = useState(false);

    const todayStart = useMemo(() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        return Timestamp.fromDate(start);
    }, []);

    const todayEnd = useMemo(() => {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return Timestamp.fromDate(end);
    }, []);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch all-time unpaid orders total separately for accuracy
            const allUnpaidQuery = query(collection(db, "orders"), where("paymentStatus", "in", ["Unpaid", "Partially Paid"]));
            const allUnpaidSnapshot = await getDocs(allUnpaidQuery);
            const totalUnpaidValue = allUnpaidSnapshot.docs.reduce((sum, doc) => sum + (doc.data().balanceDue || 0), 0);
            setAllUnpaidOrdersTotal(totalUnpaidValue);
            
            // Fetch today's data
            const ordersQuery = query(collection(db, "orders"), where('timestamp', '>=', todayStart), where('timestamp', '<=', todayEnd));
            const expensesQuery = query(collection(db, "miscExpenses"), where('timestamp', '>=', todayStart), where('timestamp', '<=', todayEnd));
            const [ordersSnapshot, expensesSnapshot] = await Promise.all([getDocs(ordersQuery), getDocs(expensesQuery)]);
            
            const fetchedOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
            const fetchedExpenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MiscExpense));
            
            setOrders(fetchedOrders);
            setMiscExpenses(fetchedExpenses);

        } catch (e) {
            console.error("Error fetching accounting data:", e);
            setError("Failed to load financial data for today.");
        } finally {
            setLoading(false);
        }
    }, [todayStart, todayEnd]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);
    
    useEffect(() => {
        const reportsQuery = query(collection(db, "reconciliationReports"), where('timestamp', '>=', todayStart));
        const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
            setIsTodayClosedOut(!snapshot.empty);
        });
        return () => unsubscribe();
    }, [todayStart]);


    useEffect(() => {
        if (!orders.length && !miscExpenses.length && loading) return;

        let totalSales = 0, cashSales = 0, momoSales = 0, miscCashExpenses = 0, miscMomoExpenses = 0;
        let totalPardonedAmount = 0, changeOwedForPeriod = 0, collectionsFromPreviousDays = 0;
        const itemPerformance: Record<string, { name: string; count: number; totalValue: number }> = {};
        
        orders.forEach(order => {
            if (order.status === 'Completed') {
                totalSales += order.total;
                order.items.forEach(item => {
                    if (!itemPerformance[item.name]) {
                        itemPerformance[item.name] = { name: item.name, count: 0, totalValue: 0 };
                    }
                    itemPerformance[item.name].count += item.quantity;
                    itemPerformance[item.name].totalValue += item.price * item.quantity;
                });
            }
            if (order.pardonedAmount > 0) totalPardonedAmount += order.pardonedAmount;
            if (order.balanceDue < 0) changeOwedForPeriod += Math.abs(order.balanceDue);
            
            const paymentDate = order.lastPaymentTimestamp?.toDate() || order.timestamp.toDate();
            if (paymentDate >= todayStart.toDate() && paymentDate <= todayEnd.toDate()) {
                 if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Paid') {
                    const paidAmount = order.lastPaymentAmount || order.amountPaid;
                    const orderDate = order.timestamp.toDate();
                    
                    if (orderDate < todayStart.toDate()) {
                        collectionsFromPreviousDays += paidAmount;
                    }

                    if (order.paymentMethod === 'cash') cashSales += paidAmount;
                    if (order.paymentMethod === 'momo') momoSales += paidAmount;
                }
            }
        });
        
        miscExpenses.forEach(expense => {
            if (expense.source === 'cash') miscCashExpenses += expense.amount;
            if (expense.source === 'momo') miscMomoExpenses += expense.amount;
        });

        setStats({
            totalSales, cashSales, momoSales, collectionsFromPreviousDays,
            miscCashExpenses, miscMomoExpenses, totalPardonedAmount,
            itemPerformance: Object.values(itemPerformance).sort((a, b) => b.count - a.count),
            changeOwedForPeriod,
        });

    }, [orders, miscExpenses, loading, todayStart, todayEnd]);
    
    const unpaidOrdersToday = useMemo(() => {
        return orders.filter(o => o.paymentStatus !== 'Paid');
    }, [orders]);
    
    const handleStartEndDay = () => {
         if (unpaidOrdersToday.length > 0) {
            if (!window.confirm("There are still unpaid orders for today. Are you sure you want to proceed to reconciliation? It's recommended to settle them first.")) {
                return;
            }
        }
        setShowReconciliation(true);
    }
    
    if (loading) {
        return <div className="p-6 h-full flex items-center justify-center"><LoadingSpinner /></div>;
    }
    
    if (error) {
        return <div className="p-6"><Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div>;
    }
    
    if (showReconciliation && stats) {
        return <ReconciliationView stats={stats} orders={orders} onBack={() => setShowReconciliation(false)} setActiveView={setActiveView} />;
    }

    return (
        <div className="h-full flex flex-col bg-background">
            <Tabs defaultValue="summary" className="flex-1 flex flex-col">
                <div className="p-4 md:p-6 border-b">
                     <div className="flex justify-between items-center mb-4">
                        <h1 className="text-2xl md:text-3xl font-bold">Accounting</h1>
                        <Button onClick={handleStartEndDay} disabled={isTodayClosedOut}>
                            <FileSignature className="mr-2 h-4 w-4" />
                            {isTodayClosedOut ? 'Day Already Closed' : 'Start End-of-Day'}
                        </Button>
                    </div>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="summary">Financial Summary</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="summary" className="flex-1 overflow-auto">
                    {stats ? (
                        <FinancialSummaryView
                            stats={stats}
                            allUnpaidOrdersTotal={allUnpaidOrdersTotal}
                            isTodayClosedOut={isTodayClosedOut}
                            onStartEndDay={handleStartEndDay}
                        />
                    ) : (
                        <p className="p-6 text-muted-foreground">No data for today.</p>
                    )}
                </TabsContent>
                <TabsContent value="history" className="flex-1 overflow-auto">
                    <HistoryView />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AccountingView;
