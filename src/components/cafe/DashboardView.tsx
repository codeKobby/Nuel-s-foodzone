
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, setDoc, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense, ReconciliationReport, ChatSession } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { DollarSign, ShoppingBag, TrendingUp, TrendingDown, AlertCircle, Sparkles, User, Bot, Send, Calendar as CalendarIcon, FileWarning, Activity, UserCheck, MessageSquare, Plus, Trash2 } from 'lucide-react';
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
import { type BusinessChatInput } from '@/ai/schemas';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useIsMobile } from '@/hooks/use-mobile';


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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState<DateRange | undefined>({ from: addDays(new Date(), -6), to: new Date() });
    
    // AI Chat State
    const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isAiReplying, setIsAiReplying] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [isChatSheetOpen, setIsChatSheetOpen] = useState(false);
    const [isHistoryView, setIsHistoryView] = useState(false);
    const isMobile = useIsMobile();


    useEffect(() => {
        fetchDashboardData();
    }, [date]);
    
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


    const fetchDashboardData = async () => {
        if (!date?.from || !date?.to) return;
        setLoading(true);
        setError(null);
        setStats(null);
        
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
                messages: [newUserMessage]
            });
            sessionId = newSessionRef.id;
            setActiveChatSessionId(sessionId);
        }

        try {
            const input: BusinessChatInput = {
                history: newHistory.slice(0, -1),
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

    const topItems = useMemo(() => stats?.itemPerformance.slice(0, 5) || [], [stats]);
    const bottomItems = useMemo(() => stats && stats.itemPerformance.length > 5 ? stats.itemPerformance.slice(-5).reverse() : [], [stats]);
    
    const renderChatContent = () => (
         <div className="h-full flex flex-col">
            <ScrollArea className="flex-grow p-4" ref={chatContainerRef}>
                <div className="space-y-4">
                    {chatHistory.map((message, index) => (
                        <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                            {message.role === 'model' && (
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback><Bot /></AvatarFallback>
                                </Avatar>
                            )}
                            <div className={`rounded-lg px-4 py-2 max-w-sm ${message.role === 'model' ? 'bg-secondary markdown-content' : 'bg-primary text-primary-foreground'}`}>
                                {message.role === 'model' ? (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {message.content}
                                    </ReactMarkdown>
                                ) : (
                                    message.content
                                )}
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
            <div className="mt-auto p-4 border-t flex gap-2">
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
                        <div key={session.id} onClick={() => selectChat(session.id)}
                            className={cn(
                                "p-3 rounded-lg cursor-pointer hover:bg-secondary",
                                activeChatSessionId === session.id && "bg-secondary"
                            )}>
                            <p className="font-semibold truncate">{session.title}</p>
                            <p className="text-xs text-muted-foreground">{formatTimestamp(session.timestamp)}</p>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );

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
            
            <Sheet open={isChatSheetOpen} onOpenChange={setIsChatSheetOpen}>
                <SheetTrigger asChild>
                     <Button className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-lg z-20">
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
                    <SheetHeader className="p-4 border-b flex flex-row items-center justify-between">
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
                   {isHistoryView ? renderHistoryContent() : renderChatContent()}
                </SheetContent>
            </Sheet>

        </div>
    );
};

export default DashboardView;

    
