

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { collection, doc, writeBatch, serverTimestamp, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency } from '@/lib/utils';
import type { Order, CustomerReward } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Gift, Search as SearchIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface RewardApplication {
    customer: CustomerReward;
    discount: number;
    bagsUsed: number;
}

const RewardContent = ({ totalToPay, onApplyReward, onBack }: { totalToPay: number; onApplyReward: (reward: RewardApplication) => void; onBack: () => void; }) => {
    const [rewardSearch, setRewardSearch] = useState('');
    const [allEligibleCustomers, setAllEligibleCustomers] = useState<CustomerReward[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchEligibleCustomers = async () => {
            setIsLoading(true);
            const q = query(
                collection(db, 'rewards'),
                where('bagCount', '>=', 5)
            );
            const snapshot = await getDocs(q);
            const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerReward));
            setAllEligibleCustomers(customers);
            setIsLoading(false);
        };
        fetchEligibleCustomers();
    }, []);

    const filteredCustomers = useMemo(() => {
        if (!rewardSearch.trim()) {
            return allEligibleCustomers;
        }
        return allEligibleCustomers.filter(customer =>
            customer.customerTag.toLowerCase().includes(rewardSearch.trim().toLowerCase())
        );
    }, [rewardSearch, allEligibleCustomers]);

    const handleSelectRewardCustomer = (customer: CustomerReward) => {
        const availableDiscount = Math.floor(customer.bagCount / 5) * 10;
        if (availableDiscount > 0) {
            const discountToApply = Math.min(availableDiscount, totalToPay);
            const bagsUsed = Math.ceil((discountToApply / 10)) * 5;
            onApplyReward({
                customer,
                discount: discountToApply,
                bagsUsed,
            });
        }
    };

    return (
     <>
        <DialogHeader>
          <DialogTitle>Apply Customer Reward</DialogTitle>
          <DialogDescription>Search for a customer or select from the eligible list.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="relative">
                 <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search eligible customer..." 
                    value={rewardSearch} 
                    onChange={(e) => setRewardSearch(e.target.value)} 
                    autoFocus
                    className="pl-10"
                />
            </div>
            <ScrollArea className="h-60 border rounded-md">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full"><LoadingSpinner/></div>
                ) : filteredCustomers.length > 0 ? (
                    filteredCustomers.map(customer => {
                        const discount = Math.floor(customer.bagCount / 5) * 10;
                        return (
                            <div key={customer.id} className="p-3 border-b flex justify-between items-center hover:bg-secondary">
                                <div>
                                    <p className="font-semibold">{customer.customerTag}</p>
                                    <p className="text-sm text-muted-foreground">Bags: {customer.bagCount} | Discount: {formatCurrency(discount)}</p>
                                </div>
                                <Button size="sm" onClick={() => handleSelectRewardCustomer(customer)} disabled={discount <= 0}>
                                    Apply
                                </Button>
                            </div>
                        )
                    })
                ) : (
                    <p className="p-4 text-center text-muted-foreground">
                        {rewardSearch.trim() ? 'No customers match your search.' : 'No customers are currently eligible for a reward.'}
                    </p>
                )}
            </ScrollArea>
        </div>
        <DialogFooter>
            <Button variant="secondary" onClick={onBack}>Back to Payment</Button>
        </DialogFooter>
     </>
    );
};

interface CombinedPaymentModalProps {
    orders: Order[];
    onClose: () => void;
    onOrderPlaced: () => void;
}

