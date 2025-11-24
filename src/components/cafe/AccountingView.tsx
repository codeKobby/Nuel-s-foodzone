"use client";

import React, { useState } from 'react';
import { useAccounting } from '@/hooks/useAccounting';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, FileSignature, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HistoryView from '@/components/cafe/HistoryView';
import { ScrollArea } from '../ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatCurrency } from '@/lib/utils';
import { FinancialSummary } from './accounting/FinancialSummary';
import { ReconciliationForm } from './accounting/ReconciliationForm';

const AccountingView: React.FC<{ setActiveView: (view: string) => void }> = ({ setActiveView }) => {
    const { stats, loading, error, isTodayClosedOut, adjustedExpectedCash } = useAccounting();
    const [showReconciliation, setShowReconciliation] = useState(false);
    const [showUnpaidOrdersWarning, setShowUnpaidOrdersWarning] = useState(false);

    const handleStartEndDay = () => {
        if (stats?.todayUnpaidOrdersValue && stats.todayUnpaidOrdersValue > 0) {
            setShowUnpaidOrdersWarning(true);
        } else {
            setShowReconciliation(true);
        }
    }

    if (showReconciliation && stats) {
        return <ReconciliationForm stats={stats} adjustedExpectedCash={adjustedExpectedCash} onBack={() => setShowReconciliation(false)} />;
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
                    {loading ? <LoadingSpinner /> : error ? (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Failed to Load Data</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : stats ? (
                        <FinancialSummary stats={stats} />
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
                            <AlertDialogAction onClick={() => { setShowUnpaidOrdersWarning(false); setActiveView('orders'); }}><ShoppingCart className="mr-2 h-4 w-4" />Go to Orders</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </ScrollArea>
    );
};

export default AccountingView;
