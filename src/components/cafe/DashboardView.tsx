

"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { 
    Order, 
    MiscExpense, 
    EnhancedReconciliationReport, 
    ChatSession, 
    DashboardStats,
    ChatMessage
} from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { DollarSign, ShoppingBag, TrendingUp, TrendingDown, Sparkles, User, Bot, Send, Calendar as CalendarIcon, AlertTriangle, Check, Search, Coins, Landmark, CreditCard, Hourglass, MinusCircle, FileCheck, Clock, Eye, MessageSquare, Plus, ArrowDownUp as SortDesc, ArrowUpWideNarrow as SortAsc } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
  ChartArea,
} from "@/components/ui/chart"
import { Area, ComposedChart, CartesianGrid, XAxis, YAxis, Line as ChartLine } from 'recharts';

import { DateRange } from "react-day-picker"
import { addDays, format, startOfWeek, endOfWeek, startOfMonth, startOfToday, endOfToday, differenceInDays } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyzeBusiness } from '@/ai/flows/analyze-business-flow';
import { businessChat } from '@/ai/flows/business-chat-flow';
import { useToast } from '@/hooks/use-toast';

type ItemSortKey = 'count' | 'totalValue';
type ItemSortDirection = 'asc' | 'desc';
type PresetDateRange = 'today' | 'week' | 'month' | 'custom';

const StatCard: React.FC<{ 
  icon: React.ReactNode; 
  title: string; 
  value: string | number; 
  description?: string; 
  onClick?: () => void;
  variant?: 'default' | 'warning' | 'success' | 'danger';
  badge?: React.ReactNode;
}> = ({ icon, title, value, description, onClick, variant = 'default', badge }) => {
  const getCardClasses = () => {
    const baseClasses = onClick ? 'cursor-pointer hover:shadow-md transition-all' : '';
    switch (variant) {
      case 'warning': return `${baseClasses} border-amber-200 bg-amber-50 dark:bg-amber-900/20`;
      case 'success': return `${baseClasses} border-green-200 bg-green-50 dark:bg-green-900/20`;
      case 'danger': return `${baseClasses} border-red-200 bg-red-50 dark:bg-red-900/20`;
      default: return baseClasses;
    }
  };

  return (
    <Card onClick={onClick} className={getCardClasses()}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {badge}
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
};

const chartConfig = {
  newSales: {
    label: "New Sales",
    color: "hsl(var(--chart-1))",
  },
  collections: {
    label: "Collections",
    color: "hsl(var(--chart-2))",
  },
  netRevenue: {
    label: "Net Revenue",
    color: "hsl(var(--chart-3))",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--chart-4))",
  }
} satisfies ChartConfig;

