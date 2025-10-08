
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
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp, FileText, Banknote, Smartphone, Scale } from 'lucide-react';
import { groupOrdersByDate } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Separator } from '../ui/separator';

const getBalanceStatus = (discrepancy: number) => {
    if (Math.abs(discrepancy) < 0.01) {
        return { color: 'text-green-600 dark:text-green-400', icon: CheckCircle, text: 'Balanced' };
    } else if (discrepancy > 0) {
        return { color: 'text-blue-600 dark:text-blue-400', icon: TrendingUp, text: `Surplus` };
    } else {
        return { color: 'text-red-600 dark:text-red-400', icon: TrendingDown, text: `Deficit` };
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
                                            const cashDiscrepancy = report.countedCash - report.expectedCash - (report.changeOwedSetAside ? report.changeOwedForPeriod : 0);
                                            const momoDiscrepancy = (report.countedMomo || 0) - (report.expectedMomo || 0);

                                            return (
                                            <AccordionItem value={report.id} key={report.id} className="border-b-0">
                                                <AccordionTrigger className="p-4 border rounded-lg bg-secondary hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:border-b-0">
                                                    <div className="flex justify-between items-center w-full">
                                                        <div>
                                                            <p className="font-semibold text-sm">{formatTimestamp(report.timestamp)}</p>
                                                            <p className="text-xs text-muted-foreground">by {report.cashierName || 'Unknown'}</p>
                                                        </div>
                                                        <Badge variant={report.totalDiscrepancy === 0 ? "default" : "destructive"} className={`flex items-center gap-1 ${status.color}`}>
                                                            <status.icon className="h-3 w-3" />
                                                            {status.text}: {formatCurrency(report.totalDiscrepancy)}
                                                        </Badge>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-4 border rounded-b-lg border-t-0 bg-card">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Financial Breakdown */}
                                                        <div className="space-y-4">
                                                            <h4 className="font-semibold flex items-center gap-2"><Scale className="h-4 w-4"/>Financial Breakdown</h4>
                                                            <div className="p-3 rounded-md bg-secondary space-y-2">
                                                                <p className="font-medium text-sm flex items-center gap-2"><Banknote className="h-4 w-4 text-green-500"/>Cash Summary</p>
                                                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Expected:</span><span>{formatCurrency(report.expectedCash)}</span></div>
                                                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Counted:</span><span>{formatCurrency(report.countedCash)}</span></div>
                                                                <Separator/>
                                                                <div className="flex justify-between text-xs font-semibold"><span className="text-muted-foreground">Discrepancy:</span><span className={cashDiscrepancy === 0 ? '' : 'text-red-500'}>{formatCurrency(cashDiscrepancy)}</span></div>
                                                            </div>
                                                             <div className="p-3 rounded-md bg-secondary space-y-2">
                                                                <p className="font-medium text-sm flex items-center gap-2"><Smartphone className="h-4 w-4 text-purple-500"/>Digital Summary</p>
                                                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Expected:</span><span>{formatCurrency(report.expectedMomo)}</span></div>
                                                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Counted:</span><span>{formatCurrency(report.countedMomo)}</span></div>
                                                                <Separator/>
                                                                <div className="flex justify-between text-xs font-semibold"><span className="text-muted-foreground">Discrepancy:</span><span className={momoDiscrepancy === 0 ? '' : 'text-red-500'}>{formatCurrency(momoDiscrepancy)}</span></div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Notes */}
                                                        <div className="space-y-2">
                                                            <h4 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4"/>Notes</h4>
                                                            {report.notes ? (
                                                                <p className="text-sm italic text-muted-foreground p-3 bg-secondary rounded-md">"{report.notes}"</p>
                                                            ) : (
                                                                <p className="text-sm text-muted-foreground">No notes were added for this report.</p>
                                                            )}
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
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <AlertTriangle className="h-10 w-10 mb-4" />
                                <p>No historical reports found.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </ScrollArea>
    );
};

export default HistoryView;

