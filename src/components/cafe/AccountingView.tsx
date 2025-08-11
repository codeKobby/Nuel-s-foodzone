
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, addDoc, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense, ReconciliationReport } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { DollarSign, CreditCard, MinusCircle, History, Landmark, Coins, AlertCircle, Search, Package, Calendar as CalendarIcon, FileCheck } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { addDays, format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';


interface PeriodStats {
    totalSales: number;
    cashSales: number;
    momoSales: number;
    miscExpenses: number;
    expectedCash: number;
    netRevenue: number;
    changeGiven: number;
    changeOwed: number;
    orders: Order[];
    itemCounts: Record<string, number>;
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

const denominations = [
    { name: '200 GHS', value: 200 }, { name: '100 GHS', value: 100 },
    { name: '50 GHS', value: 50 }, { name: '20 GHS', value: 20 },
    { name: '10 GHS', value: 10 }, { name: '5 GHS', value: 5 },
    { name: '2 GHS', value: 2 }, { name: '1 GHS', value: 1 },
    { name: '50 Pesewas', value: 0.5 },
];

const AccountingView: React.FC = () => {
    const [stats, setStats] = useState<PeriodStats | null>(null);
    const [counts, setCounts] = useState<Record<string, string>>(denominations.reduce((acc, d) => ({ ...acc, [d.name]: '' }), {}));
    const [countedMomo, setCountedMomo] = useState('');
    const [notes, setNotes] = useState('');
    const [changeSetAside, setChangeSetAside] = useState(false);
    const [reports, setReports] = useState<ReconciliationReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isCloseOutOpen, setIsCloseOutOpen] = useState(false);
    const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
    const [date, setDate] = useState<DateRange | undefined>({ from: new Date(), to: new Date() });
    const isMobile = useIsMobile();

    const totalCountedCash = useMemo(() => {
        return denominations.reduce((acc, d) => {
            const count = parseInt(counts[d.name], 10) || 0;
            return acc + count * d.value;
        }, 0);
    }, [counts]);
    
    const cashDifference = useMemo(() => totalCountedCash - (stats?.expectedCash || 0), [totalCountedCash, stats?.expectedCash]);
    const cashForDeposit = useMemo(() => changeSetAside ? totalCountedCash - (stats?.changeOwed || 0) : totalCountedCash, [changeSetAside, totalCountedCash, stats?.changeOwed]);

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

            const ordersRef = collection(db, "orders");
            const ordersQuery = query(ordersRef, where("timestamp", ">=", startDateTimestamp), where("timestamp", "<=", endDateTimestamp));
            
            const miscExpensesRef = collection(db, "miscExpenses");
            const miscQuery = query(miscExpensesRef, where("timestamp", ">=", startDateTimestamp), where("timestamp", "<=", endDateTimestamp));
            
            const [ordersSnapshot, miscSnapshot] = await Promise.all([getDocs(ordersQuery), getDocs(miscQuery)]);

            let cashSales = 0, momoSales = 0, totalSales = 0, totalChangeGiven = 0, totalChangeOwed = 0;
            const periodOrders: Order[] = [];
            const itemCounts: Record<string, number> = {};

            ordersSnapshot.docs.forEach(doc => {
                const order = { id: doc.id, ...doc.data() } as Order;
                periodOrders.push(order);
                if (order.paymentStatus === 'Unpaid') return;
                
                totalSales += order.amountPaid;
                order.items.forEach(item => {
                    itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
                });

                if (order.paymentMethod === 'cash') {
                   // Only count the actual order total as sales, not overpayment for change
                   cashSales += Math.min(order.total, order.amountPaid);
                   totalChangeGiven += order.changeGiven;
                   // This defines change owed *to* the customer from a single transaction
                   if (order.balanceDue > 0 && order.amountPaid >= order.total) {
                       totalChangeOwed += order.balanceDue;
                   }
                } else if (order.paymentMethod === 'momo') {
                    momoSales += order.amountPaid;
                }
            });

            let miscExpenses = 0;
            miscSnapshot.forEach(doc => {
                const expense = doc.data() as MiscExpense;
                // Cashier reconciliation should account for ALL money spent from the drawer
                miscExpenses += expense.amount;
            });
            
            const expectedCash = cashSales - totalChangeGiven - miscExpenses;
            const netRevenue = totalSales - miscExpenses;
            
            setStats({ totalSales, cashSales, momoSales, miscExpenses, expectedCash, netRevenue, changeGiven: totalChangeGiven, changeOwed: totalChangeOwed, orders: periodOrders, itemCounts });
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

    const handleCountChange = (name: string, value: string) => {
        setCounts(prev => ({ ...prev, [name]: value.replace(/[^0-9]/g, '') }));
    };
    
    const resetForm = () => {
        setCounts(denominations.reduce((acc, d) => ({ ...acc, [d.name]: '' }), {}));
        setCountedMomo('');
        setNotes('');
        setChangeSetAside(false);
    }

    const handleSaveReport = async () => {
        if (!stats) {
            setError("No financial data loaded to create a report.");
            return;
        }
        if (totalCountedCash <= 0 && !countedMomo) {
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
                cashSales: stats.cashSales,
                momoSales: stats.momoSales,
                miscExpenses: stats.miscExpenses,
                expectedCash: stats.expectedCash,
                countedCash: totalCountedCash,
                countedMomo: parseFloat(countedMomo) || 0,
                cashDifference: cashDifference,
                changeOwed: stats.changeOwed,
                changeSetAside: changeSetAside,
                cashForDeposit: cashForDeposit,
                notes: notes,
            };
            await addDoc(collection(db, "reconciliationReports"), reportData);
            
            resetForm();
            setIsCloseOutOpen(false);

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
    
    const sortedItemCounts = useMemo(() => {
        if (!stats) return [];
        return Object.entries(stats.itemCounts).sort(([, a], [, b]) => b - a);
    }, [stats]);
    
    const CloseOutDialog = (
        <Dialog open={isCloseOutOpen} onOpenChange={setIsCloseOutOpen}>
            <DialogTrigger asChild>
                 <Button className="w-full md:w-auto"><FileCheck className="mr-2" /> Start End-of-Day</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>End-of-Day Reconciliation</DialogTitle>
                    <DialogDescription>
                        Count physical cash and reconcile accounts for today's sales. This action will save a permanent report.
                    </DialogDescription>
                </DialogHeader>
                
                {!stats ? <LoadingSpinner /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                     <div className="space-y-4">
                        <Label className="text-lg font-semibold">Cash Count</Label>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 border rounded-md bg-secondary">
                            {denominations.map(d => (
                                <div key={d.name} className="flex items-center space-x-2">
                                    <Label htmlFor={`count-${d.name}`} className="w-24 text-sm">{d.name}</Label>
                                    <Input id={`count-${d.name}`} type="text" pattern="[0-9]*" value={counts[d.name]} onChange={e => handleCountChange(d.name, e.target.value)} placeholder="Qty" className="h-8"/>
                                </div>
                            ))}
                        </div>
                        <div>
                            <Label className="text-lg font-semibold">Momo/Card Sales Count</Label>
                            <Input id="counted-momo" type="number" value={countedMomo} onChange={e => setCountedMomo(e.target.value)} placeholder="Total from payment device" className="h-10 mt-2"/>
                        </div>
                        <div>
                            <Label className="text-lg font-semibold" htmlFor="notes">Notes</Label>
                            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., reason for cash deficit/surplus" className="mt-2"/>
                        </div>
                     </div>

                     <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="text-lg font-semibold text-center mb-2">Reconciliation Summary</h3>
                        <div className="flex justify-between items-center">
                            <Label>Expected Cash in Drawer</Label>
                            <p className="font-bold text-lg">{formatCurrency(stats.expectedCash)}</p>
                        </div>
                        <div className="flex justify-between items-center">
                            <Label>Counted Cash Total</Label>
                            <p className="font-bold text-lg">{formatCurrency(totalCountedCash)}</p>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                             <Label>Cash Status</Label>
                             {renderDifferenceBadge(cashDifference)}
                        </div>
                        {cashDifference !== 0 && (
                             <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => setIsAdvancedModalOpen(true)}>
                                 <Search className="mr-2 h-4 w-4" />
                                 Advanced Reconciliation (Audit)
                             </Button>
                        )}
                        <Separator />
                        <div className="space-y-3 pt-2">
                            <h4 className="font-semibold">Handle Outstanding Change</h4>
                            <div className="flex justify-between items-center">
                                <Label className="text-red-500">Change Owed to Customers</Label>
                                <p className="font-bold text-red-500 text-lg">{formatCurrency(stats.changeOwed)}</p>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                <div className="space-y-0.5">
                                    <Label htmlFor="change-set-aside" className="font-semibold">Set aside cash?</Label>
                                    <p className="text-xs text-muted-foreground">Separate cash for owed change.</p>
                                </div>
                                <Switch
                                    id="change-set-aside"
                                    checked={changeSetAside}
                                    onCheckedChange={setChangeSetAside}
                                    disabled={stats.changeOwed === 0}
                                />
                            </div>
                        </div>
                        <Separator />
                        <div className="pt-2 text-center bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                             <Label className="text-xl font-bold text-green-700 dark:text-green-300">Cash for Deposit</Label>
                             <p className="text-3xl md:text-4xl font-extrabold text-green-600 dark:text-green-400 mt-2">{formatCurrency(cashForDeposit)}</p>
                              {changeSetAside && <p className="text-xs text-muted-foreground mt-1">({formatCurrency(totalCountedCash)} - {formatCurrency(stats.changeOwed)} set aside)</p>}
                        </div>
                     </div>
                </div>
                )}
                
                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

                <DialogFooter>
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
                    {CloseOutDialog}
                </div>
            </div>
            
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
                                    <StatCard icon={<DollarSign className="text-primary"/>} title="Total Sales (Paid)" value={formatCurrency(stats.totalSales)} />
                                    <StatCard icon={<Landmark className="text-blue-500"/>} title="Cash Sales" value={formatCurrency(stats.cashSales)} description="Total cash received" />
                                    <StatCard icon={<CreditCard className="text-purple-500"/>} title="Momo/Card Sales" value={formatCurrency(stats.momoSales)} />
                                    <StatCard icon={<Coins className="text-green-500"/>} title="Change Given" value={formatCurrency(stats.changeGiven)} description="Cash returned" />
                                    <StatCard icon={<Coins className="text-red-500"/>} title="Change Owed" value={formatCurrency(stats.changeOwed)} description="Outstanding change" />
                                    <StatCard icon={<MinusCircle className="text-orange-500"/>} title="Misc. Expenses" value={formatCurrency(stats.miscExpenses)} />
                                </CardContent>
                                <CardFooter>
                                    <div className="w-full p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                                        <Label className="text-base md:text-lg font-semibold text-green-700 dark:text-green-300">Net Revenue</Label>
                                        <p className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.netRevenue)}</p>
                                        <p className="text-xs text-muted-foreground">(Total Sales - Misc. Expenses)</p>
                                    </div>
                                </CardFooter>
                            </Card>
                        </div>
                         <Card>
                            <CardHeader>
                                <CardTitle>Item Sales</CardTitle>
                                <CardDescription>Total count of each item sold.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[350px] md:h-[400px] pr-4">
                                    <div className="space-y-3">
                                        {sortedItemCounts.length > 0 ? sortedItemCounts.map(([name, count]) => (
                                            <div key={name} className="flex justify-between items-center text-sm p-2 bg-secondary rounded-md">
                                                <span className="font-medium">{name}</span>
                                                <Badge variant="default" className="bg-primary/80">{count} sold</Badge>
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
                      <CardContent className="space-y-3 max-h-[500px] overflow-y-auto pr-4">
                        {reports.length === 0 && <p className="text-muted-foreground italic text-center py-4">No reports saved yet.</p>}
                        {reports.map(report => (
                            <div key={report.id} className="p-3 rounded-lg bg-secondary">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{report.period}</p>
                                        <p className="text-sm text-muted-foreground">{formatTimestamp(report.timestamp)}</p>
                                    </div>
                                    {renderDifferenceBadge(report.cashDifference)}
                                </div>
                                <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1 mt-2 border-t pt-2">
                                    <span>Expected Cash: <span className="font-medium">{formatCurrency(report.expectedCash)}</span></span>
                                    <span>Counted Cash: <span className="font-medium">{formatCurrency(report.countedCash)}</span></span>
                                    <span>Expected Momo: <span className="font-medium">{formatCurrency(report.momoSales)}</span></span>
                                    <span>Counted Momo: <span className="font-medium">{formatCurrency(report.countedMomo)}</span></span>
                                    <span className="col-span-2">Cash for Deposit: <span className="font-bold">{formatCurrency(report.cashForDeposit)}</span></span>
                                </div>
                                 {report.changeOwed > 0 && (
                                    <div className={`mt-2 text-xs flex items-center gap-2 p-2 rounded-md ${report.changeSetAside ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                                        <AlertCircle className="h-4 w-4"/>
                                        <div>
                                            {formatCurrency(report.changeOwed)} in change was owed. Cashier reported it was
                                            <span className="font-bold"> {report.changeSetAside ? 'SET ASIDE' : 'NOT SET ASIDE'}</span>.
                                        </div>
                                    </div>
                                )}
                                {report.notes && <p className="text-xs italic mt-2 border-t pt-2">Notes: {report.notes}</p>}
                            </div>
                        ))}
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
                                Are you sure you want to save this reconciliation report? This action cannot be undone and will be permanently recorded.
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

    