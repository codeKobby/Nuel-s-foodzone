"use client";

import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { useAccounting } from '@/hooks/useAccounting';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, FileSignature, ShoppingCart, CheckCircle, Banknote, Smartphone, FileText, Search, X, TrendingUp, TrendingDown, DollarSign, Landmark, CreditCard, Hourglass, MinusCircle, Gift, Ban, ArrowRightLeft, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HistoryView from '@/components/cafe/HistoryView';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator as UiSeparator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatCurrency } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, onSnapshot, orderBy } from 'firebase/firestore';
import { format, isToday } from 'date-fns';
import { AuthContext } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Order, MiscExpense, ReconciliationReport } from '@/lib/types';

interface PeriodStats {
    totalSales: number;
    totalItemsSold: number;
    cashSales: number;
    momoSales: number;
    miscCashExpenses: number;
    miscMomoExpenses: number;
    netRevenue: number;
    todayUnpaidOrdersValue: number;
    allTimeUnpaidOrdersValue: number;
    previousUnpaidOrdersValue: number;
    totalPardonedAmount: number;
    changeOwedForPeriod: number;
    settledUnpaidOrdersValue: number;
    settledUnpaidCash: number;
    settledUnpaidMomo: number;
    previousDaysChangeGiven: number;
    totalRewardDiscount: number;
    orders: Order[];
    itemStats: Record<string, { count: number; totalValue: number }>;
}

