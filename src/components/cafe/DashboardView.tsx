
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense, ReconciliationReport } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, ShoppingBag, TrendingUp, TrendingDown, AlertCircle, Sparkles, Lightbulb, UserCheck, Calendar as CalendarIcon, FileWarning, Activity } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart"
import { BarChart, CartesianGrid, XAxis, YAxis, Bar, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { DateRange } from "react-day-picker"
import { addDays, format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { analyzeBusiness } from '@/ai/flows/analyze-business-flow';
import { type AnalyzeBusinessInput, type AnalyzeBusinessOutput } from '@/ai/schemas';
import { ScrollArea } from '../ui/scroll-area';

interface DashboardStats {
    totalSales: number;
    totalOrders: number;
    totalMiscExpenses: number;
    netSales: number;
    unpaidOrdersValue: number;
    cashDiscrepancy: number; // sum of deficits and surpluses
    salesData: { date: string; sales: number }[];
    itemPerformance: { name: string; count: number }[];
}

const StatCard: React.FC<{ icon: React.ReactNode, title: string, value: string | number, description?: string }> = ({ icon, title, value, description }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const chartConfig = {
  sales: {
    label: "Sales",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

const DashboardView: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState<DateRange | undefined>({ from: addDays(new Date(), -6), to: new Date() });
    const [aiReport, setAiReport] = useState<AnalyzeBusinessOutput | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    useEffect(() => {
        fetchDashboardData();
    }, [date]);

    const fetchDashboardData = async () => {
        if (!date?.from || !date?.to) return;
        setLoading(true);
        setError(null);
        setStats(null);
        setAiReport(null);

        try {
            const startDate = Timestamp.fromDate(date.from);
            const endDate = Timestamp.fromDate(new Date(date.to.getTime() + 86400000)); // Include the whole end day

            const ordersRef = collection(db, "orders");
            const ordersQuery = query(ordersRef, where("timestamp", ">=", startDate), where("timestamp", "<", endDate), orderBy("timestamp", "asc"));
            
            const miscExpensesRef = collection(db, "miscExpenses");
            const miscQuery = query(miscExpensesRef, where("timestamp", ">=", startDate), where("timestamp", "<", endDate));
            
            const reconciliationReportsRef = collection(db, "reconciliationReports");
            const reportsQuery = query(reconciliationReportsRef, where("timestamp", ">=", startDate), where("timestamp", "<", endDate));

            const [ordersSnapshot, miscSnapshot, reportsSnapshot] = await Promise.all([
                getDocs(ordersQuery),
                getDocs(miscQuery),
                getDocs(reportsQuery),
            ]);

            // Process Orders
            let totalSales = 0, totalOrders = 0, unpaidOrdersValue = 0;
            const itemCounts: Record<string, number> = {};
            const salesByDay: Record<string, number> = {};

            ordersSnapshot.forEach(doc => {
                const order = doc.data() as Order;
                totalOrders++;
                if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Paid') {
                    totalSales += order.amountPaid;
                }
                if (order.paymentStatus === 'Unpaid' || order.paymentStatus === 'Partially Paid') {
                    unpaidOrdersValue += order.balanceDue;
                }
                
                order.items.forEach(item => {
                    itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
                });

                if (order.timestamp) {
                    const orderDate = order.timestamp.toDate();
                    const dayKey = format(orderDate, 'MMM d');
                    salesByDay[dayKey] = (salesByDay[dayKey] || 0) + order.total;
                }
            });

            // Process Misc Expenses
            let totalMiscExpenses = 0;
            miscSnapshot.forEach(doc => {
                const expense = doc.data() as MiscExpense;
                if (expense.settled) totalMiscExpenses += expense.amount;
            });
            
            // Process Reconciliation Reports
            let cashDiscrepancy = 0;
            reportsSnapshot.forEach(doc => {
                const report = doc.data() as ReconciliationReport;
                cashDiscrepancy += report.cashDifference;
            });

            const netSales = totalSales - totalMiscExpenses;
            const salesData = Object.entries(salesByDay).map(([date, sales]) => ({ date, sales }));
            const itemPerformance = Object.entries(itemCounts).sort(([, a], [, b]) => b - a);

            setStats({
                totalSales,
                totalOrders,
                totalMiscExpenses,
                netSales,
                unpaidOrdersValue,
                cashDiscrepancy,
                salesData,
                itemPerformance,
            });

        } catch (e) {
            console.error("Error fetching dashboard data:", e);
            setError("Failed to load dashboard data. You may need to create a Firestore index. Check the browser console for a link.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleGenerateReport = async () => {
        if (!stats) return;
        setIsGeneratingReport(true);
        setError(null);
        try {
            const input: AnalyzeBusinessInput = {
                period: `From ${date?.from ? format(date.from, "PPP") : ''} to ${date?.to ? format(date.to, "PPP") : ''}`,
                totalSales: stats.totalSales,
                netSales: stats.netSales,
                totalOrders: stats.totalOrders,
                itemPerformance: stats.itemPerformance,
                cashDiscrepancy: stats.cashDiscrepancy,
            };
            const report = await analyzeBusiness(input);
            setAiReport(report);
        } catch (e) {
            console.error("Error generating AI report:", e);
            setError("Failed to generate the AI analysis report.");
        } finally {
            setIsGeneratingReport(false);
        }
    }

    const topItems = useMemo(() => stats?.itemPerformance.slice(0, 5) || [], [stats]);
    const bottomItems = useMemo(() => stats && stats.itemPerformance.length > 5 ? stats.itemPerformance.slice(-5).reverse() : [], [stats]);

    return (
        <div className="p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Dashboard</h2>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn("w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                        date.to ? (
                            <>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>
                        ) : (
                            format(date.from, "LLL dd, y")
                        )
                        ) : (
                        <span>Pick a date</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                    />
                    </PopoverContent>
                </Popover>
            </div>
            {loading ? <div className="mt-8"><LoadingSpinner/></div> : error ? <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : !stats ?  <div className="text-center py-10 text-muted-foreground">Select a date range to view data.</div> : (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <StatCard icon={<DollarSign className="text-green-500"/>} title="Net Sales" value={formatCurrency(stats.netSales)} description={`${formatCurrency(stats.totalSales)} Total Sales - ${formatCurrency(stats.totalMiscExpenses)} Expenses`}/>
                    <StatCard icon={<ShoppingBag className="text-blue-500"/>} title="Total Orders" value={stats.totalOrders} />
                    <StatCard icon={<FileWarning className={stats.cashDiscrepancy === 0 ? "text-muted-foreground" : "text-amber-500"}/>} title="Cash Discrepancy" value={formatCurrency(stats.cashDiscrepancy)} description="Sum of cash surplus/deficit" />
                    <StatCard icon={<AlertCircle className={stats.unpaidOrdersValue === 0 ? "text-muted-foreground" : "text-red-500"}/>} title="Unpaid Orders" value={formatCurrency(stats.unpaidOrdersValue)} description="Total outstanding balance"/>
                </div>
                
                <Card className="mb-6">
                     <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>AI Business Report</CardTitle>
                            <CardDescription>Get an AI-generated summary of your business performance.</CardDescription>
                        </div>
                         <Button onClick={handleGenerateReport} disabled={isGeneratingReport}>
                            {isGeneratingReport ? <><LoadingSpinner /> Analyzing...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate Analysis</>}
                        </Button>
                    </CardHeader>
                    {aiReport && (
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                 <h3 className="text-lg font-semibold flex items-center"><Activity className="mr-2 text-primary"/> Performance Report</h3>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiReport.analysis}</p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold flex items-center"><Lightbulb className="mr-2 text-primary"/> Sales Suggestions</h3>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiReport.suggestions}</p>
                            </div>
                        </CardContent>
                    )}
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <Card className="lg:col-span-3">
                        <CardHeader>
                            <CardTitle>Sales Trend</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="h-[300px] w-full">
                                <ResponsiveContainer>
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
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                     <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Item Performance</CardTitle>
                            <CardDescription>Top and bottom selling items for the period.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <ScrollArea className="h-[300px]">
                                <div className="space-y-4">
                                <div>
                                    <h4 className="font-semibold text-green-600 mb-2 flex items-center"><TrendingUp className="mr-2" /> Top 5 Items</h4>
                                     <ul className="space-y-2">{topItems.length > 0 ? topItems.map(item => (<li key={item.name} className="flex justify-between items-center p-2 bg-secondary rounded-md text-sm"><span className="font-medium">{item.name}</span><span className="font-bold">{item.count} sold</span></li>)) : <p className="text-xs text-muted-foreground italic">No items sold.</p>}</ul>
                                </div>
                                {bottomItems.length > 0 && <div>
                                     <h4 className="font-semibold text-red-600 mb-2 flex items-center"><TrendingDown className="mr-2" /> Bottom 5 Items</h4>
                                     <ul className="space-y-2">{bottomItems.map(item => (<li key={item.name} className="flex justify-between items-center p-2 bg-secondary rounded-md text-sm"><span className="font-medium">{item.name}</span><span className="font-bold">{item.count} sold</span></li>))}</ul>
                                </div>}
                                </div>
                           </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </>
            )}
        </div>
    );
};

export default DashboardView;
