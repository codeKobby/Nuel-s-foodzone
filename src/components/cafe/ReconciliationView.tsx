
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import type { Order } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Calculator, CheckCircle, Smartphone, Banknote, X, ArrowRightLeft, FileText, ClipboardCheck, Search, AlertTriangle as AlertTriangleIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { format } from 'date-fns';
import { Alert } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast.tsx';

interface PeriodStats {
    totalSales: number;
    cashSales: number;
    momoSales: number;
    miscCashExpenses: number;
    miscMomoExpenses: number;
    totalPardonedAmount: number;
    changeOwedForPeriod: number;
}

interface ReconciliationViewProps {
    stats: PeriodStats;
    orders: Order[];
    onBack: () => void;
    setActiveView: (view: string) => void;
}

const ReconciliationView: React.FC<ReconciliationViewProps> = ({ stats, orders, onBack, setActiveView }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [notes, setNotes] = useState('');
    const { toast } = useToast();

    const today = useMemo(() => new Date(), []);

    const cashDenominations = [200, 100, 50, 20, 10, 5, 2, 1];
    const [denominationQuantities, setDenominationQuantities] = useState<Record<string, string>>(
        cashDenominations.reduce((acc, val) => ({ ...acc, [val]: '' }), {})
    );
    const [momoTransactions, setMomoTransactions] = useState<number[]>([]);
    const [momoInput, setMomoInput] = useState('');
    const [deductCustomerChange, setDeductCustomerChange] = useState(true);

    const totalCountedCash = useMemo(() => {
        return cashDenominations.reduce((total, den) => {
            const quantity = parseInt(String(denominationQuantities[String(den)] || '0')) || 0;
            return total + (den * quantity);
        }, 0);
    }, [denominationQuantities]);

    const totalCountedMomo = useMemo(() => {
        return momoTransactions.reduce((total, amount) => total + amount, 0);
    }, [momoTransactions]);
    
    const expectedCash = useMemo(() => (stats?.cashSales || 0) - (stats?.miscCashExpenses || 0), [stats]);
    
    const availableMoney = useMemo(() => {
        let available = totalCountedCash;
        if (deductCustomerChange) {
            available -= stats.changeOwedForPeriod;
        }
        return available;
    }, [totalCountedCash, stats, deductCustomerChange]);

    const balanceDifference = availableMoney - expectedCash;
    const isBalanced = Math.abs(balanceDifference) < 0.01;

    const resetForm = useCallback(() => {
        setDenominationQuantities(cashDenominations.reduce((acc, val) => ({ ...acc, [val]: '' }), {}));
        setMomoTransactions([]);
        setMomoInput('');
        setNotes('');
        setDeductCustomerChange(true);
    }, [cashDenominations]);

    const handleSaveReport = async () => {
        if (!stats) {
            toast({ type: 'error', title: "No financial data loaded to create a report." });
            return;
        }
        setIsSubmitting(true);
        try {
            const reportData = {
                timestamp: serverTimestamp(),
                period: format(today, 'yyyy-MM-dd'),
                totalSales: stats.totalSales,
                expectedCash: expectedCash,
                expectedMomo: stats.momoSales - stats.miscMomoExpenses,
                totalExpectedRevenue: expectedCash + (stats.momoSales - stats.miscMomoExpenses),
                countedCash: totalCountedCash,
                countedMomo: totalCountedMomo,
                totalCountedRevenue: totalCountedCash + totalCountedMomo,
                totalDiscrepancy: (totalCountedCash + totalCountedMomo) - (expectedCash + (stats.momoSales - stats.miscMomoExpenses)),
                notes: notes,
                changeOwedForPeriod: stats.changeOwedForPeriod,
                changeOwedSetAside: deductCustomerChange,
            };
            await addDoc(collection(db, "reconciliationReports"), reportData);
            toast({ type: 'success', title: "Day Closed Successfully", description: "The financial report has been saved." });
            resetForm();
            setShowConfirm(false);
            onBack();
        } catch (e) {
            console.error("Error saving report:", e);
            toast({ type: 'error', title: "Save Failed", description: "Could not save the report. Please try again." });
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

    const getBalanceStatus = () => {
      if (isBalanced) {
        return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800', icon: CheckCircle, text: 'Balanced' };
      } else if (balanceDifference > 0) {
        return { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800', icon: AlertTriangleIcon, text: `Surplus: ${formatCurrency(balanceDifference)}` };
      } else {
        return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800', icon: AlertTriangleIcon, text: `Deficit: ${formatCurrency(Math.abs(balanceDifference))}` };
      }
    };

    const balanceStatus = getBalanceStatus();

    const AdvancedReconciliationModal = () => {
        const [checkedOrderIds, setCheckedOrderIds] = useState(new Set());
        const [searchQuery, setSearchQuery] = useState('');

        const handleCheckChange = (orderId: string, isChecked: boolean) => {
          setCheckedOrderIds(prev => {
            const newSet = new Set(prev);
            if (isChecked) newSet.add(orderId);
            else newSet.delete(orderId);
            return newSet;
          });
        };

        const filteredOrders = useMemo(() => orders.filter(order =>
          order.simplifiedId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (order.tag && order.tag.toLowerCase().includes(searchQuery.toLowerCase()))
        ) || [], [searchQuery]);
    
        const checkedTotal = useMemo(() => filteredOrders
          .filter(o => checkedOrderIds.has(o.id))
          .reduce((sum, o) => sum + o.total, 0), [filteredOrders, checkedOrderIds]);
        
        const uncheckedTotal = useMemo(() => filteredOrders
          .filter(o => !checkedOrderIds.has(o.id))
          .reduce((sum, o) => sum + o.total, 0), [filteredOrders, checkedOrderIds]);
    
        const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        return (
          <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
            <DialogContent className="max-w-4xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Cross-Check Digital vs Written Orders
                </DialogTitle>
                <DialogDescription>
                  Compare your digital orders against physical kitchen tickets to identify missing or extra orders.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 py-4">
                <div className="lg:col-span-3 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Search by Order ID or Table/Tag..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                  </div>
                  <ScrollArea className="h-96 border rounded-lg">
                    <div className="p-4 space-y-3">
                      {filteredOrders.length > 0 ? filteredOrders.map(order => (
                        <div key={order.id} className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${checkedOrderIds.has(order.id) ? 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800' : 'bg-card hover:bg-muted/50'}`}>
                          <Checkbox id={`check-${order.id}`} checked={checkedOrderIds.has(order.id)} onCheckedChange={(checked) => handleCheckChange(order.id, !!checked)} className="mt-1" />
                          <Label htmlFor={`check-${order.id}`} className="flex-1">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-lg">{order.simplifiedId}</span>
                                  {order.tag && <Badge variant="outline" className="text-xs">{order.tag}</Badge>}
                                  <Badge variant={order.paymentStatus === 'Paid' ? 'default' : 'secondary'} className="text-xs">{order.paymentStatus}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{formatTime(order.timestamp.toDate())}</p>
                                <div className="text-xs text-muted-foreground">{order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}</div>
                              </div>
                              <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                            </div>
                          </Label>
                        </div>
                      )) : (
                        <div className="text-center py-12"><Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">No orders found</p></div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
                <div className="space-y-4">
                  <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Audit Summary</CardTitle></CardHeader><CardContent className="space-y-4">
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><p className="text-sm text-blue-600 dark:text-blue-300">Total Digital Orders</p><p className="text-2xl font-bold text-blue-700 dark:text-blue-200">{filteredOrders.length}</p><p className="text-sm font-medium">{formatCurrency(filteredOrders.reduce((sum, o) => sum + o.total, 0))}</p></div>
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg"><p className="text-sm text-green-600 dark:text-green-300">✓ Verified Orders</p><p className="text-2xl font-bold text-green-700 dark:text-green-200">{checkedOrderIds.size}</p><p className="text-sm font-medium">{formatCurrency(checkedTotal)}</p></div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-900/30 rounded-lg"><p className="text-sm text-red-600 dark:text-red-300">⚠ Unverified Orders</p><p className="text-2xl font-bold text-red-700 dark:text-red-200">{filteredOrders.length - checkedOrderIds.size}</p><p className="text-sm font-medium">{formatCurrency(uncheckedTotal)}</p></div>
                      {checkedOrderIds.size === filteredOrders.length && filteredOrders.length > 0 && (<Alert><CheckCircle className="h-4 w-4" /><AlertDescription className="text-sm">All digital orders verified! If your cash doesn't balance, check for unrecorded written orders.</AlertDescription></Alert>)}
                  </CardContent></Card>
                  <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Quick Tips</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground space-y-2"><p>• Check each digital order against your written tickets</p><p>• Look for missing digital entries</p><p>• Verify payment methods match</p><p>• Check for duplicate entries</p></CardContent></Card>
                </div>
              </div>
              <DialogFooter className="border-t pt-4"><Button variant="outline" onClick={() => setShowAuditModal(false)}>Close Audit</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        );
    };
    
    const confirmationDescription = `You are about to finalize the financial report for today. ${
        stats.changeOwedForPeriod > 0
            ? `You have indicated that customer change of ${formatCurrency(stats.changeOwedForPeriod)} will be ${deductCustomerChange ? 'DEDUCTED from the available cash' : 'LEFT IN the cash drawer'}.`
            : ''
    } This action cannot be undone.`;

    return (
        <div className="h-full">
            <ScrollArea className="h-full">
                <div className="p-4 md:p-6 flex flex-col">
                    <div className="flex items-center gap-4 mb-6">
                        <Button variant="outline" size="icon" onClick={onBack}><ArrowLeft/></Button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-foreground">End-of-Day Reconciliation</h1>
                            <p className="text-muted-foreground">Complete daily cash reconciliation for {format(today, "EEEE, MMMM dd, yyyy")}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                        <div className="lg:col-span-2 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg"><Banknote className="h-5 w-5 text-green-600" />Physical Cash Count</CardTitle>
                                    <CardDescription>Count each denomination in your cash drawer</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                        {cashDenominations.map(den => (
                                            <div key={den} className="space-y-2">
                                                <Label className="text-sm font-medium text-foreground">GH₵{den}</Label>
                                                <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg border">
                                                    <span className="text-sm text-muted-foreground min-w-[20px]">×</span>
                                                    <Input type="text" inputMode="numeric" value={denominationQuantities[String(den)]} onChange={(e) => handleDenominationChange(e.target.value, String(den))} placeholder="0" className="text-center font-medium border-0 bg-transparent p-0 h-auto focus-visible:ring-1" />
                                                    <div className="text-xs text-center text-muted-foreground">{denominationQuantities[String(den)] ? formatCurrency(den * (parseInt(String(denominationQuantities[String(den)])) || 0)) : ''}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold text-green-800 dark:text-green-200">Total Cash Counted:</span>
                                            <span className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalCountedCash)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg"><Smartphone className="h-5 w-5 text-purple-600" />MoMo/Card Transactions</CardTitle>
                                    <CardDescription>Enter individual transaction amounts (press Space or Enter to add)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Input type="number" step="0.01" value={momoInput} onChange={(e) => setMomoInput(e.target.value)} onKeyDown={handleMomoInputKeyDown} placeholder="Enter amount and press Space/Enter" className="mb-4 h-12 text-lg" />
                                    {momoTransactions.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {momoTransactions.map((amount, index) => (
                                                <Badge key={index} variant="secondary" className="text-sm px-3 py-2">
                                                    {formatCurrency(amount)}
                                                    <button onClick={() => removeMomoTransaction(index)} className="ml-2 hover:bg-destructive/20 rounded-full p-0.5">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                    <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold text-purple-800 dark:text-purple-200">Total MoMo Counted:</span>
                                            <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(totalCountedMomo)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            {stats.changeOwedForPeriod > 0 && (
                                <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/50">
                                    <CardHeader className="pb-4">
                                        <CardTitle className="flex items-center gap-2 text-lg text-orange-800 dark:text-orange-200">
                                            <ArrowRightLeft className="h-5 w-5" />
                                            Customer Change Management
                                        </CardTitle>
                                        <CardDescription>You owe {formatCurrency(stats.changeOwedForPeriod)} in customer change</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                                            <div className="flex items-center space-x-3">
                                                <Switch id="deduct-change" checked={deductCustomerChange} onCheckedChange={setDeductCustomerChange} />
                                                <Label htmlFor="deduct-change" className="font-medium">Deduct customer change from available cash?</Label>
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-3">
                                            {deductCustomerChange ? "Change will be set aside and deducted from your available cash" : "Change will be counted as part of available cash"}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Calculator className="h-5 w-5 text-foreground" />
                                        Reconciliation Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg bg-secondary space-y-2">
                                            <div className="flex justify-between items-center"><p className="text-sm text-muted-foreground">Expected Cash</p><p className="font-semibold">{formatCurrency(expectedCash)}</p></div>
                                            <div className="flex justify-between items-center"><p className="text-sm text-muted-foreground">Available Cash</p><p className="font-semibold">{formatCurrency(availableMoney)}</p></div>
                                            <Separator/>
                                            <div className={`flex justify-between items-center font-bold ${balanceStatus.color}`}>
                                                <p>Cash Discrepancy</p>
                                                <p>{formatCurrency(balanceDifference)}</p>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-lg bg-secondary space-y-2">
                                            <div className="flex justify-between items-center"><p className="text-sm text-muted-foreground">Expected MoMo</p><p className="font-semibold">{formatCurrency(stats.momoSales - stats.miscMomoExpenses)}</p></div>
                                            <div className="flex justify-between items-center"><p className="text-sm text-muted-foreground">Counted MoMo</p><p className="font-semibold">{formatCurrency(totalCountedMomo)}</p></div>
                                            <Separator/>
                                            <div className={`flex justify-between items-center font-bold ${totalCountedMomo - (stats.momoSales - stats.miscMomoExpenses) === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                <p>MoMo Discrepancy</p>
                                                <p>{formatCurrency(totalCountedMomo - (stats.momoSales - stats.miscMomoExpenses))}</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className={`border-2 ${balanceStatus.bg}`}>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-center space-x-3">
                                        <balanceStatus.icon className={`h-6 w-6 ${balanceStatus.color}`} />
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-foreground">Cash Balance</p>
                                            <p className={`text-xl font-bold ${balanceStatus.color}`}>{balanceStatus.text}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            
                            <Card>
                                <CardHeader><CardTitle className="text-lg">Notes</CardTitle></CardHeader>
                                <CardContent>
                                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes for discrepancy..." />
                                </CardContent>
                            </Card>
                            
                            <div className="space-y-3 pt-4">
                                <Button variant="outline" className="w-full" onClick={() => setShowAuditModal(true)}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Cross-Check Orders
                                </Button>
                                <Button className="w-full h-12 text-lg font-semibold" onClick={() => setShowConfirm(true)} disabled={isSubmitting}>
                                    {isSubmitting ? <LoadingSpinner/> : isBalanced ? "Finalize Day" : "Finalize with Discrepancy"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </ScrollArea>
            {showAuditModal && <AdvancedReconciliationModal />}
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>{confirmationDescription}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSaveReport}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ReconciliationView;

    