
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
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { groupOrdersByDate } from '@/lib/utils';

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
                            <div className="space-y-6">
                                {Object.entries(groupedReports).map(([date, reportsOnDate]) => (
                                    <div key={date}>
                                        <h3 className="text-lg font-semibold mb-3">{date}</h3>
                                        <div className="space-y-4">
                                            {reportsOnDate.map(report => (
                                                <div key={report.id} className="p-4 border rounded-lg bg-secondary">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-semibold text-sm">{formatTimestamp(report.timestamp)}</p>
                                                            <div className="text-xs text-muted-foreground">
                                                                <p>Expected: {formatCurrency(report.totalExpectedRevenue)}</p>
                                                                <p>Counted: {formatCurrency(report.totalCountedRevenue)}</p>
                                                            </div>
                                                        </div>
                                                        <Badge variant={report.totalDiscrepancy === 0 ? "default" : "destructive"}>
                                                            {report.totalDiscrepancy > 0 && <TrendingUp className="mr-1 h-3 w-3" />}
                                                            {report.totalDiscrepancy < 0 && <TrendingDown className="mr-1 h-3 w-3" />}
                                                            {report.totalDiscrepancy === 0 && <CheckCircle className="mr-1 h-3 w-3" />}
                                                            {formatCurrency(report.totalDiscrepancy)}
                                                        </Badge>
                                                    </div>
                                                    {report.notes && (
                                                        <p className="text-xs mt-2 italic text-muted-foreground">Note: "{report.notes}"</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
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
