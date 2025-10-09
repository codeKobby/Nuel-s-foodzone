

import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense, ReconciliationReport } from '@/lib/types';
import { type GetBusinessDataOutput } from '@/ai/schemas';

/**
 * Retrieves and summarizes business data from Firestore for a given date range.
 * This function is designed to be used by an AI tool.
 */
export async function getBusinessDataForRange(startDateStr: string, endDateStr: string): Promise<GetBusinessDataOutput> {
    try {
        const startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);

        const startDateTimestamp = Timestamp.fromDate(startDate);
        const endDateTimestamp = Timestamp.fromDate(endDate);

        const ordersRef = collection(db, "orders");
        
        const miscExpensesRef = collection(db, "miscExpenses");
        const miscQuery = query(miscExpensesRef, where("timestamp", ">=", startDateTimestamp), where("timestamp", "<=", endDateTimestamp));
        
        const reconciliationReportsRef = collection(db, "reconciliationReports");
        const reportsQuery = query(reconciliationReportsRef, where("timestamp", ">=", startDateTimestamp), where("timestamp", "<=", endDateTimestamp));

        const allOrdersSnapshot = await getDocs(query(ordersRef));

        const [miscSnapshot, reportsSnapshot] = await Promise.all([
            getDocs(miscQuery),
            getDocs(reportsQuery),
        ]);

        let cashSales = 0;
        let momoSales = 0;
        let changeOwed = 0;
        let totalOrders = 0;
        let totalSales = 0;
        let totalPardonedAmount = 0;
        let collections = 0;
        const itemCounts: Record<string, number> = {};

        allOrdersSnapshot.forEach(doc => {
            const order = doc.data() as Order;
            const orderDate = order.timestamp.toDate();
            
            if (orderDate >= startDate && orderDate <= endDate) {
                if (order.status === 'Completed') {
                    totalOrders++;
                    totalSales += order.total;

                    order.items.forEach(item => {
                        itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
                    });
                }
                
                if (order.pardonedAmount && order.pardonedAmount > 0) {
                    totalPardonedAmount += order.pardonedAmount;
                }
                
                if (order.balanceDue < 0) {
                 changeOwed += Math.abs(order.balanceDue);
                }
            }

            const paymentDate = order.lastPaymentTimestamp?.toDate();
            if (paymentDate && paymentDate >= startDate && paymentDate <= endDate) {
                 const paymentAmount = order.lastPaymentAmount || 0;
                 if (order.paymentMethod === 'cash') cashSales += paymentAmount;
                 if (order.paymentMethod === 'momo') momoSales += paymentAmount;
                 
                 const isOrderFromPeriod = order.timestamp.toDate() >= startDate && order.timestamp.toDate() <= endDate;
                 if(!isOrderFromPeriod) {
                    collections += paymentAmount;
                 }
            }

            const settledDate = order.settledOn?.toDate();
            if (settledDate && settledDate >= startDate && settledDate <= endDate && orderDate < startDate) {
                if (order.paymentMethod === 'cash') cashSales -= order.changeGiven;
            }
        });
        
        let totalMiscExpenses = 0;
        miscSnapshot.forEach(doc => {
            const expense = doc.data() as MiscExpense;
            totalMiscExpenses += expense.amount;
        });

        let totalDiscrepancy = 0;
        reportsSnapshot.forEach(doc => {
            const report = doc.data() as ReconciliationReport;
            totalDiscrepancy += report.totalDiscrepancy;
        });

        const netSales = (cashSales + momoSales + collections) - totalMiscExpenses - totalPardonedAmount;
        const itemPerformance = Object.entries(itemCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({ name, count }));

        return {
            totalSales,
            netSales,
            totalOrders,
            itemPerformance,
            cashDiscrepancy: totalDiscrepancy,
            cashSales,
            momoSales,
            miscExpenses: totalMiscExpenses,
            changeOwed,
        };

    } catch (error) {
        console.error("Error fetching business data for tool:", error);
        return {
            totalSales: 0,
            netSales: 0,
            totalOrders: 0,
            itemPerformance: [],
            cashDiscrepancy: 0,
            cashSales: 0,
            momoSales: 0,
            miscExpenses: 0,
            changeOwed: 0,
        };
    }
}

    