const DashboardView: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<DateRange | undefined>({ 
    from: startOfWeek(new Date(), { weekStartsOn: 1 }), 
    to: endOfToday() 
  });
  const [activeDatePreset, setActiveDatePreset] = useState<PresetDateRange>('week');
  
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [analysisContent, setAnalysisContent] = useState('');
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatSheetOpen, setIsChatSheetOpen] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSortKey, setItemSortKey] = useState<ItemSortKey>('count');
  const [itemSortDirection, setItemSortDirection] = useState<ItemSortDirection>('desc');
  const [isUnpaidOrdersModalOpen, setIsUnpaidOrdersModalOpen] = useState(false);
  const [allUnpaidOrders, setAllUnpaidOrders] = useState<Order[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (!date?.from) return;

    const startDate = date.from;
    const endDate = date.to || date.from;

    const ordersQuery = query(collection(db, "orders"));
    const expensesQuery = query(collection(db, "miscExpenses"), where("timestamp", ">=", startDate), where("timestamp", "<=", endDate));
    const reportsQuery = query(collection(db, "reconciliationReports"), where("timestamp", ">=", startDate), where("timestamp", "<=", endDate));

    const unsubOrders = onSnapshot(ordersQuery, (ordersSnapshot) => {
        const unsubExpenses = onSnapshot(expensesQuery, (expensesSnapshot) => {
            const unsubReports = onSnapshot(reportsQuery, (reportsSnapshot) => {
                try {
                    const allOrders = ordersSnapshot.docs.map(d => ({...d.data(), id: d.id})) as Order[];
                    
                    const ordersCreatedInPeriod = allOrders.filter(o => 
                        o.timestamp.toDate() >= startDate && o.timestamp.toDate() <= endDate
                    );
                    
                    const unpaidOrders = allOrders.filter(o => o.balanceDue > 0);
                    setAllUnpaidOrders(unpaidOrders);
                    const unpaidOrdersValue = unpaidOrders.reduce((sum, o) => sum + o.balanceDue, 0);
                    const overdueOrdersCount = unpaidOrders.filter(o => differenceInDays(new Date(), o.timestamp.toDate()) > 2).length;

                    const periodExpenses = expensesSnapshot.docs.map(d => d.data()) as MiscExpense[];
                    const periodReports = reportsSnapshot.docs.map(d => d.data()) as EnhancedReconciliationReport[];
                    
                    const totalSales = ordersCreatedInPeriod
                        .filter(o => o.status === 'Completed')
                        .reduce((sum, o) => sum + o.total, 0);
                    
                    const totalOrders = ordersCreatedInPeriod.length;
                    const totalItemsSold = ordersCreatedInPeriod
                        .filter(o => o.status === 'Completed')
                        .reduce((sum, o) => sum + o.items.reduce((itemSum, i) => itemSum + i.quantity, 0), 0);
                    
                    let cashSales = 0;
                    let momoSales = 0;
                    let newSalesRevenue = 0;
                    let collections = 0;
                    let totalPardonedAmount = 0;

                    allOrders.forEach(o => {
                      const paymentDate = o.lastPaymentTimestamp?.toDate();
                      if (paymentDate && paymentDate >= startDate && paymentDate <= endDate) {
                          const paymentAmount = o.lastPaymentAmount || 0;
                          const isOrderFromPeriod = o.timestamp.toDate() >= startDate && o.timestamp.toDate() <= endDate;
                          if (isOrderFromPeriod) {
                              newSalesRevenue += paymentAmount;
                          } else {
                              collections += paymentAmount;
                          }

                          if (o.paymentMethod === 'cash') cashSales += paymentAmount;
                          if (o.paymentMethod === 'momo') momoSales += paymentAmount;
                      }

                      if (o.timestamp.toDate() >= startDate && o.timestamp.toDate() <= endDate) {
                        totalPardonedAmount += (o.pardonedAmount || 0);
                      }
                    });

                    const totalMiscExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
                    const netRevenueFromNewSales = newSalesRevenue - totalMiscExpenses;
                    const totalNetRevenue = (newSalesRevenue + collections) - totalMiscExpenses;
                    
                    const totalVariance = periodReports.reduce((sum, r) => sum + r.totalDiscrepancy, 0);
                    const totalSurplus = periodReports.reduce((sum, r) => sum + (r.totalDiscrepancy > 0 ? r.totalDiscrepancy : 0), 0);
                    const totalDeficit = periodReports.reduce((sum, r) => sum + (r.totalDiscrepancy < 0 ? r.totalDiscrepancy : 0), 0);


                    const salesDataMap: Record<string, { newSales: number; collections: number; expenses: number; netRevenue: number; cashierNames: Set<string> }> = {};
                    const daysInRange = differenceInDays(endDate, startDate) + 1;
                    for (let i = 0; i < daysInRange; i++) {
                        const day = format(addDays(startDate, i), 'MMM d');
                        salesDataMap[day] = { newSales: 0, collections: 0, netRevenue: 0, expenses: 0, cashierNames: new Set() };
                    }

                    allOrders.forEach(o => {
                        const paymentDate = o.lastPaymentTimestamp?.toDate();
                        if (paymentDate && paymentDate >= startDate && paymentDate <= endDate) {
                            const day = format(paymentDate, 'MMM d');
                            if (salesDataMap[day]) {
                                const isOrderFromPeriod = o.timestamp.toDate() >= startDate && o.timestamp.toDate() <= endDate;
                                const paymentAmount = o.lastPaymentAmount || 0;
                                if(isOrderFromPeriod) {
                                    salesDataMap[day].newSales += paymentAmount;
                                } else {
                                    salesDataMap[day].collections += paymentAmount;
                                }
                                if (o.cashierName) salesDataMap[day].cashierNames.add(o.cashierName);
                            }
                        }
                    });

                    periodExpenses.forEach(e => {
                        const day = format(e.timestamp.toDate(), 'MMM d');
                        if (salesDataMap[day]) {
                            salesDataMap[day].expenses += e.amount;
                            if(e.cashierName) salesDataMap[day].cashierNames.add(e.cashierName);
                        }
                    });
                    
                    const salesData = Object.entries(salesDataMap).map(([date, values]) => ({
                        date,
                        ...values,
                        netRevenue: values.newSales + values.collections - values.expenses,
                        cashierNames: Array.from(values.cashierNames).join(', ')
                    }));
                    
                    const itemPerformance = ordersCreatedInPeriod
                        .filter(o => o.status === 'Completed')
                        .flatMap(o => o.items)
                        .reduce((acc, item) => {
                            if (!acc[item.name]) {
                                acc[item.name] = { name: item.name, count: 0, totalValue: 0 };
                            }
                            acc[item.name].count += item.quantity;
                            acc[item.name].totalValue += item.quantity * item.price;
                            return acc;
                        }, {} as Record<string, { name: string; count: number; totalValue: number }>);
                    
                    const finalStats: DashboardStats = {
                        totalSales,
                        previousDayCollections: collections,
                        totalOrders,
                        totalItemsSold,
                        unpaidOrdersValue,
                        overdueOrdersCount,
                        totalMiscExpenses,
                        totalVariance,
                        enhancedReports: periodReports,
                        salesData,
                        itemPerformance: Object.values(itemPerformance),
                        netRevenueFromNewSales,
                        totalNetRevenue,
                        cashSales,
                        momoSales,
                        changeFundImpact: 0, 
                        changeFundHealth: 'healthy', 
                        totalPardonedAmount,
                        totalSurplus,
                        totalDeficit,
                        dailyStats: [], 
                        businessMetrics: [],
                        orderAgeAnalysis: [],
                        incompleteAccountingDays: [],
                        pardonedOrders: [],
                    };

                    setStats(finalStats);
                } catch(err) {
                    console.error(err);
                    if (err instanceof Error) {
                        setError(`Failed to process dashboard data: ${err.message}.`);
                    } else {
                        setError("An unknown error occurred while processing dashboard data.");
                    }
                } finally {
                    setLoading(false);
                }
            });
            return () => unsubReports();
        });
        return () => unsubExpenses();
    });
    return () => unsubOrders();
  }, [date]);

  const setDateRange = (rangeType: PresetDateRange) => {
    const today = new Date();
    let fromDate, toDate;
    
    switch (rangeType) {
      case 'today':
        fromDate = startOfToday();
        toDate = endOfToday();
        break;
      case 'week':
        fromDate = startOfWeek(today, { weekStartsOn: 1 });
        toDate = endOfToday();
        break;
      case 'month':
        fromDate = startOfMonth(today);
        toDate = endOfToday();
        break;
      default:
        return;
    }
    setDate({ from: fromDate, to: toDate });
    setActiveDatePreset(rangeType);
  };
  
    const handleRunAnalysis = async () => {
    if (!stats || !date?.from) return;

    setIsGeneratingAnalysis(true);
    setIsAnalysisModalOpen(true);
    setAnalysisContent('');

    try {
        const itemPerformance = stats.itemPerformance.map(({ name, count }) => ({ name, count }));
        const avgOrderValue = stats.totalOrders > 0 ? stats.totalSales / stats.totalOrders : 0;
        
        const period = date.to 
            ? `From ${format(date.from, 'MMMM do, yyyy')} to ${format(date.to, 'MMMM do, yyyy')}`
            : `For ${format(date.from, 'MMMM do, yyyy')}`;

        const input = {
            period,
            totalSales: stats.totalSales,
            netRevenue: stats.totalNetRevenue,
            totalOrders: stats.totalOrders,
            avgOrderValue,
            itemPerformance,
            miscExpenses: stats.totalMiscExpenses,
            cashDiscrepancy: stats.totalVariance ?? 0,
        };

        const result = await analyzeBusiness(input);
        setAnalysisContent(result.analysis);
    } catch (err) {
        console.error("AI Analysis failed:", err);
        setAnalysisContent("## Analysis Failed\n\nAn unexpected error occurred while generating the business analysis. Please check the console for more details.");
        toast({
            title: "AI Analysis Error",
            description: "Could not generate the report. Please try again later.",
            type: "error",
        });
    } finally {
        setIsGeneratingAnalysis(false);
    }
  };

  const sortedItemSales = useMemo(() => {
    if (!stats) return [];
    const filtered = stats.itemPerformance.filter(item => 
      item.name.toLowerCase().includes(itemSearchQuery.toLowerCase())
    );
    return filtered.sort((a, b) => {
      if (itemSortDirection === 'asc') {
        return a[itemSortKey] - b[itemSortKey];
      } else {
        return b[itemSortKey] - a[itemSortKey];
      }
    });
  }, [stats, itemSearchQuery, itemSortKey, itemSortDirection]);
  
    const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: [{ text: chatInput }],
    };

    setChatHistory(prev => [...prev, userMessage]);
    setChatInput('');
    setIsAiReplying(true);

    try {
      const responseText = await businessChat({
        history: chatHistory,
        prompt: userMessage.content[0].text,
      });

      const modelMessage: ChatMessage = {
        role: 'model',
        content: [{ text: responseText }],
      };
      setChatHistory(prev => [...prev, modelMessage]);
    } catch (err) {
      console.error("AI Chat failed:", err);
      const errorMessage: ChatMessage = {
        role: 'model',
        content: [{ text: "I'm sorry, I encountered an error. Please try again." }],
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsAiReplying(false);
    }
  };

  const SortButton = ({ sortKey, label }: { sortKey: ItemSortKey; label: string }) => (
    <Button variant="ghost" size="sm" onClick={() => {
        if (itemSortKey === sortKey) {
            setItemSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setItemSortKey(sortKey);
            setItemSortDirection('desc');
        }
    }}>
      {label}
      {itemSortKey === sortKey && (
        itemSortDirection === 'desc' ? <SortDesc className="ml-2 h-4 w-4" /> : <SortAsc className="ml-2 h-4 w-4" />
      )}
    </Button>
  );

  const renderChatContent = () => (
    <div className="flex-grow flex flex-col overflow-hidden h-full">
      <ScrollArea className="flex-grow p-4" ref={chatContainerRef}>
        <div className="space-y-4">
          {chatHistory.length === 0 && !isAiReplying && (
            <div className="text-center text-muted-foreground pt-16">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">AI Business Assistant</p>
              <p>Ask me anything about your business performance.</p>
            </div>
          )}
          {chatHistory.map((message, index) => (
            <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'model' && <Avatar className="h-8 w-8"><AvatarFallback><Bot /></AvatarFallback></Avatar>}
              <div className={`rounded-lg px-4 py-2 max-w-sm ${message.role === 'model' ? 'bg-secondary' : 'bg-primary text-primary-foreground'}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-content">{message.content[0].text}</ReactMarkdown>
              </div>
              {message.role === 'user' && <Avatar className="h-8 w-8"><AvatarFallback><User /></AvatarFallback></Avatar>}
            </div>
          ))}
          {isAiReplying && (
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8"><AvatarFallback><Bot /></AvatarFallback></Avatar>
              <div className="rounded-lg px-4 py-2 bg-secondary"><LoadingSpinner /></div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="flex-shrink-0 p-4 border-t bg-background flex gap-2">
        <Input placeholder="Ask about your business..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isAiReplying && handleSendMessage()} disabled={isAiReplying} className="h-12" />
        <Button onClick={handleSendMessage} disabled={isAiReplying || !chatInput.trim()} className="h-12"><Send /></Button>
      </div>
    </div>
  );
  
  const UnpaidOrdersModal = () => (
    <Dialog open={isUnpaidOrdersModalOpen} onOpenChange={setIsUnpaidOrdersModalOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>All Unpaid Orders</DialogTitle>
          <DialogDescription>
            A complete list of all orders with an outstanding balance.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] mt-4">
          <div className="pr-4">
            {allUnpaidOrders.length > 0 ? (
              allUnpaidOrders.map(order => (
                <div key={order.id} className="mb-2 p-3 border rounded-md">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{order.simplifiedId} - <span className="font-normal">{order.tag}</span></p>
                      <p className="text-xs text-muted-foreground">{formatTimestamp(order.timestamp)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-500">{formatCurrency(order.balanceDue)}</p>
                      <Badge variant={order.paymentStatus === 'Unpaid' ? 'destructive' : 'secondary'}>{order.paymentStatus}</Badge>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No unpaid orders found.</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

  if (loading || !stats) {
    return <div className="p-6 h-full flex items-center justify-center"><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="p-6"><Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div>;
  }

  return (
    <div className="p-4 md:p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">Manager's Dashboard</h2>
          <p className="text-sm text-muted-foreground">Business performance overview</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1">
            <Button variant={activeDatePreset === 'today' ? 'default' : 'outline'} size="sm" onClick={() => setDateRange('today')}>Today</Button>
            <Button variant={activeDatePreset === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setDateRange('week')}>This Week</Button>
            <Button variant={activeDatePreset === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setDateRange('month')}>This Month</Button>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full sm:w-[260px] justify-start text-left font-normal", !date && "text-muted-foreground", activeDatePreset === 'custom' && 'border-primary' )}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (date.to ? <>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</> : format(date.from, "LLL dd, y")) : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={(newDate) => { setDate(newDate); setActiveDatePreset('custom'); }} numberOfMonths={2} />
            </PopoverContent>
          </Popover>
           <Button onClick={handleRunAnalysis} className="w-full sm:w-auto"><Sparkles className="mr-2 h-4 w-4" />Analyze</Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="items">Item Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<DollarSign className="text-green-500"/>} title="Total Sales" value={formatCurrency(stats.totalSales)} description={`${stats.totalOrders} orders in period`} />
            <StatCard icon={<TrendingUp className="text-blue-500"/>} title="Net Revenue" value={formatCurrency(stats.totalNetRevenue)} description={`+${formatCurrency(stats.previousDayCollections)} from collections`} />
            <StatCard icon={<MinusCircle className="text-orange-500"/>} title="Expenses" value={formatCurrency(stats.totalMiscExpenses)} description="Misc. cash/momo outs" />
            <StatCard 
              icon={<Hourglass className={stats.unpaidOrdersValue === 0 ? "text-muted-foreground" : "text-amber-500"}/>} 
              title="Unpaid Orders (All Time)" 
              value={formatCurrency(stats.unpaidOrdersValue)} 
              description={`${stats.overdueOrdersCount} overdue`} 
              variant={stats.overdueOrdersCount > 0 ? 'danger' : 'default'}
              badge={stats.overdueOrdersCount > 0 ? <Badge variant="destructive">{stats.overdueOrdersCount}</Badge> : undefined}
              onClick={() => setIsUnpaidOrdersModalOpen(true)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Daily breakdown of new sales vs. collections on old debts</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.salesData && stats.salesData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <ComposedChart data={stats.salesData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => formatCurrency(Number(value))} />
                    <ChartTooltip
                      content={({ payload, label }) => (
                        <ChartTooltipContent
                          label={label}
                          payload={payload || []}
                          formatter={(value, name, props) => (
                            <div className="flex flex-col">
                              <span className="font-bold">{formatCurrency(value as number)}</span>
                              {props.payload.cashierNames && <span className="text-xs text-muted-foreground">{props.payload.cashierNames}</span>}
                            </div>
                          )}
                        />
                      )}
                    />
                    <Area dataKey="collections" type="natural" fill="var(--color-collections)" fillOpacity={0.4} stroke="var(--color-collections)" stackId="a" />
                    <Area dataKey="newSales" type="natural" fill="var(--color-newSales)" fillOpacity={0.4} stroke="var(--color-newSales)" stackId="a" />
                    <ChartLine dataKey="expenses" type="monotone" stroke="var(--color-expenses)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ChartContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No sales data available for this period.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Item Performance</CardTitle>
                  <CardDescription>Breakdown of items sold in the selected period.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <SortButton sortKey="count" label="Qty" />
                  <SortButton sortKey="totalValue" label="Value" />
                </div>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search items..." className="pl-10 h-9" value={itemSearchQuery} onChange={(e) => setItemSearchQuery(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 pr-4">
                {sortedItemSales.length > 0 ? (
                  <div className="space-y-3">
                    {sortedItemSales.map((item, index) => (
                      <div key={item.name + index} className="flex justify-between items-center text-sm p-3 bg-secondary rounded-md">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.count} sold</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{formatCurrency(item.totalValue)}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">{formatCurrency(item.totalValue / item.count)} avg</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground italic py-8">{itemSearchQuery ? 'No items match your search.' : 'No items sold in this period.'}</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAnalysisModalOpen} onOpenChange={setIsAnalysisModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="text-primary h-5 w-5" />AI Business Performance Analysis</DialogTitle><DialogDescription>An AI-generated report on your business performance for the selected period.</DialogDescription></DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4"><div className="p-4 prose dark:prose-invert max-w-none">{isGeneratingAnalysis ? <div className="flex flex-col items-center justify-center h-48"><LoadingSpinner /><p className="mt-4 text-muted-foreground">Generating your report...</p></div> : <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-content">{analysisContent}</ReactMarkdown>}</div></ScrollArea>
        </DialogContent>
      </Dialog>
      
      <UnpaidOrdersModal />

      <Sheet open={isChatSheetOpen} onOpenChange={setIsChatSheetOpen}>
        <SheetTrigger asChild><Button className="fixed bottom-6 right-6 h-16 w-16 rounded-full z-20 shadow-lg"><Sparkles className="h-8 w-8" /></Button></SheetTrigger>
        <SheetContent side="right" className="w-full sm:w-[500px] flex flex-col p-0">
          <SheetHeader className="p-4 border-b flex flex-row items-center justify-between flex-shrink-0">
            <div><SheetTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />AI Business Assistant</SheetTitle><SheetDescription>Get insights about your business performance</SheetDescription></div>
            <div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => setChatHistory([])}><Plus className="h-4 w-4" /></Button></div>
          </SheetHeader>
          <div className="flex-grow overflow-y-auto">{renderChatContent()}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default DashboardView;

    

    