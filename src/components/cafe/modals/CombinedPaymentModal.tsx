
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency } from '@/lib/utils';
import type { Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { findAndApplyCustomerCredit } from '@/lib/customer-credit';

interface CombinedPaymentModalProps {
    orders: Order[];
    onClose: () => void;
    onOrderPlaced: () => void;
}

const CombinedPaymentModal: React.FC<CombinedPaymentModalProps> = ({ orders, onClose, onOrderPlaced }) => {
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo'>('cash');
    const [cashPaid, setCashPaid] = useState('');
    const [changeGiven, setChangeGiven] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [creditApplied, setCreditApplied] = useState(0);

    const totalToPayBeforeCredit = useMemo(() => {
        // Only sum up balances owed by the customer, not change owed to them.
        return orders.reduce((acc, order) => {
            if ((order.paymentStatus === 'Unpaid' || order.paymentStatus === 'Partially Paid') && order.balanceDue > 0) {
                return acc + order.balanceDue;
            }
            return acc;
        }, 0);
    }, [orders]);
    
    useEffect(() => {
        const applyCredit = async () => {
            // Find unique customer tags from the selected orders
            const customerTags = [...new Set(orders.map(o => o.tag).filter(Boolean))];
            if (customerTags.length > 0) {
                // For simplicity, we use the first tag to find credit. 
                // A more complex system could handle multiple customers, but this handles the common case.
                const { creditFound } = await findAndApplyCustomerCredit(customerTags[0]);
                // Only apply credit up to the amount needed to pay.
                const creditToUse = Math.min(creditFound, totalToPayBeforeCredit);
                if (creditToUse > 0) {
                    setCreditApplied(creditToUse);
                }
            }
        };
        applyCredit();
    }, [orders, totalToPayBeforeCredit]);


    const totalToPay = Math.max(0, totalToPayBeforeCredit - creditApplied);
    const amountPaidNum = parseFloat(cashPaid || '0');
    const calculatedChange = paymentMethod === 'cash' && amountPaidNum > totalToPay ? amountPaidNum - totalToPay : 0;
    
    useEffect(() => {
        if (paymentMethod === 'cash' && amountPaidNum >= totalToPay) {
             setCashPaid(amountPaidNum.toString());
             setChangeGiven(calculatedChange.toFixed(2));
        } else {
            setChangeGiven('');
        }
    }, [cashPaid, totalToPay, paymentMethod, calculatedChange, amountPaidNum]);


    const changeGivenNum = parseFloat(changeGiven || '0');
    const finalBalanceDue = paymentMethod === 'cash' 
        ? (totalToPay > amountPaidNum ? totalToPay - amountPaidNum : calculatedChange - changeGivenNum)
        : 0;

    const processCombinedPayment = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const batch = writeBatch(db);

            // Apply credit if any was found and used
            if (creditApplied > 0) {
                 const customerTags = [...new Set(orders.map(o => o.tag).filter(Boolean))];
                 await findAndApplyCustomerCredit(customerTags[0], batch, creditApplied);
            }

            // Update the orders being paid for
            let remainingPaid = paymentMethod === 'cash' ? amountPaidNum : totalToPay;
            
            // Filter for only orders that actually need payment
            const ordersToPay = orders.filter(o => (o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partially Paid') && o.balanceDue > 0);

            for (const order of ordersToPay) {
                const orderRef = doc(db, "orders", order.id);
                const orderBalance = order.balanceDue; // We already know this is > 0
                const amountToPayForOrder = Math.min(remainingPaid, orderBalance);
                
                const newAmountPaid = order.amountPaid + amountToPayForOrder;
                const newPaymentStatus = newAmountPaid >= order.total ? 'Paid' : 'Partially Paid';
                const newBalanceDue = Math.max(0, order.total - newAmountPaid);

                batch.update(orderRef, {
                    // Don't override the original payment method unless it was unpaid
                    paymentMethod: order.paymentMethod === 'Unpaid' ? paymentMethod : order.paymentMethod,
                    paymentStatus: newPaymentStatus,
                    amountPaid: newAmountPaid,
                    balanceDue: newBalanceDue,
                });

                remainingPaid -= amountToPayForOrder;
            }
            
            // Distribute change given if any, to the last order that was paid
             if (paymentMethod === 'cash' && changeGivenNum > 0 && ordersToPay.length > 0) {
                const lastOrder = ordersToPay[ordersToPay.length - 1];
                const lastOrderRef = doc(db, "orders", lastOrder.id);
                batch.update(lastOrderRef, { balanceDue: changeGivenNum, changeGiven: changeGivenNum });
            }

            await batch.commit();
            onOrderPlaced();
        } catch (e) {
            console.error("Error processing combined payment:", e);
            setError("Failed to process payment. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg animate-fade-in-up">
                <DialogHeader>
                    <DialogTitle>Combined Payment</DialogTitle>
                    <DialogDescription>Settle payment for {orders.length} selected orders.</DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-40 my-2 border rounded-md p-3">
                    <div className="space-y-2">
                    {orders.map(order => (
                        <div key={order.id} className="flex justify-between items-center text-sm p-2 bg-secondary rounded-md">
                           <div>
                                <p className="font-semibold">{order.simplifiedId}</p>
                                <p className="text-xs text-muted-foreground">{order.tag || 'No Tag'}</p>
                           </div>
                           <Badge variant={order.balanceDue > 0 ? "secondary" : "default"}>
                                {formatCurrency(order.balanceDue || order.total)}
                           </Badge>
                        </div>
                    ))}
                    </div>
                </ScrollArea>
                
                 {creditApplied > 0 && (
                    <Alert variant="default" className="bg-green-100 dark:bg-green-900/20 border-green-500">
                        <AlertDescription>
                            Applied <span className="font-bold">{formatCurrency(creditApplied)}</span> from customer's previous change.
                        </AlertDescription>
                    </Alert>
                )}
                
                <div className="text-center text-4xl font-bold text-primary py-4">{formatCurrency(totalToPay)}</div>
                
                <div className="space-y-4">
                    <div className="flex justify-center space-x-4">
                        <Button onClick={() => setPaymentMethod('cash')} variant={paymentMethod === 'cash' ? 'default' : 'secondary'}>Cash</Button>
                        <Button onClick={() => setPaymentMethod('momo')} variant={paymentMethod === 'momo' ? 'default' : 'secondary'}>Momo/Card</Button>
                    </div>
                    {paymentMethod === 'cash' && (
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="cashPaid">Amount Paid by Customer</Label>
                                <Input id="cashPaid" type="number" value={cashPaid} onChange={(e) => setCashPaid(e.target.value)} placeholder="0.00" onFocus={(e) => e.target.select()} autoFocus className="text-lg h-12" />
                            </div>
                            {cashPaid && calculatedChange > 0 && (
                                <div>
                                    <Label htmlFor="changeGiven">Change Given to Customer</Label>
                                    <Input id="changeGiven" type="number" value={changeGiven} onChange={(e) => setChangeGiven(e.target.value)} placeholder="0.00" onFocus={(e) => e.target.select()} className="text-lg h-12" />
                                    <p className="text-sm text-muted-foreground mt-1">Calculated change: {formatCurrency(calculatedChange)}</p>
                                </div>
                            )}
                            {cashPaid && totalToPay > amountPaidNum && <p className="font-semibold text-yellow-500">Balance Owed by Customer: {formatCurrency(totalToPay - amountPaidNum)}</p>}
                            {cashPaid && finalBalanceDue > 0 && amountPaidNum >= totalToPay && <p className="font-semibold text-red-500">Change Owed to Customer: {formatCurrency(finalBalanceDue)}</p>}
                        </div>
                    )}
                     {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                </div>

                <DialogFooter className="grid grid-cols-1 gap-3 pt-6">
                    <Button onClick={processCombinedPayment} disabled={isProcessing || (paymentMethod === 'cash' && !cashPaid)} className="bg-green-500 hover:bg-green-600 text-white h-12 text-lg">
                        {isProcessing ? 'Processing...' : 'Confirm Payment'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CombinedPaymentModal;
