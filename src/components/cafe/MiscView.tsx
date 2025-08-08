
"use client";

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MiscExpense } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { Trash2, Check } from 'lucide-react';
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

interface MiscViewProps {
    appId: string;
}

const MiscView: React.FC<MiscViewProps> = ({ appId }) => {
    const [expenses, setExpenses] = useState<MiscExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formState, setFormState] = useState({ purpose: '', amount: '' });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<MiscExpense | null>(null);

    useEffect(() => {
        const expensesRef = collection(db, `/artifacts/${appId}/public/data/miscExpenses`);
        const q = query(expensesRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MiscExpense)));
            setLoading(false);
        }, (e) => { setError("Failed to load miscellaneous expenses."); setLoading(false); });
        return () => unsubscribe();
    }, [appId]);
    
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.purpose || !formState.amount) return;
        const data = { 
            purpose: formState.purpose, 
            amount: parseFloat(formState.amount), 
            settled: false,
            timestamp: serverTimestamp()
        };
        try {
            await addDoc(collection(db, `/artifacts/${appId}/public/data/miscExpenses`), data);
            setFormState({ purpose: '', amount: ''});
        } catch (e) { setError("Failed to save expense."); }
    };

    const handleDelete = async (itemId: string) => {
        try { await deleteDoc(doc(db, `/artifacts/${appId}/public/data/miscExpenses`, itemId)); } catch (e) { setError("Failed to delete expense."); }
        setShowDeleteConfirm(null);
    };
    
    const handleSettle = async (itemId: string) => {
        try {
            await updateDoc(doc(db, `/artifacts/${appId}/public/data/miscExpenses`, itemId), { settled: true });
        } catch (e) {
            setError("Failed to settle expense.");
        }
    };

    return (
        <div className="flex h-full flex-col md:flex-row bg-secondary/50 dark:bg-background">
            <div className="flex-1 p-6 overflow-y-auto">
                <h2 className="text-3xl font-bold mb-6">Miscellaneous Expenses</h2>
                {loading && <LoadingSpinner />}
                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                {!loading && !error && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Expense Log</CardTitle>
                            <CardDescription>A list of all miscellaneous expenses recorded.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {expenses.length === 0 && <p className="text-muted-foreground italic text-center py-4">No expenses recorded yet.</p>}
                            {expenses.map(item => (
                                <div key={item.id} className={`p-3 rounded-lg flex justify-between items-center ${item.settled ? 'bg-green-100 dark:bg-green-900/20' : 'bg-secondary'}`}>
                                    <div>
                                        <p className="font-semibold">{item.purpose}</p>
                                        <p className="text-sm text-muted-foreground">{formatCurrency(item.amount)} - {formatTimestamp(item.timestamp)}</p>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        {item.settled ? (
                                            <Badge variant="default" className="bg-green-500 hover:bg-green-500">Settled</Badge>
                                        ) : (
                                            <Button variant="ghost" size="icon" onClick={() => handleSettle(item.id)}><Check className="h-4 w-4 text-green-500" /></Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(item)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
            <Card className="w-full md:w-96 rounded-none border-t md:border-t-0 md:border-r-0">
                <CardHeader>
                    <CardTitle className="text-2xl">Add New Expense</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="purpose">Purpose</Label>
                            <Input type="text" name="purpose" id="purpose" value={formState.purpose} onChange={handleFormChange} required placeholder="e.g., 'Bought new napkins'"/>
                        </div>
                        <div>
                            <Label htmlFor="amount">Amount</Label>
                            <Input type="number" name="amount" id="amount" value={formState.amount} onChange={handleFormChange} required placeholder="0.00"/>
                        </div>
                        <div className="pt-4">
                            <Button type="submit" className="w-full font-bold">Add Expense</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

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

    