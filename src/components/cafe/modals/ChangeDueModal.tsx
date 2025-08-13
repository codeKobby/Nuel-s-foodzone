
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
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HandCoins, Repeat, Wallet } from 'lucide-react';
import ApplyCreditModal from './ApplyCreditModal';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDescription } from '@/components/ui/alert';

interface ChangeDueModalProps {
    ordersWithChange?: Order[]; // For the list view in Orders
    orderForPopup?: Order; // For the immediate popup after payment
    onClose: () => void;
    onSettle: (orderId: string, amount: number) => void;
}

const ChangeDueModal: React.FC<ChangeDueModalProps> = ({ ordersWithChange, orderForPopup, onClose, onSettle }) => {
    const [settleOrder, setSettleOrder] = useState<Order | null>(orderForPopup || null);
    const [creditOrder, setCreditOrder] = useState<Order | null>(null);

    const handleSettleSubmit = (orderId: string, amount: number) => {
        onSettle(orderId, amount);
        setSettleOrder(null);
        if (orderForPopup) onClose();
    };

    const handleCreditApplied = () => {
        setCreditOrder(null);
        onClose(); // Close the main change modal as well
    };

    if (orderForPopup) {
        return (
             <SettleChangePopup
                order={orderForPopup}
                onClose={onClose}
                onSettle={handleSettleSubmit}
            />
        )
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
                            {ordersWithChange && ordersWithChange.length > 0 ? (
                                ordersWithChange.map(o => (
                                    <Card key={o.id} className="p-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold">{o.tag || o.simplifiedId}</p>
                                                <p className="text-sm text-red-500 font-bold">{formatCurrency(Math.abs(o.balanceDue))} due</p>
                                                <p className="text-xs text-muted-foreground">{formatTimestamp(o.timestamp)}</p>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Button size="sm" variant="outline" onClick={() => setSettleOrder(o)}>
                                                    <Wallet className="h-4 w-4 mr-2" /> Settle
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
            {settleOrder && !orderForPopup && (
                 <SettleChangePopup
                    order={settleOrder}
                    onClose={() => setSettleOrder(null)}
                    onSettle={handleSettleSubmit}
                />
            )}
             {creditOrder && (
                <ApplyCreditModal
                    sourceOrder={creditOrder}
                    onClose={() => setCreditOrder(null)}
                    onCreditApplied={handleCreditApplied}
                />
            )}
        </>
    );
};

const SettleChangePopup: React.FC<{
    order: Order,
    onClose: () => void,
    onSettle: (orderId: string, amount: number) => void
}> = ({ order, onClose, onSettle }) => {
    const changeDue = Math.abs(order.balanceDue);
    const [settleAmount, setSettleAmount] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSettle = () => {
        const amount = parseFloat(settleAmount);
        if (isNaN(amount) || amount <= 0) {
            setError("Please enter a valid amount.");
            return;
        }
        if (amount > changeDue) {
            setError(`Cannot settle more than the change due of ${formatCurrency(changeDue)}.`);
            return;
        }
        setError(null);
        onSettle(order.id, amount);
        onClose();
    };
    
    const handleFullChange = () => {
        setSettleAmount(changeDue.toFixed(2));
    };

    return (
         <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Change Due for Order {order.simplifiedId}</DialogTitle>
                    <DialogDescription>
                        Total change owed: <span className="font-bold text-red-500">{formatCurrency(changeDue)}</span>. How much change are you giving to the customer?
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label htmlFor="settle-amount">Amount Given to Customer</Label>
                    <div className="flex items-center gap-2">
                         <Input
                            id="settle-amount"
                            type="number"
                            value={settleAmount}
                            onChange={(e) => setSettleAmount(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="Enter amount given..."
                            autoFocus
                        />
                         <Button onClick={handleFullChange} variant="outline">Full Change</Button>
                    </div>
                    {error && <AlertDescription className="text-red-500 text-xs">{error}</AlertDescription>}
                </div>
                <DialogFooter>
                    <Button onClick={onClose} variant="secondary">Settle Later</Button>
                    <Button onClick={handleSettle} disabled={!settleAmount} className="bg-green-500 hover:bg-green-600">Settle Amount</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default ChangeDueModal;
