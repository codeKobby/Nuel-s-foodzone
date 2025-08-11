
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
import { HandCoins, Wallet } from 'lucide-react';
import PartialSettleModal from './PartialSettleModal';
import { addCreditToCustomer } from '@/lib/customer-credit';

interface ChangeDueModalProps {
    orders: Order[];
    onClose: () => void;
    onSettle: (orderId: string, amount: number) => void;
}

const ChangeDueModal: React.FC<ChangeDueModalProps> = ({ orders, onClose, onSettle }) => {
    const [settleOrder, setSettleOrder] = useState<Order | null>(null);
    const [isCrediting, setIsCrediting] = useState<string | null>(null);

    const handleSettleSubmit = (orderId: string, amount: number) => {
        onSettle(orderId, amount);
        setSettleOrder(null);
    };

    const handleUseAsCredit = async (order: Order) => {
        if (!order.tag) return;
        setIsCrediting(order.id);
        await addCreditToCustomer(order.tag, order.balanceDue, order.id);
        setIsCrediting(null);
    }

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
                            {orders.length > 0 ? (
                                orders.map(order => (
                                    <Card key={order.id} className="p-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold">{order.tag || order.simplifiedId}</p>
                                                <p className="text-sm text-red-500 font-bold">{formatCurrency(order.balanceDue)} due</p>
                                                <p className="text-xs text-muted-foreground">{formatTimestamp(order.timestamp)}</p>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Button size="sm" variant="outline" onClick={() => setSettleOrder(order)}>
                                                    <HandCoins className="h-4 w-4 mr-2" /> Settle
                                                </Button>
                                                {order.tag && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="secondary" 
                                                        onClick={() => handleUseAsCredit(order)} 
                                                        disabled={isCrediting === order.id}
                                                    >
                                                        <Wallet className="h-4 w-4 mr-2" /> 
                                                        {isCrediting === order.id ? 'Crediting...' : 'Use as Credit'}
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
        </>
    );
};

export default ChangeDueModal;
