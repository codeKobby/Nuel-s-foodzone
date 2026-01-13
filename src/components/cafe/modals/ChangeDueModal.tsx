
"use client";

import React, { useState } from 'react';
import type { Order } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDescription } from '@/components/ui/alert';

interface ChangeDueModalProps {
    order: Order;
    onClose: () => void;
    onSettle: (orderId: string, amount: number, isFullSettlement: boolean) => void;
}

const ChangeDueModal: React.FC<ChangeDueModalProps> = ({ order, onClose, onSettle }) => {
    const changeDue = Math.abs(order.balanceDue);
    const [settleAmount, setSettleAmount] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSettle = () => {
        const amount = parseFloat(settleAmount);
        if (isNaN(amount) || amount < 0) {
            setError("Please enter a valid amount.");
            return;
        }
        if (amount > changeDue) {
            setError(`Cannot settle more than the change due of ${formatCurrency(changeDue)}.`);
            return;
        }
        setError(null);
        const isFullSettlement = amount === changeDue;
        onSettle(order.id, amount, isFullSettlement);
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
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button onClick={handleSettle} className="w-full sm:w-auto bg-green-500 hover:bg-green-600">Settle Amount</Button>
                    <Button onClick={onClose} variant="secondary" className="w-full sm:w-auto">Settle Later</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default ChangeDueModal;

