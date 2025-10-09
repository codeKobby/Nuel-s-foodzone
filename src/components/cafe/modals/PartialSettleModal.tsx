

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
import ApplyCreditModal from './ApplyCreditModal'; // Import the new modal
import { Separator } from '@/components/ui/separator';

interface PartialSettleModalProps {
    order: Order;
    onClose: () => void;
    onSettle: (orderId: string, amount: number, isFullSettlement: boolean) => void;
    isPopup?: boolean;
}

const PartialSettleModal: React.FC<PartialSettleModalProps> = ({ order, onClose, onSettle, isPopup = false }) => {
    const [settleAmount, setSettleAmount] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showApplyCredit, setShowApplyCredit] = useState(false);
    
    const changeDue = Math.abs(order.balanceDue);

    const handleSettle = () => {
        const amount = parseFloat(settleAmount);
        if (isNaN(amount) || amount <= 0) { // Should not be able to settle 0
            setError("Please enter a valid positive amount.");
            return;
        }
        if (amount > changeDue) {
            setError(`Cannot settle more than the change due of ${formatCurrency(changeDue)}.`);
            return;
        }
        setError(null);
        const isFullSettlement = Math.abs(amount - changeDue) < 0.01;
        onSettle(order.id, amount, isFullSettlement);
        onClose();
    };
    
    const handleFullChange = () => {
        setSettleAmount(changeDue.toFixed(2));
    };

    const title = isPopup ? `Change Due for Order ${order.simplifiedId}` : `Settle Change for ${order.tag || order.simplifiedId}`;
    const descriptionText = isPopup ? "How much change are you giving to the customer now?" : "How much of the outstanding change are you giving the customer?";

    if (showApplyCredit) {
        return (
            <ApplyCreditModal 
                sourceOrder={order}
                onClose={() => {
                    setShowApplyCredit(false);
                    onClose(); // Close the main modal as well
                }}
                onCreditApplied={() => {
                    setShowApplyCredit(false);
                    onClose();
                }}
            />
        );
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Total change owed: <span className="font-bold text-primary">{formatCurrency(changeDue)}</span>. {descriptionText}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                     <div>
                        <Label htmlFor="settle-amount">Amount Given to Customer</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="settle-amount"
                                type="number"
                                value={settleAmount}
                                onChange={(e) => setSettleAmount(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                placeholder="Enter amount..."
                                autoFocus
                            />
                            <Button onClick={handleFullChange} variant="outline">Full Change</Button>
                        </div>
                        {error && <AlertDescription className="text-red-500 text-xs mt-1">{error}</AlertDescription>}
                    </div>

                    <div className="flex items-center gap-2">
                        <Separator />
                        <span className="text-xs text-muted-foreground">OR</span>
                        <Separator />
                    </div>

                    <Button variant="secondary" className="w-full" onClick={() => setShowApplyCredit(true)}>
                        Apply Credit to Another Order
                    </Button>
                </div>
                <DialogFooter>
                    <Button onClick={onClose} variant="ghost">Cancel</Button>
                    <Button onClick={handleSettle} disabled={!settleAmount} className="bg-green-500 hover:bg-green-600">Settle Cash</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PartialSettleModal;

    