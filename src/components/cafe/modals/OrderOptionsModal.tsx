
"use client";

import React, { useState, useEffect } from 'react';
import { collection, doc, addDoc, getDoc, setDoc, serverTimestamp, runTransaction, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency, generateSimpleOrderId } from '@/lib/utils';
import type { OrderItem, Order, Customer } from '@/lib/types';
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
    const [changeGiven, setChangeGiven] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Customer Credit State
    const [customerCredit, setCustomerCredit] = useState<number>(0);
    const [isCreditLoading, setIsCreditLoading] = useState(false);
    const [creditApplied, setCreditApplied] = useState(0);

    useEffect(() => {
        if (editingOrder) {
            setOrderType(editingOrder.orderType);
            setOrderTag(editingOrder.tag);
        }
    }, [editingOrder]);

    // Fetch customer credit when tag is available
    useEffect(() => {
        const fetchCredit = async () => {
            if (orderTag) {
                setIsCreditLoading(true);
                const customerRef = doc(db, "customers", orderTag);
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
    }, [orderTag]);
    
    const totalAfterCredit = Math.max(0, total - creditApplied);
    const amountPaidNum = parseFloat(cashPaid || '0');
    const calculatedChange = paymentMethod === 'cash' && amountPaidNum > totalAfterCredit ? amountPaidNum - totalAfterCredit : 0;
    
    useEffect(() => {
        if (paymentMethod === 'cash' && amountPaidNum >= totalAfterCredit) {
             setCashPaid(amountPaidNum.toString()); 
             setChangeGiven(calculatedChange.toFixed(2));
        } else {
            setChangeGiven('');
        }
    }, [cashPaid, totalAfterCredit, paymentMethod, calculatedChange, amountPaidNum]);


    const changeGivenNum = parseFloat(changeGiven || '0');
    const finalBalanceDue = paymentMethod === 'cash' 
        ? (totalAfterCredit > amountPaidNum ? totalAfterCredit - amountPaidNum : calculatedChange - changeGivenNum)
        : 0;
        
    const handleApplyCredit = () => {
        const creditToApply = Math.min(customerCredit, total);
        setCreditApplied(creditToApply);
    }

    const processOrder = async (isPaid: boolean) => {
        setIsProcessing(true);
        setError(null);
        try {
            const batch = writeBatch(db);

            // Deduct applied credit from customer's balance
            if (creditApplied > 0 && orderTag) {
                const customerRef = doc(db, "customers", orderTag);
                const newCreditBalance = customerCredit - creditApplied;
                batch.update(customerRef, { credit: newCreditBalance });
            }

            const finalAmountPaid = isPaid ? (paymentMethod === 'cash' ? amountPaidNum : totalAfterCredit) : 0;
            const paymentStatus = isPaid 
                ? (finalAmountPaid < totalAfterCredit ? 'Partially Paid' : 'Paid')
                : 'Unpaid';
            
            const orderData = {
                tag: orderTag,
                orderType,
                items: Object.values(orderItems).map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
                total,
                paymentMethod: isPaid ? paymentMethod : 'Unpaid',
                paymentStatus,
                amountPaid: finalAmountPaid + creditApplied, // Total value settled
                changeGiven: isPaid && paymentMethod === 'cash' ? changeGivenNum : 0,
                balanceDue: isPaid ? Math.max(0, finalBalanceDue) : total,
            };

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
                    timestamp: serverTimestamp(),
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
                        <DialogFooter>
                            <Button onClick={() => setStep(2)} className="w-full">Proceed to Payment</Button>
                        </DialogFooter>
                    </>
                )}
                {step === 2 && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{editingOrder ? 'Update Payment' : 'Complete Payment'}</DialogTitle>
                            <div className="text-center text-4xl font-bold text-primary py-4">{formatCurrency(total)}</div>
                        </DialogHeader>
                        <div className="space-y-4">
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
                                    <p className="font-bold text-2xl">New Total: {formatCurrency(totalAfterCredit)}</p>
                                </Alert>
                            )}
                            
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
                                    {cashPaid && totalAfterCredit > amountPaidNum && <p className="font-semibold text-yellow-500">Balance Owed by Customer: {formatCurrency(totalAfterCredit - amountPaidNum)}</p>}
                                    {cashPaid && finalBalanceDue > 0 && amountPaidNum >= totalAfterCredit && <p className="font-semibold text-red-500">Change Owed to Customer: {formatCurrency(finalBalanceDue)}</p>}
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
