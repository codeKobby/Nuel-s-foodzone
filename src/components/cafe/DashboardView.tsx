
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, setDoc, addDoc, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense, ReconciliationReport, ChatSession, AnalyzeBusinessOutput } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { DollarSign, ShoppingBag, TrendingUp, TrendingDown, AlertCircle, Sparkles, User, Bot, Send, Calendar as CalendarIcon, FileWarning, Activity, UserCheck, MessageSquare, Plus, Trash2, FileCheck, Check, Briefcase, Search } from 'lucide-react';
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
import { ScrollArea } from '../ui/scroll-area';
import { businessChat } from '@/ai/flows/business-chat-flow';
import { analyzeBusiness } from '@/ai/flows/analyze-business-flow';
import { type BusinessChatInput, type AnalyzeBusinessInput } from '@/ai/schemas';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '../ui/badge';


interface DashboardStats {
    totalSales: number;
    totalOrders: number;
    totalMiscExpenses: number;
    netSales: number;
    unpaidOrdersValue: number;
    cashDiscrepancy: number; // sum of deficits and surpluses
    salesData: { date: string; sales: number }[];
    itemPerformance: { name: string; count: number; totalValue: number }[];
}

interface ChatMessage {
    role: 'user' | 'model';
    content: string;
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
    const [miscExpenses, setMiscExpenses] = useState<MiscExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState<DateRange | undefined>({ from: addDays(new Date(), -6), to: new Date() });
    
