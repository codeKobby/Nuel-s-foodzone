"use client";

import React, { useState } from 'react';
import type { Order } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HandCoins, Wallet, Repeat } from 'lucide-react';
import PartialSettleModal from './PartialSettleModal';
import ApplyCreditModal from './ApplyCreditModal';


interface ChangeDueModalProps {
    orders?: Order[]; // Optional for list view
    order?: Order; // Optional for popup view
    isPopup?: boolean;
    onClose: () => void;
    onSettle: (orderId: string, amount: number) => void;
}

const ChangeDueModal: React.FC<ChangeDueModalProps> = ({ orders, order, isPopup = false, onClose, onSettle }) => {
    const [settleOrder, setSettleOrder] = useState<Order | null>(isPopup ? order : null);
    const [creditOrder, setCreditOrder] = useState<Order | null>(null);

    const handleSettleSubmit = (orderId: string, amount: number) => {
        onSettle(orderId, amount);
        setSettleOrder(null);
    };
    
    // The popup is now handled directly by POSView, this modal is only for the list view from OrdersView
    if (isPopup) return null;

    return (
        <>
            <Dialog open onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Customer Change Due</DialogTitle>
                        <DialogDescription>
                            List of all orders with outstanding change to be given to the customer.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-72 my-4">
                        <div className="space-y-3 pr-4">
                            {orders && orders.length > 0 ? (
                                orders.map(o => (
                                    <Card key={o.id} className="p-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold">{o.tag || o.simplifiedId}</p>
                                                <p className="text-sm text-red-500 font-bold">{formatCurrency(Math.abs(o.balanceDue))} due</p>
                                                <p className="text-xs text-muted-foreground">{formatTimestamp(o.timestamp)}</p>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Button size="sm" variant="outline" onClick={() => setSettleOrder(o)}>
                                                    <HandCoins className="h-4 w-4 mr-2" /> Settle
                                                </Button>
                                                {o.tag && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="secondary" 
                                                        onClick={() => setCreditOrder(o)} 
                                                    >
                                                        <Repeat className="h-4 w-4 mr-2" /> 
                                                        Apply to Order
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            ) : (
                                <p className="text-center text-muted-foreground italic py-8">No outstanding change.</p>
                            )}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button onClick={onClose} variant="secondary" className="w-full">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {settleOrder && (
                <PartialSettleModal 
                    order={settleOrder}
                    onClose={() => setSettleOrder(null)}
                    onSettle={handleSettleSubmit}
                />
            )}
             {creditOrder && (
                <ApplyCreditModal
                    sourceOrder={creditOrder}
                    onClose={() => setCreditOrder(null)}
                    onCreditApplied={() => {
                        setCreditOrder(null);
                        onClose(); // Close the main modal too
                    }}
                />
            )}
        </>
    );
};

export default ChangeDueModal;
