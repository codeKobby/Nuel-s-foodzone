
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
        const ordersQuery = query(ordersRef, where("timestamp", ">=", startDateTimestamp), where("timestamp", "<=", endDateTimestamp));
        
        const miscExpensesRef = collection(db, "miscExpenses");
        const miscQuery = query(miscExpensesRef, where("timestamp", ">=", startDateTimestamp), where("timestamp", "<", endDateTimestamp));
        
        const reconciliationReportsRef = collection(db, "reconciliationReports");
        const reportsQuery = query(reconciliationReportsRef, where("timestamp", ">=", startDateTimestamp), where("timestamp", "<", endDateTimestamp));

        const [ordersSnapshot, miscSnapshot, reportsSnapshot] = await Promise.all([
            getDocs(ordersQuery),
            getDocs(miscQuery),
            getDocs(reportsQuery),
        ]);

        let cashSales = 0;
        let momoSales = 0;
        let changeOwed = 0;
        let totalOrders = 0;
        const itemCounts: Record<string, number> = {};

        ordersSnapshot.forEach(doc => {
            const order = doc.data() as Order;
            if (order.status === 'Completed') {
                totalOrders++;
                if (order.paymentMethod === 'cash') cashSales += Math.min(order.total, order.amountPaid);
                if (order.paymentMethod === 'momo') momoSales += order.total;

                // Calculate change owed to customer
                if (order.paymentMethod === 'cash' && order.balanceDue > 0 && order.amountPaid >= order.total) {
                    changeOwed += order.balanceDue;
                }

                order.items.forEach(item => {
                    itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
                });
            }
        });
        
        // Find payments for old orders made today
        const allCompletedOrdersQuery = query(collection(db, "orders"), where("status", "==", "Completed"));
        const allCompletedOrdersSnapshot = await getDocs(allCompletedOrdersQuery);
        allCompletedOrdersSnapshot.forEach(doc => {
            const order = doc.data() as Order;
            const orderDate = order.timestamp.toDate();
             if (order.lastPaymentTimestamp && orderDate < startDate) {
                const lastPaymentDate = order.lastPaymentTimestamp.toDate();
                if (lastPaymentDate >= startDate && lastPaymentDate <= endDate) {
                    const paidAmount = order.lastPaymentAmount || 0;
                    if (order.paymentMethod === 'cash') cashSales += paidAmount;
                    if (order.paymentMethod === 'momo') momoSales += paidAmount;
                }
            }
        });

        const totalSales = ordersSnapshot.docs
            .map(doc => doc.data() as Order)
            .filter(o => o.status === 'Completed')
            .reduce((acc, order) => acc + order.total, 0);
        
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

        const netSales = (cashSales + momoSales) - totalMiscExpenses;
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
