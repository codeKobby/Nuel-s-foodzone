
"use client";

import React, { useState, useEffect } from 'react';
import { collection, doc, addDoc, getDoc, setDoc, serverTimestamp, runTransaction, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency, generateSimpleOrderId } from '@/lib/utils';
import type { OrderItem, Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Wallet } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface OrderOptionsModalProps {
    total: number;
    orderItems: Record<string, OrderItem>;
    editingOrder: Order | null;
    onClose: () => void;
    onOrderPlaced: () => void;
}

const OrderOptionsModal: React.FC<OrderOptionsModalProps> = ({ total, orderItems, editingOrder, onClose, onOrderPlaced }) => {
    const [step, setStep] = useState(1);
    const [orderType, setOrderType] = useState<'Dine-In' | 'Takeout' | 'Delivery'>('Dine-In');
    const [orderTag, setOrderTag] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo'>('cash');
    const [cashPaid, setCashPaid] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (editingOrder) {
            setOrderType(editingOrder.orderType);
            setOrderTag(editingOrder.tag);
        }
    }, [editingOrder]);

    const amountPaidNum = parseFloat(cashPaid || '0');
    
    // If cashPaid is empty, assume exact payment, so finalAmountPaid will be total
    const finalAmountPaid = paymentMethod === 'cash' 
        ? (cashPaid ? amountPaidNum : total)
        : total;

    // This will be positive if change is owed, or negative if the customer underpaid
    const finalBalanceDue = finalAmountPaid - total;
        
    const processOrder = async (isPaid: boolean) => {
        setIsProcessing(true);
        setError(null);
        
        // Final validation for cash payment
        if (isPaid && paymentMethod === 'cash' && cashPaid && amountPaidNum < total) {
            setError('Cash paid cannot be less than the total amount.');
            setIsProcessing(false);
            return;
        }

        try {
            const batch = writeBatch(db);
            const now = serverTimestamp();
            
            const paymentStatus = isPaid 
                ? (finalAmountPaid < total ? 'Partially Paid' : 'Paid')
                : 'Unpaid';
            
            const orderData: any = {
                tag: orderTag,
                orderType,
                items: Object.values(orderItems).map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
                total,
                paymentMethod: isPaid ? paymentMethod : 'Unpaid',
                paymentStatus,
                amountPaid: isPaid ? finalAmountPaid : 0,
                balanceDue: isPaid ? finalBalanceDue : total, // balanceDue now tracks underpayment OR change owed
                changeGiven: 0, // This field is for manually settled change later.
            };

            if (isPaid) {
                orderData.lastPaymentTimestamp = now;
                orderData.lastPaymentAmount = finalAmountPaid;
                if (orderData.paymentStatus === 'Paid') {
                    orderData.status = 'Completed';
                }
            }


            if (editingOrder) {
                const orderRef = doc(db, "orders", editingOrder.id);
                batch.update(orderRef, orderData);
            } else {
                 const counterRef = doc(db, "counters", "orderIdCounter");
                const newOrderRef = doc(collection(db, "orders"));

                const counterSnap = await getDoc(counterRef);
                const newCount = (counterSnap.exists() ? counterSnap.data().count : 0) + 1;
                
                const newOrder = {
                    ...orderData,
                    id: newOrderRef.id,
                    simplifiedId: generateSimpleOrderId(newCount),
                    status: 'Pending',
                    timestamp: now,
                };
                
                batch.set(newOrderRef, newOrder);
                batch.set(counterRef, { count: newCount }, { merge: true });
            }

            await batch.commit();
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
                            <DialogTitle>{editingOrder ? 'Update Order Options' : 'Order Options'}</DialogTitle>
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
                        <DialogFooter className="grid grid-cols-2 gap-2">
                             <Button onClick={() => processOrder(false)} disabled={isProcessing} variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-white">{isProcessing ? 'Processing...' : 'Pay Later'}</Button>
                            <Button onClick={() => setStep(2)} className="w-full">Proceed to Payment</Button>
                        </DialogFooter>
                    </>
                )}
                {step === 2 && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{editingOrder ? 'Update Payment' : 'Complete Payment'}</DialogTitle>
                            <DialogDescription>Finalize the payment details for this order.</DialogDescription>
                            <div className="text-center text-4xl font-bold text-primary pt-4">{formatCurrency(total)}</div>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="flex justify-center space-x-4">
                                <Button onClick={() => setPaymentMethod('cash')} variant={paymentMethod === 'cash' ? 'default' : 'secondary'}>Cash</Button>
                                <Button onClick={() => setPaymentMethod('momo')} variant={paymentMethod === 'momo' ? 'default' : 'secondary'}>Momo/Card</Button>
                            </div>
                            {paymentMethod === 'cash' && (
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="cashPaid">Amount Paid by Customer (Optional)</Label>
                                        <Input id="cashPaid" type="number" value={cashPaid} onChange={(e) => setCashPaid(e.target.value)} placeholder="Leave blank for exact amount" onFocus={(e) => e.target.select()} autoFocus className="text-lg h-12" />
                                    </div>
                                    {cashPaid && finalBalanceDue > 0 && <p className="font-semibold text-red-500 text-center">Change Due: {formatCurrency(finalBalanceDue)}</p>}
                                    {cashPaid && finalBalanceDue < 0 && <p className="font-semibold text-yellow-500 text-center">Balance Remaining: {formatCurrency(Math.abs(finalBalanceDue))}</p>}
                                </div>
                            )}
                             {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                        </div>
                        <DialogFooter className="grid grid-cols-1 gap-3 pt-6">
                            <Button onClick={() => processOrder(true)} disabled={isProcessing} className="bg-green-500 hover:bg-green-600 text-white h-12 text-lg">{isProcessing ? 'Processing...' : 'Confirm'}</Button>
                        </DialogFooter>
                        <Button onClick={() => setStep(1)} variant="link" className="w-full mt-2 text-sm">Back to Options</Button>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default OrderOptionsModal;
