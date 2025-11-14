"use client";

import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { collection, query, where, getDocs, Timestamp, addDoc, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense, ReconciliationReport, Payment } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, FileSignature, AlertCircle, Lock, ShoppingCart, TrendingUp, TrendingDown, CheckCircle, FileText, Banknote, Smartphone, X, Coins, ArrowRightLeft, HelpCircle, Landmark, CreditCard, DollarSign, Hourglass, MinusCircle, Ban, Gift, Wrench, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isToday } from 'date-fns';
import HistoryView from '@/components/cafe/HistoryView';
import { ScrollArea } from '../ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator as UiSeparator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { AuthContext } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/utils';

interface PeriodStats {
    totalSales: number;
    totalItemsSold: number;
    cashSales: number;
    momoSales: number;
    miscCashExpenses: number;
    miscMomoExpenses: number;
    expectedCash: number;
    expectedMomo: number;
    netRevenue: number;
    todayUnpaidOrdersValue: number;
    allTimeUnpaidOrdersValue: number;
    previousUnpaidOrdersValue: number;
    totalPardonedAmount: number;
    changeOwedForPeriod: number;
    settledUnpaidOrdersValue: number;
    previousDaysChangeGiven: number;
    totalRewardDiscount: number;
    orders: Order[];
    itemStats: Record<string, { count: number; totalValue: number }>;
}

