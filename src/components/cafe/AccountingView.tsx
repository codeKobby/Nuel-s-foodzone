
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp, addDoc, onSnapshot, serverTimestamp, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense, ReconciliationReport } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { DollarSign, CreditCard, MinusCircle, CheckCircle, AlertCircle, History, Landmark } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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


interface AccountingViewProps {
    appId: string;
}

interface DailyStats {
    totalSales: number;
    cashSales: number;
    momoSales: number;
    miscExpenses: number;
    expectedCash: number;
}

const StatCard: React.FC<{ icon: React.ReactNode, title: string, value: string | number, color?: string }> = ({ icon, title, value, color }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
        </CardContent>
    </Card>
);

const denominations = [
    { name: '200 GHS', value: 200 }, { name: '100 GHS', value: 100 },
    { name: '50 GHS', value: 50 }, { name: '20 GHS', value: 20 },
    { name: '10 GHS', value: 10 }, { name: '5 GHS', value: 5 },
    { name: '2 GHS', value: 2 }, { name: '1 GHS', value: 1 },
    { name: '50 Pesewas', value: 0.5 },
];

const AccountingView: React.FC<AccountingViewProps> = ({ appId }) => {
    const [stats, setStats] = useState<DailyStats>({ totalSales: 0, cashSales: 0, momoSales: 0, miscExpenses: 0, expectedCash: 0 });
    const [counts, setCounts] = useState<Record<string, string>>(denominations.reduce((acc, d) => ({ ...acc, [d.name]: '' }), {}));
    const [countedMomo, setCountedMomo] = useState('');
    const [notes, setNotes] = useState('');
    const [reports, setReports] = useState<ReconciliationReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const totalCountedCash = useMemo(() => {
        return denominations.reduce((acc, d) => {
            const count = parseInt(counts[d.name], 10) || 0;
            return acc + count * d.value;
        }, 0);
    }, [counts]);
    
    const cashDifference = useMemo(() => totalCountedCash - stats.expectedCash, [totalCountedCash, stats.expectedCash]);

    useEffect(() => {
        const fetchDailyData = async () => {
            setLoading(true);
            setError(null);
            try {
                const now = new Date();
                const startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0);
                const startDateTimestamp = Timestamp.fromDate(startDate);

                const ordersRef = collection(db, `/artifacts/${appId}/public/data/orders`);
                const ordersQuery = query(ordersRef, where("timestamp", ">=", startDateTimestamp), where("paymentStatus", "!=", "Unpaid"));
                
                const miscExpensesRef = collection(db, `/artifacts/${appId}/public/data/miscExpenses`);
                const miscQuery = query(miscExpensesRef, where("timestamp", ">=", startDateTimestamp));
                
                const [ordersSnapshot, miscSnapshot] = await Promise.all([getDocs(ordersQuery), getDocs(miscQuery)]);

                let cashSales = 0, momoSales = 0;
                ordersSnapshot.forEach(doc => {
                    const order = doc.data() as Order;
                    if(order.paymentMethod === 'cash') {
                       cashSales += order.amountPaid - order.changeGiven;
                    } else if (order.paymentMethod === 'momo') {
                        momoSales += order.amountPaid;
                    }
                });

                let miscExpenses = 0;
                miscSnapshot.forEach(doc => {
                    const expense = doc.data() as MiscExpense;
                    if (expense.settled) {
                        miscExpenses += expense.amount;
                    }
                });
                
                const totalSales = cashSales + momoSales;
                const expectedCash = cashSales - miscExpenses;
                
                setStats({ totalSales, cashSales, momoSales, miscExpenses, expectedCash });
            } catch (e) {
                console.error(e);
                setError("Failed to load daily financial data. Check Firestore indexes.");
            } finally {
                setLoading(false);
            }
        };

        const reportsRef = collection(db, `/artifacts/${appId}/public/data/reconciliationReports`);
        const q = query(reportsRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReconciliationReport)));
        }, (err) => {
            console.error(err);
            setError("Failed to load past reports.");
        });

        fetchDailyData();
        return () => unsubscribe();
    }, [appId]);

    const handleCountChange = (name: string, value: string) => {
        setCounts(prev => ({ ...prev, [name]: value.replace(/[^0-9]/g, '') }));
    };

    const handleSaveReport = async () => {
        if (totalCountedCash <= 0 && !countedMomo) {
            setError("Please count either cash or Momo/Card before submitting.");
            return;
        }
        setError(null);
        setIsSubmitting(true);
        try {
            const reportData = {
                timestamp: serverTimestamp(),
                period: new Date().toDateString(),
                totalSales: stats.totalSales,
                cashSales: stats.cashSales,
                momoSales: stats.momoSales,
                miscExpenses: stats.miscExpenses,
                expectedCash: stats.expectedCash,
                countedCash: totalCountedCash,
                countedMomo: parseFloat(countedMomo) || 0,
                cashDifference: cashDifference,
                notes: notes,
            };
            await addDoc(collection(db, `/artifacts/${appId}/public/data/reconciliationReports`), reportData);
            
            // Reset form
            setCounts(denominations.reduce((acc, d) => ({ ...acc, [d.name]: '' }), {}));
            setCountedMomo('');
            setNotes('');

        } catch (e) {
            console.error(e);
            setError("Failed to save the report.");
        } finally {
            setIsSubmitting(false);
            setShowConfirm(false);
        }
    };
    
    const renderDifference = (diff: number) => {
        if (diff === 0) return <Badge variant="default" className="bg-green-500 text-lg">Balanced</Badge>;
        const color = diff > 0 ? "text-green-500" : "text-red-500";
        const sign = diff > 0 ? "+" : "";
        return (
            <div className={`text-2xl font-bold ${color}`}>
                {diff > 0 ? 'Surplus' : 'Deficit'}: {sign}{formatCurrency(diff)}
            </div>
        );
    }
    
    if (loading) return <div className="mt-8"><LoadingSpinner /></div>;

    return (
        <div className="flex h-full flex-col md:flex-row bg-secondary/50 dark:bg-background">
            <div className="flex-1 p-6 overflow-y-auto">
                <h2 className="text-3xl font-bold mb-6">Accounting & Reconciliation</h2>
                {error && <Alert variant="destructive" className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

                 <Tabs defaultValue="reconciliation" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
                    <TabsTrigger value="history">History ({reports.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="reconciliation">
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle>Today's Financial Summary</CardTitle>
                                <CardDescription>All financial data since midnight.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard icon={<DollarSign className="text-primary"/>} title="Total Sales (Paid)" value={formatCurrency(stats.totalSales)} />
                                <StatCard icon={<Landmark className="text-blue-500"/>} title="Cash Sales" value={formatCurrency(stats.cashSales)} />
                                <StatCard icon={<CreditCard className="text-purple-500"/>} title="Momo/Card Sales" value={formatCurrency(stats.momoSales)} />
                                <StatCard icon={<MinusCircle className="text-orange-500"/>} title="Misc. Expenses" value={formatCurrency(stats.miscExpenses)} />
                            </CardContent>
                        </Card>
                  </TabsContent>
                  <TabsContent value="history">
                      <Card className="mt-4">
                          <CardHeader>
                              <CardTitle>Reconciliation History</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
                            {reports.length === 0 && <p className="text-muted-foreground italic text-center py-4">No reports saved yet.</p>}
                            {reports.map(report => (
                                <div key={report.id} className="p-3 rounded-lg bg-secondary">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{report.period}</p>
                                            <p className="text-sm text-muted-foreground">{formatTimestamp(report.timestamp)}</p>
                                        </div>
                                        {renderDifference(report.cashDifference)}
                                    </div>
                                    <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1 mt-2 border-t pt-2">
                                        <p>Expected Cash: {formatCurrency(report.expectedCash)}</p>
                                        <p>Counted Cash: {formatCurrency(report.countedCash)}</p>
                                        <p>Expected Momo: {formatCurrency(report.momoSales)}</p>
                                        <p>Counted Momo: {formatCurrency(report.countedMomo)}</p>
                                    </div>
                                    {report.notes && <p className="text-xs italic mt-2">Notes: {report.notes}</p>}
                                </div>
                            ))}
                          </CardContent>
                      </Card>
                  </TabsContent>
                </Tabs>
            </div>
            
            <Card className="w-full md:w-[450px] rounded-none border-t md:border-t-0 md:border-r-0 flex flex-col">
                <CardHeader>
                    <CardTitle className="text-2xl">Close Out for Today</CardTitle>
                    <CardDescription>Count physical cash and reconcile accounts.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow overflow-y-auto">
                    <div className="space-y-4">
                        <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                            <Label className="text-lg font-semibold text-green-700 dark:text-green-300">Expected Cash in Drawer</Label>
                            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.expectedCash)}</p>
                            <p className="text-xs text-muted-foreground">(Total Cash Sales - Settled Misc. Expenses)</p>
                        </div>
                        <div>
                            <Label className="text-lg font-semibold">Cash Count</Label>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 p-3 border rounded-md">
                                {denominations.map(d => (
                                    <div key={d.name} className="flex items-center space-x-2">
                                        <Label htmlFor={`count-${d.name}`} className="w-24 text-sm">{d.name}</Label>
                                        <Input id={`count-${d.name}`} type="text" pattern="[0-9]*" value={counts[d.name]} onChange={e => handleCountChange(d.name, e.target.value)} placeholder="Qty" className="h-8"/>
                                    </div>
                                ))}
                            </div>
                        </div>
                         <div>
                            <Label className="text-lg font-semibold">Momo/Card Count</Label>
                             <Input id="counted-momo" type="number" value={countedMomo} onChange={e => setCountedMomo(e.target.value)} placeholder="Total from device" className="h-10 mt-2"/>
                        </div>
                        <div>
                            <Label className="text-lg font-semibold" htmlFor="notes">Notes</Label>
                             <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes about today's sales (e.g., reason for deficit)" className="mt-2"/>
                        </div>

                    </div>
                </CardContent>
                 <CardFooter className="mt-auto bg-card border-t pt-4 flex-col items-stretch space-y-4">
                    <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
                        <Label className="text-lg font-semibold text-blue-700 dark:text-blue-300">Counted Cash Total</Label>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalCountedCash)}</p>
                    </div>
                     <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-center">
                        <Label className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">Cash Difference</Label>
                        {renderDifference(cashDifference)}
                    </div>
                    <Button onClick={() => setShowConfirm(true)} disabled={isSubmitting} className="w-full h-12 text-lg font-bold">
                        {isSubmitting ? 'Saving...' : 'Save Reconciliation Report'}
                    </Button>
                </CardFooter>
            </Card>
            {showConfirm && (
                <AlertDialog open onOpenChange={setShowConfirm}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Report Submission</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to save this reconciliation report? This action cannot be undone.
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

    