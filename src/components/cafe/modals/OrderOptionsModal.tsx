
"use client";

import React, { useState } from 'react';
import { collection, doc, addDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
    appId: string;
    total: number;
    orderItems: Record<string, OrderItem>;
    onClose: () => void;
    onOrderPlaced: () => void;
}

const OrderOptionsModal: React.FC<OrderOptionsModalProps> = ({ appId, total, orderItems, onClose, onOrderPlaced }) => {
    const [step, setStep] = useState(1);
    const [orderType, setOrderType] = useState<'Dine-In' | 'Takeout' | 'Delivery'>('Dine-In');
    const [orderTag, setOrderTag] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo'>('cash');
    const [cashPaid, setCashPaid] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const amountPaidNum = parseFloat(cashPaid || '0');
    const change = amountPaidNum > total ? amountPaidNum - total : 0;
    const balanceDue = total > amountPaidNum ? total - amountPaidNum : 0;

    const processOrder = async (isPaid: boolean) => {
        setIsProcessing(true);
        setError(null);
        try {
            const ordersRef = collection(db, `/artifacts/${appId}/public/data/orders`);
            const counterRef = doc(db, `artifacts/${appId}/public/data/counters/orderIdCounter`);
            
            let newCount;
            const counterSnap = await getDoc(counterRef);
            newCount = (counterSnap.exists() ? counterSnap.data().count : 0) + 1;
            await setDoc(counterRef, { count: newCount });
            
            const newOrder = {
                simplifiedId: generateSimpleOrderId(newCount),
                tag: orderTag,
                orderType,
                items: Object.values(orderItems).map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
                total,
                paymentMethod: isPaid ? paymentMethod : 'Unpaid',
                paymentStatus: isPaid ? (balanceDue > 0 ? 'Partially Paid' : 'Paid') : 'Unpaid',
                amountPaid: isPaid ? amountPaidNum : 0,
                changeGiven: isPaid ? change : 0,
                balanceDue: isPaid ? balanceDue : total,
                status: 'Pending',
                timestamp: serverTimestamp(),
            };
            await addDoc(ordersRef, newOrder);
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
                                <div className="space-y-2">
                                    <Label htmlFor="cashPaid">Amount Paid</Label>
                                    <Input id="cashPaid" type="number" value={cashPaid} onChange={(e) => setCashPaid(e.target.value)} placeholder="0.00" autoFocus className="text-lg h-12" />
                                    {balanceDue > 0 && <p className="font-semibold text-yellow-500">Balance Due: {formatCurrency(balanceDue)}</p>}
                                    {change > 0 && <p className="font-semibold text-green-500">Change: {formatCurrency(change)}</p>}
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

    