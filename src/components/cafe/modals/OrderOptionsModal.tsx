"use client";

import React, { useState, useEffect } from 'react';
import { collection, doc, addDoc, getDoc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency, generateSimpleOrderId } from '@/lib/utils';
import type { OrderItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface OrderOptionsModalProps {
    total: number;
    orderItems: Record<string, OrderItem>;
    onClose: () => void;
    onOrderPlaced: () => void;
}

const OrderOptionsModal: React.FC<OrderOptionsModalProps> = ({ total, orderItems, onClose, onOrderPlaced }) => {
    const [step, setStep] = useState(1);
    const [orderType, setOrderType] = useState<'Dine-In' | 'Takeout' | 'Delivery'>('Dine-In');
    const [orderTag, setOrderTag] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo'>('cash');
    const [cashPaid, setCashPaid] = useState('');
    const [changeGiven, setChangeGiven] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const amountPaidNum = parseFloat(cashPaid || '0');
    const calculatedChange = paymentMethod === 'cash' && amountPaidNum > total ? amountPaidNum - total : 0;
    
    useEffect(() => {
        if (paymentMethod === 'cash' && amountPaidNum >= total) {
             setCashPaid(amountPaidNum.toString()); // Ensure cashPaid reflects a number for auto-fill
             setChangeGiven(calculatedChange.toFixed(2));
        } else {
            setChangeGiven('');
        }
    }, [cashPaid, total, paymentMethod, calculatedChange, amountPaidNum]);


    const changeGivenNum = parseFloat(changeGiven || '0');
    const finalBalanceDue = paymentMethod === 'cash' 
        ? (total > amountPaidNum ? total - amountPaidNum : calculatedChange - changeGivenNum)
        : 0;

    const processOrder = async (isPaid: boolean) => {
        setIsProcessing(true);
        setError(null);
        try {
            const counterRef = doc(db, "counters", "orderIdCounter");
            
            const newOrderRef = doc(collection(db, "orders"));

            await runTransaction(db, async (transaction) => {
                const counterSnap = await transaction.get(counterRef);
                const newCount = (counterSnap.exists() ? counterSnap.data().count : 0) + 1;

                const finalAmountPaid = isPaid ? (paymentMethod === 'cash' ? amountPaidNum : total) : 0;
                const paymentStatus = isPaid 
                    ? (finalAmountPaid < total ? 'Partially Paid' : 'Paid')
                    : 'Unpaid';
    
                const newOrder = {
                    id: newOrderRef.id,
                    simplifiedId: generateSimpleOrderId(newCount),
                    tag: orderTag,
                    orderType,
                    items: Object.values(orderItems).map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
                    total,
                    paymentMethod: isPaid ? paymentMethod : 'Unpaid',
                    paymentStatus,
                    amountPaid: finalAmountPaid,
                    changeGiven: isPaid && paymentMethod === 'cash' ? changeGivenNum : 0,
                    balanceDue: isPaid ? Math.max(0, finalBalanceDue) : total,
                    status: 'Pending',
                    timestamp: serverTimestamp(),
                };

                transaction.set(newOrderRef, newOrder);
                transaction.set(counterRef, { count: newCount });
            });

            onOrderPlaced();
        } catch (e) {
            console.error("Error processing order:", e);
            setError("Failed to place order. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md animate-fade-in-up">
                {step === 1 && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Order Options</DialogTitle>
                            <DialogDescription>Set the details for this order before payment.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label>Order Type</Label>
                                <div className="flex space-x-2 mt-2">
                                    {(['Dine-In', 'Takeout', 'Delivery'] as const).map(type => (
                                        <Button key={type} onClick={() => setOrderType(type)} variant={orderType === type ? 'default' : 'secondary'} className="flex-1">{type}</Button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="tag">Tag (Customer Name / Table No.)</Label>
                                <Input id="tag" type="text" value={orderTag} onChange={(e) => setOrderTag(e.target.value)} placeholder="e.g., 'Table 5' or 'John D.'" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={() => setStep(2)} className="w-full">Proceed to Payment</Button>
                        </DialogFooter>
                    </>
                )}
                {step === 2 && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Complete Payment</DialogTitle>
                            <div className="text-center text-4xl font-bold text-primary py-4">{formatCurrency(total)}</div>
                        </DialogHeader>
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
                                    {cashPaid && total > amountPaidNum && <p className="font-semibold text-yellow-500">Balance Owed by Customer: {formatCurrency(total - amountPaidNum)}</p>}
                                    {cashPaid && finalBalanceDue > 0 && amountPaidNum >= total && <p className="font-semibold text-red-500">Change Owed to Customer: {formatCurrency(finalBalanceDue)}</p>}
                                </div>
                            )}
                             {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                        </div>
                        <DialogFooter className="grid grid-cols-2 gap-3 pt-6">
                            <Button onClick={() => processOrder(false)} disabled={isProcessing} variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-white">{isProcessing ? 'Processing...' : 'Pay Later'}</Button>
                            <Button onClick={() => processOrder(true)} disabled={isProcessing || (paymentMethod === 'cash' && !cashPaid)} className="bg-green-500 hover:bg-green-600 text-white">{isProcessing ? 'Processing...' : 'Confirm'}</Button>
                        </DialogFooter>
                        <Button onClick={() => setStep(1)} variant="link" className="w-full mt-2 text-sm">Back to Options</Button>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default OrderOptionsModal;