const StatCard: React.FC<{ icon: React.ReactNode, title: string, value: string | number, color?: string, description?: string | React.ReactNode }> = ({ icon, title, value, color, description }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className={`text-xl md:text-2xl font-bold ${color}`}>{value}</div>
            {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </CardContent>
    </Card>
);

const ReconciliationView: React.FC<{ 
    stats: PeriodStats | null,
    adjustedExpectedCash: number,
    onBack: () => void 
}> = ({ stats, adjustedExpectedCash, onBack }) => {
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
        if(deductCustomerChange) {
            counted -= stats.changeOwedForPeriod;
        }
        return counted;
    }, [totalCountedCash, stats, deductCustomerChange]);

    const cashDiscrepancy = useMemo(() => {
        return availableCash - adjustedExpectedCash;
    }, [availableCash, adjustedExpectedCash]);

    const momoDiscrepancy = useMemo(() => {
        if (!stats) return 0;
        return totalCountedMomo - stats.expectedMomo;
    }, [totalCountedMomo, stats]);

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
                expectedCash: adjustedExpectedCash,
                expectedMomo: stats.expectedMomo,
                totalExpectedRevenue: adjustedExpectedCash + stats.expectedMomo,
                countedCash: totalCountedCash,
                countedMomo: totalCountedMomo,
                totalCountedRevenue: totalCountedCash + totalCountedMomo,
                cashDiscrepancy: cashDiscrepancy,
                momoDiscrepancy: momoDiscrepancy,
                totalDiscrepancy: totalDiscrepancy,
                notes: notes,
                changeOwedForPeriod: stats.changeOwedForPeriod,
                changeOwedSetAside: deductCustomerChange,
                cashierId: session?.uid || 'unknown',
                cashierName: session?.fullName || session?.username || 'Unknown',
            };
            await addDoc(collection(db, "reconciliationReports"), reportData);
            
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
            return { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800', icon: AlertTriangle, text: `Surplus: ${formatCurrency(discrepancy)}` };
        } else {
            return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800', icon: AlertTriangle, text: `Deficit: ${formatCurrency(Math.abs(discrepancy))}` };
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
                          className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                            checkedOrderIds.has(order.id) 
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
                                            {stats.settledUnpaidOrdersValue > 0 && <div className="flex justify-between text-green-600"><span>(+) Settled Old Orders:</span><span className="font-medium">+{formatCurrency(stats.settledUnpaidOrdersValue)}</span></div>}
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
                                            <UiSeparator />
                                            <div className="flex justify-between font-bold text-purple-700 text-base"><span>Expected MoMo:</span><span>{formatCurrency(stats.expectedMomo)}</span></div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-primary/10 p-4">
                                <div className="w-full flex justify-between items-center"><span className="font-bold text-primary text-lg">Total Expected:</span><span className="font-extrabold text-primary text-xl">{formatCurrency(adjustedExpectedCash + stats.expectedMomo)}</span></div>
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


const AccountingView: React.FC<{setActiveView: (view: string) => void}> = ({setActiveView}) => {
    const [stats, setStats] = useState<PeriodStats | null>(null);
    const [reports, setReports] = useState<ReconciliationReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showReconciliation, setShowReconciliation] = useState(false);
    const [showUnpaidOrdersWarning, setShowUnpaidOrdersWarning] = useState(false);
    
    const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
    const todayEnd = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }, []);

    const isTodayClosedOut = useMemo(() => {
        return reports.some(report => isToday(report.timestamp.toDate()));
    }, [reports]);

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
                let settledUnpaidOrdersValue = 0, previousDaysChangeGiven = 0;
                let totalRewardDiscount = 0;
                
                const todayOrders: Order[] = [];
                const itemStats: Record<string, { count: number; totalValue: number }> = {};
                
                const allOrders = allOrdersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    
                allOrders.forEach(order => {
                    const orderDate = order.timestamp.toDate();
                    const isTodayOrder = orderDate >= todayStart && orderDate <= todayEnd;

                    if (orderDate < todayStart && (order.paymentStatus === 'Unpaid' || order.paymentStatus === 'Partially Paid')) {
                        previousUnpaidOrdersValue += order.balanceDue;
                    }

                    if (isTodayOrder) {
                        todayOrders.push(order);

                        if (order.status === "Completed") {
                            totalSales += order.total;
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
                        }
                        
                        totalPardonedAmount += order.pardonedAmount || 0;
                        totalRewardDiscount += order.rewardDiscount || 0;
                        if (order.balanceDue < 0) {
                            changeOwedForPeriod += Math.abs(order.balanceDue);
                        }
                    }

                    if (order.paymentHistory && Array.isArray(order.paymentHistory)) {
                        order.paymentHistory.forEach(payment => {
                            const paymentDate = payment.timestamp?.toDate();
                            if (paymentDate && paymentDate >= todayStart && paymentDate <= todayEnd) {
                                const paymentAmount = payment.amount || 0;
                                
                                if (payment.method === 'cash') {
                                    cashSales += paymentAmount;
                                } else if (payment.method === 'momo' || payment.method === 'card') {
                                    momoSales += paymentAmount;
                                }
                                
                                if (!isTodayOrder) {
                                    settledUnpaidOrdersValue += paymentAmount;
                                }
                            }
                        });
                    } else {
                        const paymentDate = order.lastPaymentTimestamp?.toDate();
                        if (paymentDate && paymentDate >= todayStart && paymentDate <= todayEnd) {
                            
                            const amountPaidTowardsOrder = order.amountPaid - order.changeGiven;
                            
                            if (order.paymentBreakdown) {
                                if(order.paymentBreakdown.cash) {
                                    cashSales += order.paymentBreakdown.cash;
                                }
                                if(order.paymentBreakdown.momo) {
                                    momoSales += order.paymentBreakdown.momo;
                                }
                            } else {
                                const revenueAmount = amountPaidTowardsOrder;
                                
                                if(order.paymentMethod === 'cash') {
                                    cashSales += revenueAmount;
                                } else if(order.paymentMethod === 'momo' || order.paymentMethod === 'card') {
                                    momoSales += revenueAmount;
                                }
                            }

                            if (!isTodayOrder) {
                                settledUnpaidOrdersValue += amountPaidTowardsOrder;
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
                miscExpensesSnapshot.docs.forEach(doc => {
                    const expense = doc.data() as MiscExpense;
                    const expenseDate = expense.timestamp.toDate();
                    if(expenseDate >= todayStart && expenseDate <= todayEnd){
                       if (expense.source === 'cash') miscCashExpenses += expense.amount;
                       else miscMomoExpenses += expense.amount;
                    }
                });
    
                const allTimeUnpaidOrdersValue = previousUnpaidOrdersValue + todayUnpaidOrdersValue;
    
                const totalMiscExpenses = miscCashExpenses + miscMomoExpenses;
                const expectedCash = cashSales - miscCashExpenses + settledUnpaidOrdersValue - previousDaysChangeGiven;
                const expectedMomo = momoSales - miscMomoExpenses;
                const netRevenue = (cashSales + momoSales) - totalMiscExpenses - totalRewardDiscount;
    
                setStats({ 
                    totalSales, 
                    totalItemsSold, 
                    cashSales, 
                    momoSales, 
                    miscCashExpenses, 
                    miscMomoExpenses, 
                    expectedCash, 
                    expectedMomo, 
                    netRevenue, 
                    todayUnpaidOrdersValue,
                    allTimeUnpaidOrdersValue,
                    previousUnpaidOrdersValue,
                    totalPardonedAmount, 
                    changeOwedForPeriod, 
                    settledUnpaidOrdersValue, 
                    previousDaysChangeGiven, 
                    totalRewardDiscount,
                    orders: todayOrders, 
                    itemStats 
                });
    
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
        expected += stats.settledUnpaidOrdersValue; 
        expected -= stats.miscCashExpenses;
        expected -= stats.previousDaysChangeGiven;
        return expected;
    }, [stats]);

    if (showReconciliation && stats) {
        return <ReconciliationView stats={stats} adjustedExpectedCash={adjustedExpectedCash} onBack={() => setShowReconciliation(false)} />;
    }

    return (
        <ScrollArea className="h-full">
            <div className="p-4 md:p-6 bg-background">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl md:text-3xl font-bold">Accounting</h1>
                    <Button onClick={handleStartEndDay} disabled={isTodayClosedOut}>
                        <FileSignature className="mr-2 h-4 w-4" />
                        {isTodayClosedOut ? 'Day Already Closed' : 'Start End-of-Day'}
                    </Button>
                </div>
            </div>
            <Tabs defaultValue="summary" className="flex-1 flex flex-col overflow-hidden px-4 md:px-6">
                <TabsList className="grid w-full grid-cols-2 mx-auto max-w-sm">
                    <TabsTrigger value="summary">Financial Summary</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="summary" className="flex-1 overflow-hidden mt-4">
                    {loading ? <LoadingSpinner/> : error ? (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Failed to Load Data</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                         </Alert>
                    ) : stats ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Financial Summary</CardTitle>
                                            <CardDescription>Daily financial data for {format(new Date(), "EEEE, MMMM dd, yyyy")}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <StatCard icon={<DollarSign className="text-muted-foreground" />} title="Total Sales" value={formatCurrency(stats.totalSales)} description={`${stats.totalItemsSold} items sold from completed orders`} />
                                            <StatCard icon={<Landmark className="text-muted-foreground" />} title="Cash Sales" value={formatCurrency(stats.cashSales)} description="All cash payments received today" />
                                            <StatCard icon={<CreditCard className="text-muted-foreground" />} title="Momo/Card Sales" value={formatCurrency(stats.momoSales)} description="All momo/card payments received" />
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
                                            />
                                            <StatCard icon={<MinusCircle className="text-muted-foreground" />} title="Total Misc. Expenses" value={formatCurrency(stats.miscCashExpenses + stats.miscMomoExpenses)} description={`Cash: ${formatCurrency(stats.miscCashExpenses)} | Momo: ${formatCurrency(stats.miscMomoExpenses)}`} />
                                            <StatCard icon={<Gift className="text-muted-foreground" />} title="Reward Discounts" value={formatCurrency(stats.totalRewardDiscount)} description="Total discounts from rewards" />
                                            <StatCard icon={<Ban className="text-muted-foreground" />} title="Pardoned Deficits" value={formatCurrency(stats.totalPardonedAmount)} description="Unplanned discounts given today" />
                                            <StatCard icon={<ArrowRightLeft className="text-muted-foreground" />} title="Change Owed" value={formatCurrency(stats.changeOwedForPeriod)} description="Total change owed to customers today" />
                                            <StatCard icon={<Coins className="text-muted-foreground" />} title="Previous Change Given" value={formatCurrency(stats.previousDaysChangeGiven)} description="Change for old orders given today" />
                                        </CardContent>
                                        <CardFooter>
                                            <div className="w-full p-4 border rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                                                <div className="flex justify-between items-baseline">
                                                    <Label className="text-sm font-semibold text-green-700 dark:text-green-300">Total Revenue</Label>
                                                    <p className="text-3xl font-bold">{formatCurrency(stats.totalSales - stats.todayUnpaidOrdersValue)}</p>
                                                </div>
                                                
                                                {stats.settledUnpaidOrdersValue > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700 text-sm">
                                                        <div className="flex justify-between items-center text-green-700 dark:text-green-300">
                                                            <span className="font-bold">Today's Net: {formatCurrency(stats.netRevenue - stats.settledUnpaidOrdersValue)}</span>
                                                            <span className="font-semibold">+ Collections: {formatCurrency(stats.settledUnpaidOrdersValue)}</span>
                                                        </div>
                                                    </div>
                                                )}
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
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="p-6 text-muted-foreground">No data for today.</p>
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
                            <AlertDialogAction onClick={() => { setShowUnpaidOrdersWarning(false); setActiveView('orders'); }}><ShoppingCart className="mr-2 h-4 w-4"/>Go to Orders</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </ScrollArea>
    );
};

export default AccountingView;
    