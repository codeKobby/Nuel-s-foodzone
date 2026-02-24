import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Search, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { PeriodStats } from '@/lib/types';

interface AdvancedReconciliationModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    stats: PeriodStats | null;
}

export const AdvancedReconciliationModal: React.FC<AdvancedReconciliationModalProps> = ({ isOpen, onOpenChange, stats }) => {
    const [checkedOrderIds, setCheckedOrderIds] = useState(new Set<string>());
    const [searchQuery, setSearchQuery] = useState('');

    const handleCheckChange = (orderId: string, isChecked: boolean) => {
        setCheckedOrderIds(prev => {
            const newSet = new Set(prev);
            if (isChecked) newSet.add(orderId);
            else newSet.delete(orderId);
            return newSet;
        });
    };

    const filteredOrders = useMemo(() => stats?.orders.filter(order =>
        order.simplifiedId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.tag && order.tag.toLowerCase().includes(searchQuery.toLowerCase()))
    ) || [], [searchQuery, stats?.orders]);

    const checkedTotal = useMemo(() => filteredOrders
        .filter(o => checkedOrderIds.has(o.id))
        .reduce((sum, o) => sum + o.total, 0), [filteredOrders, checkedOrderIds]);

    const uncheckedTotal = useMemo(() => filteredOrders
        .filter(o => !checkedOrderIds.has(o.id))
        .reduce((sum, o) => sum + o.total, 0), [filteredOrders, checkedOrderIds]);

    const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Cross-Check Digital vs Written Orders
                    </DialogTitle>
                    <DialogDescription>
                        Compare your digital orders against physical kitchen tickets to identify missing or extra orders.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 flex-1 overflow-hidden h-full">
                    <div className="lg:col-span-3 flex flex-col h-full space-y-4 overflow-hidden">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by Order ID or Table/Tag..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <ScrollArea className="flex-1 border rounded-lg">
                            <div className="p-4 space-y-3">
                                {filteredOrders.length > 0 ? filteredOrders.map(order => (
                                    <div
                                        key={order.id}
                                        className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${checkedOrderIds.has(order.id)
                                                ? 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800'
                                                : 'bg-card hover:bg-muted/50'
                                            }`}
                                    >
                                        <Checkbox
                                            id={`check-${order.id}`}
                                            checked={checkedOrderIds.has(order.id)}
                                            onCheckedChange={(checked) => handleCheckChange(order.id, !!checked)}
                                            className="mt-1"
                                        />
                                        <Label htmlFor={`check-${order.id}`} className="flex-1 cursor-pointer">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-lg">{order.simplifiedId}</span>
                                                        {order.tag && <Badge variant="outline" className="text-xs">{order.tag}</Badge>}
                                                        <Badge variant={order.paymentStatus === 'Paid' ? 'default' : 'secondary'} className="text-xs">
                                                            {order.paymentStatus}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {formatTime(order.timestamp.toDate())}
                                                    </p>
                                                    <div className="text-xs text-muted-foreground">
                                                        {order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                                                    </div>
                                                </div>
                                                <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                                            </div>
                                        </Label>
                                    </div>
                                )) : (
                                    <div className="text-center py-12">
                                        <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                        <p className="text-muted-foreground">No orders found</p>
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
                                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                    <p className="text-sm text-blue-600 dark:text-blue-300">Total Digital Orders</p>
                                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-200">{filteredOrders.length}</p>
                                    <p className="text-sm font-medium">{formatCurrency(filteredOrders.reduce((sum, o) => sum + o.total, 0))}</p>
                                </div>
                                <div className="text-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                                    <p className="text-sm text-green-600 dark:text-green-300">✓ Verified Orders</p>
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-200">{checkedOrderIds.size}</p>
                                    <p className="text-sm font-medium">{formatCurrency(checkedTotal)}</p>
                                </div>
                                <div className="text-center p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                                    <p className="text-sm text-red-600 dark:text-red-300">⚠ Unverified Orders</p>
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-200">{filteredOrders.length - checkedOrderIds.size}</p>
                                    <p className="text-sm font-medium">{formatCurrency(uncheckedTotal)}</p>
                                </div>
                                {checkedOrderIds.size === filteredOrders.length && filteredOrders.length > 0 && (
                                    <Alert>
                                        <CheckCircle className="h-4 w-4" />
                                        <AlertDescription className="text-sm">
                                            All digital orders verified! If cash doesn't balance, check for unrecorded written orders.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm">Quick Tips</CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs text-muted-foreground space-y-2">
                                <p>• Check each digital order against your written tickets</p>
                                <p>• Look for missing digital entries</p>
                                <p>• Verify payment methods match</p>
                                <p>• Check for duplicate entries</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
                <DialogFooter className="p-6 pt-4 border-t shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close Audit
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
