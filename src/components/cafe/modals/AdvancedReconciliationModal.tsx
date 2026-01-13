
"use client";

import React, { useState, useMemo } from 'react';
import type { Order } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';

interface AdvancedReconciliationModalProps {
    orders: Order[];
    onClose: () => void;
}

const AdvancedReconciliationModal: React.FC<AdvancedReconciliationModalProps> = ({ orders, onClose }) => {
    const [checkedOrderIds, setCheckedOrderIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    const handleCheckChange = (orderId: string, isChecked: boolean) => {
        setCheckedOrderIds(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(orderId);
            } else {
                newSet.delete(orderId);
            }
            return newSet;
        });
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(order =>
            order.simplifiedId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.tag?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [orders, searchQuery]);

    const checkedTotal = useMemo(() => {
        return filteredOrders
            .filter(o => checkedOrderIds.has(o.id))
            .reduce((sum, o) => sum + o.total, 0);
    }, [filteredOrders, checkedOrderIds]);
    
    const uncheckedTotal = useMemo(() => {
        return filteredOrders
            .filter(o => !checkedOrderIds.has(o.id))
            .reduce((sum, o) => sum + o.total, 0);
    }, [filteredOrders, checkedOrderIds]);

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-full flex flex-col sm:h-auto">
                <DialogHeader>
                    <DialogTitle>Advanced Reconciliation Audit</DialogTitle>
                    <DialogDescription>
                        Check off digital orders against your physical kitchen tickets to find discrepancies.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 flex flex-col md:flex-row gap-4 py-4 min-h-0">
                    <div className="flex-1 flex flex-col space-y-4 min-h-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by Order ID or Tag..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <ScrollArea className="flex-1 border rounded-md">
                            <div className="p-2 space-y-2">
                                {filteredOrders.length > 0 ? filteredOrders.map(order => (
                                    <div key={order.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-secondary">
                                        <Checkbox
                                            id={`check-${order.id}`}
                                            checked={checkedOrderIds.has(order.id)}
                                            onCheckedChange={(checked) => handleCheckChange(order.id, !!checked)}
                                        />
                                        <Label htmlFor={`check-${order.id}`} className="flex-1 flex justify-between items-center cursor-pointer">
                                            <div>
                                                <span className="font-semibold">{order.simplifiedId}</span>
                                                {order.tag && <span className="text-muted-foreground ml-2">({order.tag})</span>}
                                                <p className="text-xs text-muted-foreground">{formatTimestamp(order.timestamp, true)}</p>
                                            </div>
                                            <div className="text-right">
                                               <p className="font-bold">{formatCurrency(order.total)}</p>
                                               <Badge variant={order.paymentStatus === 'Paid' ? 'default' : 'secondary'}>{order.paymentStatus}</Badge>
                                            </div>
                                        </Label>
                                    </div>
                                )) : (
                                    <p className="text-center text-muted-foreground py-10">No orders match your search.</p>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    <div className="w-full md:w-56 space-y-4">
                        <div className="p-3 border rounded-lg">
                           <h4 className="font-semibold">Audit Summary</h4>
                           <p className="text-sm text-muted-foreground">Total Orders: {filteredOrders.length}</p>
                        </div>
                        <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-900/20">
                           <h4 className="font-semibold text-green-600">Checked</h4>
                           <p>Count: {checkedOrderIds.size}</p>
                           <p>Total: {formatCurrency(checkedTotal)}</p>
                        </div>
                        <div className="p-3 border rounded-lg bg-red-50 dark:bg-red-900/20">
                           <h4 className="font-semibold text-red-600">Unchecked</h4>
                           <p>Count: {filteredOrders.length - checkedOrderIds.size}</p>
                           <p>Total: {formatCurrency(uncheckedTotal)}</p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={onClose} variant="secondary" className="w-full sm:w-auto">Close Audit</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AdvancedReconciliationModal;
