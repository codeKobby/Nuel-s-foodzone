import { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Order,
  MiscExpense,
  ReconciliationReport,
  PeriodStats,
} from "@/lib/types";
import { isToday } from "date-fns";

export const useAccounting = () => {
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [reports, setReports] = useState<ReconciliationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayEnd = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const isTodayClosedOut = useMemo(() => {
    return reports.some(
      (report) => report.timestamp && isToday(report.timestamp.toDate())
    );
  }, [reports]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const ordersQuery = query(collection(db, "orders"));
    const miscExpensesQuery = query(collection(db, "miscExpenses"));

    const unsubAllOrders = onSnapshot(
      ordersQuery,
      (allOrdersSnapshot) => {
        const unsubMiscExpenses = onSnapshot(
          miscExpensesQuery,
          (miscExpensesSnapshot) => {
            let totalSales = 0,
              totalItemsSold = 0;
            let cashSales = 0,
              momoSales = 0;
            let todayUnpaidOrdersValue = 0,
              previousUnpaidOrdersValue = 0;
            let totalPardonedAmount = 0,
              changeOwedForPeriod = 0;
            let settledUnpaidOrdersValue = 0,
              settledUnpaidCash = 0,
              settledUnpaidMomo = 0,
              previousDaysChangeGiven = 0,
              previousDaysChangeGivenFromSales = 0,
              previousDaysChangeGivenFromSetAside = 0;
            let totalRewardDiscount = 0;

            const todayOrders: Order[] = [];
            const activityOrders: Order[] = [];
            const itemStats: Record<
              string,
              { count: number; totalValue: number }
            > = {};

            const allOrders = allOrdersSnapshot.docs.map(
              (doc) => ({ id: doc.id, ...doc.data() } as Order)
            );

            allOrders.forEach((order) => {
              let hasPaymentActivityToday = false;
              if (!order.timestamp) return;
              const orderDate = order.timestamp.toDate();
              const isTodayOrder =
                orderDate >= todayStart && orderDate <= todayEnd;

              if (
                orderDate < todayStart &&
                (order.paymentStatus === "Unpaid" ||
                  order.paymentStatus === "Partially Paid")
              ) {
                if (order.balanceDue > 0) {
                  previousUnpaidOrdersValue += order.balanceDue;
                }
              }

              if (isTodayOrder) {
                todayOrders.push(order);

                const reward = order.rewardDiscount || 0;
                const orderNetTotal = (order.total || 0) - reward;

                if (order.status === "Completed") {
                  totalSales += orderNetTotal;
                  order.items.forEach((item) => {
                    totalItemsSold += item.quantity;
                    itemStats[item.name] = {
                      count: (itemStats[item.name]?.count || 0) + item.quantity,
                      totalValue:
                        (itemStats[item.name]?.totalValue || 0) +
                        item.quantity * item.price,
                    };
                  });
                }

                if (order.balanceDue > 0) {
                  todayUnpaidOrdersValue += order.balanceDue;
                }

                totalPardonedAmount += order.pardonedAmount || 0;
                totalRewardDiscount += order.rewardDiscount || 0;
                if (order.balanceDue < 0) {
                  changeOwedForPeriod += Math.abs(order.balanceDue);
                }
              }

              if (order.paymentHistory && Array.isArray(order.paymentHistory)) {
                let cashPaid = 0;
                let momoPaid = 0;
                order.paymentHistory.forEach((payment) => {
                  const paymentDate = payment.timestamp?.toDate();
                  if (
                    paymentDate &&
                    paymentDate >= todayStart &&
                    paymentDate <= todayEnd
                  ) {
                    hasPaymentActivityToday = true;
                    const paymentAmount = payment.amount || 0;
                    if (payment.method === "cash") {
                      cashPaid += paymentAmount;
                      // Track collections from previous days by payment method
                      if (!isTodayOrder) {
                        settledUnpaidCash += paymentAmount;
                        settledUnpaidOrdersValue += paymentAmount;
                      }
                    } else if (
                      payment.method === "momo" ||
                      payment.method === "card"
                    ) {
                      momoPaid += paymentAmount;
                      // Track collections from previous days by payment method
                      if (!isTodayOrder) {
                        settledUnpaidMomo += paymentAmount;
                        settledUnpaidOrdersValue += paymentAmount;
                      }
                    }
                  }
                });
                if (isTodayOrder) {
                  const reward = order.rewardDiscount || 0;
                  const orderNetTotal = (order.total || 0) - reward;
                  cashSales += Math.min(orderNetTotal, cashPaid);
                  momoSales += Math.min(orderNetTotal, momoPaid);
                }
              } else {
                // Fallback for orders without paymentHistory.
                // Some legacy/edge-case orders may not set lastPaymentTimestamp even though the
                // payment happened at order creation time.
                const paymentDate =
                  order.lastPaymentTimestamp?.toDate() ||
                  order.timestamp?.toDate?.();
                if (
                  paymentDate &&
                  paymentDate >= todayStart &&
                  paymentDate <= todayEnd
                ) {
                  hasPaymentActivityToday = true;
                  // Avoid double-counting: amountPaid is cumulative over the life of the order.
                  // For legacy orders without paymentHistory, rely on lastPaymentAmount which
                  // represents what was paid on the most recent payment.
                  const amountPaidTowardsOrder = order.lastPaymentAmount || 0;

                  // If we can't determine the last payment amount, do not guess using cumulative totals.
                  if (amountPaidTowardsOrder <= 0) {
                    // Still treat as activity (timestamp moved), but don't add to revenue buckets.
                    // This prevents overstating sales/collections.
                  }

                  // Only add to momo/cash sales if order was created today
                  if (isTodayOrder && order.paymentBreakdown) {
                    const reward = order.rewardDiscount || 0;
                    const orderNetTotal = (order.total || 0) - reward;
                    if (order.paymentBreakdown.cash) {
                      cashSales += Math.min(
                        orderNetTotal,
                        order.paymentBreakdown.cash
                      );
                    }
                    if (order.paymentBreakdown.momo) {
                      momoSales += Math.min(
                        orderNetTotal,
                        order.paymentBreakdown.momo
                      );
                    }
                  }

                  // Track settlements from previous days by payment method
                  if (!isTodayOrder) {
                    if (amountPaidTowardsOrder > 0) {
                      settledUnpaidOrdersValue += amountPaidTowardsOrder;
                    }
                    // Determine method for this payment (best-effort for legacy orders)
                    if (amountPaidTowardsOrder > 0) {
                      if (order.paymentMethod === "cash") {
                        settledUnpaidCash += amountPaidTowardsOrder;
                      } else if (
                        order.paymentMethod === "momo" ||
                        order.paymentMethod === "card"
                      ) {
                        settledUnpaidMomo += amountPaidTowardsOrder;
                      } else {
                        // If method is 'split'/'Unpaid' for a legacy order, infer the method when possible.
                        const breakdownCash = order.paymentBreakdown?.cash || 0;
                        const breakdownMomo = order.paymentBreakdown?.momo || 0;
                        if (
                          order.paymentBreakdown &&
                          Math.abs(breakdownCash - amountPaidTowardsOrder) <
                            0.01 &&
                          breakdownMomo > 0
                        ) {
                          settledUnpaidCash += amountPaidTowardsOrder;
                        } else if (
                          order.paymentBreakdown &&
                          Math.abs(breakdownMomo - amountPaidTowardsOrder) <
                            0.01 &&
                          breakdownCash > 0
                        ) {
                          settledUnpaidMomo += amountPaidTowardsOrder;
                        }
                      }
                    }
                  }
                }
              }

              const changeSettlementDate =
                order.lastChangeSettlementAt?.toDate();
              if (
                changeSettlementDate &&
                changeSettlementDate >= todayStart &&
                changeSettlementDate <= todayEnd &&
                !isTodayOrder
              ) {
                const settledChangeAmount =
                  order.lastChangeSettlementAmount || 0;
                if (settledChangeAmount > 0.01) {
                  previousDaysChangeGiven += settledChangeAmount;

                  // If the original change was set aside on the day it was generated,
                  // paying it later should not reduce today's expected cash.
                  if (order.changeSetAside) {
                    previousDaysChangeGivenFromSetAside += settledChangeAmount;
                  } else {
                    previousDaysChangeGivenFromSales += settledChangeAmount;
                  }
                }
              }

              if (isTodayOrder || hasPaymentActivityToday) {
                activityOrders.push(order);
              }
            });

            let miscCashExpenses = 0,
              miscMomoExpenses = 0;
            miscExpensesSnapshot.docs.forEach((doc) => {
              const expense = doc.data() as MiscExpense;
              if (!expense.timestamp) return;
              const expenseDate = expense.timestamp.toDate();
              if (expenseDate >= todayStart && expenseDate <= todayEnd) {
                if (expense.source === "cash")
                  miscCashExpenses += expense.amount;
                else miscMomoExpenses += expense.amount;
              }
            });

            const allTimeUnpaidOrdersValue =
              previousUnpaidOrdersValue + todayUnpaidOrdersValue;

            // expectedCash includes only cash collections from previous days
            const expectedCash =
              cashSales -
              miscCashExpenses +
              settledUnpaidCash -
              previousDaysChangeGivenFromSales;
            // expectedMomo includes only momo collections from previous days
            const expectedMomo =
              momoSales - miscMomoExpenses + settledUnpaidMomo;
            // netRevenue: reward discount is already subtracted from orderNetTotal when calculating sales,
            // so we don't subtract totalRewardDiscount again to avoid double-counting
            const netRevenue =
              cashSales +
              momoSales +
              settledUnpaidOrdersValue -
              (miscCashExpenses + miscMomoExpenses);

            setStats({
              totalSales,
              totalItemsSold,
              cashSales,
              momoSales,
              miscCashExpenses,
              miscMomoExpenses,
              expectedCash,
              expectedMomo,
              netRevenue,
              todayUnpaidOrdersValue,
              allTimeUnpaidOrdersValue,
              previousUnpaidOrdersValue,
              totalPardonedAmount,
              changeOwedForPeriod,
              settledUnpaidOrdersValue,
              settledUnpaidCash,
              settledUnpaidMomo,
              previousDaysChangeGiven,
              previousDaysChangeGivenFromSales,
              previousDaysChangeGivenFromSetAside,
              totalRewardDiscount,
              orders: todayOrders,
              activityOrders,
              itemStats,
            });

            setLoading(false);
          },
          (error) => {
            console.error("Error fetching misc expenses:", error);
            setError("Failed to load miscellaneous expenses data.");
            setLoading(false);
          }
        );

        return () => unsubMiscExpenses();
      },
      (error) => {
        console.error("Error fetching all orders:", error);
        setError("Failed to load order data.");
        setLoading(false);
      }
    );

    const reportsQuery = query(
      collection(db, "reconciliationReports"),
      orderBy("timestamp", "desc")
    );
    const unsubReports = onSnapshot(
      reportsQuery,
      (snapshot) => {
        setReports(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as ReconciliationReport)
          )
        );
      },
      (error) => {
        console.error("Error fetching reports:", error);
        setError("Failed to load reconciliation reports.");
      }
    );

    return () => {
      unsubAllOrders();
      unsubReports();
    };
  }, [todayStart, todayEnd]);

  const adjustedExpectedCash = useMemo(() => {
    if (!stats) return 0;
    let expected = stats.cashSales;
    expected += stats.settledUnpaidCash; // Only cash collections from previous days
    expected -= stats.miscCashExpenses;
    expected -= stats.previousDaysChangeGivenFromSales;
    return expected;
  }, [stats]);

  const adjustedExpectedMomo = useMemo(() => {
    if (!stats) return 0;
    let expected = stats.momoSales;
    expected += stats.settledUnpaidMomo; // Only momo collections from previous days
    expected -= stats.miscMomoExpenses;
    return expected;
  }, [stats]);

  return {
    stats,
    reports,
    loading,
    error,
    isTodayClosedOut,
    adjustedExpectedCash,
    adjustedExpectedMomo,
  };
};
