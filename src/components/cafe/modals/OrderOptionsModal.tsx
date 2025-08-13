

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
import { cn } from '@/lib/utils';

interface OrderOptionsModalProps {
    total: number;
    orderItems: Record<string, OrderItem>;
    editingOrder: Order | null;
    onClose: () => void;
    onOrderPlaced: (order: Order) => void;
}

const OrderOptionsModal: React.FC<OrderOptionsModalProps> = ({ total, orderItems, editingOrder, onClose, onOrderPlaced }) => {
    const [step, setStep] = useState(1);
    const [orderType, setOrderType] = useState<'Dine-In' | 'Takeout' | 'Delivery'>('Dine-In');
    const [orderTag, setOrderTag] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo'>('cash');
    const [amountPaidInput, setAmountPaidInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exactButtonClicked, setExactButtonClicked] = useState(false);

    useEffect(() => {
        if (editingOrder) {
            setOrderType(editingOrder.orderType);
            setOrderTag(editingOrder.tag || '');
        }
    }, [editingOrder]);
    
    const handleAmountPaidChange = (value: string) => {
        setAmountPaidInput(value);
        setExactButtonClicked(false);
    };

    const handleExactAmountClick = () => {
        setAmountPaidInput(String(total));
        setExactButtonClicked(true);
    };

    const amountPaidNum = parseFloat(amountPaidInput);
    const isAmountPaidEntered = amountPaidInput.trim() !== '' && !isNaN(amountPaidNum);
    
    const finalAmountPaid = isAmountPaidEntered ? amountPaidNum : (paymentMethod === 'momo' ? total : 0);
    
    const deficit = isAmountPaidEntered && finalAmountPaid < total ? total - finalAmountPaid : 0;
    const change = isAmountPaidEntered && finalAmountPaid > total ? finalAmountPaid - total : 0;

    const handleProceedToPayment = () => {
        if (!orderTag) {
            setError("Please add a tag (e.g., customer name or table number) to the order.");
            return;
        }
        setError(null);
        setStep(2);
    }
    
    const handlePayLater = () => {
        if (!orderTag) {
            setError("Please add a tag before creating a 'Pay Later' order.");
            return;
        }
        setError(null);
        processOrder({ isPaid: false });
    }

    const processOrder = async (options: { isPaid: boolean, pardonDeficit?: boolean }) => {
        setIsProcessing(true);
        setError(null);

        const { isPaid, pardonDeficit = false } = options;
        const finalAmountToPay = isAmountPaidEntered ? finalAmountPaid : (isPaid ? total : 0);

        if (isPaid && !isAmountPaidEntered && paymentMethod === 'cash') {
             setError("Please enter an amount paid or use the 'Exact Amount' button for cash payments.");
             setIsProcessing(false);
             return;
        }

        try {
            const batch = writeBatch(db);
            const now = serverTimestamp();
            
            let paymentStatus: Order['paymentStatus'] = 'Unpaid';
            if (isPaid) {
                if (finalAmountToPay < total && !pardonDeficit) {
                    paymentStatus = 'Partially Paid';
                } else {
                    paymentStatus = 'Paid';
                }
            }

            const pardonedAmount = isPaid && pardonDeficit ? total - finalAmountToPay : 0;
            const finalBalanceDue = finalAmountToPay - total - pardonedAmount;

            const orderData: any = {
                tag: orderTag,
                orderType,
                items: Object.values(orderItems).map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
                total,
                paymentMethod: isPaid ? paymentMethod : 'Unpaid',
                paymentStatus,
                amountPaid: finalAmountToPay,
                balanceDue: finalBalanceDue,
                pardonedAmount: pardonedAmount,
                changeGiven: 0, 
                fulfilledItems: editingOrder?.fulfilledItems || [],
            };
            
            if (pardonedAmount > 0) {
                 orderData.notes = `Deficit of ${formatCurrency(pardonedAmount)} pardoned.`;
            }

            if (isPaid) {
                orderData.lastPaymentTimestamp = now;
                orderData.lastPaymentAmount = finalAmountToPay;
            }
            
            if (paymentStatus === 'Paid') {
                orderData.status = 'Completed';
            } else {
                orderData.status = 'Pending';
            }

            let finalOrder: Order;

            if (editingOrder) {
                const orderRef = doc(db, "orders", editingOrder.id);
                batch.update(orderRef, orderData);
                finalOrder = { ...editingOrder, ...orderData, timestamp: editingOrder.timestamp };
            } else {
                const counterRef = doc(db, "counters", "orderIdCounter");
                const newOrderRef = doc(collection(db, "orders"));

                const counterSnap = await getDoc(counterRef);
                const newCount = (counterSnap.exists() ? counterSnap.data().count : 0) + 1;
                
                const newOrder: Omit<Order, 'timestamp'> = {
                    ...orderData,
                    id: newOrderRef.id,
                    simplifiedId: generateSimpleOrderId(newCount),
                };
                
                batch.set(newOrderRef, {...newOrder, timestamp: now});
                batch.set(counterRef, { count: newCount }, { merge: true });
                finalOrder = { ...newOrder, timestamp: Timestamp.now() }; // approximate timestamp for return
            }

            await batch.commit();
            onOrderPlaced(finalOrder);

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
                             {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                        </div>
                        <DialogFooter className="grid grid-cols-2 gap-2">
                             <Button onClick={handlePayLater} disabled={isProcessing} variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-white">{isProcessing ? 'Processing...' : 'Pay Later'}</Button>
                            <Button onClick={handleProceedToPayment} className="w-full">Proceed to Payment</Button>
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
                           
                            <div className="space-y-2">
                                <Label htmlFor="cashPaid">Amount Paid by Customer</Label>
                                <div className="flex gap-2">
                                    <Input id="cashPaid" type="number" value={amountPaidInput} onChange={(e) => handleAmountPaidChange(e.target.value)} placeholder="0.00" onFocus={(e) => e.target.select()} autoFocus={paymentMethod === 'cash'} className="text-lg h-12" />
                                    <Button onClick={handleExactAmountClick} className={cn("h-12", exactButtonClicked ? "bg-green-500 hover:bg-green-600 text-white" : "")}>Exact</Button>
                                </div>
                            </div>
                            
                            {change > 0 && (
                                <p className="font-semibold text-red-500 text-center">Change Due: {formatCurrency(change)}</p>
                            )}
                            {deficit > 0 && (
                                <p className="font-semibold text-orange-500 text-center">Deficit: {formatCurrency(deficit)}</p>
                            )}
                         
                            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                        </div>
                        
                        <DialogFooter className="grid grid-cols-1 gap-3 pt-6">
                           {deficit > 0 ? (
                                <div className="grid grid-cols-2 gap-2">
                                     <Button onClick={() => processOrder({ isPaid: true, pardonDeficit: true })} disabled={isProcessing} className="bg-green-500 hover:bg-green-600 text-white h-12 text-base">
                                        {isProcessing ? <LoadingSpinner /> : 'Pardon Deficit'}
                                    </Button>
                                     <Button onClick={() => processOrder({ isPaid: true, pardonDeficit: false })} disabled={isProcessing} className="bg-yellow-500 hover:bg-yellow-600 text-white h-12 text-base">
                                        {isProcessing ? <LoadingSpinner /> : 'Leave as Unpaid'}
                                    </Button>
                                </div>
                           ) : (
                             <Button onClick={() => processOrder({ isPaid: true })} disabled={isProcessing || (!isAmountPaidEntered && paymentMethod === 'cash')} className="bg-green-500 hover:bg-green-600 text-white h-12 text-lg">
                                {isProcessing ? <LoadingSpinner /> : 'Confirm Payment'}
                            </Button>
                           )}
                        </DialogFooter>
                        <Button onClick={() => setStep(1)} variant="link" className="w-full mt-2 text-sm">Back to Options</Button>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default OrderOptionsModal;
