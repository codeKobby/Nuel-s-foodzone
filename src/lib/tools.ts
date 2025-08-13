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
        const reportsQuery = query(reconciliationReportsRef, where("timestamp", ">=", startDateTimestamp), where("timestamp", "<", endDateTimestamp));

        // Get all orders first to correctly calculate payments vs sales
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
        const itemCounts: Record<string, number> = {};

        allOrdersSnapshot.forEach(doc => {
            const order = doc.data() as Order;
            const orderDate = order.timestamp.toDate();

            // 1. Total Sales (from completed orders created in range)
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
            }

            // 2. Paid Revenue (from any payment made in range)
            const paymentDate = order.lastPaymentTimestamp?.toDate() ?? order.timestamp.toDate();
            if (paymentDate >= startDate && paymentDate <= endDate) {
                 if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Paid') {
                    const paidAmount = order.lastPaymentAmount ?? order.amountPaid;
                    if (order.paymentMethod === 'cash') cashSales += paidAmount;
                    if (order.paymentMethod === 'momo') momoSales += paidAmount;
                }
            }

            // 3. Change owed TO the customer (from any order)
            if (order.balanceDue < 0) {
                changeOwed += Math.abs(order.balanceDue);
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

        const netSales = (cashSales + momoSales) - totalMiscExpenses - totalPardonedAmount;
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
