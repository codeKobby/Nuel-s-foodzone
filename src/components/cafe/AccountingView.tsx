
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, addDoc, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, ReconciliationReport } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { DollarSign, CreditCard, MinusCircle, History, Landmark, Coins, AlertCircle, Search, Package, Calendar as CalendarIcon, FileCheck, Hourglass, ShoppingCart, Lock, X, Ban, HelpCircle, TrendingUp, TrendingDown, Plus, Calculator, Eye, Clock, AlertTriangle as AlertTriangleIcon, CheckCircle, Banknote, Smartphone, Gift, ArrowRightLeft, FileText, ClipboardCheck } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Checkbox } from '@/components/ui/checkbox';
import { addDays, format, isToday } from "date-fns"
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface PeriodStats {
    totalSales: number;
    cashSales: number;
    momoSales: number;
    miscCashExpenses: number;
    miscMomoExpenses: number;
    totalPardonedAmount: number;
    changeOwedForPeriod: number;
    orders: Order[];
}

const AccountingView: React.FC<{setActiveView: (view: string) => void}> = ({setActiveView}) => {
    const [stats, setStats] = useState<PeriodStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [showUnpaidOrdersWarning, setShowUnpaidOrdersWarning] = useState(false);
    const [notes, setNotes] = useState('');
    const [reports, setReports] = useState<ReconciliationReport[]>([]);

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
    
    const [deductCustomerChange, setDeductCustomerChange] = useState(true);
    const cashDenominations = [200, 100, 50, 20, 10, 5, 2, 1];
    const [denominationQuantities, setDenominationQuantities] = useState<Record<string, string>>(
      cashDenominations.reduce((acc, val) => ({ ...acc, [String(val)]: '' }), {})
    );
  
    const [momoTransactions, setMomoTransactions] = useState<number[]>([]);
    const [momoInput, setMomoInput] = useState('');

    const isTodayClosedOut = useMemo(() => {
        return reports.some(report => report.timestamp && isToday(report.timestamp.toDate()));
    }, [reports]);

    const totalCountedCash = useMemo(() => {
        return cashDenominations.reduce((total, den) => {
            const quantity = parseInt(String(denominationQuantities[String(den)] || '0')) || 0;
            return total + (den * quantity);
        }, 0);
    }, [denominationQuantities]);
    
    const totalCountedMomo = useMemo(() => {
        return momoTransactions.reduce((total, amount) => total + amount, 0);
    }, [momoTransactions]);

    const totalMiscExpenses = useMemo(() => (stats?.miscCashExpenses || 0) + (stats?.miscMomoExpenses || 0), [stats]);

    const expectedMoney = useMemo(() => {
        if (!stats) return 0;
        return stats.cashSales + stats.momoSales - totalMiscExpenses;
    }, [stats, totalMiscExpenses]);
      
    const availableMoney = useMemo(() => {
        if (!stats) return 0;
        let available = totalCountedCash + totalCountedMomo - totalMiscExpenses - stats.totalPardonedAmount;
        if (deductCustomerChange) {
            available -= stats.changeOwedForPeriod;
        }
        return available;
    }, [totalCountedCash, totalCountedMomo, totalMiscExpenses, stats, deductCustomerChange]);
    
    const balanceDifference = availableMoney - expectedMoney;
    const isBalanced = Math.abs(balanceDifference) < 0.01;

    const fetchPeriodData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setStats(null);
        
        try {
            const startDateTimestamp = Timestamp.fromDate(today);
            const endDateTimestamp = Timestamp.fromDate(todayEnd);

            const todayOrdersQuery = query(
                collection(db, "orders"), 
                where("timestamp", ">=", startDateTimestamp), 
                where("timestamp", "<=", endDateTimestamp)
            );
            
            const todayMiscQuery = query(
                collection(db, "miscExpenses"), 
                where("timestamp", ">=", startDateTimestamp), 
                where("timestamp", "<=", endDateTimestamp)
            );

            const [todayOrdersSnapshot, todayMiscSnapshot] = await Promise.all([
                getDocs(todayOrdersQuery),
                getDocs(todayMiscQuery),
            ]);

            let totalSales = 0;
            let cashSales = 0;
            let momoSales = 0;
            const todayOrders: Order[] = [];
            let totalPardonedAmount = 0;
            let changeOwedForPeriod = 0;

            todayOrdersSnapshot.docs.forEach(doc => {
                const order = { id: doc.id, ...doc.data() } as Order;
                todayOrders.push(order);

                if (order.pardonedAmount && order.pardonedAmount > 0) {
                    totalPardonedAmount += order.pardonedAmount;
                }
                
                if (order.balanceDue < 0) {
                    changeOwedForPeriod += Math.abs(order.balanceDue);
                }
                
                if (order.status === 'Completed') {
                    totalSales += order.total;
                }
                
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

            let miscCashExpenses = 0;
            let miscMomoExpenses = 0;
            todayMiscSnapshot.forEach(doc => {
                const expense = doc.data();
                if (expense.source === 'cash') {
                    miscCashExpenses += expense.amount;
                } else {
                    miscMomoExpenses += expense.amount;
                }
            });
            
            setStats({ 
                totalSales, 
                cashSales, 
                momoSales, 
                miscCashExpenses, 
                miscMomoExpenses, 
                totalPardonedAmount, 
                changeOwedForPeriod,
                orders: todayOrders, 
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
        setDenominationQuantities(cashDenominations.reduce((acc, val) => ({ ...acc, [val]: '' }), {}));
        setMomoTransactions([]);
        setMomoInput('');
        setNotes('');
        setDeductCustomerChange(true);
    }, []);

    const handleSaveReport = async () => {
        if (!stats) {
            setError("No financial data loaded to create a report.");
            return;
        }
        
        setError(null);
        setIsSubmitting(true);
        
        try {
            const reportData = {
                timestamp: serverTimestamp(),
                period: format(today, 'yyyy-MM-dd'),
                totalSales: stats.totalSales,
                expectedCash: stats.cashSales - stats.miscCashExpenses,
                expectedMomo: stats.momoSales - stats.miscMomoExpenses,
                totalExpectedRevenue: expectedMoney,
                countedCash: totalCountedCash,
                countedMomo: totalCountedMomo,
                totalCountedRevenue: totalCountedCash + totalCountedMomo,
                totalDiscrepancy: balanceDifference,
                notes: notes,
                changeOwedForPeriod: stats.changeOwedForPeriod,
                changeOwedSetAside: deductCustomerChange,
            };
            
            await addDoc(collection(db, "reconciliationReports"), reportData);
            
            resetForm();
            setShowConfirm(false);
            
        } catch (e) {
            console.error("Error saving report:", e);
            setError("Failed to save the report. Please try again.");
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
        return { color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: CheckCircle, text: 'Balanced' };
      } else if (balanceDifference > 0) {
        return { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: AlertTriangleIcon, text: `Surplus: ${formatCurrency(balanceDifference)}` };
      } else {
        return { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: AlertTriangleIcon, text: `Deficit: ${formatCurrency(Math.abs(balanceDifference))}` };
      }
    };

    const balanceStatus = getBalanceStatus();

    const AdvancedReconciliationModal = () => {
        const [checkedOrderIds, setCheckedOrderIds] = useState(new Set());
        const [searchQuery, setSearchQuery] = useState('');

        const handleCheckChange = (orderId: string, isChecked: boolean) => {
          setCheckedOrderIds(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
              newSet.add(orderId);
            } else {
              newSet.delete(orderId);
            }
            return newSet;
          });
        };

        const filteredOrders = useMemo(() => stats?.orders.filter(order =>
          order.simplifiedId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (order.tag && order.tag.toLowerCase().includes(searchQuery.toLowerCase()))
        ) || [], [stats?.orders, searchQuery]);
    
        const checkedTotal = useMemo(() => filteredOrders
          .filter(o => checkedOrderIds.has(o.id))
          .reduce((sum, o) => sum + o.total, 0), [filteredOrders, checkedOrderIds]);
        
        const uncheckedTotal = useMemo(() => filteredOrders
          .filter(o => !checkedOrderIds.has(o.id))
          .reduce((sum, o) => sum + o.total, 0), [filteredOrders, checkedOrderIds]);
    
        const formatTime = (date: Date) => {
          return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          });
        };

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
                  Check off each order as you verify it against your written records.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 py-4">
                <div className="lg:col-span-3 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          <Checkbox
                            id={`check-${order.id}`}
                            checked={checkedOrderIds.has(order.id)}
                            onCheckedChange={(checked) => handleCheckChange(order.id, !!checked)}
                            className="mt-1"
                          />
                          <Label htmlFor={`check-${order.id}`} className="flex-1">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-lg">{order.simplifiedId}</span>
                                  {order.tag && <Badge variant="outline" className="text-xs">{order.tag}</Badge>}
                                  <Badge variant={order.paymentStatus === 'Paid' ? 'default' : 'secondary'} className="text-xs">
                                    {order.paymentStatus}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600">{formatTime(order.timestamp.toDate())}</p>
                                <div className="text-xs text-gray-500">
                                  {order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                              </div>
                            </div>
                          </Label>
                        </div>
                      )) : (
                        <div className="text-center py-12">
                          <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">No orders found</p>
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
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-600">Total Digital Orders</p>
                        <p className="text-2xl font-bold text-blue-700">{filteredOrders.length}</p>
                        <p className="text-sm font-medium">{formatCurrency(filteredOrders.reduce((sum, o) => sum + o.total, 0))}</p>
                      </div>
                      
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-600">✓ Verified Orders</p>
                        <p className="text-2xl font-bold text-green-700">{checkedOrderIds.size}</p>
                        <p className="text-sm font-medium">{formatCurrency(checkedTotal)}</p>
                      </div>
                      
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <p className="text-sm text-red-600">⚠ Unverified Orders</p>
                        <p className="text-2xl font-bold text-red-700">{filteredOrders.length - checkedOrderIds.size}</p>
                        <p className="text-sm font-medium">{formatCurrency(uncheckedTotal)}</p>
                      </div>
    
                      {checkedOrderIds.size === filteredOrders.length && filteredOrders.length > 0 && (
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            All digital orders verified! If your cash doesn't balance, check for unrecorded written orders.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
    
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Quick Tips</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-gray-600 space-y-2">
                      <p>• Check each digital order against your written tickets</p>
                      <p>• Look for missing digital entries</p>
                      <p>• Verify payment methods match</p>
                      <p>• Check for duplicate entries</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
    
              <DialogFooter className="border-t pt-4">
                <Button variant="outline" onClick={() => setShowAuditModal(false)}>
                  Close Audit
                </Button>
                <Button 
                  onClick={() => setShowAuditModal(false)}
                  disabled={isSubmitting}
                >
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      };

    if (loading || !stats) {
        return (
            <div className="h-full flex items-center justify-center">
                <LoadingSpinner />
            </div>
        )
    }

    if(isTodayClosedOut){
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-gray-50">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4"/>
                <h2 className="text-2xl font-bold">Day Already Closed</h2>
                <p className="text-gray-600 mt-2">Today's reconciliation has already been completed. You can view it in the history tab.</p>
                <Button onClick={() => window.location.reload()} className="mt-6">Refresh</Button>
            </div>
        )
    }

    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6 bg-gray-50 min-h-screen">
        <Tabs defaultValue="reconciliation">
            <div className="flex justify-between items-center mb-8">
                <div className="text-center flex-grow">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">End-of-Day Reconciliation</h1>
                    <p className="text-gray-600">Complete daily cash reconciliation and account for all transactions for {format(today, "EEEE, MMMM dd, yyyy")}</p>
                </div>
                <TabsList>
                    <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
            </div>
            
            <TabsContent value="reconciliation">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
                <div className="lg:col-span-2 space-y-6">
                <Card className="shadow-sm">
                    <CardHeader className="pb-4">
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
                            <Label className="text-sm font-medium text-gray-700">GH₵{den}</Label>
                            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                            <span className="text-sm text-gray-600 min-w-[20px]">×</span>
                            <Input
                                type="text"
                                inputMode="numeric"
                                value={denominationQuantities[String(den)]}
                                onChange={(e) => handleDenominationChange(e.target.value, String(den))}
                                placeholder="0"
                                className="text-center font-medium border-0 bg-transparent p-0 h-auto focus-visible:ring-1"
                            />
                            </div>
                            <div className="text-xs text-center text-gray-500">
                            {denominationQuantities[String(den)] ? formatCurrency(den * (parseInt(String(denominationQuantities[String(den)])) || 0)) : ''}
                            </div>
                        </div>
                        ))}
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                        <span className="font-semibold text-green-800">Total Cash Counted:</span>
                        <span className="text-xl font-bold text-green-600">{formatCurrency(totalCountedCash)}</span>
                        </div>
                    </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-4">
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
                                className="ml-2 hover:bg-red-100 rounded-full p-0.5"
                            >
                                <X className="h-3 w-3" />
                            </button>
                            </Badge>
                        ))}
                        </div>
                    )}
                    
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                        <span className="font-semibold text-purple-800">Total MoMo Counted:</span>
                        <span className="text-xl font-bold text-purple-600">{formatCurrency(totalCountedMomo)}</span>
                        </div>
                    </div>
                    </CardContent>
                </Card>

                {stats.changeOwedForPeriod > 0 && (
                    <Card className="shadow-sm border-orange-200">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-orange-800">
                        <ArrowRightLeft className="h-5 w-5" />
                        Customer Change Management
                        </CardTitle>
                        <CardDescription>
                        You owe {formatCurrency(stats.changeOwedForPeriod)} in customer change
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <Switch
                            id="deduct-change"
                            checked={deductCustomerChange}
                            onCheckedChange={setDeductCustomerChange}
                            />
                            <Label htmlFor="deduct-change" className="font-medium">
                            Deduct customer change from available money?
                            </Label>
                        </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-3">
                        {deductCustomerChange 
                            ? "Change will be set aside and deducted from your available money" 
                            : "Change will be counted as part of available money (pay customers immediately)"
                        }
                        </p>
                    </CardContent>
                    </Card>
                )}
                </div>
        
                <div className="space-y-6">
                
                <Card className="shadow-sm">
                    <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Calculator className="h-5 w-5 text-gray-700" />
                        Reconciliation Summary
                    </CardTitle>
                    </CardHeader>
                    <CardContent>
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-gray-100">
                        <p className="text-sm text-gray-600">Expected Money</p>
                        <p className="text-2xl font-bold">{formatCurrency(expectedMoney)}</p>
                        <p className="text-xs text-gray-500">(Total Sales - Expenses)</p>
                        </div>
                        
                        <div className="p-4 rounded-lg bg-gray-100">
                        <p className="text-sm text-gray-600">Counted Money</p>
                        <p className="text-2xl font-bold">{formatCurrency(totalCountedCash + totalCountedMomo)}</p>
                        <p className="text-xs text-gray-500">(Cash + MoMo)</p>
                        </div>
                        
                        <div className="p-4 rounded-lg bg-gray-100">
                        <p className="text-sm text-gray-600">Available Money</p>
                        <p className="text-2xl font-bold">{formatCurrency(availableMoney)}</p>
                        <p className="text-xs text-gray-500">(Counted - Expenses - Pardons - Change)</p>
                        </div>
                    </div>
                    </CardContent>
                </Card>

                <Card className={`shadow-sm border-2 ${balanceStatus.bg}`}>
                    <CardContent className="p-6">
                    <div className="flex items-center justify-center space-x-3">
                        <balanceStatus.icon className={`h-6 w-6 ${balanceStatus.color}`} />
                        <div className="text-center">
                        <p className="text-sm font-medium text-gray-700">Balance Status</p>
                        <p className={`text-xl font-bold ${balanceStatus.color}`}>
                            {balanceStatus.text}
                        </p>
                        </div>
                    </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Key Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Sales:</span>
                        <span className="font-medium">{formatCurrency(stats.totalSales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Misc. Expenses:</span>
                        <span className="font-medium text-red-600">{formatCurrency(totalMiscExpenses)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Pardoned Amounts:</span>
                        <span className="font-medium text-orange-600">{formatCurrency(stats.totalPardonedAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Customer Change:</span>
                        <span className="font-medium text-blue-600">{formatCurrency(stats.changeOwedForPeriod)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                        <span className="text-sm font-semibold">Net Revenue:</span>
                        <span className="font-bold text-green-600">{formatCurrency(stats.totalSales - stats.totalPardonedAmount)}</span>
                    </div>
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => setShowAuditModal(true)}
                    >
                    <FileText className="mr-2 h-4 w-4" />
                    Cross-Check Orders
                    </Button>
                    
                    <Button 
                    className="w-full h-12 text-lg font-semibold"
                    onClick={() => setShowConfirm(true)}
                    disabled={isSubmitting}
                    >
                        {isSubmitting ? <LoadingSpinner/> : isBalanced ? "Finalize Day" : "Finalize with Discrepancy"}
                    </Button>
                </div>
                </div>
            </div>
            </TabsContent>
            <TabsContent value="history">
                <Card>
                    <CardHeader>
                        <CardTitle>Reconciliation History</CardTitle>
                        <CardDescription>Review past end-of-day reports.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    <ScrollArea className="h-96 pr-4">
                        {reports.length > 0 ? reports.map(report => (
                            <div key={report.id} className="p-4 mb-3 border rounded-lg bg-gray-50">
                                <div className="flex justify-between items-center mb-2">
                                    <div>
                                        <p className="font-bold">{report.timestamp ? format(report.timestamp.toDate(), 'EEEE, LLL dd, yyyy') : 'Invalid Date'}</p>
                                        <p className="text-xs text-gray-500">{report.timestamp ? formatTimestamp(report.timestamp) : ''}</p>
                                    </div>
                                    <Badge variant={report.totalDiscrepancy === 0 ? 'default' : 'destructive'}>
                                        {formatCurrency(report.totalDiscrepancy)}
                                    </Badge>
                                </div>
                                {report.notes && <p className="text-sm italic text-gray-600">"{report.notes}"</p>}
                            </div>
                        )) : <p className="text-center text-gray-500 py-10">No reports found.</p>}
                    </ScrollArea>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
        
        {showAuditModal && <AdvancedReconciliationModal />}

        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will finalize the financial report for today. It cannot be undone.
              </AlertDialogDescription>
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

export default AccountingView;

    

    