

"use client";

import React, { useState, useEffect, useMemo, useContext } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MiscExpense, ReconciliationReport } from '@/lib/types';
import { formatCurrency, formatTimestamp, groupOrdersByDate } from '@/lib/utils';
import { Trash2, Check, PlusCircle, Coins, CreditCard, Lock } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { AuthContext } from '@/context/AuthContext';

const MiscExpenseForm = ({
    formState,
    handleFormChange,
    handleSubmit,
    source,
    setSource
}: {
    formState: { purpose: string; amount: string };
    handleFormChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: React.FormEvent) => void;
    source: 'cash' | 'momo' | null;
    setSource: (source: 'cash' | 'momo') => void;
}) => (
     <form onSubmit={handleSubmit} className="space-y-4">
        <div>
            <Label>Source</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
                <Button type="button" onClick={() => setSource('cash')} variant={source === 'cash' ? 'default' : 'outline'}><Coins className="mr-2"/>Cash</Button>
                <Button type="button" onClick={() => setSource('momo')} variant={source === 'momo' ? 'default' : 'outline'}><CreditCard className="mr-2"/>Momo</Button>
            </div>
        </div>
        <div>
            <Label htmlFor="purpose">Purpose</Label>
            <Input type="text" name="purpose" id="purpose" value={formState.purpose} onChange={handleFormChange} required placeholder="e.g., 'Bought new napkins'"/>
        </div>
        <div>
            <Label htmlFor="amount">Amount</Label>
            <Input type="number" name="amount" id="amount" value={formState.amount} onChange={handleFormChange} required placeholder="0.00"/>
        </div>
        <div className="pt-4">
            <Button type="submit" className="w-full font-bold" disabled={!formState.purpose || !formState.amount || !source}>Add Expense</Button>
        </div>
    </form>
);


const MiscView: React.FC = () => {
    const [expenses, setExpenses] = useState<MiscExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formState, setFormState] = useState({ purpose: '', amount: '' });
    const [source, setSource] = useState<'cash' | 'momo' | null>('cash');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<MiscExpense | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const isMobile = useIsMobile();
    const [lastReconciliationDate, setLastReconciliationDate] = useState<Date | null>(null);
    const { session } = useContext(AuthContext);
    
    const groupedExpenses = useMemo(() => groupOrdersByDate(expenses), [expenses]);

    useEffect(() => {
        const reportsRef = collection(db, "reconciliationReports");
        const q = query(reportsRef, orderBy('timestamp', 'desc'), where('timestamp', '!=', null));
        const unsubscribeReports = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const lastReport = snapshot.docs[0].data() as ReconciliationReport;
                setLastReconciliationDate(lastReport.timestamp.toDate());
            }
        });

        const expensesRef = collection(db, "miscExpenses");
        const qExpenses = query(expensesRef, orderBy('timestamp', 'desc'));
        const unsubscribeExpenses = onSnapshot(qExpenses, (snapshot) => {
            setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MiscExpense)));
            setLoading(false);
        }, (e) => { setError("Failed to load miscellaneous expenses."); setLoading(false); });

        return () => {
            unsubscribeReports();
            unsubscribeExpenses();
        };
    }, []);
    
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.purpose || !formState.amount || !source) return;
        const data = { 
            purpose: formState.purpose, 
            amount: parseFloat(formState.amount),
            source: source,
            settled: false,
            timestamp: serverTimestamp(),
            cashierId: session?.uid || 'unknown',
            cashierName: session?.fullName || session?.username || 'Unknown',
        };
        try {
            await addDoc(collection(db, "miscExpenses"), data);
            setFormState({ purpose: '', amount: ''});
            setSource('cash');
            setIsSheetOpen(false); // Close sheet on mobile after submission
        } catch (e) { setError("Failed to save expense."); }
    };

    const handleDelete = async (itemId: string) => {
        try { await deleteDoc(doc(db, "miscExpenses", itemId)); } catch (e) { setError("Failed to delete expense."); }
        setShowDeleteConfirm(null);
    };

    const isExpenseLocked = (expense: MiscExpense) => {
        if (!lastReconciliationDate || !expense.timestamp) return false;
        return expense.timestamp.toDate() <= lastReconciliationDate;
    };


    return (
        <div className="flex h-full flex-col md:flex-row bg-secondary/50 dark:bg-background">
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold">Miscellaneous Expenses</h2>
                     {isMobile && (
                        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                            <SheetTrigger asChild>
                                <Button size="icon"><PlusCircle /></Button>
                            </SheetTrigger>
                            <SheetContent side="bottom" className="h-auto">
                                <SheetHeader>
                                    <SheetTitle className="text-2xl">Add New Expense</SheetTitle>
                                </SheetHeader>
                                <div className="p-4 overflow-y-auto">
                                <MiscExpenseForm
                                    formState={formState}
                                    handleFormChange={handleFormChange}
                                    handleSubmit={handleSubmit}
                                    source={source}
                                    setSource={setSource}
                                />
                                </div>
                            </SheetContent>
                        </Sheet>
                    )}
                </div>
                {loading && <LoadingSpinner />}
                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                {!loading && !error && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Expense Log</CardTitle>
                            <CardDescription>A list of all miscellaneous expenses recorded, grouped by date.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {Object.keys(groupedExpenses).length === 0 && <p className="text-muted-foreground italic text-center py-4">No expenses recorded yet.</p>}
                            {Object.entries(groupedExpenses).map(([date, expensesOnDate]) => (
                                <div key={date}>
                                     <div className="flex items-center gap-3 mb-3">
                                        <h3 className="text-lg font-semibold">{date}</h3>
                                        <Separator className="flex-1" />
                                    </div>
                                    <div className="space-y-3">
                                        {expensesOnDate.map(item => {
                                            const locked = isExpenseLocked(item);
                                            return (
                                            <div key={item.id} className={cn('p-3 rounded-lg flex justify-between items-center', item.settled ? 'bg-green-100 dark:bg-green-900/20' : 'bg-secondary')}>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant={item.source === 'cash' ? 'outline' : 'secondary'} className="capitalize">{item.source}</Badge>
                                                        <p className="font-semibold">{item.purpose}</p>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground mt-1">{formatCurrency(item.amount)} - {formatTimestamp(item.timestamp, true)}</p>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    {item.settled ? (
                                                        <Badge variant="default" className="bg-green-500 hover:bg-green-500">Settled</Badge>
                                                    ) : locked ? (
                                                        <Badge variant="secondary"><Lock className="mr-2 h-3 w-3" />Locked</Badge>
                                                    ) : null}
                                                    {!locked && (
                                                         <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(item)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                    )}
                                                </div>
                                            </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
             {!isMobile && (
                 <Card className="w-full md:w-96 rounded-none border-t md:border-t-0 md:border-l">
                    <CardHeader>
                        <CardTitle className="text-2xl">Add New Expense</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <MiscExpenseForm
                            formState={formState}
                            handleFormChange={handleFormChange}
                            handleSubmit={handleSubmit}
                            source={source}
                            setSource={setSource}
                        />
                    </CardContent>
                </Card>
            )}

            {showDeleteConfirm && (
                <AlertDialog open onOpenChange={() => setShowDeleteConfirm(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this expense of {formatCurrency(showDeleteConfirm.amount)} for "{showDeleteConfirm.purpose}"? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(showDeleteConfirm.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
};

export default MiscView;

    
