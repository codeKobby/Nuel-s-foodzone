
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
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PartialSettleModalProps {
    order: Order;
    onClose: () => void;
    onSettle: (orderId: string, amount: number) => void;
}

const PartialSettleModal: React.FC<PartialSettleModalProps> = ({ order, onClose, onSettle }) => {
    const changeDue = Math.abs(order.balanceDue);
    const [settleAmount, setSettleAmount] = useState(changeDue.toFixed(2));
    const [error, setError] = useState<string | null>(null);

    const handleSettle = () => {
        const amount = parseFloat(settleAmount);
        if (isNaN(amount) || amount <= 0) {
            setError("Please enter a valid positive amount.");
            return;
        }
        if (amount > changeDue) {
            setError(`Cannot settle more than the change due of ${formatCurrency(changeDue)}.`);
            return;
        }
        setError(null);
        onSettle(order.id, amount);
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Settle Change for {order.tag || order.simplifiedId}</DialogTitle>
                    <DialogDescription>
                        Outstanding change: <span className="font-bold text-red-500">{formatCurrency(changeDue)}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label htmlFor="settle-amount">Amount Given to Customer</Label>
                    <Input
                        id="settle-amount"
                        type="number"
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.00"
                        autoFocus
                    />
                    {error && <AlertDescription className="text-red-500 text-xs">{error}</AlertDescription>}
                </div>
                <DialogFooter>
                    <Button onClick={onClose} variant="secondary">Cancel</Button>
                    <Button onClick={handleSettle} className="bg-green-500 hover:bg-green-600">Settle Amount</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PartialSettleModal;