const CombinedPaymentModal: React.FC<CombinedPaymentModalProps> = ({ orders, onClose, onOrderPlaced }) => {
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo'>('cash');
    const [amountPaidInput, setAmountPaidInput] = useState('');
    const [changeGivenInput, setChangeGivenInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isApplyingReward, setIsApplyingReward] = useState(false);
    const [reward, setReward] = useState<RewardApplication | null>(null);

    const totalToPay = useMemo(() => {
        return orders.reduce((acc, order) => {
            if ((order.paymentStatus === 'Unpaid' || order.paymentStatus === 'Partially Paid') && order.balanceDue > 0) {
                return acc + order.balanceDue;
            }
            return acc;
        }, 0);
    }, [orders]);
    
    const finalTotal = Math.max(0, totalToPay - (reward?.discount ?? 0));

    const amountPaidNum = parseFloat(amountPaidInput);
    const isAmountPaidEntered = amountPaidInput.trim() !== '' && !isNaN(amountPaidNum);
    const finalAmountPaid = paymentMethod === 'momo' ? finalTotal : (isAmountPaidEntered ? amountPaidNum : 0);
    
    const deficit = finalAmountPaid < finalTotal ? finalTotal - finalAmountPaid : 0;
    const change = finalAmountPaid > finalTotal ? finalAmountPaid - finalTotal : 0;
    
    const showDeficitOptions = paymentMethod === 'cash' && isAmountPaidEntered && deficit > 0;
    
    const handleApplyReward = (appliedReward: RewardApplication) => {
        setReward(appliedReward);
        setIsApplyingReward(false);
    };

    const processCombinedPayment = async ({ pardonDeficit = false }) => {
        if (paymentMethod === 'cash' && !isAmountPaidEntered) {
             setError("Please enter an amount paid.");
             return;
        }

        setIsProcessing(true);
        setError(null);
        
        try {
            const batch = writeBatch(db);
            const now = serverTimestamp();
            const changeGiven = parseFloat(changeGivenInput) || 0;

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
                    amountPaid: newAmountPaid,
                    lastPaymentTimestamp: now,
                    lastPaymentAmount: amountToPayForOrder,
                    paymentMethod: paymentMethod, // Set the method for THIS payment
                    pardonedAmount: order.pardonedAmount || 0,
                };
                
                if (newBalanceDue <= 0) {
                    updateData.paymentStatus = 'Paid';
                } else {
                    updateData.paymentStatus = 'Partially Paid';
                }
                
                updateData.balanceDue = newBalanceDue;

                batch.update(orderRef, updateData);
                amountToDistribute -= amountToPayForOrder;
            }
            
            const remainingDeficit = finalTotal - finalAmountPaid;

            if (ordersToPay.length > 0) {
                 const lastOrder = ordersToPay[ordersToPay.length - 1];
                 const lastOrderRef = doc(db, "orders", lastOrder.id);
                 
                 // Handle change
                 const finalBalance = (finalTotal - finalAmountPaid + changeGiven) * -1;
                 
                 if (finalAmountPaid > finalTotal) {
                    batch.update(lastOrderRef, { 
                        balanceDue: finalBalance, 
                        changeGiven: (lastOrder.changeGiven || 0) + changeGiven 
                    });
                 }
                 else if (pardonDeficit && remainingDeficit > 0) {
                    const lastOrderData = (await getDoc(lastOrderRef)).data() as Order;
                    batch.update(lastOrderRef, {
                        pardonedAmount: (lastOrderData.pardonedAmount || 0) + remainingDeficit,
                        notes: `Combined payment deficit of ${formatCurrency(remainingDeficit)} pardoned.`,
                        balanceDue: 0,
                        paymentStatus: 'Paid',
                    });
                 }

                 if(reward) {
                    const rewardRef = doc(db, 'rewards', reward.customer.id);
                    const newBagCount = reward.customer.bagCount - reward.bagsUsed;
                    const newTotalRedeemed = (reward.customer.totalRedeemed || 0) + reward.discount;
                    batch.update(rewardRef, { 
                        bagCount: newBagCount, 
                        totalRedeemed: newTotalRedeemed, 
                        updatedAt: serverTimestamp() 
                    });
                    
                    batch.update(lastOrderRef, {
                        rewardDiscount: (lastOrder.rewardDiscount || 0) + reward.discount,
                        rewardCustomerTag: reward.customer.customerTag,
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
    
    const MainPaymentContent = () => (
        <>
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
            
            <div className="text-center py-2 space-y-1">
                {reward && <p className="text-sm text-muted-foreground line-through">{formatCurrency(totalToPay)}</p>}
                <p className="text-4xl font-bold text-primary">{formatCurrency(finalTotal)}</p>
                {reward && <Badge variant="secondary"><Gift className="h-3 w-3 mr-1.5" />{formatCurrency(reward.discount)} discount applied</Badge>}
            </div>
            
            <div className="space-y-4 pt-2">
                <div className="flex justify-center space-x-4">
                    <Button onClick={() => setPaymentMethod('cash')} variant={paymentMethod === 'cash' ? 'default' : 'secondary'}>Cash</Button>
                    <Button onClick={() => setPaymentMethod('momo')} variant={paymentMethod === 'momo' ? 'default' : 'secondary'}>Momo/Card</Button>
                </div>
                {paymentMethod === 'cash' && (
                    <div className="space-y-4">
                         <div>
                            <Label htmlFor="cashPaid">Amount Paid by Customer</Label>
                            <Input id="cashPaid" type="number" value={amountPaidInput} onChange={(e) => setAmountPaidInput(e.target.value)} placeholder="0.00" autoFocus className="text-lg h-12" />
                        </div>
                        
                        {change > 0 && (
                             <div className="text-center">
                                <p className="font-semibold text-red-500">Change Due: {formatCurrency(change)}</p>
                                <div className="mt-2">
                                    <Label htmlFor="changeGiven">Amount Given as Change</Label>
                                    <Input id="changeGiven" type="number" value={changeGivenInput} onChange={(e) => setChangeGivenInput(e.target.value)} placeholder={formatCurrency(change)} className="text-center" />
                                </div>
                            </div>
                        )}
                        {showDeficitOptions && (
                            <p className="font-semibold text-orange-500 text-center">Deficit: {formatCurrency(deficit)}</p>
                        )}
                    </div>
                )}
                 {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            </div>

            <DialogFooter className="grid grid-cols-1 gap-3 pt-6">
                <Button variant="outline" size="sm" onClick={() => setIsApplyingReward(true)}>
                  <Gift className="h-4 w-4 mr-2" /> Apply Reward Discount
                </Button>
                {showDeficitOptions ? (
                    <div className="grid grid-cols-2 gap-2">
                        <Button onClick={() => processCombinedPayment({ pardonDeficit: true })} disabled={isProcessing} className="bg-green-500 hover:bg-green-600 text-white h-12 text-base">
                            {isProcessing ? <LoadingSpinner /> : 'Pardon & Complete'}
                        </Button>
                        <Button onClick={() => processCombinedPayment({ pardonDeficit: false })} disabled={isProcessing} className="bg-yellow-500 hover:bg-yellow-600 text-white h-12 text-base">
                            {isProcessing ? <LoadingSpinner /> : 'Leave Unpaid'}
                        </Button>
                    </div>
                ) : (
                    <Button onClick={() => processCombinedPayment({})} disabled={isProcessing || (paymentMethod === 'cash' && !isAmountPaidEntered)} className="bg-green-500 hover:bg-green-600 text-white h-12 text-lg">
                        {isProcessing ? <LoadingSpinner /> : 'Confirm Payment'}
                    </Button>
                )}
            </DialogFooter>
        </>
    );
    
    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                 {isApplyingReward ? <RewardContent totalToPay={totalToPay} onApplyReward={handleApplyReward} onBack={() => setIsApplyingReward(false)} /> : <MainPaymentContent />}
            </DialogContent>
        </Dialog>
    );
};

export default CombinedPaymentModal;

    