
"use client";

import React, { useState, useMemo } from 'react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, OrderItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface FulfillItemsModalProps {
    order: Order;
    onClose: () => void;
}

interface ItemToFulfill extends Omit<OrderItem, 'id' | 'category'> {
    uniqueKey: string;
}

const FulfillItemsModal: React.FC<FulfillItemsModalProps> = ({ order, onClose }) => {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    
    const unfulfilledItems = useMemo(() => {
        const items: ItemToFulfill[] = [];
        order.items.forEach((item, index) => {
            const fulfilledCount = order.fulfilledItems?.filter(fi => fi.name === item.name).reduce((sum, fi) => sum + fi.quantity, 0) || 0;
            if (item.quantity > fulfilledCount) {
                items.push({ ...item, uniqueKey: `${item.name}-${index}` });
            }
        });
        return items;
    }, [order]);
    
    const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

    const handleCheckboxChange = (uniqueKey: string, checked: boolean) => {
        setSelectedItems(prev => ({ ...prev, [uniqueKey]: checked }));
    };

    const handleFulfill = async () => {
        setIsProcessing(true);
        const itemsToMarkAsFulfilled = unfulfilledItems.filter(item => selectedItems[item.uniqueKey]);

        if (itemsToMarkAsFulfilled.length === 0) {
            toast({
                variant: "destructive",
                title: "No items selected",
                description: "Please select at least one item to fulfill.",
            });
            setIsProcessing(false);
            return;
        }

        try {
            const orderRef = doc(db, "orders", order.id);
            const fulfillmentUpdates = itemsToMarkAsFulfilled.map(item => ({
                name: item.name,
                quantity: item.quantity,
            }));
            
            await updateDoc(orderRef, {
                fulfilledItems: arrayUnion(...fulfillmentUpdates)
            });

            toast({
                title: "Items Fulfilled",
                description: `${itemsToMarkAsFulfilled.length} item(s) have been marked as fulfilled.`,
            });
            onClose();
        } catch (error) {
            console.error("Error fulfilling items:", error);
            toast({
                variant: "destructive",
                title: "Fulfillment Failed",
                description: "Could not update the order. Please try again.",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Fulfill Items for Order {order.simplifiedId}</DialogTitle>
                    <DialogDescription>
                        Select the items the customer is receiving now.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-64 my-4">
                    <div className="space-y-3 pr-4">
                        {unfulfilledItems.length > 0 ? (
                            unfulfilledItems.map((item) => (
                                <div key={item.uniqueKey} className="flex items-center space-x-3 p-3 rounded-md border">
                                    <Checkbox
                                        id={item.uniqueKey}
                                        checked={!!selectedItems[item.uniqueKey]}
                                        onCheckedChange={(checked) => handleCheckboxChange(item.uniqueKey, !!checked)}
                                    />
                                    <Label htmlFor={item.uniqueKey} className="flex-1 cursor-pointer">
                                        <div className="flex justify-between">
                                            <span>{item.quantity}x {item.name}</span>
                                            <span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span>
                                        </div>
                                    </Label>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-10">All items have been fulfilled.</p>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button onClick={onClose} variant="secondary">Cancel</Button>
                    <Button onClick={handleFulfill} disabled={isProcessing || Object.values(selectedItems).every(v => !v)}>
                        {isProcessing ? <LoadingSpinner /> : "Fulfill Selected Items"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FulfillItemsModal;
