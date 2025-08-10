
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
        let totalOrders = 0;
        const itemCounts: Record<string, number> = {};

        ordersSnapshot.forEach(doc => {
            const order = doc.data() as Order;
            totalOrders++;
            if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Paid') {
                totalSales += order.amountPaid;
            }
            order.items.forEach(item => {
                itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
            });
        });

        let totalMiscExpenses = 0;
        miscSnapshot.forEach(doc => {
            const expense = doc.data() as MiscExpense;
            if (expense.settled) totalMiscExpenses += expense.amount;
        });

        let cashDiscrepancy = 0;
        reportsSnapshot.forEach(doc => {
            const report = doc.data() as ReconciliationReport;
            cashDiscrepancy += report.cashDifference;
        });

        const netSales = totalSales - totalMiscExpenses;
        const itemPerformance = Object.entries(itemCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({ name, count }));

        return {
            totalSales,
            netSales,
            totalOrders,
            itemPerformance,
            cashDiscrepancy,
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
        };
    }
}
