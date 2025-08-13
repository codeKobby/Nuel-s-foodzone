
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
    const [amountPaidInput, setAmountPaidInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (editingOrder) {
            setOrderType(editingOrder.orderType);
            setOrderTag(editingOrder.tag || '');
        }
    }, [editingOrder]);

    const amountPaidNum = parseFloat(amountPaidInput);
    const isAmountPaidEntered = amountPaidInput.trim() !== '' && !isNaN(amountPaidNum);
    const finalAmountPaid = isAmountPaidEntered ? amountPaidNum : total;

    const processOrder = async (isPaid: boolean) => {
        setIsProcessing(true);
        setError(null);
        
        const pardonedAmount = isPaid && finalAmountPaid < total ? total - finalAmountPaid : 0;

        try {
            const batch = writeBatch(db);
            const now = serverTimestamp();
            
            const paymentStatus = isPaid 
                ? (finalAmountPaid < total && pardonedAmount === 0 ? 'Partially Paid' : 'Paid')
                : 'Unpaid';
            
            const orderData: any = {
                tag: orderTag,
                orderType,
                items: Object.values(orderItems).map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
                total,
                paymentMethod: isPaid ? paymentMethod : 'Unpaid',
                paymentStatus,
                amountPaid: isPaid ? finalAmountPaid : 0,
                balanceDue: isPaid ? finalAmountPaid - total : total,
                pardonedAmount: pardonedAmount,
                changeGiven: 0, 
            };
            
            if (pardonedAmount > 0) {
                 orderData.notes = `Deficit of ${formatCurrency(pardonedAmount)} pardoned.`;
            }

            if (isPaid) {
                orderData.lastPaymentTimestamp = now;
                orderData.lastPaymentAmount = finalAmountPaid;
                if (paymentStatus === 'Paid') {
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
    
    const balance = isAmountPaidEntered ? finalAmountPaid - total : 0;


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
                                <div className="space-y-2">
                                     <div>
                                        <Label htmlFor="cashPaid">Amount Paid by Customer (Optional)</Label>
                                        <div className="flex gap-2">
                                        <Input id="cashPaid" type="number" value={amountPaidInput} onChange={(e) => setAmountPaidInput(e.target.value)} placeholder="Leave blank for exact amount" onFocus={(e) => e.target.select()} autoFocus className="text-lg h-12" />
                                         <Button variant="outline" onClick={() => setAmountPaidInput(String(total))} className="h-12">Exact</Button>
                                        </div>
                                    </div>
                                    
                                    {isAmountPaidEntered && balance > 0 && (
                                        <p className="font-semibold text-red-500 text-center">Change Due: {formatCurrency(balance)}</p>
                                    )}
                                    {isAmountPaidEntered && balance < 0 && (
                                        <p className="font-semibold text-orange-500 text-center">Deficit (Pardoned): {formatCurrency(Math.abs(balance))}</p>
                                    )}
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
