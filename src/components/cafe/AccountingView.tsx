"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, addDoc, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense, ReconciliationReport } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { DollarSign, CreditCard, MinusCircle, History, Landmark, Coins, AlertCircle, Search, Package, Calendar as CalendarIcon, FileCheck, Hourglass, ShoppingCart, Lock, X, Ban, HelpCircle } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AdvancedReconciliationModal from './modals/AdvancedReconciliationModal';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { addDays, format, isToday } from "date-fns"
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';


interface PeriodStats {
    totalSales: number;
    totalItemsSold: number;
    cashSales: number;
    momoSales: number;
    miscCashExpenses: number;
    miscMomoExpenses: number;
    expectedCash: number;
    expectedMomo: number;
    totalExpectedRevenue: number;
    netRevenue: number;
    allTimeUnpaidOrdersValue: number;
    todayUnpaidOrdersValue: number;
    totalPardonedAmount: number;
    changeOwedForPeriod: number;
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
    const isMobile = useIsMobile();
    const [setAsideChange, setSetAsideChange] = useState(true);
    
    // Get today's date for fixed daily accounting
    const today = useMemo(() => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }, []);
    
    const todayEnd = useMemo(() => {
        const date = new Date(today);
        date.setHours(23, 59, 59, 999);
        return date;
    }, [today]);
    
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
    
    const reconciliationExpectedCash = useMemo(() => {
        if (!stats) return 0;
        // If we set aside the change, the cash drawer should have that money, so don't subtract it from expected.
        if (setAsideChange) {
            return stats.expectedCash;
        }
        // If we DON'T set it aside, it's a deficit for the day, so subtract it.
        return stats.expectedCash - stats.changeOwedForPeriod;
    }, [stats, setAsideChange]);
    
    const totalDiscrepancy = useMemo(() => {
        if (!stats) return 0;
        const expectedRevenue = reconciliationExpectedCash + stats.expectedMomo;
        return totalCountedRevenue - expectedRevenue;
    }, [totalCountedRevenue, stats, reconciliationExpectedCash]);
    
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
        setLoading(true);
        setError(null);
        setStats(null);
        
        try {
            const startDateTimestamp = Timestamp.fromDate(today);
            const endDateTimestamp = Timestamp.fromDate(todayEnd);

            // Query for today's orders
            const todayOrdersQuery = query(
                collection(db, "orders"), 
                where("timestamp", ">=", startDateTimestamp), 
                where("timestamp", "<=", endDateTimestamp)
            );
            
            // Query for today's misc expenses
            const todayMiscQuery = query(
                collection(db, "miscExpenses"), 
                where("timestamp", ">=", startDateTimestamp), 
                where("timestamp", "<=", endDateTimestamp)
            );
            
            // Query for all unpaid orders (all time)
            const allUnpaidOrdersQuery = query(
                collection(db, "orders"), 
                where("paymentStatus", "in", ["Unpaid", "Partially Paid"])
            );

            const [todayOrdersSnapshot, todayMiscSnapshot, allUnpaidOrdersSnapshot] = await Promise.all([
                getDocs(todayOrdersQuery),
                getDocs(todayMiscQuery),
                getDocs(allUnpaidOrdersQuery)
            ]);

            // Initialize variables
            let totalSales = 0;
            let totalItemsSold = 0;
            let cashSales = 0;
            let momoSales = 0;
            const todayOrders: Order[] = [];
            const itemStats: Record<string, { count: number; totalValue: number }> = {};
            let allTimeUnpaidOrdersValue = 0;
            let todayUnpaidOrdersValue = 0;
            let totalPardonedAmount = 0;
            let changeOwedForPeriod = 0;

            // Process all unpaid orders (all time)
            allUnpaidOrdersSnapshot.docs.forEach(doc => {
                const order = { id: doc.id, ...doc.data() } as Order;
                allTimeUnpaidOrdersValue += order.balanceDue;
                
                // Check if this unpaid order is from today
                const orderDate = order.timestamp.toDate();
                if (orderDate >= today && orderDate <= todayEnd) {
                    todayUnpaidOrdersValue += order.balanceDue;
                }
            });
            
            // Process today's orders
            todayOrdersSnapshot.docs.forEach(doc => {
                const order = { id: doc.id, ...doc.data() } as Order;
                todayOrders.push(order);

                // Calculate pardoned amounts
                if (order.pardonedAmount && order.pardonedAmount > 0) {
                    totalPardonedAmount += order.pardonedAmount;
                }
                
                // Calculate change owed (negative balance due means we owe customer change)
                if (order.balanceDue < 0) {
                    changeOwedForPeriod += Math.abs(order.balanceDue);
                }
                
                // Calculate total sales and items from completed orders
                if (order.status === 'Completed') {
                    totalSales += order.total;
                    order.items.forEach(item => {
                        totalItemsSold += item.quantity;
                        const currentStats = itemStats[item.name] || { count: 0, totalValue: 0 };
                        itemStats[item.name] = {
                            count: currentStats.count + item.quantity,
                            totalValue: currentStats.totalValue + (item.quantity * item.price)
                        };
                    });
                }
                
                // Calculate cash and momo sales (all payments received today)
                // Check if payment was made today
                const paymentDate = order.lastPaymentTimestamp ? order.lastPaymentTimestamp.toDate() : order.timestamp.toDate();
                if (paymentDate >= today && paymentDate <= todayEnd) {
                    if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Paid') {
                        const paidAmount = order.lastPaymentAmount ?? order.amountPaid;
                        if (order.paymentMethod === 'cash') {
                            cashSales += paidAmount;
                        }
                        if (order.paymentMethod === 'momo') {
                            momoSales += paidAmount;
                        }
                    }
                }
            });

            // Process today's misc expenses
            let miscCashExpenses = 0;
            let miscMomoExpenses = 0;
            todayMiscSnapshot.forEach(doc => {
                const expense = doc.data() as MiscExpense;
                if (expense.source === 'cash') {
                    miscCashExpenses += expense.amount;
                } else {
                    miscMomoExpenses += expense.amount;
                }
            });
            
            // Calculate expected amounts and net revenue
            const expectedCash = cashSales - miscCashExpenses;
            const expectedMomo = momoSales - miscMomoExpenses;
            const totalExpectedRevenue = expectedCash + expectedMomo;
            
            // Net Revenue = (All Payments Received) - (All Expenses) - (Pardoned Amount)
            const netRevenue = (cashSales + momoSales) - (miscCashExpenses + miscMomoExpenses) - totalPardonedAmount;
            
            setStats({ 
                totalSales, 
                totalItemsSold,
                cashSales, 
                momoSales, 
                miscCashExpenses, 
                miscMomoExpenses, 
                expectedCash, 
                expectedMomo, 
                totalExpectedRevenue, 
                netRevenue, 
                allTimeUnpaidOrdersValue,
                todayUnpaidOrdersValue,
                totalPardonedAmount, 
                changeOwedForPeriod, 
                orders: todayOrders, 
                itemStats 
            });
            
        } catch (e) {
            console.error(e);
            setError("Failed to load financial data for today.");
        } finally {
            setLoading(false);
        }
    }, [today, todayEnd]);
    
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
        setSetAsideChange(true);
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
                period: format(today, 'yyyy-MM-dd'),
                totalSales: stats.totalSales,
                
                expectedCash: reconciliationExpectedCash,
                expectedMomo: stats.expectedMomo,
                totalExpectedRevenue: reconciliationExpectedCash + stats.expectedMomo,
                
                countedCash: totalCountedCash,
                countedMomo: totalCountedMomo,
                totalCountedRevenue: totalCountedRevenue,

                totalDiscrepancy: totalDiscrepancy,
                notes: notes,

                changeOwedForPeriod: stats.changeOwedForPeriod,
                changeOwedSetAside: setAsideChange,
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
        if (stats && stats.todayUnpaidOrdersValue > 0) {
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
                        <div className="p-4 border rounded-md">
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="set-aside-switch" className="font-semibold">Set aside change for tomorrow?</Label>
                                     <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                                            <TooltipContent>
                                                <p className="max-w-xs">ON: Assumes you keep the change owed ({formatCurrency(stats.changeOwedForPeriod)}) in the cash drawer to pay customers later. It won't be counted as a deficit today.</p>
                                                <p className="max-w-xs mt-2">OFF: Treats the change owed as a cash deficit for today's report.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <Switch id="set-aside-switch" checked={setAsideChange} onCheckedChange={setSetAsideChange} disabled={stats.changeOwedForPeriod <= 0}/>
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
                                 {!setAsideChange && stats.changeOwedForPeriod > 0 && (
                                     <div className="flex justify-between"><span>(-) Change Owed Deficit:</span> <span className="text-orange-500">{formatCurrency(stats.changeOwedForPeriod)}</span></div>
                                 )}
                                <div className="flex justify-between font-bold border-t pt-1"><span>Expected Cash Today:</span> <span>{formatCurrency(reconciliationExpectedCash)}</span></div>
                                <Separator className="my-2"/>
                                <div className="flex justify-between"><span>MoMo Sales:</span> <span>{formatCurrency(stats.momoSales)}</span></div>
                                <div className="flex justify-between"><span>(-) MoMo Expenses:</span> <span className="text-orange-500">{formatCurrency(stats.miscMomoExpenses)}</span></div>
                                <div className="flex justify-between font-bold border-t pt-1"><span>Expected MoMo:</span> <span>{formatCurrency(stats.expectedMomo)}</span></div>
                            </CardContent>
                            <CardFooter className="bg-primary/10 p-3">
                                <div className="w-full flex justify-between items-center">
                                    <span className="font-bold text-primary text-lg">Total Expected:</span>
                                    <span className="font-extrabold text-primary text-xl">{formatCurrency(reconciliationExpectedCash + stats.expectedMomo)}</span>
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
        <TooltipProvider>
        <div className="p-4 md:p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold">Accounting</h2>
                    <p className="text-muted-foreground">Daily accounting for {format(today, "EEEE, MMMM dd, yyyy")}</p>
                </div>
                <div className="flex items-center gap-2">
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
                                There are unpaid orders from today totaling {formatCurrency(stats.todayUnpaidOrdersValue)}.
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
                    {loading ? <div className="mt-8"><LoadingSpinner /></div> : !stats ? <p className="text-muted-foreground text-center italic py-10">No financial data for today.</p> : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mt-4">
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Financial Summary</CardTitle>
                                    <CardDescription>
                                        Daily financial data for {format(today, "EEEE, MMMM dd, yyyy")}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <StatCard 
                                        icon={<DollarSign className="text-primary"/>} 
                                        title="Total Sales" 
                                        value={formatCurrency(stats.totalSales)} 
                                        description={`${stats.totalItemsSold} items sold from completed orders`}
                                    />
                                    <StatCard 
                                        icon={<Landmark className="text-blue-500"/>} 
                                        title="Cash Sales" 
                                        value={formatCurrency(stats.cashSales)} 
                                        description="All cash payments received today" 
                                    />
                                    <StatCard 
                                        icon={<CreditCard className="text-purple-500"/>} 
                                        title="Momo/Card Sales" 
                                        value={formatCurrency(stats.momoSales)}
                                        description="All momo/card payments received today" 
                                    />
                                    <StatCard 
                                        icon={<Hourglass className={stats.allTimeUnpaidOrdersValue === 0 ? "text-muted-foreground" : "text-amber-500"}/>} 
                                        title="Unpaid Orders (All Time)" 
                                        value={formatCurrency(stats.allTimeUnpaidOrdersValue)} 
                                        description={`${formatCurrency(stats.todayUnpaidOrdersValue)} from today`}
                                    />
                                    <StatCard 
                                        icon={<MinusCircle className="text-orange-500"/>} 
                                        title="Total Misc. Expenses" 
                                        value={formatCurrency(stats.miscCashExpenses + stats.miscMomoExpenses)} 
                                        description={`Cash: ${formatCurrency(stats.miscCashExpenses)} | Momo: ${formatCurrency(stats.miscMomoExpenses)}`} 
                                    />
                                    <StatCard 
                                        icon={<Ban className="text-red-500" />} 
                                        title="Pardoned Deficits" 
                                        value={formatCurrency(stats.totalPardonedAmount)}
                                        description="Unplanned discounts given today" 
                                    />
                                </CardContent>
                                <CardFooter>
                                    <div className="w-full p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                                        <Label className="text-base md:text-lg font-semibold text-green-700 dark:text-green-300">Net Revenue</Label>
                                        <p className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.netRevenue)}</p>
                                        <p className="text-xs text-muted-foreground">(All Payments - Expenses - Pardons)</p>
                                    </div>
                                </CardFooter>
                            </Card>
                        </div>
                         <Card>
                            <CardHeader>
                                <CardTitle>Item Sales (Completed Orders)</CardTitle>
                                <CardDescription>Total count and value of each item sold today.</CardDescription>
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
                                            <p className="text-muted-foreground text-center italic py-4">No items sold today.</p>
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
                                    {report.changeOwedForPeriod > 0 && <span className="col-span-2 mt-1 pt-1 border-t">Change from period: <span className="font-medium">{formatCurrency(report.changeOwedForPeriod)}</span> ({report.changeOwedSetAside ? 'Set Aside' : 'Deficit'})</span>}
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
        </TooltipProvider>
    );
};

export default AccountingView;
