
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, addDoc, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense, ReconciliationReport } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { DollarSign, CreditCard, MinusCircle, History, Landmark, Coins, AlertCircle, Search, Package, Calendar as CalendarIcon, FileCheck, Hourglass, ShoppingCart, Lock, X, Ban, HelpCircle, TrendingUp, TrendingDown, Plus } from 'lucide-react';
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
    settledUnpaidOrdersValue: number; // Unpaid orders from previous days settled today
    previousDaysChangeGiven: number; // Change given today but from previous days
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
    
    // Adjusted expected cash calculation including settled unpaid orders and previous days change
    const adjustedExpectedCash = useMemo(() => {
        if (!stats) return 0;
        let expectedCash = stats.expectedCash + stats.settledUnpaidOrdersValue - stats.previousDaysChangeGiven;
        
        // If we set aside the change, the cash drawer should have that money, so don't subtract it from expected.
        if (setAsideChange) {
            return expectedCash;
        }
        // If we DON'T set it aside, it's a deficit for the day, so subtract it.
        return expectedCash - stats.changeOwedForPeriod;
    }, [stats, setAsideChange]);
    
    const totalDiscrepancy = useMemo(() => {
        if (!stats) return 0;
        const expectedRevenue = adjustedExpectedCash + stats.expectedMomo;
        return totalCountedRevenue - expectedRevenue;
    }, [totalCountedRevenue, stats, adjustedExpectedCash]);
    
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

            // Query for orders settled today (from previous days)
            const settledTodayQuery = query(
                collection(db, "orders"),
                where("settledOn", ">=", startDateTimestamp),
                where("settledOn", "<=", endDateTimestamp)
            );

            const [todayOrdersSnapshot, todayMiscSnapshot, allUnpaidOrdersSnapshot, settledTodaySnapshot] = await Promise.all([
                getDocs(todayOrdersQuery),
                getDocs(todayMiscQuery),
                getDocs(allUnpaidOrdersQuery),
                getDocs(settledTodayQuery)
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
            let settledUnpaidOrdersValue = 0;
            let previousDaysChangeGiven = 0;

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

            // Process orders settled today (from previous days)
            settledTodaySnapshot.docs.forEach(doc => {
                const order = { id: doc.id, ...doc.data() } as Order;
                const orderDate = order.timestamp.toDate();
                
                // Only count if order was from a previous day but settled today
                if (orderDate < today) {
                    settledUnpaidOrdersValue += order.amountPaid;
                    
                    // Track change given today for orders from previous days
                    if (order.changeGiven && order.changeGiven > 0) {
                        previousDaysChangeGiven += order.changeGiven;
                    }
                }
            });
            
            // Process today's orders
            todayOrdersSnapshot.docs.forEach(doc => {
                const order = { id: doc.id, ...doc.data() } as Order;
                todayOrders.push(order);
                totalSales += order.total; // Sum up total value of all orders created today

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
            const totalExpectedRevenue = expectedCash + expectedMomo + settledUnpaidOrdersValue;
            
            // Net Revenue = (All Payments Received) - (All Expenses) - (Pardoned Amount) + (Settled Unpaid Orders) - (Previous Days Change)
            const netRevenue = (cashSales + momoSales) - (miscCashExpenses + miscMomoExpenses) - totalPardonedAmount + settledUnpaidOrdersValue - previousDaysChangeGiven;
            
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
                settledUnpaidOrdersValue,
                previousDaysChangeGiven,
                orders: todayOrders, 
                itemStats 
            });
            
        } catch (e) {
            console.error("Error fetching period data:", e);
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
            console.error("Error loading reports:", err);
            setError("Failed to load past reports.");
        });

        return () => unsubscribe();
    }, []);
    
    const resetForm = useCallback(() => {
        setDenominationQuantities(initialDenominations);
        setMomoTransactions([]);
        setMomoInput('');
        setNotes('');
        setSetAsideChange(true);
    }, []);

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
                
                expectedCash: adjustedExpectedCash,
                expectedMomo: stats.expectedMomo,
                totalExpectedRevenue: adjustedExpectedCash + stats.expectedMomo,
                
                countedCash: totalCountedCash,
                countedMomo: totalCountedMomo,
                totalCountedRevenue: totalCountedRevenue,

                totalDiscrepancy: totalDiscrepancy,
                notes: notes,

                changeOwedForPeriod: stats.changeOwedForPeriod,
                changeOwedSetAside: setAsideChange,
            };
            
            await addDoc(collection(db, "reconciliationReports"), reportData);
            
            // Reset form and close modal
            resetForm();
            setIsCloseOutOpen(false);
            setShowConfirm(false);
            
            // Delay refetch to prevent stale state errors
            setTimeout(() => {
                fetchPeriodData();
            }, 500);

        } catch (e) {
            console.error("Error saving report:", e);
            setError("Failed to save the report. Please try again.");
        } finally {
            setIsSubmitting(false);
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
        <Dialog open={isCloseOutOpen} onOpenChange={(open) => {
            if (!isSubmitting) {
                setIsCloseOutOpen(open);
                if (!open) {
                    resetForm();
                    setError(null);
                }
            }
        }}>
            <DialogContent className="max-w-6xl max-h-[90vh]">
                <DialogHeader className="pb-4 border-b">
                    <DialogTitle className="text-2xl font-bold">End-of-Day Reconciliation</DialogTitle>
                    <DialogDescription className="text-base">
                        Complete daily cash reconciliation and account for all transactions for {format(today, "EEEE, MMMM dd, yyyy")}
                    </DialogDescription>
                </DialogHeader>
                
                {!stats ? <LoadingSpinner /> : (
                <ScrollArea className="max-h-[70vh]">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-6 pr-4">
                    {/* Left Column - Input Section */}
                    <div className="space-y-6">
                        <div className="p-6 border rounded-lg bg-card">
                            <Label className="text-xl font-bold mb-4 block">Physical Count</Label>
                            
                            {/* Cash Denominations */}
                            <div className="space-y-4">
                                <Label className="text-lg font-semibold">Cash by Denomination</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {cashDenominations.map(den => (
                                        <div key={den} className="flex items-center gap-3 p-2 bg-secondary rounded-md">
                                            <Label htmlFor={`den-${den}`} className="w-20 font-medium text-lg">{`GH₵${den}`}</Label>
                                            <span className="text-muted-foreground text-lg">×</span>
                                            <Input 
                                                id={`den-${den}`} 
                                                type="number" 
                                                value={denominationQuantities[den]} 
                                                onChange={e => handleDenominationChange(e.target.value, String(den))} 
                                                placeholder="0"
                                                className="flex-1 h-12 text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="p-3 bg-primary/10 rounded-md">
                                    <p className="font-semibold text-primary">Total Counted Cash: {formatCurrency(totalCountedCash)}</p>
                                </div>
                            </div>
                            
                            {/* MoMo Transactions */}
                            <div className="space-y-4 mt-6">
                                <Label className="text-lg font-semibold">MoMo/Card Transactions</Label>
                                <Input 
                                    type="number" 
                                    value={momoInput} 
                                    onChange={e => setMomoInput(e.target.value)} 
                                    onKeyDown={handleMomoInputKeyDown}
                                    placeholder="Enter amount and press Space/Enter"
                                    className="h-12 text-lg"
                                />
                                <div className="flex flex-wrap gap-2">
                                    {momoTransactions.map((amount, index) => (
                                        <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
                                            {formatCurrency(amount)}
                                            <button onClick={() => removeMomoTransaction(index)} className="ml-2 hover:bg-destructive/20 rounded-full p-0.5">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                                    <p className="font-semibold text-purple-600 dark:text-purple-400">Total Counted MoMo: {formatCurrency(totalCountedMomo)}</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Change Setting */}
                        <div className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="set-aside-switch" className="font-semibold">Set aside change for tomorrow?</Label>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                                            <TooltipContent>
                                                <p className="max-w-xs">ON: Keep change owed ({formatCurrency(stats.changeOwedForPeriod)}) in drawer for customers. Won't count as deficit.</p>
                                                <p className="max-w-xs mt-2">OFF: Count change owed as cash deficit for today.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <Switch 
                                    id="set-aside-switch" 
                                    checked={setAsideChange} 
                                    onCheckedChange={setSetAsideChange} 
                                    disabled={stats.changeOwedForPeriod <= 0}
                                />
                            </div>
                        </div>
                        
                        {/* Notes */}
                        <div className="space-y-2">
                            <Label className="text-lg font-semibold" htmlFor="notes">Notes & Comments</Label>
                            <Textarea 
                                id="notes" 
                                value={notes} 
                                onChange={e => setNotes(e.target.value)} 
                                placeholder="Explain any discrepancies, issues, or special circumstances..."
                                className="min-h-[100px]"
                            />
                        </div>
                        
                        {/* Audit Tool */}
                        <Button 
                            variant="outline" 
                            size="lg" 
                            className="w-full" 
                            onClick={() => setIsAdvancedModalOpen(true)}
                        >
                            <Search className="mr-2 h-4 w-4" />
                            Advanced Reconciliation Audit
                        </Button>
                    </div>

                    {/* Right Column - Expected Revenue Breakdown */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="text-center">
                            <h3 className="text-2xl font-bold mb-2">Reconciliation Analysis</h3>
                            <p className="text-muted-foreground">Comparing expected vs counted revenue</p>
                        </div>
                        
                        {/* Expected Revenue Card */}
                        <Card className="border-2">
                            <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-blue-600" />
                                    Expected Revenue Breakdown
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Cash Section */}
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-lg text-blue-600">Cash</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span>Today's Cash Sales:</span>
                                                <span className="font-medium">{formatCurrency(stats.cashSales)}</span>
                                            </div>
                                            <div className="flex justify-between text-orange-600">
                                                <span>(-) Cash Expenses:</span>
                                                <span className="font-medium">-{formatCurrency(stats.miscCashExpenses)}</span>
                                            </div>
                                            {stats.settledUnpaidOrdersValue > 0 && (
                                                <div className="flex justify-between text-green-600">
                                                    <span>(+) Settled Old Orders:</span>
                                                    <span className="font-medium">+{formatCurrency(stats.settledUnpaidOrdersValue)}</span>
                                                </div>
                                            )}
                                            {stats.previousDaysChangeGiven > 0 && (
                                                <div className="flex justify-between text-red-600">
                                                    <span>(-) Previous Days Change:</span>
                                                    <span className="font-medium">-{formatCurrency(stats.previousDaysChangeGiven)}</span>
                                                </div>
                                            )}
                                            {!setAsideChange && stats.changeOwedForPeriod > 0 && (
                                                <div className="flex justify-between text-red-600">
                                                    <span>(-) Change Owed Deficit:</span>
                                                    <span className="font-medium">-{formatCurrency(stats.changeOwedForPeriod)}</span>
                                                </div>
                                            )}
                                            <Separator />
                                            <div className="flex justify-between font-bold text-blue-700 text-base">
                                                <span>Expected Cash:</span>
                                                <span>{formatCurrency(adjustedExpectedCash)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* MoMo Section */}
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-lg text-purple-600">MoMo / Card</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span>Today's MoMo Sales:</span>
                                                <span className="font-medium">{formatCurrency(stats.momoSales)}</span>
                                            </div>
                                            <div className="flex justify-between text-orange-600">
                                                <span>(-) MoMo Expenses:</span>
                                                <span className="font-medium">-{formatCurrency(stats.miscMomoExpenses)}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between font-bold text-purple-700 text-base">
                                                <span>Expected MoMo:</span>
                                                <span>{formatCurrency(stats.expectedMomo)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-blue-50 dark:bg-blue-900/20 p-4">
                                <div className="w-full flex justify-between items-center">
                                    <span className="font-bold text-blue-700 text-lg">Total Expected:</span>
                                    <span className="font-extrabold text-blue-800 text-2xl">{formatCurrency(adjustedExpectedCash + stats.expectedMomo)}</span>
                                </div>
                            </CardFooter>
                        </Card>

                        {/* Final Reconciliation Card */}
                        <Card className="border-2">
                             <CardHeader className="bg-green-50 dark:bg-green-900/20">
                                <CardTitle className="flex items-center gap-2">
                                    <FileCheck className="h-5 w-5 text-green-600" />
                                    Final Reconciliation
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 text-center space-y-4">
                                <div>
                                    <p className="text-muted-foreground">Expected Revenue</p>
                                    <p className="text-2xl font-bold">{formatCurrency(adjustedExpectedCash + stats.expectedMomo)}</p>
                                </div>
                                <TrendingDown className="text-muted-foreground mx-auto" />
                                 <div>
                                    <p className="text-muted-foreground">Counted Revenue</p>
                                    <p className="text-2xl font-bold">{formatCurrency(totalCountedRevenue)}</p>
                                </div>
                            </CardContent>
                            <CardFooter className="p-4 flex-col gap-2 items-center">
                                 <h4 className="font-semibold text-lg">Final Status</h4>
                                 {renderDifferenceBadge(totalDiscrepancy, 'text-lg px-4 py-2')}
                            </CardFooter>
                        </Card>
                    </div>
                </div>
                </ScrollArea>
                )}
                
                {error && <Alert variant="destructive" className="my-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

                <DialogFooter className="pt-6 border-t">
                    <Button onClick={() => setShowConfirm(true)} disabled={isSubmitting || !stats} className="w-full h-16 text-xl font-bold">
                        {isSubmitting ? <LoadingSpinner /> : 'Finalize & Save Report'}
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
                    expectedTotal={stats.totalSales}
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
                                        <p className="text-xs text-muted-foreground">(Payments - Expenses - Pardons + Settled Old Orders)</p>
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