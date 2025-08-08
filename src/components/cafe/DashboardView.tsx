
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, ShoppingBag, TrendingUp, TrendingDown, Briefcase } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart"
import { BarChart, CartesianGrid, XAxis, YAxis, Bar, Legend, ResponsiveContainer, Tooltip } from 'recharts';

interface DashboardViewProps {
    appId: string;
}

interface Stats {
    totalSales: number;
    totalMiscExpenses: number;
    netSales: number;
    orderCount: number;
    salesData: { date: string; sales: number }[];
    topItems: { name: string; count: number }[];
    bottomItems: { name: string; count: number }[];
}

const StatCard: React.FC<{ icon: React.ReactNode, title: string, value: string | number, color: string }> = ({ icon, title, value, color }) => (
    <Card className={`border-l-4 ${color}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const chartConfig = {
  sales: {
    label: "Sales",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

const DashboardView: React.FC<DashboardViewProps> = ({ appId }) => {
    const [stats, setStats] = useState<Stats>({ totalSales: 0, totalMiscExpenses: 0, netSales: 0, orderCount: 0, salesData: [], topItems: [], bottomItems: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState('Today');

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            setError(null);
            try {
                const now = new Date();
                let startDate;

                if (timeRange === 'Today') {
                    startDate = new Date(now);
                    startDate.setHours(0, 0, 0, 0);
                } else if (timeRange === 'This Week') {
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - now.getDay());
                    startDate.setHours(0, 0, 0, 0);
                } else { // This Month
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                }

                const ordersRef = collection(db, `/artifacts/${appId}/public/data/orders`);
                const ordersQuery = query(ordersRef, where("timestamp", ">=", startDate), orderBy("timestamp", "asc"));
                
                const miscExpensesRef = collection(db, `/artifacts/${appId}/public/data/miscExpenses`);
                const miscQuery = query(miscExpensesRef, where("timestamp", ">=", startDate), where("settled", "==", true));
                
                const [ordersSnapshot, miscSnapshot] = await Promise.all([getDocs(ordersQuery), getDocs(miscQuery)]);

                let totalSales = 0, orderCount = 0;
                const itemCounts: Record<string, number> = {};
                const salesByDay: Record<string, number> = {};

                ordersSnapshot.forEach(doc => {
                    const order = doc.data() as Order;
                    if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Paid') totalSales += order.amountPaid;
                    orderCount++;
                    
                    order.items.forEach(item => {
                        itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
                    });

                    if (order.timestamp) {
                        const date = order.timestamp.toDate().toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
                        salesByDay[date] = (salesByDay[date] || 0) + order.amountPaid;
                    }
                });

                let totalMiscExpenses = 0;
                miscSnapshot.forEach(doc => {
                    const expense = doc.data() as MiscExpense;
                    totalMiscExpenses += expense.amount;
                });
                
                const netSales = totalSales - totalMiscExpenses;

                const salesData = Object.entries(salesByDay).map(([date, sales]) => ({ date, sales }));
                const allItems = Object.entries(itemCounts).sort(([, a], [, b]) => b - a);
                const topItems = allItems.slice(0, 5).map(([name, count]) => ({ name, count }));
                const bottomItems = allItems.length > 5 ? allItems.slice(-5).reverse().map(([name, count]) => ({ name, count })) : [];

                setStats({ totalSales, totalMiscExpenses, netSales, orderCount, salesData, topItems, bottomItems });
            } catch (e) {
                console.error("Error fetching dashboard data:", e);
                setError("Failed to load dashboard data.");
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, [timeRange, appId]);

    return (
        <div className="p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Dashboard</h2>
                <div className="flex space-x-1 bg-card p-1 rounded-lg shadow-sm">
                    {['Today', 'This Week', 'This Month'].map(range => (
                        <Button key={range} onClick={() => setTimeRange(range)} variant={timeRange === range ? 'default' : 'ghost'} size="sm">{range}</Button>
                    ))}
                </div>
            </div>
            {loading ? <div className="mt-8"><LoadingSpinner/></div> : error ? <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                    <StatCard icon={<DollarSign className="text-green-500"/>} title="Net Sales" value={formatCurrency(stats.netSales)} color="border-green-500" />
                    <StatCard icon={<ShoppingBag className="text-blue-500"/>} title="Total Orders" value={stats.orderCount} color="border-blue-500" />
                    <StatCard icon={<Briefcase className="text-orange-500"/>} title="Settled Misc. Expenses" value={formatCurrency(stats.totalMiscExpenses)} color="border-orange-500" />
                </div>
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Sales Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                            <BarChart data={stats.salesData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis tickFormatter={(value) => formatCurrency(Number(value))} />
                                <Tooltip
                                    cursor={false}
                                    content={<ChartTooltipContent
                                        formatter={(value) => formatCurrency(Number(value))}
                                        labelClassName="font-bold"
                                        indicator="dot"
                                    />}
                                />
                                <Legend />
                                <Bar dataKey="sales" fill="var(--color-sales)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                       <CardHeader>
                            <div className="flex items-center space-x-2">
                                <TrendingUp className="text-green-500" />
                                <CardTitle>Top 5 Performing Items</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3">{stats.topItems.map(item => (<li key={item.name} className="flex justify-between items-center p-3 bg-secondary rounded-lg"><span className="font-semibold">{item.name}</span><span className="font-bold text-green-500">{item.count} sold</span></li>))}</ul>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <div className="flex items-center space-x-2">
                                <TrendingDown className="text-red-500" />
                                <CardTitle>Bottom 5 Performing Items</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3">{stats.bottomItems.map(item => (<li key={item.name} className="flex justify-between items-center p-3 bg-secondary rounded-lg"><span className="font-semibold">{item.name}</span><span className="font-bold text-red-500">{item.count} sold</span></li>))}</ul>
                        </CardContent>
                    </Card>
                </div>
            </>
            )}
        </div>
    );
};

export default DashboardView;
