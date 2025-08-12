

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, addDoc, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense, ReconciliationReport } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { DollarSign, CreditCard, MinusCircle, History, Landmark, Coins, AlertCircle, Search, Package, Calendar as CalendarIcon, FileCheck, Hourglass, ShoppingCart, Lock, X } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AdvancedReconciliationModal from './modals/AdvancedReconciliationModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRange } from "react-day-picker"
import { addDays, format, isToday } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';


interface PeriodStats {
    totalSales: number;
    cashSales: number;
    momoSales: number;
    miscCashExpenses: number;
    miscMomoExpenses: number;
    expectedCash: number;
    expectedMomo: number;
    totalExpectedRevenue: number;
    netRevenue: number;
    unpaidOrdersValue: number;
    orders: Order[];
    itemStats: Record<string, { count: number; totalValue: number }>;
}

const StatCard: React.FC<{ icon: React.ReactNode, title: string, value: string | number, color?: string, description?: string }> = ({ icon, title, value, color, description }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className={`text-xl md:text-2xl font-bold ${color}`}>{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const cashDenominations = [200, 100, 50, 20, 10, 5, 2, 1];
const initialDenominations: Record<string, string> = cashDenominations.reduce((acc, val) => ({ ...acc, [val]: '' }), {});

const AccountingView: React.FC<{setActiveView: (view: string) => void}> = ({setActiveView}) => {
    const [stats, setStats] = useState<PeriodStats | null>(null);
    const [notes, setNotes] = useState('');
    const [reports, setReports] = useState<ReconciliationReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isCloseOutOpen, setIsCloseOutOpen] = useState(false);
    const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
    const [showUnpaidOrdersWarning, setShowUnpaidOrdersWarning] = useState(false);
    const [date, setDate] = useState<DateRange | undefined>({ from: new Date(), to: new Date() });
    const isMobile = useIsMobile();
    
    // State for denomination-based counting
    const [denominationQuantities, setDenominationQuantities] = useState(initialDenominations);
    
    // State for MoMo pill input
    const [momoTransactions, setMomoTransactions] = useState<number[]>([]);
    const [momoInput, setMomoInput] = useState('');


    const isTodayClosedOut = useMemo(() => {
        return reports.some(report => isToday(report.timestamp.toDate()));
    }, [reports]);

    const totalCountedCash = useMemo(() => {
        return cashDenominations.reduce((total, den) => {
            const quantity = parseInt(denominationQuantities[den], 10) || 0;
            return total + (den * quantity);
        }, 0);
    }, [denominationQuantities]);
    
    const totalCountedMomo = useMemo(() => {
        return momoTransactions.reduce((total, amount) => total + amount, 0);
    }, [momoTransactions]);

    const totalCountedRevenue = useMemo(() => totalCountedCash + totalCountedMomo, [totalCountedCash, totalCountedMomo]);
    const totalDiscrepancy = useMemo(() => totalCountedRevenue - (stats?.totalExpectedRevenue || 0), [totalCountedRevenue, stats]);
    
    const handleDenominationChange = (value: string, denomination: string) => {
        setDenominationQuantities(prev => ({ ...prev, [denomination]: value }));
    };

    const handleMomoInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if ((e.key === 'Enter' || e.key === ' ') && momoInput.trim() !== '') {
            e.preventDefault();
            const amount = parseFloat(momoInput);
            if (!isNaN(amount) && amount > 0) {
                setMomoTransactions([...momoTransactions, amount]);
                setMomoInput('');
            }
        }
    };
    
    const removeMomoTransaction = (indexToRemove: number) => {
        setMomoTransactions(momoTransactions.filter((_, index) => index !== indexToRemove));
    };


    const fetchPeriodData = useCallback(async () => {
        if (!date?.from) return;
        setLoading(true);
        setError(null);
        setStats(null);
        
        try {
            const startDate = new Date(date.from);
            startDate.setHours(0, 0, 0, 0);
            const endDate = date.to ? new Date(date.to) : new Date(date.from);
            endDate.setHours(23, 59, 59, 999);

            const startDateTimestamp = Timestamp.fromDate(startDate);
            const endDateTimestamp = Timestamp.fromDate(endDate);

            // Fetch all orders and misc expenses for the period
            const allOrdersQuery = query(collection(db, "orders"));
            const miscQuery = query(collection(db, "miscExpenses"), where("timestamp", ">=", startDateTimestamp), where("timestamp", "<=", endDateTimestamp));
            const allUnpaidOrdersQuery = query(collection(db, "orders"), where("paymentStatus", "in", ["Unpaid", "Partially Paid"]));

            
            const [allOrdersSnapshot, miscSnapshot, allUnpaidOrdersSnapshot] = await Promise.all([
                getDocs(allOrdersQuery),
                getDocs(miscQuery),
                getDocs(allUnpaidOrdersQuery)
            ]);

            let cashSales = 0, momoSales = 0, totalSalesToday = 0;
            const periodOrders: Order[] = [];
            const itemStats: Record<string, { count: number; totalValue: number }> = {};
            let unpaidOrdersValue = 0;

            allUnpaidOrdersSnapshot.docs.forEach(doc => {
                 const order = { id: doc.id, ...doc.data() } as Order;
                unpaidOrdersValue += order.balanceDue;
            });
            
            allOrdersSnapshot.docs.forEach(doc => {
                const order = { id: doc.id, ...doc.data() } as Order;
                
                const orderDate = order.timestamp.toDate();
                if (orderDate >= startDate && orderDate <= endDate) {
                    periodOrders.push(order);
                }

                // Add to total sales and item performance only if completed within the period
                if (order.status === 'Completed' && orderDate >= startDate && orderDate <= endDate) {
                    totalSalesToday += order.total;
                    order.items.forEach(item => {
                        const currentStats = itemStats[item.name] || { count: 0, totalValue: 0 };
                        itemStats[item.name] = {
                            count: currentStats.count + item.quantity,
                            totalValue: currentStats.totalValue + (item.quantity * item.price)
                        };
                    });
                }
                
                // Add to revenue if a payment was made within the period
                const paymentDate = order.lastPaymentTimestamp ? order.lastPaymentTimestamp.toDate() : orderDate;
                if (paymentDate >= startDate && paymentDate <= endDate) {
                    if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Paid') {
                         const paidAmount = order.lastPaymentAmount ?? order.amountPaid;
                        if (order.paymentMethod === 'cash') cashSales += paidAmount;
                        if (order.paymentMethod === 'momo') momoSales += paidAmount;
                    }
                }
            });


            let miscCashExpenses = 0, miscMomoExpenses = 0;
            miscSnapshot.forEach(doc => {
                const expense = doc.data() as MiscExpense;
                if (expense.source === 'cash') {
                    miscCashExpenses += expense.amount;
                } else {
                    miscMomoExpenses += expense.amount;
                }
            });
            
            const totalSales = totalSalesToday;
            const netRevenue = (cashSales + momoSales) - (miscCashExpenses + miscMomoExpenses);
            const expectedCash = cashSales - miscCashExpenses;
            const expectedMomo = momoSales - miscMomoExpenses;
            const totalExpectedRevenue = expectedCash + expectedMomo;
            
            setStats({ totalSales, cashSales, momoSales, miscCashExpenses, miscMomoExpenses, expectedCash, expectedMomo, totalExpectedRevenue, netRevenue, unpaidOrdersValue, orders: periodOrders, itemStats });
        } catch (e) {
            console.error(e);
            setError("Failed to load financial data for the selected period.");
        } finally {
            setLoading(false);
        }
    }, [date]);
    
    useEffect(() => {
        fetchPeriodData();
    }, [fetchPeriodData]);
    
    useEffect(() => {
        const reportsRef = collection(db, "reconciliationReports");
        const q = query(reportsRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReconciliationReport)));
        }, (err) => {
            console.error(err);
            setError("Failed to load past reports.");
        });

        return () => unsubscribe();
    }, []);
    
    const resetForm = () => {
        setDenominationQuantities(initialDenominations);
        setMomoTransactions([]);
        setMomoInput('');
        setNotes('');
    }

    const handleSaveReport = async () => {
        if (!stats) {
            setError("No financial data loaded to create a report.");
            return;
        }
        if (totalCountedCash <= 0 && totalCountedMomo <= 0) {
            setError("Please count either cash or Momo/Card before submitting.");
            return;
        }
        setError(null);
        setIsSubmitting(true);
        try {
            const reportData: Omit<ReconciliationReport, 'id'> = {
                timestamp: serverTimestamp(),
                period: new Date().toDateString(),
                totalSales: stats.totalSales,
                
                expectedCash: stats.expectedCash,
                expectedMomo: stats.expectedMomo,
                totalExpectedRevenue: stats.totalExpectedRevenue,
                
                countedCash: totalCountedCash,
                countedMomo: totalCountedMomo,
                totalCountedRevenue: totalCountedRevenue,

                totalDiscrepancy: totalDiscrepancy,
                notes: notes,
            };
            await addDoc(collection(db, "reconciliationReports"), reportData);
            
            resetForm();
            setIsCloseOutOpen(false);
            fetchPeriodData(); // Refetch data to prevent stale state error

        } catch (e) {
            console.error(e);
            setError("Failed to save the report.");
        } finally {
            setIsSubmitting(false);
            setShowConfirm(false);
        }
    };
    
    const renderDifferenceBadge = (diff: number, className: string = "") => {
        if (diff === 0) return <Badge variant="default" className={`bg-green-500 hover:bg-green-500 text-base ${className}`}>Balanced</Badge>;
        
        const isSurplus = diff > 0;
        const colorClass = isSurplus ? 'bg-blue-500 hover:bg-blue-500' : 'bg-red-500 hover:bg-red-500';
        const text = isSurplus ? `Surplus: +${formatCurrency(diff)}` : `Deficit: ${formatCurrency(diff)}`;

        return <Badge variant="default" className={`${colorClass} text-base ${className}`}>{text}</Badge>;
    }
    
    const sortedItemStats = useMemo(() => {
        if (!stats) return [];
        return Object.entries(stats.itemStats).sort(([, a], [, b]) => b.count - a.count);
    }, [stats]);
    
    const handleStartEndOfDay = () => {
        if (stats && stats.unpaidOrdersValue > 0) {
            setShowUnpaidOrdersWarning(true);
        } else {
            setIsCloseOutOpen(true);
        }
    };
    
    const CloseOutDialog = (
        <Dialog open={isCloseOutOpen} onOpenChange={setIsCloseOutOpen}>
            <DialogContent className="max-w-4xl">
                 <DialogHeader>
                    <DialogTitle>End-of-Day Reconciliation</DialogTitle>
                    <DialogDescription>
                        Count physical cash and reconcile accounts for today's sales. This action will save a permanent report.
                    </DialogDescription>
                </DialogHeader>
                 {!stats ? <LoadingSpinner /> : (
                <ScrollArea className="max-h-[70vh] p-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 pr-4">
                     <div className="space-y-4">
                        <Label className="text-lg font-semibold">Counted Totals</Label>
                        <div className="space-y-4 p-4 border rounded-md bg-secondary">
                             <div>
                                <Label className="text-base font-medium">Cash by Denomination</Label>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                                    {cashDenominations.map(den => (
                                        <div key={den} className="flex items-center gap-2">
                                            <Label htmlFor={`den-${den}`} className="w-16 text-right">{`GH₵${den}`}</Label>
                                            <span className="text-muted-foreground">x</span>
                                            <Input 
                                                id={`den-${den}`} 
                                                type="number" 
                                                value={denominationQuantities[den]} 
                                                onChange={e => handleDenominationChange(e.target.value, String(den))} 
                                                placeholder="0"
                                                className="h-9 w-full"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label className="text-base font-medium">Momo/Card Transactions</Label>
                                <div className="mt-2">
                                     <Input 
                                        type="number" 
                                        value={momoInput} 
                                        onChange={e => setMomoInput(e.target.value)} 
                                        onKeyDown={handleMomoInputKeyDown}
                                        placeholder="Enter amount and press Space/Enter"
                                        className="h-10"
                                    />
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {momoTransactions.map((amount, index) => (
                                            <Badge key={index} variant="secondary" className="text-base">
                                                {formatCurrency(amount)}
                                                <button onClick={() => removeMomoTransaction(index)} className="ml-2 rounded-full hover:bg-muted-foreground/20 p-0.5">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <Label className="text-lg font-semibold" htmlFor="notes">Notes</Label>
                            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., reason for deficit/surplus" className="mt-2"/>
                        </div>
                        <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => setIsAdvancedModalOpen(true)}>
                            <Search className="mr-2 h-4 w-4" />
                            Advanced Reconciliation (Audit Tool)
                        </Button>
                     </div>

                     <div className="space-y-4 p-4 border rounded-lg bg-card">
                        <h3 className="text-lg font-semibold text-center mb-2">Reconciliation Summary</h3>
                        
                        <Card className="bg-secondary">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Expected Revenue</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 text-sm">
                                <div className="flex justify-between"><span>Cash Sales:</span> <span>{formatCurrency(stats.cashSales)}</span></div>
                                <div className="flex justify-between"><span>(-) Cash Expenses:</span> <span className="text-orange-500">{formatCurrency(stats.miscCashExpenses)}</span></div>
                                <div className="flex justify-between font-bold border-t pt-1"><span>Expected Cash:</span> <span>{formatCurrency(stats.expectedCash)}</span></div>
                                <Separator className="my-2"/>
                                <div className="flex justify-between"><span>MoMo Sales:</span> <span>{formatCurrency(stats.momoSales)}</span></div>
                                <div className="flex justify-between"><span>(-) MoMo Expenses:</span> <span className="text-orange-500">{formatCurrency(stats.miscMomoExpenses)}</span></div>
                                <div className="flex justify-between font-bold border-t pt-1"><span>Expected MoMo:</span> <span>{formatCurrency(stats.expectedMomo)}</span></div>
                            </CardContent>
                            <CardFooter className="bg-primary/10 p-3">
                                <div className="w-full flex justify-between items-center">
                                    <span className="font-bold text-primary text-lg">Total Expected:</span>
                                    <span className="font-extrabold text-primary text-xl">{formatCurrency(stats.totalExpectedRevenue)}</span>
                                </div>
                            </CardFooter>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Counted Revenue</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 text-sm">
                                <div className="flex justify-between"><span>Counted Cash:</span> <span className="font-bold">{formatCurrency(totalCountedCash)}</span></div>
                                <div className="flex justify-between"><span>Counted MoMo:</span> <span className="font-bold">{formatCurrency(totalCountedMomo)}</span></div>
                            </CardContent>
                             <CardFooter className="bg-green-50 dark:bg-green-900/20 p-3">
                                <div className="w-full flex justify-between items-center">
                                    <span className="font-bold text-green-700 dark:text-green-300 text-lg">Total Counted:</span>
                                    <span className="font-extrabold text-green-600 dark:text-green-400 text-xl">{formatCurrency(totalCountedRevenue)}</span>
                                </div>
                            </CardFooter>
                        </Card>
                        
                        <div className="pt-2 flex justify-between items-center">
                             <Label className="text-lg font-semibold">Final Status</Label>
                             {renderDifferenceBadge(totalDiscrepancy)}
                        </div>
                     </div>
                </div>
                </ScrollArea>
                )}
                
                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

                <DialogFooter className="pt-4 border-t">
                    <Button onClick={() => setShowConfirm(true)} disabled={isSubmitting || !stats} className="w-full h-12 text-lg font-bold">
                        {isSubmitting ? 'Saving...' : 'Save Report'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    return (
        <div className="p-4 md:p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h2 className="text-2xl md:text-3xl font-bold">Accounting</h2>
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
                    <Button 
                        onClick={handleStartEndOfDay} 
                        className="w-full md:w-auto"
                        disabled={isTodayClosedOut}
                    >
                        {isTodayClosedOut ? <Lock className="mr-2"/> : <FileCheck className="mr-2" />}
                        {isTodayClosedOut ? 'Day Closed' : 'Start End-of-Day'}
                    </Button>
                </div>
            </div>
            
            {CloseOutDialog}
            
            {stats && showUnpaidOrdersWarning && (
                <AlertDialog open onOpenChange={setShowUnpaidOrdersWarning}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Unpaid Orders Found</AlertDialogTitle>
                            <AlertDialogDescription>
                                There are {stats.orders.filter(o => o.status === 'Pending').length} unpaid orders totaling {formatCurrency(stats.unpaidOrdersValue)}.
                                It's recommended to resolve these before closing the day.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                             <Button variant="secondary" onClick={() => { setShowUnpaidOrdersWarning(false); setIsCloseOutOpen(true); }}>
                                Proceed Anyway
                            </Button>
                             <AlertDialogAction onClick={() => { setShowUnpaidOrdersWarning(false); setActiveView('orders'); }}>
                                <ShoppingCart className="mr-2 h-4 w-4"/> Go to Orders
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            
            {stats && isAdvancedModalOpen && (
                <AdvancedReconciliationModal
                    orders={stats.orders}
                    onClose={() => setIsAdvancedModalOpen(false)}
                />
            )}
            
            {error && !isCloseOutOpen && <Alert variant="destructive" className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Financial Summary</TabsTrigger>
                <TabsTrigger value="history">History ({reports.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="summary">
                    {loading ? <div className="mt-8"><LoadingSpinner /></div> : !stats ? <p className="text-muted-foreground text-center italic py-10">No financial data for this period.</p> : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mt-4">
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Financial Summary</CardTitle>
                                    <CardDescription>
                                        {date?.from && date.to && format(date.from, "LLL dd, y") !== format(date.to, "LLL dd, y") 
                                            ? `Data from ${format(date.from, "LLL dd, y")} to ${format(date.to, "LLL dd, y")}`
                                            : `Data for ${date?.from ? format(date.from, "LLL dd, y") : 'the selected date'}`
                                        }
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <StatCard icon={<DollarSign className="text-primary"/>} title="Total Sales" value={formatCurrency(stats.totalSales)} description="From completed orders today"/>
                                    <StatCard icon={<Landmark className="text-blue-500"/>} title="Cash Sales" value={formatCurrency(stats.cashSales)} description="Total cash received" />
                                    <StatCard icon={<CreditCard className="text-purple-500"/>} title="Momo/Card Sales" value={formatCurrency(stats.momoSales)} />
                                    <StatCard icon={<Hourglass className={stats.unpaidOrdersValue === 0 ? "text-muted-foreground" : "text-amber-500"}/>} title="Unpaid Orders (All Time)" value={formatCurrency(stats.unpaidOrdersValue)} description="Total outstanding balance"/>
                                    <StatCard icon={<MinusCircle className="text-orange-500"/>} title="Misc. Expenses (Cash)" value={formatCurrency(stats.miscCashExpenses)} />
                                     <StatCard icon={<MinusCircle className="text-orange-500"/>} title="Misc. Expenses (MoMo)" value={formatCurrency(stats.miscMomoExpenses)} />
                                </CardContent>
                                <CardFooter>
                                    <div className="w-full p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                                        <Label className="text-base md:text-lg font-semibold text-green-700 dark:text-green-300">Net Revenue</Label>
                                        <p className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.netRevenue)}</p>
                                        <p className="text-xs text-muted-foreground">(Paid Sales - Misc. Expenses)</p>
                                    </div>
                                </CardFooter>
                            </Card>
                        </div>
                         <Card>
                            <CardHeader>
                                <CardTitle>Item Sales (Completed Orders)</CardTitle>
                                <CardDescription>Total count and value of each item sold.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[350px] md:h-[400px] pr-4">
                                    <div className="space-y-3">
                                        {sortedItemStats.length > 0 ? sortedItemStats.map(([name, itemStats]) => (
                                            <div key={name} className="flex justify-between items-center text-sm p-2 bg-secondary rounded-md">
                                                <div>
                                                    <p className="font-medium">{name}</p>
                                                    <p className="text-xs text-muted-foreground">{itemStats.count} sold</p>
                                                </div>
                                                <Badge variant="default" className="bg-primary/80">{formatCurrency(itemStats.totalValue)}</Badge>
                                            </div>
                                        )) : (
                                            <p className="text-muted-foreground text-center italic py-4">No items sold in this period.</p>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                    )}
              </TabsContent>
              <TabsContent value="history">
                  <Card className="mt-4">
                      <CardHeader>
                          <CardTitle>Reconciliation History</CardTitle>
                          <CardDescription>Review past end-of-day reports.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="max-h-[500px] overflow-y-auto pr-4">
                        {reports.length === 0 && <p className="text-muted-foreground italic text-center py-4">No reports saved yet.</p>}
                        {reports.map(report => (
                            <div key={report.id} className="p-3 mb-2 rounded-lg bg-secondary space-y-2">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{report.period}</p>
                                        <p className="text-sm text-muted-foreground">{formatTimestamp(report.timestamp)}</p>
                                    </div>
                                    {renderDifferenceBadge(report.totalDiscrepancy)}
                                </div>
                                <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-2">
                                    <span>Expected Revenue:</span><span className="font-medium text-right">{formatCurrency(report.totalExpectedRevenue)}</span>
                                    <span>Counted Revenue:</span><span className="font-medium text-right">{formatCurrency(report.totalCountedRevenue)}</span>
                                    <span>Expected Cash:</span><span className="font-medium text-right">{formatCurrency(report.expectedCash)}</span>
                                    <span>Counted Cash:</span><span className="font-medium text-right">{formatCurrency(report.countedCash)}</span>
                                    <span>Expected Momo:</span><span className="font-medium text-right">{formatCurrency(report.expectedMomo)}</span>
                                    <span>Counted Momo:</span><span className="font-medium text-right">{formatCurrency(report.countedMomo)}</span>
                                </div>
                                {report.notes && <p className="text-xs italic mt-2 border-t pt-2">Notes: {report.notes}</p>}
                            </div>
                        ))}
                        </ScrollArea>
                      </CardContent>
                  </Card>
              </TabsContent>
            </Tabs>
            
            {showConfirm && (
                <AlertDialog open onOpenChange={setShowConfirm}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Report Submission</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to save this reconciliation report? This action is final for the day and cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSaveReport} className="bg-primary hover:bg-primary/90">Confirm & Save</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
};

export default AccountingView;

    