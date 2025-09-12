"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, setDoc, addDoc, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { 
    Order, 
    MiscExpense, 
    ReconciliationReport as EnhancedReconciliationReport, 
    ChatSession, 
    EnhancedPeriodStats,
    PreviousDaySettlement,
    ChangeFund,
    OrderAgeAnalysis,
    BusinessMetrics,
    DashboardStats,
    ChatMessage
} from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { DollarSign, ShoppingBag, TrendingUp, TrendingDown, AlertCircle, Sparkles, User, Bot, Send, Calendar as CalendarIcon, FileWarning, Activity, UserCheck, MessageSquare, Plus, Trash2, FileCheck, Check, Briefcase, Search, Coins, Landmark, CreditCard, Hourglass, MinusCircle, ArrowDownUp, SortAsc, SortDesc, Ban, Package, AlertTriangle, Clock, Eye, History, Calculator, Wifi, WifiOff } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart, CartesianGrid, Area, AreaChart } from 'recharts';
import { DateRange } from "react-day-picker"
import { addDays, format, startOfWeek, endOfWeek, startOfMonth, startOfToday, endOfToday, differenceInDays, isToday } from "date-fns"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';
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
  children?: React.ReactNode;
  variant?: 'default' | 'warning' | 'success' | 'danger';
  badge?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
}> = ({ icon, title, value, description, onClick, children, variant = 'default', badge, trend }) => {
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
        <div className="flex items-end justify-between">
          <div className="text-2xl font-bold">{value}</div>
          {trend && (
            <div className={`flex items-center text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {children}
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({ 
    from: startOfWeek(new Date(), { weekStartsOn: 1 }), 
    to: endOfToday() 
  });
  const [activeDatePreset, setActiveDatePreset] = useState<PresetDateRange>('week');
  
  // Modal states
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);
  const [isChangeFundModalOpen, setIsChangeFundModalOpen] = useState(false);
  const [isOrderAgeModalOpen, setIsOrderAgeModalOpen] = useState(false);
  const [isIncompleteModalOpen, setIsIncompleteModalOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [analysisContent, setAnalysisContent] = useState('');
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  
  // AI Features State
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [isChatSheetOpen, setIsChatSheetOpen] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Search and sorting
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSortKey, setItemSortKey] = useState<ItemSortKey>('count');
  const [itemSortDirection, setItemSortDirection] = useState<ItemSortDirection>('desc');
  
  const { toast } = useToast();

  // Check authentication status
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setAuthChecking(false);
      if (!user) {
        setError("Authentication required. Please log in to access the dashboard.");
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

   useEffect(() => {
    if (authChecking || !isAuthenticated || !date?.from) return;

    setLoading(true);

    const fetchDashboardData = async () => {
        try {
            const startDate = date.from!;
            const endDate = date.to || date.from;
            
            const ordersQuery = query(collection(db, "orders"), orderBy('timestamp', 'desc'));
            const expensesQuery = query(collection(db, "miscExpenses"), where("timestamp", ">=", startDate), where("timestamp", "<=", endDate));
            const reportsQuery = query(collection(db, "reconciliationReports"), where("timestamp", ">=", startDate), where("timestamp", "<=", endDate));

            const [ordersSnapshot, expensesSnapshot, reportsSnapshot] = await Promise.all([
                getDocs(ordersQuery),
                getDocs(expensesQuery),
                getDocs(reportsQuery),
            ]);

            const allOrders = ordersSnapshot.docs.map(d => ({...d.data(), id: d.id})) as Order[];
            const periodExpenses = expensesSnapshot.docs.map(d => d.data()) as MiscExpense[];
            const periodReports = reportsSnapshot.docs.map(d => d.data()) as EnhancedReconciliationReport[];
            
            const ordersCreatedInPeriod = allOrders.filter(o => o.timestamp.toDate() >= startDate && o.timestamp.toDate() <= endDate);

            // Calculate metrics for orders created in the period
            const totalSales = ordersCreatedInPeriod
                .filter(o => o.status === 'Completed')
                .reduce((sum, o) => sum + o.total, 0);
            
            const totalOrders = ordersCreatedInPeriod.length;
            const totalItemsSold = ordersCreatedInPeriod
                .filter(o => o.status === 'Completed')
                .reduce((sum, o) => sum + o.items.reduce((itemSum, i) => itemSum + i.quantity, 0), 0);
            const totalPardonedAmount = ordersCreatedInPeriod.reduce((sum, o) => sum + (o.pardonedAmount || 0), 0);

            // Calculate payments received in the period (for both new and old orders)
            let newSalesRevenue = 0;
            let collections = 0;
            let cashSales = 0;
            let momoSales = 0;

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
            });

            const totalMiscExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
            const totalNetRevenue = (newSalesRevenue + collections) - totalMiscExpenses - totalPardonedAmount;
            
            // Unpaid orders value should be calculated from ALL orders, regardless of date range
            const unpaidOrdersValue = allOrders
                .filter(o => (o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partially Paid') && o.balanceDue > 0)
                .reduce((sum, o) => sum + o.balanceDue, 0);

            const overdueOrders = allOrders.filter(o => o.balanceDue > 0 && differenceInDays(new Date(), o.timestamp.toDate()) > 2);
            
            const totalVariance = periodReports.reduce((sum, r) => sum + r.totalDiscrepancy, 0);

            // Chart Data
            const salesDataMap: Record<string, { newSales: number; collections: number; netRevenue: number; expenses: number }> = {};
            const daysInRange = differenceInDays(endDate, startDate) + 1;
            for (let i = 0; i < daysInRange; i++) {
                const day = format(addDays(startDate, i), 'MMM d');
                salesDataMap[day] = { newSales: 0, collections: 0, netRevenue: 0, expenses: 0 };
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
                     }
                }
            });
            
             const salesData = Object.entries(salesDataMap).map(([date, values]) => ({
                date, ...values, netRevenue: values.newSales + values.collections - values.expenses
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

            setStats({
                totalSales,
                netRevenueFromNewSales: newSalesRevenue, // Corrected
                totalNetRevenue,
                previousDayCollections: collections,
                cashSales,
                momoSales,
                changeFundImpact: -45, // MOCK DATA
                changeFundHealth: 'healthy', // MOCK DATA
                totalOrders,
                totalItemsSold,
                unpaidOrdersValue, // Corrected
                overdueOrdersCount: overdueOrders.length,
                totalMiscExpenses,
                totalPardonedAmount,
                totalVariance: totalVariance,
                totalSurplus: periodReports.filter(r => r.totalDiscrepancy > 0).reduce((sum, r) => sum + r.totalDiscrepancy, 0),
                totalDeficit: periodReports.filter(r => r.totalDiscrepancy < 0).reduce((sum, r) => sum + r.totalDiscrepancy, 0),
                enhancedReports: periodReports,
                dailyStats: [], // Needs more complex daily breakdown
                salesData,
                itemPerformance: Object.values(itemPerformance),
                businessMetrics: [], // MOCK DATA
                orderAgeAnalysis: overdueOrders.map(o => ({
                    orderId: o.id,
                    orderNumber: o.simplifiedId,
                    cashierName: o.cashierName,
                    daysOverdue: differenceInDays(new Date(), o.timestamp.toDate()),
                    amount: o.balanceDue,
                    riskLevel: differenceInDays(new Date(), o.timestamp.toDate()) > 5 ? 'high' : 'medium',
                    recommendedAction: 'Follow up call'
                })),
                incompleteAccountingDays: [], // MOCK DATA
                pardonedOrders: [] // MOCK DATA
            });

        } catch (err) {
            console.error(err);
            setError("Failed to fetch dashboard data. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    fetchDashboardData();
  }, [date, authChecking, isAuthenticated]);

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

  const handleSortChange = (key: ItemSortKey) => {
    if (itemSortKey === key) {
      setItemSortDirection(itemSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setItemSortKey(key);
      setItemSortDirection('desc');
    }
  };
  
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
      const response = await businessChat({
        history: chatHistory,
        prompt: userMessage.content[0].text,
      });

      const modelMessage: ChatMessage = {
        role: 'model',
        content: [{ text: response }],
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
    <Button variant="ghost" size="sm" onClick={() => handleSortChange(sortKey)}>
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
              <p>Ask questions about your business performance, like:</p>
              <div className="space-y-1 mt-3 text-sm">
                <p className="italic">"How did we perform this week?"</p>
                <p className="italic">"Which items need more promotion?"</p>
                <p className="italic">"Add a new drink called 'Sobolo' for 10 cedis"</p>
              </div>
            </div>
          )}
          {chatHistory.map((message, index) => (
            <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'model' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback><Bot /></AvatarFallback>
                </Avatar>
              )}
              <div className={`rounded-lg px-4 py-2 max-w-sm ${
                message.role === 'model' ? 'bg-secondary' : 'bg-primary text-primary-foreground'
              }`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-content">
                  {message.content[0].text}
                </ReactMarkdown>
              </div>
              {message.role === 'user' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback><User /></AvatarFallback>
                </Avatar>
              )}
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
        <Input
          placeholder="Ask about your business..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isAiReplying && handleSendMessage()}
          disabled={isAiReplying}
          className="h-12"
        />
        <Button 
          onClick={handleSendMessage} 
          disabled={isAiReplying || !chatInput.trim()} 
          className="h-12"
        >
          <Send />
        </Button>
      </div>
    </div>
  );

  if (authChecking) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Select a date range to view data.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex flex-col">
          <h2 className="text-2xl md:text-3xl font-bold">Enhanced Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Advanced business performance with accounting integration
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1">
            <Button 
              variant={activeDatePreset === 'today' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setDateRange('today')}
            >
              Today
            </Button>
            <Button 
              variant={activeDatePreset === 'week' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setDateRange('week')}
            >
              This Week
            </Button>
            <Button 
              variant={activeDatePreset === 'month' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setDateRange('month')}
            >
              This Month
            </Button>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full sm:w-[260px] justify-start text-left font-normal",
                  !date && "text-muted-foreground",
                  activeDatePreset === 'custom' && 'border-primary'
                )}
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
                onSelect={(newDate) => { 
                  setDate(newDate); 
                  setActiveDatePreset('custom'); 
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
           <Button onClick={handleRunAnalysis} className="w-full sm:w-auto">
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze
            </Button>
        </div>
      </div>

      {/* Alert for incomplete accounting */}
      {stats.incompleteAccountingDays.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Incomplete Daily Accounting</AlertTitle>
          <AlertDescription>
            {stats.incompleteAccountingDays.length} day(s) missing end-of-day reconciliation.
            <Button 
              variant="link" 
              size="sm" 
              className="p-0 h-auto ml-2 text-red-600"
              onClick={() => setIsIncompleteModalOpen(true)}
            >
              View details →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analysis</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Key Performance Indicators */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              icon={<DollarSign className="text-green-500"/>} 
              title="Total Sales" 
              value={formatCurrency(stats.totalSales)}
              description={`${stats.totalOrders} orders, ${stats.totalItemsSold} items`}
            />
            <StatCard 
              icon={<TrendingUp className="text-blue-500"/>} 
              title="Net Revenue (New)" 
              value={formatCurrency(stats.netRevenueFromNewSales)}
              description="New business only"
            />
            <StatCard 
              icon={<Landmark className="text-purple-500"/>} 
              title="Total Net Revenue" 
              value={formatCurrency(stats.totalNetRevenue)}
              description={`+${formatCurrency(stats.previousDayCollections)} collections`}
            />
            <StatCard 
              icon={<Hourglass className={stats.unpaidOrdersValue === 0 ? "text-muted-foreground" : "text-amber-500"}/>} 
              title="Unpaid Orders" 
              value={formatCurrency(stats.unpaidOrdersValue)}
              description={`${stats.overdueOrdersCount} overdue orders`}
              onClick={stats.unpaidOrdersValue > 0 ? () => setIsOrderAgeModalOpen(true) : undefined}
              variant={stats.overdueOrdersCount > 3 ? 'danger' : stats.overdueOrdersCount > 0 ? 'warning' : 'default'}
              badge={stats.overdueOrdersCount > 0 ? (
                <Badge variant="destructive" className="text-xs">
                  {stats.overdueOrdersCount}
                </Badge>
              ) : undefined}
            />
          </div>

          {/* Change Fund Status Alert */}
          {stats.changeFundImpact !== 0 && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <Coins className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700 dark:text-amber-300">
                Change Fund Impact on Revenue
              </AlertTitle>
              <AlertDescription className="text-amber-600 dark:text-amber-400">
                Net revenue shows {formatCurrency(stats.changeFundImpact)} impact from change management.
                <Button 
                  variant="link" 
                  size="sm" 
                  className="p-0 h-auto ml-2 text-amber-700 dark:text-amber-300"
                  onClick={() => setIsChangeFundModalOpen(true)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View change details
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Revenue Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend Analysis</CardTitle>
              <CardDescription>
                Daily breakdown showing new sales, collections, and expenses.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ComposedChart data={stats.salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Area
                    dataKey="collections"
                    type="natural"
                    fill="var(--color-collections)"
                    fillOpacity={0.4}
                    stroke="var(--color-collections)"
                    stackId="a"
                  />
                  <Area
                    dataKey="newSales"
                    type="natural"
                    fill="var(--color-newSales)"
                    fillOpacity={0.4}
                    stroke="var(--color-newSales)"
                    stackId="a"
                  />
                   <Line
                    dataKey="expenses"
                    type="natural"
                    stroke="var(--color-expenses)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-6 space-y-6">
          {/* Revenue Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Sources</CardTitle>
                <CardDescription>Breakdown of revenue by source and payment method</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded">
                    <p className="text-sm text-green-600 dark:text-green-400">New Sales Revenue</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-300">
                      {formatCurrency(stats.netRevenueFromNewSales)}
                    </p>
                    <p className="text-xs text-muted-foreground">Primary business</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <p className="text-sm text-blue-600 dark:text-blue-400">Previous Collections</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                      {formatCurrency(stats.previousDayCollections)}
                    </p>
                    <p className="text-xs text-muted-foreground">Debt recovery</p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-secondary rounded">
                    <p className="text-sm text-muted-foreground">Cash Sales</p>
                    <p className="text-lg font-bold">{formatCurrency(stats.cashSales)}</p>
                    <p className="text-xs text-muted-foreground">
                      {((stats.cashSales / (stats.cashSales + stats.momoSales || 1)) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                  <div className="p-3 bg-secondary rounded">
                    <p className="text-sm text-muted-foreground">Digital Sales</p>
                    <p className="text-lg font-bold">{formatCurrency(stats.momoSales)}</p>
                    <p className="text-xs text-muted-foreground">
                      {((stats.momoSales / (stats.cashSales + stats.momoSales || 1)) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Adjustments</CardTitle>
                <CardDescription>Expenses, pardons, and change fund impacts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Miscellaneous Expenses</span>
                    <span className="font-medium text-red-600">-{formatCurrency(stats.totalMiscExpenses)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Pardoned Amounts</span>
                    <span className="font-medium text-red-600">-{formatCurrency(stats.totalPardonedAmount)}</span>
                  </div>
                  {stats.changeFundImpact !== 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Change Fund Impact</span>
                      <span className={`font-medium ${stats.changeFundImpact < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {stats.changeFundImpact < 0 ? '' : '+'}{formatCurrency(stats.changeFundImpact)}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="p-3 border-t bg-primary/5 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Final Net Revenue</span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(stats.totalNetRevenue)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Item Performance */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Item Performance Analysis</CardTitle>
                  <CardDescription>Detailed breakdown of all items sold</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <SortButton sortKey="count" label="Qty" />
                  <SortButton sortKey="totalValue" label="Value" />
                </div>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search items..." 
                  className="pl-10 h-9" 
                  value={itemSearchQuery} 
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 pr-4">
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
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatCurrency(item.totalValue / item.count)} avg
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground italic py-8">
                    {itemSearchQuery ? 'No items match your search.' : 'No items sold in this period.'}
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="mt-6 space-y-6">
          {/* Order Age Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="text-amber-500" />
                  Order Age Analysis
                </CardTitle>
                <CardDescription>Outstanding orders requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 pr-4">
                  {stats.orderAgeAnalysis.length > 0 ? (
                    <div className="space-y-3">
                      {stats.orderAgeAnalysis.map((order) => (
                        <div key={order.orderId} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{order.orderNumber}</p>
                              <p className="text-sm text-muted-foreground">{order.cashierName || 'Unknown Cashier'}</p>
                              <p className="text-xs text-muted-foreground">{order.daysOverdue} days overdue</p>
                            </div>
                            <div className="text-right">
                              <Badge 
                                variant={
                                  order.riskLevel === 'high' ? 'destructive' : 
                                  order.riskLevel === 'medium' ? 'default' : 'secondary'
                                }
                              >
                                {formatCurrency(order.amount)}
                              </Badge>
                              <p className="text-xs mt-1 capitalize">{order.riskLevel} risk</p>
                            </div>
                          </div>
                          <p className="text-xs text-blue-600 mt-2 italic">{order.recommendedAction}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>All orders are up to date!</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
              {stats.orderAgeAnalysis.length > 0 && (
                <CardFooter>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setIsOrderAgeModalOpen(true)}
                  >
                    View Full Analysis
                  </Button>
                </CardFooter>
              )}
            </Card>

            {/* Change Fund Health */}
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="bg-amber-50 dark:bg-amber-900/20">
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <Coins className="h-5 w-5" />
                  Change Fund Health
                </CardTitle>
                <CardDescription>Current status: {stats.changeFundHealth}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Fund Status:</span>
                    <Badge variant={
                      stats.changeFundHealth === 'healthy' ? 'default' :
                      stats.changeFundHealth === 'low' ? 'destructive' : 'secondary'
                    }>
                      {stats.changeFundHealth}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Weekly Impact:</span>
                    <span className={`font-medium ${stats.changeFundImpact < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(stats.changeFundImpact)}
                    </span>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setIsChangeFundModalOpen(true)}
                >
                  <History className="h-4 w-4 mr-2" />
                  View Change History
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Business KPIs */}
          <Card>
            <CardHeader>
              <CardTitle>Key Performance Indicators</CardTitle>
              <CardDescription>Critical business metrics for operational excellence</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-secondary rounded text-center">
                  <p className="text-sm text-muted-foreground">Avg Order Value</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(stats.totalOrders > 0 ? stats.totalSales / stats.totalOrders : 0)}
                  </p>
                </div>
                <div className="p-3 bg-secondary rounded text-center">
                  <p className="text-sm text-muted-foreground">Cash vs Digital</p>
                  <p className="text-xl font-bold">
                    {((stats.cashSales / (stats.cashSales + stats.momoSales || 1)) * 100).toFixed(0)}% Cash
                  </p>
                </div>
                <div className="p-3 bg-secondary rounded text-center">
                  <p className="text-sm text-muted-foreground">On-Time Payment</p>
                  <p className="text-xl font-bold">
                    {((stats.totalOrders - stats.overdueOrdersCount) / Math.max(stats.totalOrders, 1) * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="p-3 bg-secondary rounded text-center">
                  <p className="text-sm text-muted-foreground">Collection Rate</p>
                  <p className="text-xl font-bold">
                    {stats.previousDayCollections > 0 ? '95%' : '100%'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-6 space-y-6">
          {/* Reconciliation Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              icon={<TrendingUp className="text-green-500" />} 
              title="Total Surplus" 
              value={formatCurrency(stats.totalSurplus)}
              description="Positive variances"
              variant="success"
            />
            <StatCard 
              icon={<TrendingDown className="text-red-500" />} 
              title="Total Deficit" 
              value={formatCurrency(stats.totalDeficit)}
              description="Negative variances"
              variant="danger"
            />
            <StatCard 
              icon={<Calculator className="text-blue-500" />} 
              title="Net Variance" 
              value={formatCurrency(stats.totalVariance)}
              description="Overall accuracy"
              variant={Math.abs(stats.totalVariance) > 20 ? 'warning' : 'default'}
            />
            <StatCard 
              icon={<FileCheck className="text-purple-500" />} 
              title="Reports Generated" 
              value={stats.enhancedReports.length}
              description="Reconciliation reports"
              onClick={() => setIsReconciliationModalOpen(true)}
            />
          </div>

          {/* Daily Completion Status */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Accounting Completion</CardTitle>
              <CardDescription>Track which days have completed reconciliation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }, (_, i) => {
                  const day = new Date();
                  day.setDate(day.getDate() - (6 - i));
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const isIncomplete = stats.incompleteAccountingDays.includes(dayStr);
                  const isCurrentDay = isToday(day);
                  
                  return (
                    <div 
                      key={dayStr} 
                      className={cn(
                        "p-3 rounded-lg text-center text-sm",
                        isIncomplete ? "bg-red-100 border border-red-300 text-red-700" :
                        isCurrentDay ? "bg-blue-100 border border-blue-300 text-blue-700" :
                        "bg-green-100 border border-green-300 text-green-700"
                      )}
                    >
                      <p className="font-medium">{format(day, 'EEE')}</p>
                      <p className="text-xs">{format(day, 'MMM d')}</p>
                      <div className="mt-1">
                        {isIncomplete ? (
                          <AlertTriangle className="h-4 w-4 mx-auto" />
                        ) : isCurrentDay ? (
                          <Clock className="h-4 w-4 mx-auto" />
                        ) : (
                          <Check className="h-4 w-4 mx-auto" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {stats.incompleteAccountingDays.length > 0 && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Action Required</AlertTitle>
                  <AlertDescription>
                    {stats.incompleteAccountingDays.length} day(s) need reconciliation completion.
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="p-0 h-auto ml-2"
                      onClick={() => setIsIncompleteModalOpen(true)}
                    >
                      Review missing days →
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      
      {/* Order Age Analysis Modal */}
      <Dialog open={isOrderAgeModalOpen} onOpenChange={setIsOrderAgeModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="text-amber-500" />
              Detailed Order Age Analysis
            </DialogTitle>
            <DialogDescription>
              Complete breakdown of outstanding orders and recommended actions
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4">
            <div className="space-y-4 pr-4">
              {stats.orderAgeAnalysis.map((order) => (
                <Card key={order.orderId} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-lg">{order.orderNumber}</h4>
                      <p className="text-sm text-muted-foreground">
                        Cashier: {order.cashierName || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.daysOverdue} days overdue
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={
                          order.riskLevel === 'high' ? 'destructive' : 
                          order.riskLevel === 'medium' ? 'default' : 'secondary'
                        }
                        className="text-sm"
                      >
                        {formatCurrency(order.amount)}
                      </Badge>
                      <p className="text-xs mt-1 capitalize font-medium">
                        {order.riskLevel} risk
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      💡 Recommended Action
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      {order.recommendedAction}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Change Fund Modal */}
      <Dialog open={isChangeFundModalOpen} onOpenChange={setIsChangeFundModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="text-amber-500" />
              Change Fund Analysis
            </DialogTitle>
            <DialogDescription>
              Impact of change fund management on revenue calculations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                  Weekly Change Activity
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Generated:</span>
                    <span className="font-medium">+{formatCurrency(85.50)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Settled:</span>
                    <span className="font-medium">-{formatCurrency(62.00)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Set Aside:</span>
                    <span className="font-medium">{formatCurrency(78.00)}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded">
                <h4 className="font-semibold text-amber-700 dark:text-amber-300 mb-2">
                  Revenue Impact
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Net Impact:</span>
                    <span className={`font-medium ${stats.changeFundImpact < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(stats.changeFundImpact)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {stats.changeFundImpact < 0 ? 
                      'Change not set aside reduces net revenue' : 
                      'Change properly managed, no negative impact'
                    }
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-secondary rounded">
              <h4 className="font-semibold mb-3">Recent Change Transactions</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span>Order ORD-089 overpayment</span>
                  <Badge variant="default">+{formatCurrency(7.50)}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Change settled for ORD-082</span>
                  <Badge variant="outline">-{formatCurrency(4.00)}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Used for Order ORD-091</span>
                  <Badge variant="outline">-{formatCurrency(12.50)}</Badge>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Reconciliation Modal */}
      <Dialog open={isReconciliationModalOpen} onOpenChange={setIsReconciliationModalOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Enhanced Reconciliation Reports</DialogTitle>
            <DialogDescription>
              Detailed reconciliation reports from daily accounting
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] mt-4">
            <div className="space-y-4 pr-4">
              {stats.enhancedReports.map((report) => (
                <Card key={report.id} className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-semibold text-lg">
                        {format(new Date(report.period), 'EEEE, MMMM dd, yyyy')}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Reconciled by {report.cashierName}
                      </p>
                    </div>
                    <Badge 
                      variant={report.totalDiscrepancy > 0 ? 'default' : report.totalDiscrepancy < 0 ? 'destructive' : 'secondary'}
                      className="text-lg px-3 py-1"
                    >
                      {report.totalDiscrepancy > 0 ? '+' : ''}{formatCurrency(report.totalDiscrepancy)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <h5 className="font-medium text-green-600">Cash Analysis</h5>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>Expected:</span>
                          <span>{formatCurrency(report.expectedCash)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Counted:</span>
                          <span>{formatCurrency(report.countedCash)}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Variance:</span>
                          <span className={report.countedCash - report.expectedCash >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {report.countedCash - report.expectedCash >= 0 ? '+' : ''}{formatCurrency(report.countedCash - report.expectedCash)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h5 className="font-medium text-purple-600">MoMo Analysis</h5>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>Expected:</span>
                          <span>{formatCurrency(report.expectedMomo)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Counted:</span>
                          <span>{formatCurrency(report.countedMomo)}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Variance:</span>
                          <span className={report.countedMomo - report.expectedMomo >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {report.countedMomo - report.expectedMomo >= 0 ? '+' : ''}{formatCurrency(report.countedMomo - report.expectedMomo)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {report.notes && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                        📝 Reconciler Notes
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        {report.notes}
                      </p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Incomplete Accounting Days Modal */}
      <Dialog open={isIncompleteModalOpen} onOpenChange={setIsIncompleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-red-500" />
              Incomplete Accounting Days
            </DialogTitle>
            <DialogDescription>
              These days are missing end-of-day reconciliation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {stats.incompleteAccountingDays.map((day) => (
              <div key={day} className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200">
                <div>
                  <p className="font-medium text-red-700 dark:text-red-300">
                    {format(new Date(day), 'EEEE, MMMM dd, yyyy')}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {differenceInDays(new Date(), new Date(day))} days ago
                  </p>
                </div>
                <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-100">
                  Complete Now
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200">
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mb-2">
              ⚠️ Impact on Analytics
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Missing reconciliation data may affect the accuracy of revenue calculations and variance analysis. 
              Complete these reconciliations as soon as possible for accurate business insights.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Analysis Modal */}
      <Dialog open={isAnalysisModalOpen} onOpenChange={setIsAnalysisModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="text-primary h-5 w-5" />
              AI Business Performance Analysis
            </DialogTitle>
            <DialogDescription>
              An AI-generated report on your business performance for the selected period.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4">
            <div className="p-4 prose dark:prose-invert max-w-none">
              {isGeneratingAnalysis ? (
                <div className="flex flex-col items-center justify-center h-48">
                  <LoadingSpinner />
                  <p className="mt-4 text-muted-foreground">Generating your report...</p>
                </div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-content">
                  {analysisContent}
                </ReactMarkdown>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* AI Business Assistant */}
      <Sheet open={isChatSheetOpen} onOpenChange={setIsChatSheetOpen}>
        <SheetTrigger asChild>
          <Button className="fixed bottom-6 right-6 h-16 w-16 rounded-full z-20 shadow-lg">
            <Sparkles className="h-8 w-8" />
          </Button>
        </SheetTrigger>
        <SheetContent 
          side="right" 
          className="w-full sm:w-[500px] flex flex-col p-0"
        >
          <SheetHeader className="p-4 border-b flex flex-row items-center justify-between flex-shrink-0">
            <div>
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {isHistoryView ? 'Chat History' : 'AI Business Assistant'}
              </SheetTitle>
              <SheetDescription>
                {isHistoryView ? 'Select a chat or start a new one.' : 'Get insights about your business performance'}
              </SheetDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setIsHistoryView(!isHistoryView)}>
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => {
                setActiveChatSessionId(null);
                setChatHistory([]);
                setIsHistoryView(false);
              }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>
          <div className="flex-grow overflow-y-auto">
            {isHistoryView ? (
              <div className="p-4">
                <div className="space-y-2">
                  <div className="p-3 rounded-lg cursor-pointer hover:bg-secondary">
                    <p className="font-semibold">Weekly Performance Review</p>
                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                  </div>
                  <div className="p-3 rounded-lg cursor-pointer hover:bg-secondary">
                    <p className="font-semibold">Change Fund Analysis</p>
                    <p className="text-xs text-muted-foreground">Yesterday</p>
                  </div>
                  <div className="p-3 rounded-lg cursor-pointer hover:bg-secondary">
                    <p className="font-semibold">Item Performance Questions</p>
                    <p className="text-xs text-muted-foreground">3 days ago</p>
                  </div>
                </div>
              </div>
            ) : (
              renderChatContent()
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default DashboardView;