const StatCard: React.FC<{ icon: React.ReactNode, title: string, value: string | number, color?: string, description?: string | React.ReactNode, onClick?: () => void }> = ({ icon, title, value, color, description, onClick }) => (
    <Card className={onClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""} onClick={onClick}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className={`text-xl md:text-2xl font-bold ${color} ${onClick ? "underline" : ""}`}>{value}</div>
            {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </CardContent>
    </Card>
);

const ReconciliationView: React.FC<{
    stats: PeriodStats | null,
    adjustedExpectedCash: number,
    adjustedExpectedMomo: number,
    miscExpenses: MiscExpense[],
    onBack: () => void
}> = ({ stats, adjustedExpectedCash, adjustedExpectedMomo, miscExpenses, onBack }) => {
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
    const [deductCustomerChange, setDeductCustomerChange] = useState(true);
    const { session } = useContext(AuthContext);
    const { toast } = useToast();
    const today = useMemo(() => new Date(), []);

    const cashDenominations = [200, 100, 50, 20, 10, 5, 2, 1];
    const [denominationQuantities, setDenominationQuantities] = useState<Record<string, string>>(
        cashDenominations.reduce((acc, val) => ({ ...acc, [val]: '' }), {})
    );
    const [momoTransactions, setMomoTransactions] = useState<number[]>([]);
    const [momoInput, setMomoInput] = useState('');

    const totalCountedCash = useMemo(() => {
        return cashDenominations.reduce((total, den) => {
            const quantity = parseInt(String(denominationQuantities[String(den)] || '0')) || 0;
            return total + (den * quantity);
        }, 0);
    }, [denominationQuantities]);

    const totalCountedMomo = useMemo(() => {
        return momoTransactions.reduce((total, amount) => total + amount, 0);
    }, [momoTransactions]);

    const availableCash = useMemo(() => {
        if (!stats) return totalCountedCash;
        let counted = totalCountedCash;
        if (deductCustomerChange) {
            counted -= stats.changeOwedForPeriod;
        }
        return counted;
    }, [totalCountedCash, stats, deductCustomerChange]);

    const cashDiscrepancy = useMemo(() => {
        return availableCash - adjustedExpectedCash;
    }, [availableCash, adjustedExpectedCash]);

    const momoDiscrepancy = useMemo(() => {
        if (!stats) return 0;
        return totalCountedMomo - adjustedExpectedMomo;
    }, [totalCountedMomo, adjustedExpectedMomo, stats]);

    const totalDiscrepancy = useMemo(() => {
        return cashDiscrepancy + momoDiscrepancy;
    }, [cashDiscrepancy, momoDiscrepancy]);

    const resetForm = useCallback(() => {
        setDenominationQuantities(cashDenominations.reduce((acc, val) => ({ ...acc, [val]: '' }), {}));
        setMomoTransactions([]);
        setMomoInput('');
        setNotes('');
        setDeductCustomerChange(true);
    }, []);

    const handleSaveReport = async () => {
        if (!stats) {
            toast({
                title: "Error saving report",
                description: "Cannot save report, financial stats are missing.",
                type: "error"
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const reportData = {
                timestamp: serverTimestamp(),
                period: format(today, 'yyyy-MM-dd'),
                totalSales: stats.totalSales,
                totalItemsSold: stats.totalItemsSold,

                // Expected vs Counted
                expectedCash: adjustedExpectedCash,
                expectedMomo: adjustedExpectedMomo,
                totalExpectedRevenue: adjustedExpectedCash + adjustedExpectedMomo,
                countedCash: totalCountedCash,
                countedMomo: totalCountedMomo,
                totalCountedRevenue: totalCountedCash + totalCountedMomo,

                // Payment method breakdown
                cashSales: stats.cashSales,
                momoSales: stats.momoSales,

                // Expenses
                miscCashExpenses: stats.miscCashExpenses,
                miscMomoExpenses: stats.miscMomoExpenses,
                miscExpenseDetails: miscExpenses.map((e: MiscExpense) => ({ purpose: e.purpose, amount: e.amount, source: e.source })),

                // Collections from previous days
                collectionsFromPreviousDays: stats.settledUnpaidOrdersValue,
                settledUnpaidCash: stats.settledUnpaidCash,
                settledUnpaidMomo: stats.settledUnpaidMomo,

                // Discounts and adjustments
                totalRewardDiscount: stats.totalRewardDiscount,
                totalPardonedAmount: stats.totalPardonedAmount,

                // Discrepancies
                cashDiscrepancy: cashDiscrepancy,
                momoDiscrepancy: momoDiscrepancy,
                totalDiscrepancy: totalDiscrepancy,

                // Notes
                notes: notes,

                // Change tracking
                changeOwedForPeriod: stats.changeOwedForPeriod,
                changeOwedSetAside: deductCustomerChange,
                previousDaysChangeGiven: stats.previousDaysChangeGiven,

                // Cashier info
                cashierId: session?.uid || 'unknown',
                cashierName: session?.fullName || session?.username || 'Unknown',
            };
            await addDoc(collection(db, "reconciliationReports"), reportData);

            // Clear localStorage unsaved flag
            localStorage.removeItem('unsavedReconciliation');

            toast({
                title: "Day Closed Successfully",
                description: "The financial report has been saved.",
                type: 'success'
            });

            resetForm();
            setShowConfirm(false);

            setTimeout(() => {
                onBack();
            }, 100);

        } catch (e) {
            console.error("Error saving report:", e);
            toast({
                title: "Save Failed",
                description: e instanceof Error ? e.message : "Could not save the report. Please try again.",
                type: "error"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDenominationChange = (value: string, denomination: string) => {
        const numValue = value.replace(/[^0-9]/g, '');
        setDenominationQuantities(prev => ({ ...prev, [String(denomination)]: numValue }));
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

    const getBalanceStatus = (discrepancy: number) => {
        if (Math.abs(discrepancy) < 0.01) {
            return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800', icon: CheckCircle, text: 'Balanced' };
        } else if (discrepancy > 0) {
            return { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800', icon: AlertTriangle, text: `+${formatCurrency(Math.abs(discrepancy))}` };
        } else {
            return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800', icon: AlertTriangle, text: `-${formatCurrency(Math.abs(discrepancy))}` };
        }
    };

    const confirmationDescription = useMemo(() => {
        let baseText = "You are about to finalize the financial report for today. This action cannot be undone.";
        if (!stats || stats.changeOwedForPeriod <= 0) {
            return baseText;
        }

        const changeText = `You have indicated that customer change of ${formatCurrency(stats.changeOwedForPeriod)} will be ${deductCustomerChange ? 'DEDUCTED from the available cash' : 'LEFT IN the cash drawer'}.`;

        return `${changeText} ${baseText}`;
    }, [stats, deductCustomerChange]);

    const AdvancedReconciliationModal = () => {
        const [checkedOrderIds, setCheckedOrderIds] = useState(new Set<string>());
        const [searchQuery, setSearchQuery] = useState('');

        const handleCheckChange = (orderId: string, isChecked: boolean) => {
            setCheckedOrderIds(prev => {
                const newSet = new Set(prev);
                if (isChecked) newSet.add(orderId);
                else newSet.delete(orderId);
                return newSet;
            });
        };

        const filteredOrders = useMemo(() => stats?.orders.filter(order =>
            order.simplifiedId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (order.tag && order.tag.toLowerCase().includes(searchQuery.toLowerCase()))
        ) || [], [searchQuery, stats?.orders]);

        const checkedTotal = useMemo(() => filteredOrders
            .filter(o => checkedOrderIds.has(o.id))
            .reduce((sum, o) => sum + o.total, 0), [filteredOrders, checkedOrderIds]);

        const uncheckedTotal = useMemo(() => filteredOrders
            .filter(o => !checkedOrderIds.has(o.id))
            .reduce((sum, o) => sum + o.total, 0), [filteredOrders, checkedOrderIds]);

        const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        return (
            <Dialog open={isAdvancedModalOpen} onOpenChange={setIsAdvancedModalOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Cross-Check Digital vs Written Orders
                        </DialogTitle>
                        <DialogDescription>
                            Compare your digital orders against physical kitchen tickets to identify missing or extra orders.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 py-4">
                        <div className="lg:col-span-3 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by Order ID or Table/Tag..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <ScrollArea className="h-96 border rounded-lg">
                                <div className="p-4 space-y-3">
                                    {filteredOrders.length > 0 ? filteredOrders.map(order => (
                                        <div
                                            key={order.id}
                                            className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${checkedOrderIds.has(order.id)
                                                ? 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800'
                                                : 'bg-card hover:bg-muted/50'
                                                }`}
                                        >
                                            <Checkbox
                                                id={`check-${order.id}`}
                                                checked={checkedOrderIds.has(order.id)}
                                                onCheckedChange={(checked) => handleCheckChange(order.id, !!checked)}
                                                className="mt-1"
                                            />
                                            <Label htmlFor={`check-${order.id}`} className="flex-1 cursor-pointer">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-lg">{order.simplifiedId}</span>
                                                            {order.tag && <Badge variant="outline" className="text-xs">{order.tag}</Badge>}
                                                            <Badge variant={order.paymentStatus === 'Paid' ? 'default' : 'secondary'} className="text-xs">
                                                                {order.paymentStatus}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            {formatTime(order.timestamp.toDate())}
                                                        </p>
                                                        <div className="text-xs text-muted-foreground">
                                                            {order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                                                        </div>
                                                    </div>
                                                    <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                                                </div>
                                            </Label>
                                        </div>
                                    )) : (
                                        <div className="text-center py-12">
                                            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                            <p className="text-muted-foreground">No orders found</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                        <div className="space-y-4">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Audit Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                        <p className="text-sm text-blue-600 dark:text-blue-300">Total Digital Orders</p>
                                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-200">{filteredOrders.length}</p>
                                        <p className="text-sm font-medium">{formatCurrency(filteredOrders.reduce((sum, o) => sum + o.total, 0))}</p>
                                    </div>
                                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                                        <p className="text-sm text-green-600 dark:text-green-300">✓ Verified Orders</p>
                                        <p className="text-2xl font-bold text-green-700 dark:text-green-200">{checkedOrderIds.size}</p>
                                        <p className="text-sm font-medium">{formatCurrency(checkedTotal)}</p>
                                    </div>
                                    <div className="text-center p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                                        <p className="text-sm text-red-600 dark:text-red-300">⚠ Unverified Orders</p>
                                        <p className="text-2xl font-bold text-red-700 dark:text-red-200">{filteredOrders.length - checkedOrderIds.size}</p>
                                        <p className="text-sm font-medium">{formatCurrency(uncheckedTotal)}</p>
                                    </div>
                                    {checkedOrderIds.size === filteredOrders.length && filteredOrders.length > 0 && (
                                        <Alert>
                                            <CheckCircle className="h-4 w-4" />
                                            <AlertDescription className="text-sm">
                                                All digital orders verified! If cash doesn't balance, check for unrecorded written orders.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">Quick Tips</CardTitle>
                                </CardHeader>
                                <CardContent className="text-xs text-muted-foreground space-y-2">
                                    <p>• Check each digital order against your written tickets</p>
                                    <p>• Look for missing digital entries</p>
                                    <p>• Verify payment methods match</p>
                                    <p>• Check for duplicate entries</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setIsAdvancedModalOpen(false)}>
                            Close Audit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    return (
        <>
            <Dialog open={true} onOpenChange={(open) => !open && onBack()}>
                <DialogContent className="max-w-7xl max-h-[90vh]">
                    <DialogHeader className="pb-4 border-b">
                        <DialogTitle className="text-2xl font-bold">End-of-Day Reconciliation</DialogTitle>
                        <DialogDescription className="text-base">
                            Complete daily cash reconciliation and account for all transactions for {format(today, "EEEE, MMMM dd, yyyy")}
                        </DialogDescription>
                    </DialogHeader>

                    {!stats ? <LoadingSpinner /> : (
                        <ScrollArea className="max-h-[70vh]">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-6 pr-4">
                                <div className="lg:col-span-1 space-y-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <Banknote className="h-5 w-5 text-green-600" />
                                                Physical Cash Count
                                            </CardTitle>
                                            <CardDescription>Count each denomination in your cash drawer</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                                {cashDenominations.map(den => (
                                                    <div key={den} className="space-y-2">
                                                        <Label className="text-sm font-medium">GH₵{den}</Label>
                                                        <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg border">
                                                            <span className="text-sm text-muted-foreground min-w-[20px]">×</span>
                                                            <Input
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={denominationQuantities[String(den)]}
                                                                onChange={(e) => handleDenominationChange(e.target.value, String(den))}
                                                                placeholder="0"
                                                                className="text-center font-medium border-0 bg-transparent p-0 h-auto focus-visible:ring-1"
                                                            />
                                                        </div>
                                                        <div className="text-xs text-center text-muted-foreground">
                                                            {denominationQuantities[String(den)]
                                                                ? formatCurrency(den * (parseInt(String(denominationQuantities[String(den)])) || 0))
                                                                : ''}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-semibold text-green-800 dark:text-green-200">Total Cash Counted:</span>
                                                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                                        {formatCurrency(totalCountedCash)}
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <Smartphone className="h-5 w-5 text-purple-600" />
                                                MoMo/Card Transactions
                                            </CardTitle>
                                            <CardDescription>Enter individual transaction amounts (press Space or Enter to add)</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={momoInput}
                                                onChange={(e) => setMomoInput(e.target.value)}
                                                onKeyDown={handleMomoInputKeyDown}
                                                placeholder="Enter amount and press Space/Enter"
                                                className="mb-4 h-12 text-lg"
                                            />
                                            {momoTransactions.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {momoTransactions.map((amount, index) => (
                                                        <Badge key={index} variant="secondary" className="text-sm px-3 py-2">
                                                            {formatCurrency(amount)}
                                                            <button
                                                                onClick={() => removeMomoTransaction(index)}
                                                                className="ml-2 hover:bg-destructive/20 rounded-full p-0.5"
                                                                title={`Remove ${formatCurrency(amount)} transaction`}
                                                                aria-label={`Remove ${formatCurrency(amount)} transaction`}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-semibold text-purple-800 dark:text-purple-200">Total MoMo Counted:</span>
                                                    <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                                                        {formatCurrency(totalCountedMomo)}
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {stats.changeOwedForPeriod > 0 && (
                                        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/50">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-lg text-orange-800 dark:text-orange-200">
                                                    <ArrowRightLeft className="h-5 w-5" />
                                                    Customer Change Management
                                                </CardTitle>
                                                <CardDescription>
                                                    You owe {formatCurrency(stats.changeOwedForPeriod)} in customer change from today
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                                                    <div className="flex items-center space-x-3">
                                                        <Switch
                                                            id="deduct-change"
                                                            checked={deductCustomerChange}
                                                            onCheckedChange={setDeductCustomerChange}
                                                        />
                                                        <Label htmlFor="deduct-change" className="font-medium">
                                                            Deduct customer change from available cash?
                                                        </Label>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-3">
                                                    {deductCustomerChange
                                                        ? "Change will be set aside and deducted from your available cash."
                                                        : "Change will be counted as part of available cash (pay customers immediately)."
                                                    }
                                                </p>
                                            </CardContent>
                                        </Card>
                                    )}

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Notes &amp; Comments</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <Textarea
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Explain any discrepancies, issues, or special circumstances..."
                                                className="min-h-[100px]"
                                            />
                                        </CardContent>
                                    </Card>

                                    <Button
                                        variant="outline"
                                        size="lg"
                                        className="w-full"
                                        onClick={() => setIsAdvancedModalOpen(true)}
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        Cross-Check Orders
                                    </Button>
                                </div>

                                <div className="lg:col-span-2 space-y-6">
                                    <div className="text-center">
                                        <h3 className="text-2xl font-bold mb-2">Reconciliation Analysis</h3>
                                        <p className="text-muted-foreground">Comparing expected vs counted</p>
                                    </div>

                                    <Card className="border-2">
                                        <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
                                            <CardTitle className="flex items-center gap-2">
                                                <TrendingUp className="h-5 w-5 text-blue-600" />
                                                Expected Money Breakdown
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <h4 className="font-semibold text-lg text-blue-600">Cash Expected</h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between"><span>Today's Cash Sales:</span><span className="font-medium">{formatCurrency(stats.cashSales)}</span></div>
                                                        <div className="flex justify-between text-red-600"><span>(-) Cash Expenses:</span><span className="font-medium">-{formatCurrency(stats.miscCashExpenses)}</span></div>
                                                        {stats.settledUnpaidCash > 0 && <div className="flex justify-between text-green-600"><span>(+) Collections (Cash):</span><span className="font-medium">+{formatCurrency(stats.settledUnpaidCash)}</span></div>}
                                                        {stats.previousDaysChangeGiven > 0 && <div className="flex justify-between text-orange-600"><span>(-) Previous Days Change:</span><span className="font-medium">-{formatCurrency(stats.previousDaysChangeGiven)}</span></div>}
                                                        <UiSeparator />
                                                        <div className="flex justify-between font-bold text-blue-700 text-base"><span>Expected Cash:</span><span>{formatCurrency(adjustedExpectedCash)}</span></div>
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <h4 className="font-semibold text-lg text-purple-600">MoMo/Card Expected</h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between"><span>Today's MoMo Sales:</span><span className="font-medium">{formatCurrency(stats.momoSales)}</span></div>
                                                        <div className="flex justify-between text-red-600"><span>(-) MoMo Expenses:</span><span className="font-medium">-{formatCurrency(stats.miscMomoExpenses)}</span></div>
                                                        {stats.settledUnpaidMomo > 0 && <div className="flex justify-between text-green-600"><span>(+) Collections (MoMo):</span><span className="font-medium">+{formatCurrency(stats.settledUnpaidMomo)}</span></div>}
                                                        <UiSeparator />
                                                        <div className="flex justify-between font-bold text-purple-700 text-base"><span>Expected MoMo:</span><span>{formatCurrency(adjustedExpectedMomo)}</span></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="bg-primary/10 p-4">
                                            <div className="w-full flex justify-between items-center"><span className="font-bold text-primary text-lg">Total Expected:</span><span className="font-extrabold text-primary text-xl">{formatCurrency(adjustedExpectedCash + adjustedExpectedMomo)}</span></div>
                                        </CardFooter>
                                    </Card>

                                    <Card>
                                        <CardHeader className="bg-green-50 dark:bg-green-900/20"><CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-green-600" />Counted Money</CardTitle></CardHeader>
                                        <CardContent className="p-6 space-y-4">
                                            <div className="space-y-2 text-sm">
                                                <h4 className="font-semibold text-base text-green-600">Cash</h4>
                                                <div className="flex justify-between"><span>Cash Counted:</span><span className="font-medium">{formatCurrency(totalCountedCash)}</span></div>
                                                {stats.changeOwedForPeriod > 0 && (
                                                    <div className="flex justify-between text-orange-600"><span>(-) Today's Change:</span>
                                                        <span>{deductCustomerChange ? `-${formatCurrency(stats.changeOwedForPeriod)}` : '-GH₵0.00'}</span></div>)}
                                                <UiSeparator />
                                                <div className="flex justify-between font-bold text-green-700"><span>Available Cash:</span><span>{formatCurrency(availableCash)}</span></div>
                                            </div>
                                            <div className="space-y-2 text-sm">
                                                <h4 className="font-semibold text-base text-purple-600">MoMo/Card</h4>
                                                <div className="flex justify-between font-bold text-purple-700"><span>Available MoMo:</span><span>{formatCurrency(totalCountedMomo)}</span></div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="bg-green-500/10 p-4"><div className="w-full flex justify-between items-center"><span className="font-bold text-green-700 dark:text-green-300 text-lg">Total Available:</span><span className="font-extrabold text-green-600 dark:text-green-400 text-xl">{formatCurrency(availableCash + totalCountedMomo)}</span></div></CardFooter>
                                    </Card>

                                    <Card className={`border-2 ${getBalanceStatus(totalDiscrepancy).bg}`}>
                                        <CardContent className="p-6"><div className="flex items-center justify-center space-x-3">{React.createElement(getBalanceStatus(totalDiscrepancy).icon, { className: `h-8 w-8 ${getBalanceStatus(totalDiscrepancy).color}` })}<div className="text-center"><p className="text-lg font-semibold">Overall Balance</p><p className={`text-2xl font-bold ${getBalanceStatus(totalDiscrepancy).color}`}>{getBalanceStatus(totalDiscrepancy).text}</p></div></div></CardContent>
                                    </Card>
                                </div>
                            </div>
                        </ScrollArea>
                    )}

                    <DialogFooter className="pt-6 border-t">
                        <Button variant="secondary" onClick={onBack} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={() => setShowConfirm(true)} disabled={isSubmitting || !stats} className="w-full md:w-auto h-12 text-lg font-bold bg-green-600 hover:bg-green-700">
                            {isSubmitting ? <LoadingSpinner /> : 'Save & Finalize Report'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {showConfirm && (
                <AlertDialog open onOpenChange={setShowConfirm}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                {confirmationDescription}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSaveReport}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            {isAdvancedModalOpen && <AdvancedReconciliationModal />}
        </>
    );
}


const AccountingView: React.FC<{ setActiveView: (view: string) => void }> = ({ setActiveView }) => {
    const [stats, setStats] = useState<PeriodStats | null>(null);
    const [reports, setReports] = useState<ReconciliationReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showReconciliation, setShowReconciliation] = useState(false);
    const [showUnpaidOrdersWarning, setShowUnpaidOrdersWarning] = useState(false);
    const [previousCollections, setPreviousCollections] = useState<any[]>([]);
    const [showCollectionsModal, setShowCollectionsModal] = useState(false);
    const [showCashModal, setShowCashModal] = useState(false);
    const [showMomoModal, setShowMomoModal] = useState(false);
    const [selectedSalesOrders, setSelectedSalesOrders] = useState<any[]>([]);
    const [showTotalSalesModal, setShowTotalSalesModal] = useState(false);
    const [showUnpaidModal, setShowUnpaidModal] = useState(false);
    const [showExpensesModal, setShowExpensesModal] = useState(false);
    const [showRewardsModal, setShowRewardsModal] = useState(false);
    const [showPardonedModal, setShowPardonedModal] = useState(false);
    const [showChangeOwedModal, setShowChangeOwedModal] = useState(false);
    const [showPrevChangeModal, setShowPrevChangeModal] = useState(false);
    const [miscExpenses, setMiscExpenses] = useState<MiscExpense[]>([]);
    const [allUnpaidOrders, setAllUnpaidOrders] = useState<Order[]>([]);
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
    const [currentDateStr, setCurrentDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
    const { toast } = useToast();

    const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
    const todayEnd = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }, []);

    const isTodayClosedOut = useMemo(() => {
        return reports.some(report => {
            // Guard against missing/null timestamps coming from the DB
            // (e.g., partially written docs). Only call toDate() when
            // a timestamp is present.
            const ts: any = report.timestamp;
            if (!ts) return false;
            try {
                return isToday(ts.toDate());
            } catch (e) {
                console.warn('Invalid report timestamp', report.id, e);
                return false;
            }
        });
    }, [reports]);

    // Midnight boundary refresh - check every minute if the date has changed
    useEffect(() => {
        const checkDateChange = () => {
            const newDateStr = format(new Date(), 'yyyy-MM-dd');
            if (newDateStr !== currentDateStr) {
                // Date has changed (midnight passed)
                const previousDate = currentDateStr;
                setCurrentDateStr(newDateStr);

                // Check if previous day had activity but no reconciliation
                const previousDayHadActivity = stats && (stats.totalSales > 0 || stats.orders.length > 0);
                const previousDayNotClosed = !isTodayClosedOut;

                if (previousDayHadActivity && previousDayNotClosed) {
                    // Show warning toast
                    toast({
                        title: "⚠️ Previous Day Not Reconciled",
                        description: `Sales data from ${previousDate} was not saved. Please contact your manager to reconcile.`,
                        type: "error",
                    });

                    // Store unsaved data reference in localStorage for recovery
                    try {
                        localStorage.setItem('unsavedReconciliation', JSON.stringify({
                            date: previousDate,
                            totalSales: stats?.totalSales || 0,
                            cashSales: stats?.cashSales || 0,
                            momoSales: stats?.momoSales || 0,
                            timestamp: new Date().toISOString()
                        }));
                    } catch (e) {
                        console.error('Failed to save unsaved reconciliation to localStorage:', e);
                    }

                    // Trigger email notification (fire and forget)
                    fetch('/api/send-report', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'unsaved-reconciliation',
                            date: previousDate,
                            totalSales: stats?.totalSales || 0,
                            cashSales: stats?.cashSales || 0,
                            momoSales: stats?.momoSales || 0,
                        })
                    }).catch(e => console.error('Failed to send unsaved reconciliation email:', e));
                }

                // Force page reload to refresh date boundaries
                window.location.reload();
            }
        };

        // Check every minute
        const interval = setInterval(checkDateChange, 60000);
        return () => clearInterval(interval);
    }, [currentDateStr, stats, isTodayClosedOut, toast]);

    // Check for unsaved reconciliation warning on mount
    useEffect(() => {
        try {
            const unsaved = localStorage.getItem('unsavedReconciliation');
            if (unsaved) {
                const data = JSON.parse(unsaved);
                // Only show warning if from previous days (not today)
                if (data.date !== format(new Date(), 'yyyy-MM-dd')) {
                    setShowUnsavedWarning(true);
                }
            }
        } catch (e) {
            console.error('Failed to check unsaved reconciliation:', e);
        }
    }, []);

    // Track activity for unsaved warning - when there's sales activity, mark as potentially unsaved
    useEffect(() => {
        if (stats && stats.totalSales > 0 && !isTodayClosedOut) {
            try {
                localStorage.setItem('pendingReconciliation', JSON.stringify({
                    date: format(new Date(), 'yyyy-MM-dd'),
                    totalSales: stats.totalSales,
                    cashSales: stats.cashSales,
                    momoSales: stats.momoSales,
                }));
            } catch (e) {
                console.error('Failed to track pending reconciliation:', e);
            }
        }
    }, [stats, isTodayClosedOut]);

    useEffect(() => {
        setLoading(true);
        setError(null);

        const ordersQuery = query(collection(db, "orders"));
        const miscExpensesQuery = query(collection(db, "miscExpenses"));

        const unsubAllOrders = onSnapshot(ordersQuery, (allOrdersSnapshot) => {
            const unsubMiscExpenses = onSnapshot(miscExpensesQuery, (miscExpensesSnapshot) => {

                let totalSales = 0, totalItemsSold = 0;
                let cashSales = 0, momoSales = 0;
                let todayUnpaidOrdersValue = 0, previousUnpaidOrdersValue = 0;
                let totalPardonedAmount = 0, changeOwedForPeriod = 0;
                let settledUnpaidOrdersValue = 0, settledUnpaidCash = 0, settledUnpaidMomo = 0;
                let previousDaysChangeGiven = 0;
                let totalRewardDiscount = 0;
                const collectionsDetails: any[] = [];
                const unpaidOrdersList: Order[] = [];

                const todayOrders: Order[] = [];
                const itemStats: Record<string, { count: number; totalValue: number }> = {};

                const allOrders = allOrdersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

                allOrders.forEach(order => {
                    const orderDate = order.timestamp.toDate();
                    const isTodayOrder = orderDate >= todayStart && orderDate <= todayEnd;

                    if (orderDate < todayStart && (order.paymentStatus === 'Unpaid' || order.paymentStatus === 'Partially Paid')) {
                        previousUnpaidOrdersValue += order.balanceDue;
                        unpaidOrdersList.push(order);
                    }

                    if (isTodayOrder) {
                        todayOrders.push(order);

                        const reward = order.rewardDiscount || 0;
                        const orderNetTotal = (order.total || 0) - reward;

                        if (order.status === "Completed") {
                            totalSales += orderNetTotal;
                            order.items.forEach(item => {
                                totalItemsSold += item.quantity;
                                itemStats[item.name] = {
                                    count: (itemStats[item.name]?.count || 0) + item.quantity,
                                    totalValue: (itemStats[item.name]?.totalValue || 0) + (item.quantity * item.price)
                                };
                            });
                        }

                        if (order.balanceDue > 0) {
                            todayUnpaidOrdersValue += order.balanceDue;
                            unpaidOrdersList.push(order);
                        }

                        totalPardonedAmount += order.pardonedAmount || 0;
                        totalRewardDiscount += order.rewardDiscount || 0;
                        if (order.balanceDue < 0) {
                            changeOwedForPeriod += Math.abs(order.balanceDue);
                        }
                    }

                    if (order.paymentHistory && Array.isArray(order.paymentHistory)) {
                        let cashPaid = 0;
                        let momoPaid = 0;
                        order.paymentHistory.forEach(payment => {
                            const paymentDate = payment.timestamp?.toDate();
                            if (paymentDate && paymentDate >= todayStart && paymentDate <= todayEnd) {
                                const paymentAmount = payment.amount || 0;
                                if (payment.method === 'cash') {
                                    cashPaid += paymentAmount;
                                    if (!isTodayOrder) {
                                        settledUnpaidCash += paymentAmount;
                                        settledUnpaidOrdersValue += paymentAmount;
                                    }
                                } else if (payment.method === 'momo' || payment.method === 'card') {
                                    momoPaid += paymentAmount;
                                    if (!isTodayOrder) {
                                        settledUnpaidMomo += paymentAmount;
                                        settledUnpaidOrdersValue += paymentAmount;
                                    }
                                }

                                if (!isTodayOrder) {
                                    // record details for modal
                                    collectionsDetails.push({
                                        orderId: order.id,
                                        simplifiedId: order.simplifiedId,
                                        tag: order.tag,
                                        amount: paymentAmount,
                                        method: payment.method,
                                        timestamp: paymentDate,
                                        items: order.items,
                                    });
                                }
                            }
                        });
                        if (isTodayOrder) {
                            const reward = order.rewardDiscount || 0;
                            const orderNetTotal = (order.total || 0) - reward;
                            cashSales += Math.min(orderNetTotal, cashPaid);
                            momoSales += Math.min(orderNetTotal, momoPaid);
                        }
                    } else {
                        const paymentDate = order.lastPaymentTimestamp?.toDate();
                        if (paymentDate && paymentDate >= todayStart && paymentDate <= todayEnd) {

                            const amountPaidTowardsOrder = order.amountPaid - order.changeGiven;

                            if (order.paymentBreakdown) {
                                const reward = order.rewardDiscount || 0;
                                const orderNetTotal = (order.total || 0) - reward;
                                if (order.paymentBreakdown.cash) {
                                    cashSales += Math.min(orderNetTotal, order.paymentBreakdown.cash);
                                }
                                if (order.paymentBreakdown.momo) {
                                    momoSales += Math.min(orderNetTotal, order.paymentBreakdown.momo);
                                }
                            } else {
                                const reward = order.rewardDiscount || 0;
                                const orderNetTotal = (order.total || 0) - reward;
                                const revenueAmount = Math.min(amountPaidTowardsOrder, orderNetTotal);

                                if (order.paymentMethod === 'cash') {
                                    cashSales += revenueAmount;
                                } else if (order.paymentMethod === 'momo' || order.paymentMethod === 'card') {
                                    momoSales += revenueAmount;
                                }
                            }

                            if (!isTodayOrder) {
                                settledUnpaidOrdersValue += amountPaidTowardsOrder;
                                // Determine method for this payment (best-effort) and track separately
                                let method = order.paymentMethod || 'cash';
                                if (order.paymentBreakdown) {
                                    if ((order.paymentBreakdown.cash || 0) > 0 && (order.paymentBreakdown.momo || 0) > 0) {
                                        method = 'split';
                                        settledUnpaidCash += order.paymentBreakdown.cash || 0;
                                        settledUnpaidMomo += order.paymentBreakdown.momo || 0;
                                    } else if ((order.paymentBreakdown.momo || 0) > 0) {
                                        method = 'momo';
                                        settledUnpaidMomo += amountPaidTowardsOrder;
                                    } else {
                                        method = 'cash';
                                        settledUnpaidCash += amountPaidTowardsOrder;
                                    }
                                } else if (method === 'cash') {
                                    settledUnpaidCash += amountPaidTowardsOrder;
                                } else if (method === 'momo' || method === 'card') {
                                    settledUnpaidMomo += amountPaidTowardsOrder;
                                } else {
                                    // Default to cash if unknown
                                    settledUnpaidCash += amountPaidTowardsOrder;
                                }
                                collectionsDetails.push({
                                    orderId: order.id,
                                    simplifiedId: order.simplifiedId,
                                    tag: order.tag,
                                    amount: amountPaidTowardsOrder,
                                    method,
                                    timestamp: paymentDate,
                                    items: order.items,
                                });
                            }
                        }
                    }

                    const settledDate = order.settledOn?.toDate();
                    if (settledDate && settledDate >= todayStart && settledDate <= todayEnd && !isTodayOrder) {
                        if (order.changeGiven > (order.pardonedAmount || 0)) {
                            previousDaysChangeGiven += (order.changeGiven - (order.pardonedAmount || 0));
                        }
                    }
                });

                let miscCashExpenses = 0, miscMomoExpenses = 0;
                const todayMiscExpenses: MiscExpense[] = [];
                miscExpensesSnapshot.docs.forEach(doc => {
                    const expense = { id: doc.id, ...doc.data() } as MiscExpense;
                    const expenseDate = expense.timestamp.toDate();
                    if (expenseDate >= todayStart && expenseDate <= todayEnd) {
                        todayMiscExpenses.push(expense);
                        if (expense.source === 'cash') miscCashExpenses += expense.amount;
                        else miscMomoExpenses += expense.amount;
                    }
                });
                setMiscExpenses(todayMiscExpenses);

                const allTimeUnpaidOrdersValue = previousUnpaidOrdersValue + todayUnpaidOrdersValue;
                const totalMiscExpenses = miscCashExpenses + miscMomoExpenses;
                const totalRevenueToday = cashSales + momoSales;
                const netRevenue = totalRevenueToday - totalMiscExpenses - totalRewardDiscount;

                setStats({
                    totalSales,
                    totalItemsSold,
                    cashSales,
                    momoSales,
                    miscCashExpenses,
                    miscMomoExpenses,
                    netRevenue,
                    todayUnpaidOrdersValue,
                    allTimeUnpaidOrdersValue,
                    previousUnpaidOrdersValue,
                    totalPardonedAmount,
                    changeOwedForPeriod,
                    settledUnpaidOrdersValue,
                    settledUnpaidCash,
                    settledUnpaidMomo,
                    previousDaysChangeGiven,
                    totalRewardDiscount,
                    orders: todayOrders,
                    itemStats
                });

                // Save the collections details to state so the UI can display the
                // individual orders that contributed to today's collections from
                // previous days.
                setPreviousCollections(collectionsDetails);
                setAllUnpaidOrders(unpaidOrdersList);

                setLoading(false);
            }, (error) => {
                console.error("Error fetching misc expenses:", error);
                setError("Failed to load miscellaneous expenses data.");
                setLoading(false);
            });

            return () => unsubMiscExpenses();

        }, (error) => {
            console.error("Error fetching all orders:", error);
            setError("Failed to load order data.");
            setLoading(false);
        });

        const reportsQuery = query(collection(db, "reconciliationReports"), orderBy('timestamp', 'desc'));
        const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
            setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReconciliationReport)));
        }, (error) => {
            console.error("Error fetching reports:", error);
            setError("Failed to load reconciliation reports.");
        });

        return () => {
            unsubAllOrders();
            unsubReports();
        };
    }, [todayStart, todayEnd]);

    const handleStartEndDay = () => {
        if (stats?.todayUnpaidOrdersValue && stats.todayUnpaidOrdersValue > 0) {
            setShowUnpaidOrdersWarning(true);
        } else {
            setShowReconciliation(true);
        }
    }

    const sortedItemStats = useMemo(() => {
        if (!stats) return [];
        return Object.entries(stats.itemStats).sort(([, a], [, b]) => b.count - a.count);
    }, [stats]);

    const adjustedExpectedCash = useMemo(() => {
        if (!stats) return 0;
        let expected = stats.cashSales;
        expected += stats.settledUnpaidCash; // Only cash collections from previous days
        expected -= stats.miscCashExpenses;
        expected -= stats.previousDaysChangeGiven;
        return expected;
    }, [stats]);

    const adjustedExpectedMomo = useMemo(() => {
        if (!stats) return 0;
        let expected = stats.momoSales;
        expected += stats.settledUnpaidMomo; // Only momo collections from previous days
        expected -= stats.miscMomoExpenses;
        return expected;
    }, [stats]);


    if (showReconciliation && stats) {
        return <ReconciliationView stats={stats} adjustedExpectedCash={adjustedExpectedCash} adjustedExpectedMomo={adjustedExpectedMomo} miscExpenses={miscExpenses} onBack={() => setShowReconciliation(false)} />;
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
                <div className="px-3 py-2 md:p-4 bg-background">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                        <h1 className="text-lg md:text-xl font-bold truncate">Accounting</h1>
                        <Button onClick={handleStartEndDay} disabled={isTodayClosedOut} size="sm" className="h-8 text-xs md:text-sm flex-shrink-0">
                            <FileSignature className="mr-1.5 h-3.5 w-3.5" />
                            {isTodayClosedOut ? 'Day Closed' : 'End-of-Day'}
                        </Button>
                    </div>

                    {/* Unsaved Reconciliation Warning Banner */}
                    {showUnsavedWarning && (
                        <Alert variant="destructive" className="mb-3">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Previous Day Not Reconciled</AlertTitle>
                            <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span>There is unsaved accounting data from a previous day. Please contact your manager.</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        localStorage.removeItem('unsavedReconciliation');
                                        setShowUnsavedWarning(false);
                                    }}
                                    className="flex-shrink-0"
                                >
                                    Dismiss
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Current Day Activity Warning - Only show if there's activity and day not closed */}
                    {!isTodayClosedOut && stats && stats.totalSales > 0 && (
                        <Alert className="mb-3 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertTitle className="text-amber-800 dark:text-amber-200">Reminder: Save Your Work</AlertTitle>
                            <AlertDescription className="text-amber-700 dark:text-amber-300">
                                You have {formatCurrency(stats.totalSales)} in sales today. Remember to complete End-of-Day reconciliation before closing.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
                <Tabs defaultValue="summary" className="flex-1 flex flex-col px-3 md:px-4 pb-4">
                    <TabsList className="grid w-full grid-cols-2 mx-auto max-w-xs h-8">
                        <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
                        <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
                    </TabsList>
                    <TabsContent value="summary" className="flex-1 mt-4">
                        {loading ? <LoadingSpinner /> : error ? (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Failed to Load Data</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : stats ? (
                            <div className="space-y-4 md:space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
                                    <div className="lg:col-span-2 space-y-3 md:space-y-4">
                                        <Card>
                                            <CardHeader className="p-3 md:p-4">
                                                <CardTitle className="text-base md:text-lg">Financial Summary</CardTitle>
                                                <CardDescription className="text-xs">{format(new Date(), "EEEE, MMM dd, yyyy")}</CardDescription>
                                            </CardHeader>
                                            <CardContent className="grid grid-cols-2 gap-2 md:gap-3 p-3 md:p-4 pt-0">
                                                <StatCard
                                                    icon={<DollarSign className="text-muted-foreground h-4 w-4" />}
                                                    title="Total Sales"
                                                    value={formatCurrency(stats.totalSales)}
                                                    description={`${stats.totalItemsSold} items sold`}
                                                    onClick={() => setShowTotalSalesModal(true)}
                                                />
                                                <Card>
                                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3">
                                                        <CardTitle className="text-xs md:text-sm font-medium truncate pr-2">Cash Sales</CardTitle>
                                                        <Banknote className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                                                    </CardHeader>
                                                    <CardContent className="p-3 pt-0">
                                                        <div className="text-lg md:text-2xl font-bold">
                                                            <button
                                                                className="underline font-semibold"
                                                                onClick={() => {
                                                                    // compute orders contributing to cash sales
                                                                    const ordersList: any[] = [];
                                                                    (stats.orders || []).forEach((order: any) => {
                                                                        // payments in history for today
                                                                        if (order.paymentHistory && Array.isArray(order.paymentHistory)) {
                                                                            const amt = order.paymentHistory.reduce((sum: number, p: any) => {
                                                                                if (p.method === 'cash') return sum + (p.amount || 0);
                                                                                return sum;
                                                                            }, 0);
                                                                            if (amt > 0) ordersList.push({ order, amount: amt, method: 'cash' });
                                                                        } else if (order.paymentBreakdown && order.paymentBreakdown.cash) {
                                                                            const amt = order.paymentBreakdown.cash || 0;
                                                                            if (amt > 0) ordersList.push({ order, amount: amt, method: 'cash' });
                                                                        } else if (order.paymentMethod === 'cash') {
                                                                            // fallback: attribute full paid amount (amountPaid - changeGiven)
                                                                            const amt = Math.max(0, (order.amountPaid || 0) - (order.changeGiven || 0));
                                                                            if (amt > 0) ordersList.push({ order, amount: amt, method: 'cash' });
                                                                        }
                                                                    });
                                                                    setSelectedSalesOrders(ordersList);
                                                                    setShowCashModal(true);
                                                                }}
                                                            >
                                                                {formatCurrency(stats.cashSales)}
                                                            </button>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground space-y-0.5">
                                                            <div className="flex justify-between">
                                                                <span>Today's sales:</span>
                                                                <span className="font-medium">{formatCurrency(stats.cashSales - stats.settledUnpaidCash)}</span>
                                                            </div>
                                                            {stats.settledUnpaidCash > 0 && (
                                                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                                                    <span>+ Collections:</span>
                                                                    <span className="font-medium">{formatCurrency(stats.settledUnpaidCash)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                <Card>
                                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3">
                                                        <CardTitle className="text-xs md:text-sm font-medium">Momo/Card Sales</CardTitle>
                                                        <CreditCard className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                                                    </CardHeader>
                                                    <CardContent className="p-3 pt-0">
                                                        <div className="text-lg md:text-2xl font-bold">
                                                            <button
                                                                className="underline font-semibold"
                                                                onClick={() => {
                                                                    const ordersList: any[] = [];
                                                                    (stats.orders || []).forEach((order: any) => {
                                                                        if (order.paymentHistory && Array.isArray(order.paymentHistory)) {
                                                                            const amt = order.paymentHistory.reduce((sum: number, p: any) => {
                                                                                if (p.method === 'momo' || p.method === 'card') return sum + (p.amount || 0);
                                                                                return sum;
                                                                            }, 0);
                                                                            if (amt > 0) ordersList.push({ order, amount: amt, method: 'momo' });
                                                                        } else if (order.paymentBreakdown && order.paymentBreakdown.momo) {
                                                                            const amt = order.paymentBreakdown.momo || 0;
                                                                            if (amt > 0) ordersList.push({ order, amount: amt, method: 'momo' });
                                                                        } else if (order.paymentMethod === 'momo' || order.paymentMethod === 'card') {
                                                                            const amt = Math.max(0, (order.amountPaid || 0) - (order.changeGiven || 0));
                                                                            if (amt > 0) ordersList.push({ order, amount: amt, method: order.paymentMethod });
                                                                        }
                                                                    });
                                                                    setSelectedSalesOrders(ordersList);
                                                                    setShowMomoModal(true);
                                                                }}
                                                            >
                                                                {formatCurrency(stats.momoSales)}
                                                            </button>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground space-y-0.5">
                                                            <div className="flex justify-between">
                                                                <span>Today's sales:</span>
                                                                <span className="font-medium">{formatCurrency(stats.momoSales - stats.settledUnpaidMomo)}</span>
                                                            </div>
                                                            {stats.settledUnpaidMomo > 0 && (
                                                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                                                    <span>+ Collections:</span>
                                                                    <span className="font-medium">{formatCurrency(stats.settledUnpaidMomo)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                                <StatCard
                                                    icon={<Hourglass className="text-muted-foreground" />}
                                                    title="Unpaid Orders (All Time)"
                                                    value={formatCurrency(stats.allTimeUnpaidOrdersValue)}
                                                    description={
                                                        <span>
                                                            <strong className="text-base font-semibold text-foreground">Today: {formatCurrency(stats.todayUnpaidOrdersValue)}</strong>
                                                            {' | '}
                                                            Previous: {formatCurrency(stats.previousUnpaidOrdersValue)}
                                                        </span>
                                                    }
                                                    onClick={() => setShowUnpaidModal(true)}
                                                />
                                                <StatCard
                                                    icon={<MinusCircle className="text-muted-foreground" />}
                                                    title="Total Misc. Expenses"
                                                    value={formatCurrency(stats.miscCashExpenses + stats.miscMomoExpenses)}
                                                    description={`Cash: ${formatCurrency(stats.miscCashExpenses)} | Momo: ${formatCurrency(stats.miscMomoExpenses)}`}
                                                    onClick={() => setShowExpensesModal(true)}
                                                />
                                                <StatCard
                                                    icon={<Gift className="text-muted-foreground" />}
                                                    title="Reward Discounts"
                                                    value={formatCurrency(stats.totalRewardDiscount)}
                                                    description="Total discounts from rewards"
                                                    onClick={() => setShowRewardsModal(true)}
                                                />
                                                <StatCard
                                                    icon={<Ban className="text-muted-foreground" />}
                                                    title="Pardoned Deficits"
                                                    value={formatCurrency(stats.totalPardonedAmount)}
                                                    description="Unplanned discounts given today"
                                                    onClick={() => setShowPardonedModal(true)}
                                                />
                                                <StatCard
                                                    icon={<ArrowRightLeft className="text-muted-foreground" />}
                                                    title="Change Owed"
                                                    value={formatCurrency(stats.changeOwedForPeriod)}
                                                    description="Total change owed to customers today"
                                                    onClick={() => setShowChangeOwedModal(true)}
                                                />
                                                <StatCard
                                                    icon={<Coins className="text-muted-foreground" />}
                                                    title="Previous Change Given"
                                                    value={formatCurrency(stats.previousDaysChangeGiven)}
                                                    description="Change for old orders given today"
                                                    onClick={() => setShowPrevChangeModal(true)}
                                                />
                                            </CardContent>
                                            <CardFooter>
                                                <div className="w-full p-4 border rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                                                    <div className="flex justify-between items-baseline">
                                                        <Label className="text-sm font-semibold text-green-700 dark:text-green-300">Total Revenue</Label>
                                                        <p className="text-3xl font-bold">{formatCurrency(stats.cashSales + stats.momoSales)}</p>
                                                    </div>

                                                    <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700 text-sm space-y-1">
                                                        <div className="flex justify-between items-center text-green-700 dark:text-green-300">
                                                            <span className="font-bold">Today's Sales Only:</span>
                                                            <span className="font-bold">{formatCurrency((stats.cashSales - stats.settledUnpaidCash) + (stats.momoSales - stats.settledUnpaidMomo) - (stats.miscCashExpenses + stats.miscMomoExpenses))}</span>
                                                        </div>
                                                        {stats.settledUnpaidOrdersValue > 0 && (
                                                            <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                                                                <span>+ Collections from previous:</span>
                                                                <button
                                                                    onClick={() => setShowCollectionsModal(true)}
                                                                    className="font-semibold underline"
                                                                    title="View orders contributing to collections"
                                                                >
                                                                    {formatCurrency(stats.settledUnpaidOrdersValue)}
                                                                </button>
                                                            </div>
                                                        )}
                                                        {(stats.miscCashExpenses + stats.miscMomoExpenses) > 0 && (
                                                            <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 text-xs">
                                                                <span>Expenses deducted:</span>
                                                                <span>-{formatCurrency(stats.miscCashExpenses + stats.miscMomoExpenses)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardFooter>
                                        </Card>
                                    </div>
                                    <div className="flex flex-col">
                                        <Card className="flex-1 flex flex-col">
                                            <CardHeader>
                                                <CardTitle>Item Sales (Completed Orders)</CardTitle>
                                                <CardDescription>Total count and value of each item sold today.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex-1 overflow-y-auto">
                                                <div className="space-y-2">
                                                    {sortedItemStats.length > 0 ? (
                                                        sortedItemStats.map(([name, itemStat]) => (
                                                            <div key={name} className="flex justify-between items-center p-3 rounded-lg bg-secondary">
                                                                <div>
                                                                    <p className="font-semibold">{name}</p>
                                                                    <p className="text-sm text-muted-foreground">{itemStat.count} sold</p>
                                                                </div>
                                                                <Badge variant="destructive">{formatCurrency(itemStat.totalValue)}</Badge>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                                            <p>No items sold today.</p>
                                                        </div>
                                                    )}

                                                    {showCollectionsModal && (
                                                        <Dialog open={showCollectionsModal} onOpenChange={setShowCollectionsModal}>
                                                            <DialogContent className="max-w-3xl max-h-[80vh]">
                                                                <DialogHeader>
                                                                    <DialogTitle>Collections From Previous Orders</DialogTitle>
                                                                    <DialogDescription>Payments received today for orders placed on previous days.</DialogDescription>
                                                                </DialogHeader>
                                                                <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                                                                    {previousCollections.length === 0 ? (
                                                                        <p className="text-muted-foreground">No collections recorded.</p>
                                                                    ) : (
                                                                        previousCollections.map((c, idx) => (
                                                                            <div key={`${c.orderId}-${idx}`} className="p-3 border rounded-lg bg-card">
                                                                                <div className="flex justify-between items-start">
                                                                                    <div>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="font-semibold">{c.simplifiedId || c.orderId}</span>
                                                                                            {c.tag && <Badge variant="outline" className="text-xs">{c.tag}</Badge>}
                                                                                            <Badge className="text-xs">{c.method?.toUpperCase()}</Badge>
                                                                                        </div>
                                                                                        <p className="text-sm text-muted-foreground mt-1">{c.items?.map((it: any) => `${it.quantity}x ${it.name}`).join(', ')}</p>
                                                                                        <p className="text-xs text-muted-foreground mt-1">{c.timestamp ? format(new Date(c.timestamp), 'hh:mm a') : ''}</p>
                                                                                    </div>
                                                                                    <div className="font-bold">{formatCurrency(c.amount)}</div>
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>
                                                                <DialogFooter>
                                                                    <Button variant="ghost" onClick={() => setShowCollectionsModal(false)}>Close</Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="p-6 text-muted-foreground">No data for today.</p>
                        )}
                        {showCashModal && (
                            <Dialog open={showCashModal} onOpenChange={setShowCashModal}>
                                <DialogContent className="max-w-3xl max-h-[80vh]">
                                    <DialogHeader>
                                        <DialogTitle>Cash Sales - Orders</DialogTitle>
                                        <DialogDescription>Orders contributing to today's cash sales.</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                                        {selectedSalesOrders.length === 0 ? (
                                            <p className="text-muted-foreground">No cash sales found.</p>
                                        ) : (
                                            selectedSalesOrders.map((c: any, idx: number) => (
                                                <div key={`${c.order.id}-${idx}`} className="p-3 border rounded-lg bg-card">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{c.order.simplifiedId}</span>
                                                                {c.order.tag && <Badge variant="outline" className="text-xs">{c.order.tag}</Badge>}
                                                                <Badge className="text-xs">{c.method?.toUpperCase()}</Badge>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mt-1">{c.order.items?.map((it: any) => `${it.quantity}x ${it.name}`).join(', ')}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">{c.order.timestamp ? format(c.order.timestamp.toDate(), 'hh:mm a') : ''}</p>
                                                        </div>
                                                        <div className="font-bold">{formatCurrency(c.amount)}</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setShowCashModal(false)}>Close</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        {showMomoModal && (
                            <Dialog open={showMomoModal} onOpenChange={setShowMomoModal}>
                                <DialogContent className="max-w-3xl max-h-[80vh]">
                                    <DialogHeader>
                                        <DialogTitle>MoMo/Card Sales - Orders</DialogTitle>
                                        <DialogDescription>Orders contributing to today's momo/card sales.</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                                        {selectedSalesOrders.length === 0 ? (
                                            <p className="text-muted-foreground">No momo/card sales found.</p>
                                        ) : (
                                            selectedSalesOrders.map((c: any, idx: number) => (
                                                <div key={`${c.order.id}-${idx}`} className="p-3 border rounded-lg bg-card">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{c.order.simplifiedId}</span>
                                                                {c.order.tag && <Badge variant="outline" className="text-xs">{c.order.tag}</Badge>}
                                                                <Badge className="text-xs">{(c.method || '').toUpperCase()}</Badge>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mt-1">{c.order.items?.map((it: any) => `${it.quantity}x ${it.name}`).join(', ')}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">{c.order.timestamp ? format(c.order.timestamp.toDate(), 'hh:mm a') : ''}</p>
                                                        </div>
                                                        <div className="font-bold">{formatCurrency(c.amount)}</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setShowMomoModal(false)}>Close</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        {/* Total Sales Modal */}
                        {showTotalSalesModal && stats && (
                            <Dialog open={showTotalSalesModal} onOpenChange={setShowTotalSalesModal}>
                                <DialogContent className="max-w-3xl max-h-[80vh]">
                                    <DialogHeader>
                                        <DialogTitle>Total Sales - All Orders</DialogTitle>
                                        <DialogDescription>All completed orders contributing to today's sales.</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                                        {stats.orders.filter((o: Order) => o.status === 'Completed').length === 0 ? (
                                            <p className="text-muted-foreground">No completed orders found.</p>
                                        ) : (
                                            stats.orders.filter((o: Order) => o.status === 'Completed').map((order: Order) => (
                                                <div key={order.id} className="p-3 border rounded-lg bg-card">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{order.simplifiedId}</span>
                                                                {order.tag && <Badge variant="outline" className="text-xs">{order.tag}</Badge>}
                                                                <Badge className="text-xs">{(order.paymentMethod || 'N/A').toUpperCase()}</Badge>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mt-1">{order.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ')}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">{order.timestamp ? format(order.timestamp.toDate(), 'hh:mm a') : ''}</p>
                                                        </div>
                                                        <div className="font-bold">{formatCurrency(order.total)}</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setShowTotalSalesModal(false)}>Close</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        {/* Unpaid Orders Modal */}
                        {showUnpaidModal && (
                            <Dialog open={showUnpaidModal} onOpenChange={setShowUnpaidModal}>
                                <DialogContent className="max-w-3xl max-h-[80vh]">
                                    <DialogHeader>
                                        <DialogTitle>Unpaid Orders</DialogTitle>
                                        <DialogDescription>Orders with outstanding balances.</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                                        {allUnpaidOrders.length === 0 ? (
                                            <p className="text-muted-foreground">No unpaid orders found.</p>
                                        ) : (
                                            allUnpaidOrders.map((order: Order) => (
                                                <div key={order.id} className="p-3 border rounded-lg bg-card">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{order.simplifiedId}</span>
                                                                {order.tag && <Badge variant="outline" className="text-xs">{order.tag}</Badge>}
                                                                <Badge variant="destructive" className="text-xs">UNPAID</Badge>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mt-1">{order.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ')}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">{order.timestamp ? format(order.timestamp.toDate(), 'MMM dd, hh:mm a') : ''}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-bold text-destructive">{formatCurrency(order.total - (order.amountPaid || 0))}</div>
                                                            <div className="text-xs text-muted-foreground">of {formatCurrency(order.total)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setShowUnpaidModal(false)}>Close</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        {/* Misc Expenses Modal */}
                        {showExpensesModal && (
                            <Dialog open={showExpensesModal} onOpenChange={setShowExpensesModal}>
                                <DialogContent className="max-w-3xl max-h-[80vh]">
                                    <DialogHeader>
                                        <DialogTitle>Miscellaneous Expenses</DialogTitle>
                                        <DialogDescription>All expenses recorded today.</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                                        {miscExpenses.length === 0 ? (
                                            <p className="text-muted-foreground">No expenses recorded today.</p>
                                        ) : (
                                            miscExpenses.map((expense: MiscExpense) => (
                                                <div key={expense.id} className="p-3 border rounded-lg bg-card">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{expense.purpose}</span>
                                                                <Badge variant={expense.source === 'cash' ? 'default' : 'secondary'} className="text-xs">
                                                                    {expense.source.toUpperCase()}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                by {expense.cashierName} • {expense.timestamp ? format(expense.timestamp.toDate(), 'hh:mm a') : ''}
                                                            </p>
                                                        </div>
                                                        <div className="font-bold text-destructive">-{formatCurrency(expense.amount)}</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setShowExpensesModal(false)}>Close</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        {/* Rewards Discounts Modal */}
                        {showRewardsModal && stats && (
                            <Dialog open={showRewardsModal} onOpenChange={setShowRewardsModal}>
                                <DialogContent className="max-w-3xl max-h-[80vh]">
                                    <DialogHeader>
                                        <DialogTitle>Reward Discounts</DialogTitle>
                                        <DialogDescription>Orders with reward discounts applied today.</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                                        {stats.orders.filter((o: Order) => (o.rewardDiscount || 0) > 0).length === 0 ? (
                                            <p className="text-muted-foreground">No reward discounts applied today.</p>
                                        ) : (
                                            stats.orders.filter((o: Order) => (o.rewardDiscount || 0) > 0).map((order: Order) => (
                                                <div key={order.id} className="p-3 border rounded-lg bg-card">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{order.simplifiedId}</span>
                                                                {order.tag && <Badge variant="outline" className="text-xs">{order.tag}</Badge>}
                                                                <Badge className="text-xs bg-pink-500">REWARD</Badge>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mt-1">{order.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ')}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">{order.timestamp ? format(order.timestamp.toDate(), 'hh:mm a') : ''}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-bold text-pink-600">-{formatCurrency(order.rewardDiscount || 0)}</div>
                                                            <div className="text-xs text-muted-foreground">Order total: {formatCurrency(order.total)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setShowRewardsModal(false)}>Close</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        {/* Pardoned Deficits Modal */}
                        {showPardonedModal && stats && (
                            <Dialog open={showPardonedModal} onOpenChange={setShowPardonedModal}>
                                <DialogContent className="max-w-3xl max-h-[80vh]">
                                    <DialogHeader>
                                        <DialogTitle>Pardoned Deficits</DialogTitle>
                                        <DialogDescription>Orders with pardoned amounts today.</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                                        {stats.orders.filter((o: Order) => (o.pardonedAmount || 0) > 0).length === 0 ? (
                                            <p className="text-muted-foreground">No pardoned amounts today.</p>
                                        ) : (
                                            stats.orders.filter((o: Order) => (o.pardonedAmount || 0) > 0).map((order: Order) => (
                                                <div key={order.id} className="p-3 border rounded-lg bg-card">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{order.simplifiedId}</span>
                                                                {order.tag && <Badge variant="outline" className="text-xs">{order.tag}</Badge>}
                                                                <Badge variant="destructive" className="text-xs">PARDONED</Badge>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mt-1">{order.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ')}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">{order.timestamp ? format(order.timestamp.toDate(), 'hh:mm a') : ''}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-bold text-amber-600">-{formatCurrency(order.pardonedAmount || 0)}</div>
                                                            <div className="text-xs text-muted-foreground">Order total: {formatCurrency(order.total)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setShowPardonedModal(false)}>Close</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        {/* Change Owed Modal */}
                        {showChangeOwedModal && stats && (
                            <Dialog open={showChangeOwedModal} onOpenChange={setShowChangeOwedModal}>
                                <DialogContent className="max-w-3xl max-h-[80vh]">
                                    <DialogHeader>
                                        <DialogTitle>Change Owed to Customers</DialogTitle>
                                        <DialogDescription>Orders where change is still owed to customers.</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                                        {stats.orders.filter((o: Order) => o.changeGiven > 0 && o.paymentStatus === 'Paid').length === 0 ? (
                                            <p className="text-muted-foreground">No change transactions today.</p>
                                        ) : (
                                            stats.orders.filter((o: Order) => o.changeGiven > 0 && o.paymentStatus === 'Paid').map((order: Order) => (
                                                <div key={order.id} className="p-3 border rounded-lg bg-card">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{order.simplifiedId}</span>
                                                                {order.tag && <Badge variant="outline" className="text-xs">{order.tag}</Badge>}
                                                                <Badge variant="secondary" className="text-xs">CHANGE GIVEN</Badge>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mt-1">{order.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ')}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">{order.timestamp ? format(order.timestamp.toDate(), 'hh:mm a') : ''}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-bold text-orange-600">{formatCurrency(order.changeGiven || 0)}</div>
                                                            <div className="text-xs text-muted-foreground">Paid: {formatCurrency(order.amountPaid || 0)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setShowChangeOwedModal(false)}>Close</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        {/* Previous Change Given Modal */}
                        {showPrevChangeModal && stats && (
                            <Dialog open={showPrevChangeModal} onOpenChange={setShowPrevChangeModal}>
                                <DialogContent className="max-w-3xl max-h-[80vh]">
                                    <DialogHeader>
                                        <DialogTitle>Previous Change Given</DialogTitle>
                                        <DialogDescription>Change given today for orders from previous days.</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                                        {previousCollections.filter((c: any) => c.isChangeGiven).length === 0 ? (
                                            <p className="text-muted-foreground">No previous change given today.</p>
                                        ) : (
                                            previousCollections.filter((c: any) => c.isChangeGiven).map((c: any, idx: number) => (
                                                <div key={`${c.orderId}-${idx}`} className="p-3 border rounded-lg bg-card">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{c.simplifiedId || c.orderId}</span>
                                                                {c.tag && <Badge variant="outline" className="text-xs">{c.tag}</Badge>}
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mt-1">{c.items?.map((it: any) => `${it.quantity}x ${it.name}`).join(', ')}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">Order from: {c.orderDate || 'N/A'}</p>
                                                        </div>
                                                        <div className="font-bold text-blue-600">{formatCurrency(c.amount || 0)}</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setShowPrevChangeModal(false)}>Close</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </TabsContent>
                    <TabsContent value="history" className="flex-1 overflow-hidden mt-4">
                        <ScrollArea className="h-full">
                            <HistoryView />
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
                {stats && showUnpaidOrdersWarning && (
                    <AlertDialog open onOpenChange={setShowUnpaidOrdersWarning}>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Unpaid Orders Found</AlertDialogTitle><AlertDialogDescription>There are unpaid orders from today totaling {formatCurrency(stats.todayUnpaidOrdersValue)}. It's recommended to resolve these before closing the day.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <Button variant="secondary" onClick={() => { setShowUnpaidOrdersWarning(false); setShowReconciliation(true); }}>Proceed Anyway</Button>
                                <AlertDialogAction onClick={() => { setShowUnpaidOrdersWarning(false); setActiveView('orders'); }}><ShoppingCart className="mr-2 h-4 w-4" />Go to Orders</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </ScrollArea>
        </div>
    );
};

export default AccountingView;

