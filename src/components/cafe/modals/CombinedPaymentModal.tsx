

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
import { cn } from '@/lib/utils';


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
    const [exactButtonClicked, setExactButtonClicked] = useState(false);

    const totalToPay = useMemo(() => {
        return orders.reduce((acc, order) => {
            if ((order.paymentStatus === 'Unpaid' || order.paymentStatus === 'Partially Paid') && order.balanceDue > 0) {
                return acc + order.balanceDue;
            }
            return acc;
        }, 0);
    }, [orders]);
    
    const handleAmountPaidChange = (value: string) => {
        setAmountPaidInput(value);
        setExactButtonClicked(false);
    };

    const handleExactAmountClick = () => {
        setAmountPaidInput(String(totalToPay));
        setExactButtonClicked(true);
    };
    
    const amountPaidNum = parseFloat(amountPaidInput);
    const isAmountPaidEntered = amountPaidInput.trim() !== '' && !isNaN(amountPaidNum);
    const finalAmountPaid = isAmountPaidEntered ? amountPaidNum : 0;
    
    const deficit = isAmountPaidEntered && finalAmountPaid < totalToPay ? totalToPay - finalAmountPaid : 0;
    const change = isAmountPaidEntered && finalAmountPaid > totalToPay ? finalAmountPaid - totalToPay : 0;


    const processCombinedPayment = async ({ pardonDeficit = false }) => {
        if (!isAmountPaidEntered) {
             setError("Please enter an amount paid or use the 'Exact' button.");
             return;
        }

        setIsProcessing(true);
        setError(null);
        
        try {
            const batch = writeBatch(db);
            const now = serverTimestamp();

            let amountToDistribute = finalAmountPaid;
            
            const ordersToPay = orders.filter(o => (o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partially Paid') && o.balanceDue > 0).sort((a,b) => a.timestamp.toMillis() - b.timestamp.toMillis());

            for (const order of ordersToPay) {
                if (amountToDistribute <= 0 && !pardonDeficit) break;

                const orderRef = doc(db, "orders", order.id);
                const orderBalance = order.balanceDue;
                const amountToPayForOrder = Math.min(amountToDistribute, orderBalance);
                
                const newAmountPaid = order.amountPaid + amountToPayForOrder;
                let newBalanceDue = orderBalance - amountToPayForOrder;
                
                const updateData: any = {
                    paymentMethod: paymentMethod,
                    amountPaid: newAmountPaid,
                    lastPaymentTimestamp: now,
                    lastPaymentAmount: amountToPayForOrder,
                    pardonedAmount: order.pardonedAmount || 0,
                };
                
                if (newBalanceDue <= 0) {
                    updateData.paymentStatus = 'Paid';
                    updateData.status = 'Completed';
                } else {
                    updateData.paymentStatus = 'Partially Paid';
                    updateData.status = 'Pending';
                }
                
                updateData.balanceDue = newBalanceDue;

                batch.update(orderRef, updateData);
                amountToDistribute -= amountToPayForOrder;
            }
            
            const remainingDeficit = totalToPay - finalAmountPaid;

            if (ordersToPay.length > 0) {
                 const lastOrder = ordersToPay[ordersToPay.length - 1];
                 const lastOrderRef = doc(db, "orders", lastOrder.id);
                 
                 if(amountToDistribute > 0) {
                    batch.update(lastOrderRef, { balanceDue: -amountToDistribute }); // Negative balance due is change
                 } 
                 else if (pardonDeficit && remainingDeficit > 0) {
                    const lastOrderData = (await getDoc(lastOrderRef)).data() as Order;
                    batch.update(lastOrderRef, {
                        pardonedAmount: (lastOrderData.pardonedAmount || 0) + remainingDeficit,
                        notes: `Combined payment deficit of ${formatCurrency(remainingDeficit)} pardoned.`,
                        balanceDue: 0,
                        paymentStatus: 'Paid',
                        status: 'Completed',
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
                                <Label htmlFor="cashPaid">Amount Paid by Customer</Label>
                                <div className="flex gap-2">
                                <Input id="cashPaid" type="number" value={amountPaidInput} onChange={(e) => handleAmountPaidChange(e.target.value)} placeholder="0.00" onFocus={(e) => e.target.select()} autoFocus className="text-lg h-12" />
                                    <Button onClick={handleExactAmountClick} className={cn("h-12", exactButtonClicked ? "bg-green-500 hover:bg-green-600 text-white" : "")}>Exact</Button>
                                </div>
                            </div>
                            
                            {change > 0 && (
                                <p className="font-semibold text-red-500 text-center">Change Due: {formatCurrency(change)}</p>
                            )}
                            {deficit > 0 && (
                                <p className="font-semibold text-orange-500 text-center">Deficit: {formatCurrency(deficit)}</p>
                            )}
                        </div>
                    )}
                     {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                </div>

                <DialogFooter className="grid grid-cols-1 gap-3 pt-6">
                    {deficit > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                            <Button onClick={() => processCombinedPayment({ pardonDeficit: true })} disabled={isProcessing} className="bg-green-500 hover:bg-green-600 text-white h-12 text-base">
                                {isProcessing ? <LoadingSpinner /> : 'Pardon & Complete'}
                            </Button>
                            <Button onClick={() => processCombinedPayment({ pardonDeficit: false })} disabled={isProcessing} className="bg-yellow-500 hover:bg-yellow-600 text-white h-12 text-base">
                                {isProcessing ? <LoadingSpinner /> : 'Leave Unpaid'}
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={() => processCombinedPayment({})} disabled={isProcessing || !isAmountPaidEntered} className="bg-green-500 hover:bg-green-600 text-white h-12 text-lg">
                            {isProcessing ? <LoadingSpinner /> : 'Confirm Payment'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CombinedPaymentModal;
