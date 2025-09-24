
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, ReconciliationReport } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ReconciliationView from './ReconciliationView';
import FinancialSummaryView from './FinancialSummaryView';
import HistoryView from './HistoryView';
import { isToday } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PeriodStats {
    totalSales: number;
    cashSales: number;
    momoSales: number;
    miscCashExpenses: number;
    miscMomoExpenses: number;
    totalPardonedAmount: number;
    changeOwedForPeriod: number;
    collectionsFromPreviousDays: number;
    itemPerformance: { name: string; count: number; totalValue: number }[];
    orders: Order[];
}

const AccountingView: React.FC<{ setActiveView: (view: string) => void }> = ({ setActiveView }) => {
    const [stats, setStats] = useState<PeriodStats | null>(null);
    const [allUnpaidOrdersTotal, setAllUnpaidOrdersTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showReconciliation, setShowReconciliation] = useState(false);
    const [isTodayClosedOut, setIsTodayClosedOut] = useState(false);

    const today = useMemo(() => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }, []);

    const todayEnd = useMemo(() => {
        const date = new Date(today);
        date.setHours(23, 59, 59, 999);
        return date;
    }, [today]);

    const fetchPeriodData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const startDateTimestamp = Timestamp.fromDate(today);
            const endDateTimestamp = Timestamp.fromDate(todayEnd);

            const allOrdersQuery = query(collection(db, "orders"));
            const todayMiscQuery = query(
                collection(db, "miscExpenses"),
                where("timestamp", ">=", startDateTimestamp),
                where("timestamp", "<=", endDateTimestamp)
            );
            const allUnpaidOrdersQuery = query(collection(db, "orders"), where("balanceDue", ">", 0));
            
            const [allOrdersSnapshot, todayMiscSnapshot, allUnpaidOrdersSnapshot] = await Promise.all([
                getDocs(allOrdersQuery),
                getDocs(todayMiscQuery),
                getDocs(allUnpaidOrdersQuery),
            ]);
            
            setAllUnpaidOrdersTotal(allUnpaidOrdersSnapshot.docs.reduce((sum, doc) => sum + doc.data().balanceDue, 0));

            let totalSales = 0;
            let cashSales = 0;
            let momoSales = 0;
            let collectionsFromPreviousDays = 0;
            let totalPardonedAmount = 0;
            let changeOwedForPeriod = 0;
            const todayOrders: Order[] = [];
            const itemPerformance: Record<string, { name: string; count: number; totalValue: number }> = {};

            allOrdersSnapshot.docs.forEach(doc => {
                const order = { id: doc.id, ...doc.data() } as Order;
                const orderDate = order.timestamp.toDate();

                if (orderDate >= today && orderDate <= todayEnd) {
                    todayOrders.push(order);

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
                    
                    if (order.pardonedAmount && order.pardonedAmount > 0) {
                        totalPardonedAmount += order.pardonedAmount;
                    }
                    
                    if (order.balanceDue < 0) {
                        changeOwedForPeriod += Math.abs(order.balanceDue);
                    }
                }

                const paymentDate = order.lastPaymentTimestamp?.toDate();
                if (paymentDate && paymentDate >= today && paymentDate <= todayEnd) {
                    const paymentAmount = order.lastPaymentAmount ?? 0;
                    if (order.paymentMethod === 'cash') cashSales += paymentAmount;
                    if (order.paymentMethod === 'momo') momoSales += paymentAmount;

                    if (orderDate < today) {
                        collectionsFromPreviousDays += paymentAmount;
                    }
                }
            });

            let miscCashExpenses = 0;
            let miscMomoExpenses = 0;
            todayMiscSnapshot.forEach(doc => {
                const expense = doc.data();
                if (expense.source === 'cash') miscCashExpenses += expense.amount;
                else miscMomoExpenses += expense.amount;
            });

            setStats({
                totalSales,
                cashSales,
                momoSales,
                collectionsFromPreviousDays,
                miscCashExpenses,
                miscMomoExpenses,
                totalPardonedAmount,
                changeOwedForPeriod,
                itemPerformance: Object.values(itemPerformance).sort((a, b) => b.totalValue - a.totalValue),
                orders: todayOrders,
            });
        } catch (e) {
            console.error("Error fetching financial summary data:", e);
            setError("Failed to load financial data for today. Please check console for details.");
        } finally {
            setLoading(false);
        }
    }, [today, todayEnd]);

    useEffect(() => {
        fetchPeriodData();
    }, [fetchPeriodData]);
    
    useEffect(() => {
        const reportsQuery = query(collection(db, "reconciliationReports"), orderBy('timestamp', 'desc'));
        const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
            const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReconciliationReport));
            setIsTodayClosedOut(reports.some(report => report.timestamp && isToday(report.timestamp.toDate())));
        }, (err) => {
            console.error("Error loading reports:", err);
            setError("Failed to load past reports.");
        });
        
        return () => {
            unsubscribeReports();
        };
    }, []);

    if (loading) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-background">
                <LoadingSpinner />
            </div>
        );
    }
    
    if (error) {
        return <div className="p-4">{error}</div>
    }

    if (showReconciliation) {
        return <ReconciliationView stats={stats!} orders={stats?.orders || []} onBack={() => setShowReconciliation(false)} setActiveView={setActiveView}/>
    }

    return (
        <div className="h-full flex flex-col">
            <Tabs defaultValue="summary" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 md:px-6 pt-4 border-b flex-shrink-0">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="summary">Today's Summary</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>
                </div>
                <div className="flex-1 overflow-hidden">
                    <TabsContent value="summary" className="h-full">
                        <FinancialSummaryView 
                            stats={stats!}
                            allUnpaidOrdersTotal={allUnpaidOrdersTotal}
                            isTodayClosedOut={isTodayClosedOut}
                            onStartEndDay={() => setShowReconciliation(true)}
                        />
                    </TabsContent>
                    <TabsContent value="history" className="h-full">
                      <HistoryView />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
};

export default AccountingView;
