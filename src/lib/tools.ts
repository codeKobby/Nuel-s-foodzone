

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
        const startDate = Timestamp.fromDate(new Date(startDateStr));
        const endDate = Timestamp.fromDate(new Date(new Date(endDateStr).getTime() + 86400000)); // Include the whole end day

        const ordersRef = collection(db, "orders");
        const ordersQuery = query(ordersRef, where("timestamp", ">=", startDate), where("timestamp", "<", endDate));
        
        const miscExpensesRef = collection(db, "miscExpenses");
        const miscQuery = query(miscExpensesRef, where("timestamp", ">=", startDate), where("timestamp", "<", endDate));
        
        const reconciliationReportsRef = collection(db, "reconciliationReports");
        const reportsQuery = query(reconciliationReportsRef, where("timestamp", ">=", startDate), where("timestamp", "<", endDate));

        const [ordersSnapshot, miscSnapshot, reportsSnapshot] = await Promise.all([
            getDocs(ordersQuery),
            getDocs(miscQuery),
            getDocs(reportsQuery),
        ]);

        let totalSales = 0;
        let cashSales = 0;
        let momoSales = 0;
        let changeOwed = 0;
        let unpaidOrdersValue = 0;
        let totalOrders = 0;
        const itemCounts: Record<string, number> = {};

        ordersSnapshot.forEach(doc => {
            const order = doc.data() as Order;
            totalOrders++;

            if (order.status === 'Completed') {
                totalSales += order.total;
            }
            
            if (order.paymentStatus === 'Unpaid') {
                unpaidOrdersValue += order.balanceDue;
            } else if (order.paymentStatus === 'Partially Paid') {
                unpaidOrdersValue += order.balanceDue;
                const paidAmount = order.amountPaid - (order.total - order.balanceDue);
                if (order.paymentMethod === 'cash') cashSales += paidAmount;
                if (order.paymentMethod === 'momo') momoSales += paidAmount;
            } else if (order.paymentStatus === 'Paid') {
                if(order.paymentMethod === 'cash') cashSales += Math.min(order.total, order.amountPaid);
                if(order.paymentMethod === 'momo') momoSales += order.total;
            }

            // Calculate change owed to customer
            if (order.paymentMethod === 'cash' && order.balanceDue > 0 && order.amountPaid >= order.total) {
                changeOwed += order.balanceDue;
            }

            order.items.forEach(item => {
                itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
            });
        });
        
        let totalMiscExpenses = 0;
        miscSnapshot.forEach(doc => {
            const expense = doc.data() as MiscExpense;
            totalMiscExpenses += expense.amount;
        });

        let cashDiscrepancy = 0;
        reportsSnapshot.forEach(doc => {
            const report = doc.data() as ReconciliationReport;
            cashDiscrepancy += report.cashDifference;
        });

        const netSales = (cashSales + momoSales) - totalMiscExpenses;
        const itemPerformance = Object.entries(itemCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({ name, count }));

        return {
            totalSales,
            netSales,
            totalOrders,
            itemPerformance,
            cashDiscrepancy,
            cashSales,
            momoSales,
            miscExpenses: totalMiscExpenses,
            changeOwed,
        };

    } catch (error) {
        console.error("Error fetching business data for tool:", error);
        // In case of error, return a zeroed-out response
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

    