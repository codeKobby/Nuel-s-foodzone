

"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Area, ComposedChart, CartesianGrid, XAxis, YAxis, Line as ChartLine } from 'recharts';

import { DateRange } from "react-day-picker"
import { addDays, format, startOfWeek, endOfWeek, startOfMonth, startOfToday, endOfToday, differenceInDays } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
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
import { analyzeBusiness } from '@/ai/actions';
import { useChat } from '@ai-sdk/react';
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
    const baseClasses = onClick ? 'cursor-pointer hover:shadow-md transition-all active:scale-[0.98]' : '';
    switch (variant) {
      case 'warning': return `${baseClasses} border-amber-200 bg-amber-50 dark:bg-amber-900/20`;
      case 'success': return `${baseClasses} border-green-200 bg-green-50 dark:bg-green-900/20`;
      case 'danger': return `${baseClasses} border-red-200 bg-red-50 dark:bg-red-900/20`;
      default: return baseClasses;
    }
  };

  return (
    <Card onClick={onClick} className={getCardClasses()}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-4">
        <CardTitle className="text-[11px] md:text-sm font-medium truncate pr-2">{title}</CardTitle>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {badge}
          {icon}
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0">
        <div className="text-lg md:text-2xl font-bold truncate">{value}</div>
        {description && <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 truncate">{description}</p>}
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

  const { messages, input, handleInputChange, handleSubmit, isLoading: isChatLoading, setMessages, error: chatError } = useChat({
    api: '/api/chat',
    maxSteps: 5, // Allow multiple tool calls
  });
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
            const allOrders = ordersSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as Order[];

            const ordersCreatedInPeriod = allOrders.filter(o =>
              o.timestamp.toDate() >= startDate && o.timestamp.toDate() <= endDate
            );

            // Fix: Filter unpaid orders using both balanceDue AND paymentStatus to handle data integrity edge cases
            // An order is truly unpaid if:
            // 1. balanceDue > 0 (has outstanding balance)
            // 2. paymentStatus is NOT "Paid" (explicitly marked as not fully paid)
            const unpaidOrders = allOrders.filter(o =>
              o.balanceDue > 0 && o.paymentStatus !== 'Paid'
            );
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
            let totalRewardDiscount = 0;

            allOrders.forEach(o => {
              const isOrderFromPeriod = o.timestamp.toDate() >= startDate && o.timestamp.toDate() <= endDate;

              // Track pardoned amounts and reward discounts for orders in period
              if (isOrderFromPeriod) {
                totalPardonedAmount += (o.pardonedAmount || 0);
                totalRewardDiscount += (o.rewardDiscount || 0);
              }

              // Use paymentHistory if available (matches AccountingView logic)
              if (o.paymentHistory && Array.isArray(o.paymentHistory)) {
                o.paymentHistory.forEach((payment) => {
                  const paymentDate = payment.timestamp?.toDate();
                  if (paymentDate && paymentDate >= startDate && paymentDate <= endDate) {
                    const paymentAmount = payment.amount || 0;

                    if (isOrderFromPeriod) {
                      newSalesRevenue += paymentAmount;
                    } else {
                      collections += paymentAmount;
                    }

                    // Track by payment method
                    if (payment.method === 'cash') {
                      cashSales += paymentAmount;
                    } else if (payment.method === 'momo' || payment.method === 'card') {
                      momoSales += paymentAmount;
                    }
                  }
                });
              } else {
                // Fallback to lastPaymentTimestamp for legacy orders
                const paymentDate = o.lastPaymentTimestamp?.toDate();
                if (paymentDate && paymentDate >= startDate && paymentDate <= endDate) {
                  const paymentAmount = o.lastPaymentAmount || 0;

                  if (isOrderFromPeriod) {
                    newSalesRevenue += paymentAmount;
                  } else {
                    collections += paymentAmount;
                  }

                  // Attribute ONLY the last payment amount for this period.
                  // Do not use cumulative paymentBreakdown (it causes double-counting).
                  let method = o.paymentMethod;
                  const breakdownCash = o.paymentBreakdown?.cash || 0;
                  const breakdownMomo = o.paymentBreakdown?.momo || 0;

                  // Heuristic for legacy split orders: if lastPaymentAmount matches one side of the breakdown,
                  // treat that as the method used for the last payment.
                  if ((method === 'split' || method === 'Unpaid') && o.paymentBreakdown && paymentAmount > 0) {
                    if (Math.abs(breakdownCash - paymentAmount) < 0.01 && breakdownMomo > 0) {
                      method = 'cash';
                    } else if (Math.abs(breakdownMomo - paymentAmount) < 0.01 && breakdownCash > 0) {
                      method = 'momo';
                    }
                  }

                  if (method === 'cash') {
                    cashSales += paymentAmount;
                  } else if (method === 'momo' || method === 'card') {
                    momoSales += paymentAmount;
                  }
                }
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
              const isOrderFromPeriod = o.timestamp.toDate() >= startDate && o.timestamp.toDate() <= endDate;

              // Use paymentHistory if available (matches AccountingView logic)
              if (o.paymentHistory && Array.isArray(o.paymentHistory)) {
                o.paymentHistory.forEach((payment) => {
                  const paymentDate = payment.timestamp?.toDate();
                  if (paymentDate && paymentDate >= startDate && paymentDate <= endDate) {
                    const day = format(paymentDate, 'MMM d');
                    if (salesDataMap[day]) {
                      const paymentAmount = payment.amount || 0;
                      if (isOrderFromPeriod) {
                        salesDataMap[day].newSales += paymentAmount;
                      } else {
                        salesDataMap[day].collections += paymentAmount;
                      }
                      if (o.cashierName) salesDataMap[day].cashierNames.add(o.cashierName);
                    }
                  }
                });
              } else {
                // Fallback to lastPaymentTimestamp for legacy orders
                const paymentDate = o.lastPaymentTimestamp?.toDate();
                if (paymentDate && paymentDate >= startDate && paymentDate <= endDate) {
                  const day = format(paymentDate, 'MMM d');
                  if (salesDataMap[day]) {
                    const paymentAmount = o.lastPaymentAmount || 0;
                    if (isOrderFromPeriod) {
                      salesDataMap[day].newSales += paymentAmount;
                    } else {
                      salesDataMap[day].collections += paymentAmount;
                    }
                    if (o.cashierName) salesDataMap[day].cashierNames.add(o.cashierName);
                  }
                }
              }
            });

            periodExpenses.forEach(e => {
              const day = format(e.timestamp.toDate(), 'MMM d');
              if (salesDataMap[day]) {
                salesDataMap[day].expenses += e.amount;
                if (e.cashierName) salesDataMap[day].cashierNames.add(e.cashierName);
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
          } catch (err) {
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
      <div className="flex-grow p-4 overflow-y-auto" ref={chatContainerRef}>
        <div className="space-y-4">
          {messages.length === 0 && !isChatLoading && (
            <div className="text-center text-muted-foreground pt-16">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">AI Business Assistant</p>
              <p>Ask me anything about your business performance.</p>
              <p className="text-sm mt-4">Try asking:</p>
              <ul className="text-sm text-left max-w-xs mx-auto mt-2 space-y-1">
                <li>• "What were my sales last week?"</li>
                <li>• "Show me the top selling items today"</li>
                <li>• "Add a new menu item called..."</li>
              </ul>
            </div>
          )}
          {chatError && (
            <div className="text-center text-red-500 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <p className="font-medium">Error connecting to AI</p>
              <p className="text-sm">{chatError.message}</p>
            </div>
          )}
          {messages.map((message: any) => (
            <div key={message.id} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && <Avatar className="h-8 w-8 flex-shrink-0"><AvatarFallback><Bot /></AvatarFallback></Avatar>}
              <div className={`rounded-lg px-4 py-2 max-w-[85%] ${message.role === 'assistant' ? 'bg-secondary' : 'bg-primary text-primary-foreground'}`}>
                {/* Handle message parts for AI SDK v5 */}
                {message.parts ? (
                  message.parts.map((part: any, index: number) => {
                    switch (part.type) {
                      case 'text':
                        return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]} className="markdown-content prose prose-sm dark:prose-invert max-w-none">{part.text}</ReactMarkdown>;
                      case 'tool-invocation':
                        return (
                          <div key={index} className="text-xs text-muted-foreground italic my-1">
                            {part.toolInvocation.state === 'call' && `Fetching ${part.toolInvocation.toolName}...`}
                            {part.toolInvocation.state === 'result' && `✓ Got data from ${part.toolInvocation.toolName}`}
                          </div>
                        );
                      default:
                        return null;
                    }
                  })
                ) : (
                  // Fallback to content for simpler messages
                  <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-content prose prose-sm dark:prose-invert max-w-none">{message.content}</ReactMarkdown>
                )}
              </div>
              {message.role === 'user' && <Avatar className="h-8 w-8 flex-shrink-0"><AvatarFallback><User /></AvatarFallback></Avatar>}
            </div>
          ))}
          {isChatLoading && (
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0"><AvatarFallback><Bot /></AvatarFallback></Avatar>
              <div className="rounded-lg px-4 py-2 bg-secondary"><LoadingSpinner /></div>
            </div>
          )}
        </div>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 p-4 border-t bg-background flex gap-2"
      >
        <Input
          placeholder="Ask about your business..."
          value={input ?? ''}
          onChange={handleInputChange}
          disabled={isChatLoading}
          className="h-12"
        />
        <Button type="submit" disabled={isChatLoading || !(input?.trim())} className="h-12"><Send /></Button>
      </form>
    </div>
  );

  const UnpaidOrdersModal = () => (
    <Dialog open={isUnpaidOrdersModalOpen} onOpenChange={setIsUnpaidOrdersModalOpen}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle>All Unpaid Orders</DialogTitle>
          <DialogDescription>
            A complete list of all orders with an outstanding balance ({allUnpaidOrders.length} orders).
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          <div className="space-y-4">
            {allUnpaidOrders.length > 0 ? (
              allUnpaidOrders
                .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())
                .map(order => {
                  const daysOld = differenceInDays(new Date(), order.timestamp.toDate());
                  const isOverdue = daysOld > 2;
                  return (
                    <div key={order.id} className={cn("p-3 border rounded-md", isOverdue && "border-red-200 bg-red-50/50 dark:bg-red-950/20")}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{order.simplifiedId} - <span className="font-normal">{order.tag}</span></p>
                          <p className="text-xs text-muted-foreground">{formatTimestamp(order.timestamp)}</p>
                          {isOverdue && <p className="text-xs text-red-500 font-medium mt-1">{daysOld} days overdue</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Total: {formatCurrency(order.total)}</p>
                          <p className="text-xs text-muted-foreground">Paid: {formatCurrency(order.amountPaid)}</p>
                          <p className="font-bold text-red-500">{formatCurrency(order.balanceDue)} due</p>
                          <Badge variant={order.paymentStatus === 'Unpaid' ? 'destructive' : 'secondary'} className="mt-1">{order.paymentStatus}</Badge>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="text-center text-muted-foreground py-8">🎉 No unpaid orders found!</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (loading || !stats) {
    return <div className="p-4 md:p-6 h-full flex items-center justify-center"><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="p-4 md:p-6"><Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div>;
  }

  return (
    <div className="p-3 md:p-4 lg:p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 md:mb-6 gap-3 md:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold truncate">Manager's Dashboard</h2>
          <p className="text-xs md:text-sm text-muted-foreground">Business performance overview</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 -mb-1">
            <Button variant={activeDatePreset === 'today' ? 'default' : 'outline'} size="sm" className="text-xs flex-shrink-0" onClick={() => setDateRange('today')}>Today</Button>
            <Button variant={activeDatePreset === 'week' ? 'default' : 'outline'} size="sm" className="text-xs flex-shrink-0" onClick={() => setDateRange('week')}>This Week</Button>
            <Button variant={activeDatePreset === 'month' ? 'default' : 'outline'} size="sm" className="text-xs flex-shrink-0" onClick={() => setDateRange('month')}>This Month</Button>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-full sm:w-[220px] lg:w-[260px] justify-start text-left font-normal text-xs md:text-sm", !date && "text-muted-foreground", activeDatePreset === 'custom' && 'border-primary')}>
                <CalendarIcon className="mr-2 h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                <span className="truncate">
                  {date?.from ? (date.to ? <>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</> : format(date.from, "LLL dd, y")) : <span>Pick a date</span>}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={(newDate) => { setDate(newDate); setActiveDatePreset('custom'); }} numberOfMonths={2} />
            </PopoverContent>
          </Popover>
          <Button onClick={handleRunAnalysis} size="sm" className="w-full sm:w-auto text-xs md:text-sm"><Sparkles className="mr-2 h-3 w-3 md:h-4 md:w-4" />Analyze</Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-2 h-9">
          <TabsTrigger value="overview" className="text-xs md:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="items" className="text-xs md:text-sm">Item Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 md:mt-6 space-y-4 md:space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
            <StatCard icon={<DollarSign className="text-green-500" />} title="Total Sales" value={formatCurrency(stats.totalSales)} description={`${stats.totalOrders} orders in period`} />
            <StatCard icon={<TrendingUp className="text-blue-500" />} title="Net Revenue" value={formatCurrency(stats.totalNetRevenue)} description={`+${formatCurrency(stats.previousDayCollections)} from collections`} />
            <StatCard icon={<MinusCircle className="text-orange-500" />} title="Expenses" value={formatCurrency(stats.totalMiscExpenses)} description="Misc. cash/momo outs" />
            <StatCard
              icon={<Hourglass className={stats.unpaidOrdersValue === 0 ? "text-muted-foreground" : "text-amber-500"} />}
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
                      content={({ payload, label }) => {
                        if (!payload || payload.length === 0) return null;
                        const data = payload[0]?.payload;
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[200px]">
                            <p className="font-semibold text-sm mb-2 border-b pb-2">{label}</p>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full bg-[hsl(var(--chart-1))]" />
                                  <span className="text-muted-foreground">New Sales:</span>
                                </span>
                                <span className="font-medium">{formatCurrency(data?.newSales || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full bg-[hsl(var(--chart-2))]" />
                                  <span className="text-muted-foreground">Collections (Old Debts):</span>
                                </span>
                                <span className="font-medium">{formatCurrency(data?.collections || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full bg-[hsl(var(--chart-4))]" />
                                  <span className="text-muted-foreground">Expenses:</span>
                                </span>
                                <span className="font-medium text-red-500">-{formatCurrency(data?.expenses || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center pt-1.5 border-t mt-1.5">
                                <span className="text-muted-foreground font-medium">Net Revenue:</span>
                                <span className={cn("font-bold", (data?.netRevenue || 0) >= 0 ? "text-green-600" : "text-red-600")}>
                                  {formatCurrency(data?.netRevenue || 0)}
                                </span>
                              </div>
                              {data?.cashierNames && (
                                <p className="text-xs text-muted-foreground pt-1 border-t mt-1.5">
                                  Cashiers: {data.cashierNames}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area dataKey="collections" type="natural" fill="var(--color-collections)" fillOpacity={0.4} stroke="var(--color-collections)" stackId="a" name="Collections (Old Debts)" />
                    <Area dataKey="newSales" type="natural" fill="var(--color-newSales)" fillOpacity={0.4} stroke="var(--color-newSales)" stackId="a" name="New Sales" />
                    <ChartLine dataKey="expenses" type="monotone" stroke="var(--color-expenses)" strokeWidth={2} dot={false} name="Expenses" />
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
              <div className="h-96 pr-4 overflow-y-auto">
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAnalysisModalOpen} onOpenChange={setIsAnalysisModalOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b shrink-0"><DialogTitle className="flex items-center gap-2"><Sparkles className="text-primary h-5 w-5" />AI Business Performance Analysis</DialogTitle><DialogDescription>An AI-generated report on your business performance for the selected period.</DialogDescription></DialogHeader>
          <div className="flex-1 p-6 overflow-y-auto min-h-0"><div className="prose dark:prose-invert max-w-none">{isGeneratingAnalysis ? <div className="flex flex-col items-center justify-center h-48"><LoadingSpinner /><p className="mt-4 text-muted-foreground">Generating your report...</p></div> : <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-content">{analysisContent}</ReactMarkdown>}</div></div>
        </DialogContent>
      </Dialog>

      <UnpaidOrdersModal />

      <Sheet open={isChatSheetOpen} onOpenChange={setIsChatSheetOpen}>
        <SheetTrigger asChild><Button className="fixed bottom-6 right-6 h-16 w-16 rounded-full z-20 shadow-lg"><Sparkles className="h-8 w-8" /></Button></SheetTrigger>
        <SheetContent side="right" className="w-full sm:w-[500px] flex flex-col p-0">
          <SheetHeader className="p-4 border-b flex flex-row items-center justify-between flex-shrink-0">
            <div><SheetTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />AI Business Assistant</SheetTitle><SheetDescription>Get insights about your business performance</SheetDescription></div>
            <div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => setMessages([])}><Plus className="h-4 w-4" /></Button></div>
          </SheetHeader>
          <div className="flex-grow overflow-y-auto">{renderChatContent()}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default DashboardView;



