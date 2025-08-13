
"use client";

import React, { useState, useMemo } from 'react';
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
    const [amountPaidInput, setAmountPaidInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const totalToPay = useMemo(() => {
        return orders.reduce((acc, order) => {
            if ((order.paymentStatus === 'Unpaid' || order.paymentStatus === 'Partially Paid') && order.balanceDue > 0) {
                return acc + order.balanceDue;
            }
            return acc;
        }, 0);
    }, [orders]);
    
    const amountPaidNum = parseFloat(amountPaidInput);
    const isAmountPaidEntered = amountPaidInput.trim() !== '' && !isNaN(amountPaidNum);
    const finalAmountPaid = isAmountPaidEntered ? amountPaidNum : totalToPay;


    const processCombinedPayment = async () => {
        setIsProcessing(true);
        setError(null);

        const pardonedAmount = finalAmountPaid < totalToPay ? totalToPay - finalAmountPaid : 0;

        try {
            const batch = writeBatch(db);
            const now = serverTimestamp();

            let amountToDistribute = finalAmountPaid;
            
            const ordersToPay = orders.filter(o => (o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partially Paid') && o.balanceDue > 0).sort((a,b) => a.timestamp.toMillis() - b.timestamp.toMillis());

            for (const order of ordersToPay) {
                if (amountToDistribute <= 0 && pardonedAmount === 0) break;

                const orderRef = doc(db, "orders", order.id);
                const orderBalance = order.balanceDue;
                const amountToPayForOrder = Math.min(amountToDistribute, orderBalance);
                
                const newAmountPaid = order.amountPaid + amountToPayForOrder;
                const newBalanceDue = orderBalance - amountToPayForOrder;
                
                const updateData: any = {
                    paymentMethod: paymentMethod,
                    paymentStatus: newBalanceDue <= 0 ? 'Paid' : 'Partially Paid',
                    amountPaid: newAmountPaid,
                    balanceDue: newBalanceDue,
                    lastPaymentTimestamp: now,
                    lastPaymentAmount: amountToPayForOrder,
                    pardonedAmount: 0 // Reset pardoned amount for this order initially
                };

                if (newBalanceDue <= 0) {
                    updateData.status = 'Completed';
                }

                batch.update(orderRef, updateData);
                amountToDistribute -= amountToPayForOrder;
            }
            
            // Distribute change or pardoned amounts
            if (ordersToPay.length > 0) {
                 const lastOrder = ordersToPay[ordersToPay.length - 1];
                 const lastOrderRef = doc(db, "orders", lastOrder.id);
                 
                 // If there's change left over
                 if(amountToDistribute > 0) {
                    batch.update(lastOrderRef, { balanceDue: -amountToDistribute }); // Negative balance due is change
                 } 
                 // If there was a deficit
                 else if (pardonedAmount > 0) {
                    const lastOrderData = (await getDoc(lastOrderRef)).data() as Order;
                    batch.update(lastOrderRef, {
                        pardonedAmount: (lastOrderData.pardonedAmount || 0) + pardonedAmount,
                        notes: `Combined payment deficit of ${formatCurrency(pardonedAmount)} pardoned.`
                    });
                 }
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
    
    const balance = isAmountPaidEntered ? finalAmountPaid - totalToPay : 0;


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
                
                 <div className="text-center text-4xl font-bold text-primary py-2">{formatCurrency(totalToPay)}</div>
                
                <div className="space-y-4 pt-2">
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
                                    <Button variant="outline" onClick={() => setAmountPaidInput(String(totalToPay))} className="h-12">Exact</Button>
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
                    <Button onClick={processCombinedPayment} disabled={isProcessing} className="bg-green-500 hover:bg-green-600 text-white h-12 text-lg">
                        {isProcessing ? <LoadingSpinner /> : 'Confirm Payment'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CombinedPaymentModal;
