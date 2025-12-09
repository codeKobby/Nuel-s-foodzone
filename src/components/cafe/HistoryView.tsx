
"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ReconciliationReport } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp, FileText, Banknote, Smartphone, Scale, ShoppingBag, Gift, Ban, ArrowRightLeft, Coins, Receipt, Wallet } from 'lucide-react';
import { groupOrdersByDate } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Separator } from '../ui/separator';

const getBalanceStatus = (discrepancy: number) => {
    if (Math.abs(discrepancy) < 0.01) {
        return { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/30', icon: CheckCircle, text: 'Balanced' };
    } else if (discrepancy > 0) {
        return { color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10 dark:bg-sky-500/20 border-sky-500/30', icon: TrendingUp, text: `Surplus` };
    } else {
        return { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/30', icon: TrendingDown, text: `Deficit` };
    }
};

const HistoryView: React.FC = () => {
    const [reports, setReports] = useState<ReconciliationReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const reportsQuery = query(collection(db, "reconciliationReports"), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
            const fetchedReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReconciliationReport));
            setReports(fetchedReports);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching reports history:", err);
            setError("Failed to load historical reports.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const groupedReports = groupOrdersByDate<ReconciliationReport>(reports);

    if (loading) {
        return <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>;
    }

    if (error) {
        return <div className="p-4 text-red-500">{error}</div>;
    }

    return (
        <ScrollArea className="h-full">
            <div className="p-4 md:p-6 h-full">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle>Reconciliation History</CardTitle>
                        <CardDescription>A log of all past end-of-day financial reports.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        {Object.keys(groupedReports).length > 0 ? (
                            <Accordion type="single" collapsible className="w-full space-y-4">
                                {Object.entries(groupedReports).map(([date, reportsOnDate]) => (
                                    <div key={date}>
                                        <h3 className="text-lg font-semibold mb-3">{date}</h3>
                                        {reportsOnDate.map(report => {
                                            const status = getBalanceStatus(report.totalDiscrepancy);
                                            // Use saved discrepancies if available, otherwise calculate
                                            const cashDiscrepancy = report.cashDiscrepancy ?? (report.countedCash - report.expectedCash - (report.changeOwedSetAside ? report.changeOwedForPeriod : 0));
                                            const momoDiscrepancy = report.momoDiscrepancy ?? ((report.countedMomo || 0) - (report.expectedMomo || 0));

                                            return (
                                                <AccordionItem value={report.id} key={report.id} className="border-0 mb-3">
                                                    <AccordionTrigger className="p-4 border rounded-xl bg-card hover:bg-muted/50 hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:border-b-0 transition-colors">
                                                        <div className="flex justify-between items-center w-full gap-4">
                                                            <div className="text-left min-w-0">
                                                                <p className="font-semibold text-sm md:text-base">{formatTimestamp(report.timestamp)}</p>
                                                                <p className="text-xs text-muted-foreground">by {report.cashierName || 'Unknown'}</p>
                                                                {report.totalSales !== undefined && (
                                                                    <p className="text-xs text-muted-foreground mt-1">
                                                                        Sales: {formatCurrency(report.totalSales)}
                                                                        {report.totalItemsSold !== undefined && ` • ${report.totalItemsSold} items`}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <Badge className={`flex items-center gap-1.5 px-3 py-1.5 ${status.bg} ${status.color} border font-medium`}>
                                                                <status.icon className="h-3.5 w-3.5" />
                                                                <span>{status.text}: {formatCurrency(report.totalDiscrepancy)}</span>
                                                            </Badge>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="p-4 md:p-5 border rounded-b-xl border-t-0 bg-muted/30">
                                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                                            {/* Sales Summary */}
                                                            <div className="space-y-3">
                                                                <h4 className="font-semibold flex items-center gap-2 text-sm"><ShoppingBag className="h-4 w-4 text-indigo-500" />Sales Summary</h4>
                                                                <div className="p-3 rounded-lg bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20 space-y-2">
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-muted-foreground">Total Sales:</span>
                                                                        <span className="font-bold text-foreground">{formatCurrency(report.totalSales)}</span>
                                                                    </div>
                                                                    {report.totalItemsSold !== undefined && (
                                                                        <div className="flex justify-between text-xs">
                                                                            <span className="text-muted-foreground">Items Sold:</span>
                                                                            <span className="text-foreground">{report.totalItemsSold}</span>
                                                                        </div>
                                                                    )}
                                                                    <Separator className="my-2 bg-indigo-500/20" />
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground flex items-center gap-1"><Banknote className="h-3 w-3 text-emerald-500" />Cash Sales:</span>
                                                                        <span className="text-foreground">{formatCurrency(report.cashSales || 0)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground flex items-center gap-1"><Smartphone className="h-3 w-3 text-violet-500" />MoMo Sales:</span>
                                                                        <span className="text-foreground">{formatCurrency(report.momoSales || 0)}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Collections (Money Received from Previous Days) */}
                                                                {(report.collectionsFromPreviousDays || 0) > 0 && (
                                                                    <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 space-y-2">
                                                                        <p className="font-medium text-sm flex items-center gap-2"><Receipt className="h-4 w-4 text-blue-500" />Collections (Previous Days)</p>
                                                                        <div className="flex justify-between text-xs font-medium">
                                                                            <span className="text-muted-foreground">Total Collected:</span>
                                                                            <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(report.collectionsFromPreviousDays || 0)}</span>
                                                                        </div>
                                                                        {(report.settledUnpaidCash || 0) > 0 && (
                                                                            <div className="flex justify-between text-xs pl-2">
                                                                                <span className="text-muted-foreground flex items-center gap-1">↳ <Banknote className="h-3 w-3 text-emerald-500" />Cash received:</span>
                                                                                <span className="text-foreground">{formatCurrency(report.settledUnpaidCash || 0)}</span>
                                                                            </div>
                                                                        )}
                                                                        {(report.settledUnpaidMomo || 0) > 0 && (
                                                                            <div className="flex justify-between text-xs pl-2">
                                                                                <span className="text-muted-foreground flex items-center gap-1">↳ <Smartphone className="h-3 w-3 text-violet-500" />MoMo received:</span>
                                                                                <span className="text-foreground">{formatCurrency(report.settledUnpaidMomo || 0)}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Deductions / Adjustments */}
                                                                {((report.totalRewardDiscount || 0) > 0 || (report.totalPardonedAmount || 0) > 0) && (
                                                                    <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 space-y-2">
                                                                        <p className="font-medium text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Deductions</p>
                                                                        {(report.totalRewardDiscount || 0) > 0 && (
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-muted-foreground flex items-center gap-1"><Gift className="h-3 w-3 text-pink-500" />Reward Discounts:</span>
                                                                                <span className="text-pink-600 dark:text-pink-400">-{formatCurrency(report.totalRewardDiscount || 0)}</span>
                                                                            </div>
                                                                        )}
                                                                        {(report.totalPardonedAmount || 0) > 0 && (
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-muted-foreground flex items-center gap-1"><Ban className="h-3 w-3 text-amber-500" />Pardoned Orders:</span>
                                                                                <span className="text-amber-600 dark:text-amber-400">-{formatCurrency(report.totalPardonedAmount || 0)}</span>
                                                                            </div>
                                                                        )}
                                                                        <p className="text-[10px] text-muted-foreground/70 italic mt-1">*These reduce total sales but not expected cash/momo</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Financial Breakdown */}
                                                            <div className="space-y-3">
                                                                <h4 className="font-semibold flex items-center gap-2 text-sm"><Scale className="h-4 w-4 text-teal-500" />Financial Breakdown</h4>

                                                                {/* Cash Breakdown */}
                                                                <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500/5 to-green-500/5 border border-emerald-500/20 space-y-2">
                                                                    <p className="font-medium text-sm flex items-center gap-2"><Banknote className="h-4 w-4 text-emerald-500" />Cash Breakdown</p>

                                                                    {/* Show how expected is calculated */}
                                                                    <div className="space-y-1 text-xs border-b border-emerald-500/20 pb-2 mb-2">
                                                                        <div className="flex justify-between">
                                                                            <span className="text-muted-foreground">Cash Sales:</span>
                                                                            <span className="text-foreground">{formatCurrency(report.cashSales || 0)}</span>
                                                                        </div>
                                                                        {(report.settledUnpaidCash || 0) > 0 && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">+ Collections (Cash):</span>
                                                                                <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(report.settledUnpaidCash || 0)}</span>
                                                                            </div>
                                                                        )}
                                                                        {(report.miscCashExpenses || 0) > 0 && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">- Cash Expenses:</span>
                                                                                <span className="text-rose-600 dark:text-rose-400">({formatCurrency(report.miscCashExpenses || 0)})</span>
                                                                            </div>
                                                                        )}
                                                                        {(report.previousDaysChangeGiven || 0) > 0 && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">- Previous Change Given:</span>
                                                                                <span className="text-amber-600 dark:text-amber-400">({formatCurrency(report.previousDaysChangeGiven || 0)})</span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex justify-between text-xs font-medium">
                                                                        <span className="text-muted-foreground">= Expected Cash:</span>
                                                                        <span className="text-foreground font-semibold">{formatCurrency(report.expectedCash)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">Counted Cash:</span>
                                                                        <span className="text-foreground">{formatCurrency(report.countedCash)}</span>
                                                                    </div>
                                                                    {report.changeOwedForPeriod > 0 && (
                                                                        <div className="flex justify-between text-xs">
                                                                            <span className="text-muted-foreground">Change Owed {report.changeOwedSetAside ? '(Set Aside)' : '(In Drawer)'}:</span>
                                                                            <span className="text-amber-600 dark:text-amber-400">{formatCurrency(report.changeOwedForPeriod)}</span>
                                                                        </div>
                                                                    )}
                                                                    <Separator className="bg-emerald-500/20" />
                                                                    <div className="flex justify-between text-xs font-semibold">
                                                                        <span className="text-muted-foreground">Cash Discrepancy:</span>
                                                                        <span className={cashDiscrepancy === 0 ? 'text-emerald-600 dark:text-emerald-400' : cashDiscrepancy > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'}>
                                                                            {cashDiscrepancy > 0 ? '+' : ''}{formatCurrency(cashDiscrepancy)}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* MoMo Breakdown */}
                                                                <div className="p-3 rounded-lg bg-gradient-to-br from-violet-500/5 to-purple-500/5 border border-violet-500/20 space-y-2">
                                                                    <p className="font-medium text-sm flex items-center gap-2"><Smartphone className="h-4 w-4 text-violet-500" />MoMo Breakdown</p>

                                                                    {/* Show how expected is calculated */}
                                                                    <div className="space-y-1 text-xs border-b border-violet-500/20 pb-2 mb-2">
                                                                        <div className="flex justify-between">
                                                                            <span className="text-muted-foreground">MoMo Sales:</span>
                                                                            <span className="text-foreground">{formatCurrency(report.momoSales || 0)}</span>
                                                                        </div>
                                                                        {(report.settledUnpaidMomo || 0) > 0 && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">+ Collections (MoMo):</span>
                                                                                <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(report.settledUnpaidMomo || 0)}</span>
                                                                            </div>
                                                                        )}
                                                                        {(report.miscMomoExpenses || 0) > 0 && (
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">- MoMo Expenses:</span>
                                                                                <span className="text-rose-600 dark:text-rose-400">({formatCurrency(report.miscMomoExpenses || 0)})</span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex justify-between text-xs font-medium">
                                                                        <span className="text-muted-foreground">= Expected MoMo:</span>
                                                                        <span className="text-foreground font-semibold">{formatCurrency(report.expectedMomo)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">Counted MoMo:</span>
                                                                        <span className="text-foreground">{formatCurrency(report.countedMomo)}</span>
                                                                    </div>
                                                                    <Separator className="bg-violet-500/20" />
                                                                    <div className="flex justify-between text-xs font-semibold">
                                                                        <span className="text-muted-foreground">MoMo Discrepancy:</span>
                                                                        <span className={momoDiscrepancy === 0 ? 'text-emerald-600 dark:text-emerald-400' : momoDiscrepancy > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'}>
                                                                            {momoDiscrepancy > 0 ? '+' : ''}{formatCurrency(momoDiscrepancy)}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Misc Expenses - Now with details */}
                                                                {((report.miscCashExpenses || 0) > 0 || (report.miscMomoExpenses || 0) > 0) && (
                                                                    <div className="p-3 rounded-lg bg-gradient-to-br from-rose-500/5 to-orange-500/5 border border-rose-500/20 space-y-2">
                                                                        <p className="font-medium text-sm flex items-center gap-2"><Wallet className="h-4 w-4 text-rose-500" />Expense Details</p>
                                                                        <div className="flex justify-between text-xs font-medium border-b border-rose-500/20 pb-2 mb-2">
                                                                            <span className="text-muted-foreground">Total Expenses:</span>
                                                                            <span className="text-rose-600 dark:text-rose-400">-{formatCurrency((report.miscCashExpenses || 0) + (report.miscMomoExpenses || 0))}</span>
                                                                        </div>
                                                                        {(report.miscCashExpenses || 0) > 0 && (
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-muted-foreground flex items-center gap-1"><Banknote className="h-3 w-3 text-emerald-500" />Cash:</span>
                                                                                <span className="text-rose-600 dark:text-rose-400">-{formatCurrency(report.miscCashExpenses || 0)}</span>
                                                                            </div>
                                                                        )}
                                                                        {(report.miscMomoExpenses || 0) > 0 && (
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-muted-foreground flex items-center gap-1"><Smartphone className="h-3 w-3 text-violet-500" />MoMo:</span>
                                                                                <span className="text-rose-600 dark:text-rose-400">-{formatCurrency(report.miscMomoExpenses || 0)}</span>
                                                                            </div>
                                                                        )}
                                                                        {report.miscExpenseDetails && report.miscExpenseDetails.length > 0 && (
                                                                            <>
                                                                                <Separator className="my-2 bg-rose-500/20" />
                                                                                <p className="text-xs text-muted-foreground font-medium mb-1">Breakdown:</p>
                                                                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                                                                    {report.miscExpenseDetails.map((expense, idx) => (
                                                                                        <div key={idx} className="flex justify-between items-center text-xs bg-background/50 rounded px-2 py-1">
                                                                                            <span className="text-foreground truncate flex-1 mr-2">{expense.purpose}</span>
                                                                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${expense.source === 'cash' ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : 'border-violet-500/50 text-violet-600 dark:text-violet-400'}`}>
                                                                                                    {expense.source === 'cash' ? 'Cash' : 'MoMo'}
                                                                                                </Badge>
                                                                                                <span className="text-rose-600 dark:text-rose-400 font-medium">-{formatCurrency(expense.amount)}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Notes & Change */}
                                                            <div className="space-y-3">
                                                                {/* Overall Balance Card */}
                                                                <div className={`p-4 rounded-xl ${status.bg} border-2`}>
                                                                    <div className="text-center space-y-2">
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <status.icon className={`h-6 w-6 ${status.color}`} />
                                                                            <p className="font-semibold text-sm text-muted-foreground">Overall Balance</p>
                                                                        </div>
                                                                        <p className={`text-2xl font-bold ${status.color}`}>
                                                                            {report.totalDiscrepancy > 0 ? '+' : ''}{formatCurrency(report.totalDiscrepancy)}
                                                                        </p>
                                                                        <div className="text-xs text-muted-foreground space-y-0.5 pt-2 border-t border-current/20">
                                                                            <div className="flex justify-between">
                                                                                <span>Cash Discrepancy:</span>
                                                                                <span className={cashDiscrepancy >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                                                                    {cashDiscrepancy > 0 ? '+' : ''}{formatCurrency(cashDiscrepancy)}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span>MoMo Discrepancy:</span>
                                                                                <span className={momoDiscrepancy >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                                                                    {momoDiscrepancy > 0 ? '+' : ''}{formatCurrency(momoDiscrepancy)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Change Tracking */}
                                                                {(report.changeOwedForPeriod > 0 || (report.previousDaysChangeGiven || 0) > 0) && (
                                                                    <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border border-amber-500/20 space-y-2">
                                                                        <p className="font-medium text-sm flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-amber-500" />Change Tracking</p>
                                                                        {report.changeOwedForPeriod > 0 && (
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-muted-foreground">Change Owed:</span>
                                                                                <span className="text-foreground">{formatCurrency(report.changeOwedForPeriod)}</span>
                                                                            </div>
                                                                        )}
                                                                        {(report.previousDaysChangeGiven || 0) > 0 && (
                                                                            <div className="flex justify-between text-xs">
                                                                                <span className="text-muted-foreground">Previous Change Given:</span>
                                                                                <span className="text-foreground">-{formatCurrency(report.previousDaysChangeGiven || 0)}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="flex justify-between text-xs">
                                                                            <span className="text-muted-foreground">Status:</span>
                                                                            <Badge variant="outline" className={`text-xs px-2 ${report.changeOwedSetAside ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : 'border-muted-foreground/50'}`}>
                                                                                {report.changeOwedSetAside ? 'Set Aside' : 'In Drawer'}
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Notes */}
                                                                <div className="space-y-2">
                                                                    <h4 className="font-semibold flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-slate-500" />Notes</h4>
                                                                    {report.notes ? (
                                                                        <p className="text-sm italic text-muted-foreground p-3 bg-slate-500/5 border border-slate-500/20 rounded-lg">"{report.notes}"</p>
                                                                    ) : (
                                                                        <p className="text-sm text-muted-foreground/70 p-3 bg-slate-500/5 border border-slate-500/10 rounded-lg italic">No notes were added for this report.</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            )
                                        })}
                                    </div>
                                ))}
                            </Accordion>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                                <div className="p-4 rounded-full bg-muted/50 mb-4">
                                    <AlertTriangle className="h-10 w-10" />
                                </div>
                                <p className="font-medium">No historical reports found.</p>
                                <p className="text-sm mt-1">Complete a day closeout to see reports here.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </ScrollArea>
    );
};

export default HistoryView;

