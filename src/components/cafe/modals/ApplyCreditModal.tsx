
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Search, AlertCircle } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { applyChangeAsCreditToOrders } from '@/lib/customer-credit';
import { useToast } from '@/hooks/use-toast';

interface ApplyCreditModalProps {
    sourceOrder: Order;
    onClose: () => void;
    onCreditApplied: () => void;
}

const ApplyCreditModal: React.FC<ApplyCreditModalProps> = ({ sourceOrder, onClose, onCreditApplied }) => {
    const [unpaidOrders, setUnpaidOrders] = useState<Order[]>([]);
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();
    
    const availableCredit = Math.abs(sourceOrder.balanceDue);

    useEffect(() => {
        const q = query(
            collection(db, "orders"),
            where("paymentStatus", "in", ["Unpaid", "Partially Paid"]),
            where("balanceDue", ">", 0)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Order))
                .filter(order => order.id !== sourceOrder.id); // Exclude self
            setUnpaidOrders(fetchedOrders);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [sourceOrder.id]);

    const handleCheckChange = (orderId: string, isChecked: boolean) => {
        setSelectedOrderIds(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(orderId);
            } else {
                newSet.delete(orderId);
            }
            return newSet;
        });
    };
    
    const selectedOrdersTotal = useMemo(() => {
        return unpaidOrders
            .filter(o => selectedOrderIds.has(o.id))
            .reduce((sum, o) => sum + o.balanceDue, 0);
    }, [unpaidOrders, selectedOrderIds]);

    const creditToApply = Math.min(availableCredit, selectedOrdersTotal);
    
    const filteredOrders = useMemo(() => {
        return unpaidOrders.filter(order => 
            order.simplifiedId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.tag?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [unpaidOrders, searchQuery]);

    const handleApplyCredit = async () => {
        setIsProcessing(true);
        const result = await applyChangeAsCreditToOrders(sourceOrder.id, Array.from(selectedOrderIds));

        toast({
            title: result.success ? "Success" : "Error",
            description: result.message,
            variant: result.success ? "default" : "destructive",
        });

        if (result.success) {
            onCreditApplied();
        }
        setIsProcessing(false);
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Apply Credit to Another Order</DialogTitle>
                    <DialogDescription>
                        Use the <span className="font-bold text-primary">{formatCurrency(availableCredit)}</span> credit from order #{sourceOrder.simplifiedId} to pay for other unpaid orders.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by Order ID or Tag..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                     <ScrollArea className="h-60 border rounded-md p-2">
                        {loading ? <LoadingSpinner/> : filteredOrders.length > 0 ? (
                             <div className="space-y-2">
                                {filteredOrders.map(order => (
                                    <div key={order.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-secondary">
                                        <Checkbox
                                            id={`check-${order.id}`}
                                            checked={selectedOrderIds.has(order.id)}
                                            onCheckedChange={(checked) => handleCheckChange(order.id, !!checked)}
                                        />
                                        <Label htmlFor={`check-${order.id}`} className="flex-1 flex justify-between items-center cursor-pointer">
                                            <div>
                                                <span className="font-semibold">{order.simplifiedId}</span>
                                                <p className="text-xs text-muted-foreground">{order.tag || 'No Tag'}</p>
                                            </div>
                                            <p className="font-bold text-amber-600">{formatCurrency(order.balanceDue)}</p>
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-10">No other unpaid orders found.</p>
                        )}
                    </ScrollArea>
                    
                    {selectedOrderIds.size > 0 && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Summary</AlertTitle>
                            <AlertDescription>
                                Applying <span className="font-bold">{formatCurrency(creditToApply)}</span> credit to {selectedOrderIds.size} selected order(s) with a total balance of <span className="font-bold">{formatCurrency(selectedOrdersTotal)}</span>. Any remaining credit will be returned to the original order.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={onClose} variant="secondary">Cancel</Button>
                    <Button onClick={handleApplyCredit} disabled={isProcessing || selectedOrderIds.size === 0}>
                        {isProcessing ? <LoadingSpinner /> : `Apply ${formatCurrency(creditToApply)} Credit`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ApplyCreditModal;
