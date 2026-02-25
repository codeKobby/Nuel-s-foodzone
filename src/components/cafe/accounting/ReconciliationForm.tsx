import React, { useState, useMemo, useCallback, useContext } from 'react';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AuthContext } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowRightLeft, FileText, TrendingUp, TrendingDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CASH_DENOMINATIONS } from '@/lib/constants';
import type { PeriodStats } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { CashCountSection } from './CashCountSection';
import { AdvancedReconciliationModal } from './AdvancedReconciliationModal';
import { Separator } from '@/components/ui/separator';

interface ReconciliationFormProps {
    stats: PeriodStats;
    adjustedExpectedCash: number;
    onBack: () => void;
}

export const ReconciliationForm: React.FC<ReconciliationFormProps> = ({ stats, adjustedExpectedCash, onBack }) => {
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
    const [deductCustomerChange, setDeductCustomerChange] = useState(true);
    const { session } = useContext(AuthContext);
    const { toast } = useToast();
    const today = useMemo(() => new Date(), []);

    const [denominationQuantities, setDenominationQuantities] = useState<Record<string, string>>(
        CASH_DENOMINATIONS.reduce((acc, val) => ({ ...acc, [val]: '' }), {})
    );
    const [momoTransactions, setMomoTransactions] = useState<number[]>([]);
    const [momoInput, setMomoInput] = useState('');

    const totalCountedCash = useMemo(() => {
        return CASH_DENOMINATIONS.reduce((total, den) => {
            const quantity = parseInt(String(denominationQuantities[String(den)] || '0')) || 0;
            return total + (den * quantity);
        }, 0);
    }, [denominationQuantities]);

    const totalCountedMomo = useMemo(() => {
        return momoTransactions.reduce((total, amount) => total + amount, 0);
    }, [momoTransactions]);

    const availableCash = useMemo(() => {
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
        return totalCountedMomo - stats.expectedMomo;
    }, [totalCountedMomo, stats]);

    const totalDiscrepancy = useMemo(() => {
        return cashDiscrepancy + momoDiscrepancy;
    }, [cashDiscrepancy, momoDiscrepancy]);

    const handleSaveReport = async () => {
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
            const batch = writeBatch(db);
            const reportRef = doc(collection(db, "reconciliationReports"));
            batch.set(reportRef, reportData);

            const period = reportData.period as string;
            (stats.orders || [])
                .filter((o) => (o.balanceDue || 0) < 0)
                .forEach((o) => {
                    if (!o.id) return;
                    batch.update(doc(db, 'orders', o.id), {
                        changeSetAside: deductCustomerChange,
                        changeSetAsidePeriod: period,
                        changeSetAsideAt: serverTimestamp(),
                    });
                });

            await batch.commit();

            toast({
                title: "Day Closed Successfully",
                description: "The financial report has been saved.",
                type: 'success'
            });

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

    const balanceStatus = getBalanceStatus(totalDiscrepancy);

    return (
        <>
            <Dialog open={true} onOpenChange={(open) => !open && onBack()}>
                <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle className="text-2xl font-bold">End-of-Day Reconciliation</DialogTitle>
                        <DialogDescription className="text-base">
                            Complete daily cash reconciliation and account for all transactions for {format(today, "EEEE, MMMM dd, yyyy")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                            <div className="lg:col-span-1 space-y-6">
                                <CashCountSection
                                    denominationQuantities={denominationQuantities}
                                    onDenominationChange={handleDenominationChange}
                                    totalCountedCash={totalCountedCash}
                                    momoInput={momoInput}
                                    setMomoInput={setMomoInput}
                                    handleMomoInputKeyDown={handleMomoInputKeyDown}
                                    momoTransactions={momoTransactions}
                                    removeMomoTransaction={removeMomoTransaction}
                                    totalCountedMomo={totalCountedMomo}
                                />

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

                                                    <Separator className="my-2" />
                                                    <div className="flex justify-between font-bold text-blue-700 text-base"><span>Expected Cash:</span><span>{formatCurrency(adjustedExpectedCash)}</span></div>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <h4 className="font-semibold text-lg text-purple-600">MoMo/Card Expected</h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between"><span>Today's MoMo Sales:</span><span className="font-medium">{formatCurrency(stats.momoSales)}</span></div>
                                                    <div className="flex justify-between text-red-600"><span>(-) MoMo Expenses:</span><span className="font-medium">-{formatCurrency(stats.miscMomoExpenses)}</span></div>
                                                    <Separator className="my-2" />
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
                                            <Separator className="my-2" />
                                            <div className="flex justify-between font-bold text-green-700"><span>Available Cash:</span><span>{formatCurrency(availableCash)}</span></div>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <h4 className="font-semibold text-base text-purple-600">MoMo/Card</h4>
                                            <div className="flex justify-between font-bold text-purple-700"><span>Available MoMo:</span><span>{formatCurrency(totalCountedMomo)}</span></div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="bg-green-500/10 p-4"><div className="w-full flex justify-between items-center"><span className="font-bold text-green-700 dark:text-green-300 text-lg">Total Available:</span><span className="font-extrabold text-green-600 dark:text-green-400 text-xl">{formatCurrency(availableCash + totalCountedMomo)}</span></div></CardFooter>
                                </Card>

                                <Card className={`border-2 ${balanceStatus.bg}`}>
                                    <CardContent className="p-6"><div className="flex items-center justify-center space-x-3">{React.createElement(balanceStatus.icon, { className: `h-8 w-8 ${balanceStatus.color}` })}<div className="text-center"><p className="text-lg font-semibold">Overall Balance</p><p className={`text-2xl font-bold ${balanceStatus.color}`}>{balanceStatus.text}</p></div></div></CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-6 border-t shrink-0">
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
            <AdvancedReconciliationModal
                isOpen={isAdvancedModalOpen}
                onOpenChange={setIsAdvancedModalOpen}
                stats={stats}
            />
        </>
    );
};
