
"use client";

import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, CreditCard, Ban, FileSignature, AlertTriangle, MinusCircle, Hourglass, Landmark, TrendingUp } from 'lucide-react';
import type { Order } from '@/lib/types';

interface PeriodStats {
    totalSales: number;
    cashSales: number;
    momoSales: number;
    collectionsFromPreviousDays: number;
    miscCashExpenses: number;
    miscMomoExpenses: number;
    totalPardonedAmount: number;
    itemPerformance: { name: string; count: number; totalValue: number }[];
}

interface FinancialSummaryViewProps {
    stats: PeriodStats;
    allUnpaidOrdersTotal: number;
    isTodayClosedOut: boolean;
    onStartEndDay: () => void;
}

const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: string; description: string; }> = ({ icon, title, value, description }) => (
    <Card className="bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);


const FinancialSummaryView: React.FC<FinancialSummaryViewProps> = ({ stats, allUnpaidOrdersTotal, isTodayClosedOut, onStartEndDay }) => {
    const today = new Date();

    const totalMiscExpenses = stats.miscCashExpenses + stats.miscMomoExpenses;
    const netRevenue = stats.totalSales - totalMiscExpenses - stats.totalPardonedAmount;
    const totalItemsSoldCount = stats.itemPerformance.reduce((sum, item) => sum + item.count, 0);

    return (
        <div className="p-4 md:p-6 bg-background">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Financial Summary Column */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Financial Summary</CardTitle>
                            <CardDescription>Daily financial data for {format(today, "EEEE, MMMM dd, yyyy")}</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <StatCard icon={<DollarSign className="text-muted-foreground" />} title="Total Sales" value={formatCurrency(stats.totalSales)} description={`${totalItemsSoldCount} items sold from completed orders`} />
                            <StatCard icon={<Landmark className="text-muted-foreground" />} title="Cash Sales" value={formatCurrency(stats.cashSales)} description="All cash payments received today" />
                            <StatCard icon={<CreditCard className="text-muted-foreground" />} title="Momo/Card Sales" value={formatCurrency(stats.momoSales)} description="All momo/card payments received" />
                            <StatCard icon={<Hourglass className="text-muted-foreground" />} title="Unpaid Orders (All Time)" value={formatCurrency(allUnpaidOrdersTotal)} description="Total outstanding balance" />
                            <StatCard icon={<MinusCircle className="text-muted-foreground" />} title="Total Misc. Expenses" value={formatCurrency(totalMiscExpenses)} description={`Cash: ${formatCurrency(stats.miscCashExpenses)} | Momo: ${formatCurrency(stats.miscMomoExpenses)}`} />
                            <StatCard icon={<Ban className="text-muted-foreground" />} title="Pardoned Deficits" value={formatCurrency(stats.totalPardonedAmount)} description="Unplanned discounts given today" />
                        </CardContent>
                        <CardContent>
                            <div className="space-y-4">
                                {stats.collectionsFromPreviousDays > 0 && (
                                    <Card className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700">
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">Collections on Previous Debts</CardTitle>
                                            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(stats.collectionsFromPreviousDays)}</div>
                                            <p className="text-xs text-blue-600 dark:text-blue-400">Payments received today for orders made on previous days.</p>
                                        </CardContent>
                                    </Card>
                                )}
                                <Card className="bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-700">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">Net Revenue (Today's Sales)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-3xl font-bold text-green-700 dark:text-green-300">{formatCurrency(netRevenue)}</div>
                                        <p className="text-xs text-green-600 dark:text-green-400">Total Sales - Expenses - Pardons</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Item Sales Column */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Item Sales (Completed Orders)</CardTitle>
                            <CardDescription>Total count and value of each item sold today.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-96">
                                {stats.itemPerformance.length > 0 ? (
                                <div className="space-y-2 pr-4">
                                    {stats.itemPerformance.map(item => (
                                        <div key={item.name} className="flex justify-between items-center p-3 rounded-lg bg-secondary">
                                            <div>
                                                <p className="font-semibold">{item.name}</p>
                                                <p className="text-sm text-muted-foreground">{item.count} sold</p>
                                            </div>
                                            <Badge variant="destructive">{formatCurrency(item.totalValue)}</Badge>
                                        </div>
                                    ))}
                                </div>
                                ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    <p>No items sold today.</p>
                                </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default FinancialSummaryView;