    // AI Features State
    const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isAiReplying, setIsAiReplying] = useState(false);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalyzeBusinessOutput | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [isChatSheetOpen, setIsChatSheetOpen] = useState(false);
    const [isHistoryView, setIsHistoryView] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
    const isMobile = useIsMobile();
    const [itemSearchQuery, setItemSearchQuery] = useState('');


    const fetchDashboardData = useCallback(async () => {
        if (!date?.from) return;
        setLoading(true);
        setError(null);
        setStats(null);
        setAnalysisResult(null);
        
        try {
            const startDate = new Date(date.from);
            startDate.setHours(0, 0, 0, 0);
            const endDate = date.to ? new Date(date.to) : new Date(date.from);
            endDate.setHours(23, 59, 59, 999);

            const startDateTimestamp = Timestamp.fromDate(startDate);
            const endDateTimestamp = Timestamp.fromDate(endDate);

            const ordersRef = collection(db, "orders");
            const ordersQuery = query(ordersRef, where("timestamp", ">=", startDateTimestamp), where("timestamp", "<=", endDateTimestamp));
            
            const reconciliationReportsRef = collection(db, "reconciliationReports");
            const reportsQuery = query(reconciliationReportsRef, where("timestamp", ">=", startDateTimestamp), where("timestamp", "<=", endDateTimestamp));

            const [ordersSnapshot, reportsSnapshot] = await Promise.all([
                getDocs(ordersQuery),
                getDocs(reportsQuery),
            ]);

            // Process Orders
            let cashSales = 0, momoSales = 0, unpaidOrdersValue = 0, totalOrders = 0;
            const itemStats: Record<string, { count: number; totalValue: number }> = {};
            const salesByDay: Record<string, number> = {};
            
            const sortedDocs = ordersSnapshot.docs.sort((a, b) => a.data().timestamp.toMillis() - b.data().timestamp.toMillis());


            sortedDocs.forEach(doc => {
                const order = doc.data() as Order;
                totalOrders++;

                if (order.paymentStatus === 'Unpaid' || order.paymentStatus === 'Partially Paid') {
                    unpaidOrdersValue += order.balanceDue;
                }
                if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Paid') {
                    if (order.paymentMethod === 'cash') cashSales += order.amountPaid;
                    if (order.paymentMethod === 'momo') momoSales += order.amountPaid;
                }
                
                order.items.forEach(item => {
                    const currentStats = itemStats[item.name] || { count: 0, totalValue: 0 };
                    itemStats[item.name] = {
                        count: currentStats.count + item.quantity,
                        totalValue: currentStats.totalValue + (item.quantity * item.price)
                    };
                });

                if (order.timestamp) {
                    const orderDate = order.timestamp.toDate();
                    const dayKey = format(orderDate, 'MMM d');
                    if(order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Paid') {
                        salesByDay[dayKey] = (salesByDay[dayKey] || 0) + order.amountPaid;
                    }
                }
            });
            
            // Process Reconciliation Reports
            let cashDiscrepancy = 0;
            reportsSnapshot.forEach(doc => {
                const report = doc.data() as ReconciliationReport;
                cashDiscrepancy += report.cashDifference;
            });

            // Get total settled misc expenses from the dedicated listener
            const totalMiscExpenses = miscExpenses.filter(e => e.settled).reduce((sum, e) => sum + e.amount, 0);

            const totalSales = cashSales + momoSales;
            const netSales = totalSales - totalMiscExpenses;
            const salesData = Object.entries(salesByDay).map(([date, sales]) => ({ date, sales }));
            const itemPerformance = Object.entries(itemStats)
                .map(([name, data]) => ({name, ...data}))
                .sort((a, b) => b.count - a.count);


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
    }, [date, miscExpenses]);
    
     useEffect(() => {
        // Listener for all miscellaneous expenses
        const miscExpensesRef = collection(db, "miscExpenses");
        const q = query(miscExpensesRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMiscExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MiscExpense)));
        }, (err) => {
            console.error(err);
            setError("Failed to load miscellaneous expenses.");
        });

        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);
    
     useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    useEffect(() => {
        const q = query(collection(db, "chatSessions"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setChatSessions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatSession)));
        });
        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        if (activeChatSessionId) {
            const session = chatSessions.find(s => s.id === activeChatSessionId);
            setChatHistory(session?.messages || []);
        } else {
            setChatHistory([]);
        }
    }, [activeChatSessionId, chatSessions]);

    const handleRunAnalysis = async () => {
        if (!stats || !date?.from) return;
        setIsAnalysisLoading(true);
        setAnalysisResult(null);
        try {
            const period = `From ${format(date.from, "PPP")} to ${format(date.to || date.from, "PPP")}`;
            const input: AnalyzeBusinessInput = {
                period,
                totalSales: stats.totalSales,
                netSales: stats.netSales,
                totalOrders: stats.totalOrders,
                itemPerformance: stats.itemPerformance.slice(0, 10), // Send top 10 items
                cashDiscrepancy: stats.cashDiscrepancy,
            };
            const result = await analyzeBusiness(input);
            setAnalysisResult(result);
        } catch(e) {
            console.error(e);
            setError("Failed to run the AI analysis.");
        } finally {
            setIsAnalysisLoading(false);
        }
    }

    const handleSettleExpense = async (expenseId: string) => {
        try {
            const expenseRef = doc(db, "miscExpenses", expenseId);
            await updateDoc(expenseRef, { settled: true });
        } catch (e) {
            console.error("Error settling expense:", e);
            setError("Failed to settle the expense.");
        }
    };
    
    const handleSendMessage = async () => {
        if (!chatInput.trim() || isAiReplying) return;

        const newUserMessage: ChatMessage = { role: 'user', content: chatInput };
        const newHistory = [...chatHistory, newUserMessage];
        setChatHistory(newHistory);
        const currentInput = chatInput;
        setChatInput('');
        setIsAiReplying(true);

        let sessionId = activeChatSessionId;

        // Create a new session if one doesn't exist
        if (!sessionId) {
            const newSessionRef = await addDoc(collection(db, "chatSessions"), {
                title: currentInput.substring(0, 40),
                timestamp: Timestamp.now(),
                messages: newHistory.slice(0, -1), // Save history up to the user message
            });
            sessionId = newSessionRef.id;
            setActiveChatSessionId(sessionId);
        }

        try {
            const input: BusinessChatInput = {
                history: newHistory.slice(0, -1), // Pass previous messages for context
                prompt: currentInput,
            };
            const response = await businessChat(input);
            const newModelMessage: ChatMessage = { role: 'model', content: response };
            
            // Save the full exchange to Firestore
            const sessionRef = doc(db, "chatSessions", sessionId!);
            await setDoc(sessionRef, { messages: [...newHistory, newModelMessage] }, { merge: true });

        } catch (e) {
            console.error("Error with AI chat:", e);
            const errorMessage: ChatMessage = { role: 'model', content: "Sorry, I encountered an error. Please try again." };
            setChatHistory(prev => [...prev, errorMessage]);
        } finally {
            setIsAiReplying(false);
        }
    };
    
    const startNewChat = () => {
        setActiveChatSessionId(null);
        setChatHistory([]);
        setIsHistoryView(false);
    }
    
    const selectChat = (sessionId: string) => {
        setActiveChatSessionId(sessionId);
        setIsHistoryView(false);
    }

    const handleDeleteSession = async (sessionId: string) => {
        if (!sessionId) return;
        try {
            await deleteDoc(doc(db, "chatSessions", sessionId));
            if (activeChatSessionId === sessionId) {
                startNewChat();
            }
            setSessionToDelete(null); // Close the dialog
        } catch (e) {
            console.error("Error deleting chat session:", e);
        }
    };

    const topItems = useMemo(() => stats?.itemPerformance.slice(0, 5) || [], [stats]);
    const bottomItems = useMemo(() => stats && stats.itemPerformance.length > 5 ? stats.itemPerformance.slice(-5).reverse() : [], [stats]);
    
    const filteredItemSales = useMemo(() => {
        if (!stats) return [];
        if (!itemSearchQuery) return stats.itemPerformance;
        return stats.itemPerformance.filter(item => item.name.toLowerCase().includes(itemSearchQuery.toLowerCase()));
    }, [stats, itemSearchQuery]);


    const renderChatContent = () => (
         <div className="flex-grow flex flex-col overflow-hidden h-full">
            <ScrollArea className="flex-grow p-4" ref={chatContainerRef}>
                <div className="space-y-4">
                    {chatHistory.map((message, index) => (
                        <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                            {message.role === 'model' && (
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback><Bot /></AvatarFallback>
                                </Avatar>
                            )}
                            <div className={`rounded-lg px-4 py-2 max-w-sm ${message.role === 'model' ? 'bg-secondary' : 'bg-primary text-primary-foreground'}`}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-content">
                                    {message.content}
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
                    {chatHistory.length === 0 && !isAiReplying && (
                        <div className="text-center text-muted-foreground pt-16">
                            <p>Ask a question to get started, like:</p>
                            <p className="italic font-medium">"What were our sales yesterday?"</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
            <div className="flex-shrink-0 p-4 border-t bg-background flex gap-2">
                <Input
                    placeholder="Type your question..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={isAiReplying}
                    className="h-12"
                />
                <Button onClick={handleSendMessage} disabled={isAiReplying || !chatInput} className="h-12">
                    <Send />
                </Button>
            </div>
        </div>
    );
    
     const renderHistoryContent = () => (
        <div className="h-full flex flex-col">
            <ScrollArea className="flex-grow p-2">
                <div className="space-y-2">
                    {chatSessions.map(session => (
                        <div 
                            key={session.id} 
                            onClick={() => selectChat(session.id)}
                            className={cn(
                                "p-3 rounded-lg cursor-pointer hover:bg-secondary group flex justify-between items-center",
                                activeChatSessionId === session.id && "bg-secondary"
                            )}>
                            <div>
                                <p className="font-semibold truncate">{session.title}</p>
                                <p className="text-xs text-muted-foreground">{formatTimestamp(session.timestamp)}</p>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSessionToDelete(session);
                                }}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );

    return (
        <div className="p-4 md:p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                 <div className="flex flex-col">
                    <h2 className="text-2xl md:text-3xl font-bold">Dashboard</h2>
                    <p className="text-sm text-muted-foreground">High-level overview of business performance.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn("w-full sm:w-[260px] justify-start text-left font-normal", !date && "text-muted-foreground")}
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
                            numberOfMonths={isMobile ? 1 : 2}
                        />
                        </PopoverContent>
                    </Popover>
                     <Button onClick={handleRunAnalysis} disabled={!stats || isAnalysisLoading} className="w-full sm:w-auto">
                        <FileCheck className="mr-2 h-4 w-4"/>
                        {isAnalysisLoading ? "Analyzing..." : "Analyze"}
                    </Button>
                </div>
            </div>
            {loading ? <div className="mt-8"><LoadingSpinner/></div> : error ? <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : !stats ?  <div className="text-center py-10 text-muted-foreground">Select a date range to view data.</div> : (
            <>
                 {isAnalysisLoading && <div className="flex items-center justify-center my-4 p-4 rounded-lg bg-card border"><LoadingSpinner /><p className="ml-2">AI is analyzing your data...</p></div>}
                
                {analysisResult && (
                    <Dialog open onOpenChange={() => setAnalysisResult(null)}>
                        <DialogContent className="max-w-2xl">
                             <DialogHeader>
                                <DialogTitle className="flex items-center text-2xl"><Sparkles className="mr-3 text-primary" /> AI Performance Analysis</DialogTitle>
                                <DialogDescription>
                                    Analysis for the period: {date?.from && format(date.from, "PPP")} - {date?.to && format(date.to, "PPP")}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="max-h-[60vh] overflow-y-auto p-1">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-content space-y-4">
                                   {`### Analysis\n${analysisResult.analysis}\n\n### Suggestions\n${analysisResult.suggestions}`}
                                </ReactMarkdown>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
                    <StatCard icon={<DollarSign className="text-green-500"/>} title="Net Sales" value={formatCurrency(stats.netSales)} description={`${formatCurrency(stats.totalSales)} (Paid) - ${formatCurrency(stats.totalMiscExpenses)} (Expenses)`}/>
                    <StatCard icon={<ShoppingBag className="text-blue-500"/>} title="Total Orders" value={stats.totalOrders} />
                    <StatCard icon={<FileWarning className={stats.cashDiscrepancy === 0 ? "text-muted-foreground" : "text-amber-500"}/>} title="Cash Discrepancy" value={formatCurrency(stats.cashDiscrepancy)} description="Sum of cash surplus/deficit" />
                    <StatCard icon={<AlertCircle className={stats.unpaidOrdersValue === 0 ? "text-muted-foreground" : "text-red-500"}/>} title="Unpaid Orders" value={formatCurrency(stats.unpaidOrdersValue)} description="Total outstanding balance"/>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <Card className="lg:col-span-3">
                        <CardHeader>
                            <CardTitle>Sales Trend</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="h-[250px] md:h-[300px] w-full">
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
                           <ScrollArea className="h-[250px] md:h-[300px] pr-4">
                                <div className="space-y-4">
                                <div>
                                    <h4 className="font-semibold text-green-600 mb-2 flex items-center"><TrendingUp className="mr-2" /> Top 5 Items</h4>
                                     <ul className="space-y-2">{topItems.length > 0 ? topItems.map(item => (<li key={item.name} className="flex justify-between items-center p-2 bg-secondary rounded-md text-sm"><span className="font-medium">{item.name}</span><Badge variant="default">{item.count} sold</Badge></li>)) : <p className="text-xs text-muted-foreground italic">No items sold.</p>}</ul>
                                </div>
                                {bottomItems.length > 0 && <div>
                                     <h4 className="font-semibold text-red-600 mb-2 flex items-center"><TrendingDown className="mr-2" /> Bottom 5 Items</h4>
                                     <ul className="space-y-2">{bottomItems.map(item => (<li key={item.name} className="flex justify-between items-center p-2 bg-secondary rounded-md text-sm"><span className="font-medium">{item.name}</span><Badge variant="secondary">{item.count} sold</Badge></li>))}</ul>
                                </div>}
                                </div>
                           </ScrollArea>
                        </CardContent>
                    </Card>
                    <Card className="lg:col-span-3">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>Complete Item Sales List</CardTitle>
                                    <CardDescription>All items sold in the period.</CardDescription>
                                </div>
                                <div className="relative w-48">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Search items..." 
                                        className="pl-10 h-9" 
                                        value={itemSearchQuery} 
                                        onChange={(e) => setItemSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <ScrollArea className="h-64 pr-4">
                                {filteredItemSales.length > 0 ? (
                                    <div className="space-y-3">
                                        {filteredItemSales.map((item, index) => (
                                            <div key={item.name + index} className="flex justify-between items-center text-sm p-2 bg-secondary rounded-md">
                                                <div>
                                                    <p className="font-medium">{item.name}</p>
                                                    <p className="text-xs text-muted-foreground">{item.count} sold</p>
                                                </div>
                                                <Badge variant="outline">{formatCurrency(item.totalValue)}</Badge>
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
                     <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center"><Briefcase className="mr-2"/> Unsettled Expenses</CardTitle>
                            <CardDescription>Review and settle expenses.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-64 pr-4">
                                <div className="space-y-2">
                                    {miscExpenses.filter(e => !e.settled).length > 0 ? (
                                        miscExpenses.filter(e => !e.settled).map(expense => (
                                            <div key={expense.id} className="flex justify-between items-center p-3 bg-secondary rounded-md">
                                                <div>
                                                    <p className="font-semibold">{expense.purpose}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {formatCurrency(expense.amount)} - <span className="text-xs">{formatTimestamp(expense.timestamp)}</span>
                                                    </p>
                                                </div>
                                                <Button size="sm" variant="outline" onClick={() => handleSettleExpense(expense.id)}>
                                                    <Check className="mr-2 h-4 w-4" /> Settle
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center text-muted-foreground italic py-8">No unsettled expenses.</p>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </>
            )}
            
            <Sheet open={isChatSheetOpen} onOpenChange={setIsChatSheetOpen}>
                <SheetTrigger asChild>
                     <Button className="fixed bottom-6 right-6 h-16 w-16 rounded-full z-20 shadow-lg">
                        <Sparkles className="h-8 w-8" />
                    </Button>
                </SheetTrigger>
                <SheetContent 
                    side={isMobile ? 'bottom' : 'right'} 
                    className={cn(
                        isMobile ? 'h-[85vh]' : 'h-full',
                        'flex flex-col p-0'
                    )}
                >
                    <SheetHeader className="p-4 border-b flex flex-row items-center justify-between flex-shrink-0">
                       <div>
                            <SheetTitle>{isHistoryView ? 'Chat History' : 'AI Business Assistant'}</SheetTitle>
                            <SheetDescription>{isHistoryView ? 'Select a chat or start a new one.' : 'Ask me anything about your business.'}</SheetDescription>
                        </div>
                        <div className="flex gap-2">
                             <Button variant="outline" size="icon" onClick={() => setIsHistoryView(!isHistoryView)}>
                                <MessageSquare />
                             </Button>
                             <Button variant="outline" size="icon" onClick={startNewChat}>
                                <Plus />
                            </Button>
                        </div>
                    </SheetHeader>
                   <div className="flex-grow overflow-y-auto">
                    {isHistoryView ? renderHistoryContent() : renderChatContent()}
                   </div>
                </SheetContent>
            </Sheet>

            {sessionToDelete && (
                <AlertDialog open onOpenChange={() => setSessionToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Chat Session?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete the chat titled "{sessionToDelete.title}"? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSession(sessionToDelete.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

        </div>
    );
};

export default DashboardView;

    