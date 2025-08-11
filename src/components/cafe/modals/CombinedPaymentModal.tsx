
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
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
import LoadingSpinner from '@/components/shared/LoadingSpinner';

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
    
    // Customer Credit State
    const [customerCredit, setCustomerCredit] = useState<number>(0);
    const [isCreditLoading, setIsCreditLoading] = useState(false);
    const [creditApplied, setCreditApplied] = useState(0);

    const totalToPayBeforeCredit = useMemo(() => {
        return orders.reduce((acc, order) => {
            if ((order.paymentStatus === 'Unpaid' || order.paymentStatus === 'Partially Paid') && order.balanceDue > 0) {
                return acc + order.balanceDue;
            }
            return acc;
        }, 0);
    }, [orders]);
    
    // Use the first tag as the customer identifier for credit purposes
    const customerTag = useMemo(() => {
        const tags = [...new Set(orders.map(o => o.tag).filter(Boolean))];
        return tags.length > 0 ? tags[0] : null;
    }, [orders]);

    useEffect(() => {
        const fetchCredit = async () => {
            if (customerTag) {
                setIsCreditLoading(true);
                const customerRef = doc(db, "customers", customerTag);
                const customerSnap = await getDoc(customerRef);
                if (customerSnap.exists()) {
                    setCustomerCredit(customerSnap.data().credit || 0);
                } else {
                    setCustomerCredit(0);
                }
                setIsCreditLoading(false);
            } else {
                setCustomerCredit(0);
            }
        };
        fetchCredit();
    }, [customerTag]);

    const handleApplyCredit = () => {
        const creditToApply = Math.min(customerCredit, totalToPayBeforeCredit);
        setCreditApplied(creditToApply);
    };

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

            if (creditApplied > 0 && customerTag) {
                const customerRef = doc(db, "customers", customerTag);
                const newCreditBalance = customerCredit - creditApplied;
                batch.update(customerRef, { credit: newCreditBalance });
            }

            let remainingPaid = paymentMethod === 'cash' ? amountPaidNum : totalToPay;
            const ordersToPay = orders.filter(o => (o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partially Paid') && o.balanceDue > 0);

            for (const order of ordersToPay) {
                const orderRef = doc(db, "orders", order.id);
                const orderBalance = order.balanceDue;
                const amountToPayForOrder = Math.min(remainingPaid, orderBalance);
                
                const newAmountPaid = order.amountPaid + amountToPayForOrder;
                const newPaymentStatus = newAmountPaid >= order.total ? 'Paid' : 'Partially Paid';
                const newBalanceDue = Math.max(0, order.total - newAmountPaid);
                
                const updateData: any = {
                    paymentMethod: order.paymentMethod === 'Unpaid' ? paymentMethod : order.paymentMethod,
                    paymentStatus: newPaymentStatus,
                    amountPaid: newAmountPaid,
                    balanceDue: newBalanceDue,
                };

                batch.update(orderRef, updateData);
                remainingPaid -= amountToPayForOrder;
            }
            
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
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Combined Payment</DialogTitle>
                    <DialogDescription>Settle payment for {orders.length} selected orders.</DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-40 my-2 border rounded-md p-3 pr-4">
                    <div className="space-y-2">
                    {orders.map(order => (
                        <div key={order.id} className="flex justify-between items-center text-sm p-2 bg-secondary rounded-md">
                           <div>
                                <p className="font-semibold">{order.simplifiedId}</p>
                                <p className="text-xs text-muted-foreground">{order.tag || 'No Tag'}</p>
                           </div>
                           <Badge variant={order.balanceDue > 0 ? "secondary" : "default"}>
                                {formatCurrency(order.balanceDue > 0 ? order.balanceDue : order.total)}
                           </Badge>
                        </div>
                    ))}
                    </div>
                </ScrollArea>
                
                 <div className="text-center text-4xl font-bold text-primary py-2">{formatCurrency(totalToPayBeforeCredit)}</div>
                
                 {isCreditLoading ? <LoadingSpinner/> : customerCredit > 0 && creditApplied === 0 && (
                    <Alert variant="default" className="bg-green-50 dark:bg-green-900/20">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold">Available Credit: {formatCurrency(customerCredit)}</p>
                            </div>
                            <Button size="sm" onClick={handleApplyCredit}>Apply Credit</Button>
                        </div>
                    </Alert>
                )}

                 {creditApplied > 0 && (
                    <Alert variant="default" className="bg-green-100 dark:bg-green-900/20 border-green-500 text-center">
                        <p className="font-bold">{formatCurrency(creditApplied)} credit applied</p>
                        <p className="font-bold text-2xl">New Total: {formatCurrency(totalToPay)}</p>
                    </Alert>
                )}
                
                <div className="space-y-4 pt-2">
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
