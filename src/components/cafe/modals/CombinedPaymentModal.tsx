



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
    const [cashPaidInput, setCashPaidInput] = useState('');
    const [momoPaidInput, setMomoPaidInput] = useState('');
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

    const cashPaidNum = parseFloat(cashPaidInput) || 0;
    const momoPaidNum = parseFloat(momoPaidInput) || 0;
    const totalAmountPaid = cashPaidNum + momoPaidNum;

    const deficit = totalAmountPaid < finalTotal ? finalTotal - totalAmountPaid : 0;
    const change = totalAmountPaid > finalTotal ? totalAmountPaid - finalTotal : 0;
    
    const isAmountPaidEntered = cashPaidInput.trim() !== '' || momoPaidInput.trim() !== '';
    const showDeficitOptions = isAmountPaidEntered && deficit > 0;
    
    const handleApplyReward = (appliedReward: RewardApplication) => {
        setReward(appliedReward);
        setIsApplyingReward(false);
    };

    const processCombinedPayment = async ({ pardonDeficit = false }) => {
        if (!isAmountPaidEntered) {
             setError("Please enter an amount paid in at least one field.");
             return;
        }

        setIsProcessing(true);
        setError(null);
        
        try {
            const batch = writeBatch(db);
            const now = serverTimestamp();
            const changeGiven = parseFloat(changeGivenInput) || (change > 0 ? change : 0);
    
            let cashPaymentToApply = cashPaidNum;
            let momoPaymentToApply = momoPaidNum;
            
            // This will hold the total payments applied to each order from all sources
            const paymentDistribution: Record<string, {cash: number, momo: number}> = {};

            // Sort orders to pay off smaller balances first
            const sortedOrders = [...orders].sort((a,b) => a.balanceDue - b.balanceDue);

            for (const order of sortedOrders) {
                if (order.balanceDue <= 0) continue;
                if(cashPaymentToApply <= 0 && momoPaymentToApply <= 0) break;

                let remainingBalance = order.balanceDue;
                
                // Apply cash first
                const cashForThisOrder = Math.min(cashPaymentToApply, remainingBalance);
                if (cashForThisOrder > 0) {
                    paymentDistribution[order.id] = {...(paymentDistribution[order.id] || {cash: 0, momo: 0}), cash: cashForThisOrder};
                    remainingBalance -= cashForThisOrder;
                    cashPaymentToApply -= cashForThisOrder;
                }
                
                // Apply momo second
                const momoForThisOrder = Math.min(momoPaymentToApply, remainingBalance);
                 if (momoForThisOrder > 0) {
                    paymentDistribution[order.id] = {...(paymentDistribution[order.id] || {cash: 0, momo: 0}), momo: momoForThisOrder};
                    remainingBalance -= momoForThisOrder;
                    momoPaymentToApply -= momoForThisOrder;
                }
            }

            for(const order of sortedOrders) {
                if(!paymentDistribution[order.id] && !(pardonDeficit && deficit > 0)) continue;

                const orderRef = doc(db, "orders", order.id);
                const orderData = (await getDoc(orderRef)).data() as Order;

                const cashApplied = paymentDistribution[order.id]?.cash || 0;
                const momoApplied = paymentDistribution[order.id]?.momo || 0;
                const totalApplied = cashApplied + momoApplied;
                
                const newAmountPaid = orderData.amountPaid + totalApplied;
                let newBalanceDue = orderData.balanceDue - totalApplied;

                const updateData: any = {
                    amountPaid: newAmountPaid,
                    lastPaymentTimestamp: now,
                    lastPaymentAmount: totalApplied,
                    paymentBreakdown: {
                        cash: (orderData.paymentBreakdown?.cash || 0) + cashApplied,
                        momo: (orderData.paymentBreakdown?.momo || 0) + momoApplied,
                    },
                };
                
                if (cashApplied > 0 && momoApplied > 0) updateData.paymentMethod = 'split';
                else if (cashApplied > 0) updateData.paymentMethod = 'cash';
                else if (momoApplied > 0) updateData.paymentMethod = 'momo';


                if (newBalanceDue <= 0.01) {
                    updateData.paymentStatus = 'Paid';
                } else {
                    updateData.paymentStatus = 'Partially Paid';
                }
    
                updateData.balanceDue = newBalanceDue;
                batch.update(orderRef, updateData);
            }
            
            const lastOrder = sortedOrders[sortedOrders.length - 1];
            if (lastOrder) {
                const lastOrderRef = doc(db, "orders", lastOrder.id);
                let finalUpdate: any = {};
    
                if (change > 0) {
                    finalUpdate.balanceDue = -(change - changeGiven); 
                    finalUpdate.changeGiven = (lastOrder.changeGiven || 0) + changeGiven;
                    finalUpdate.paymentStatus = 'Paid';
                    finalUpdate.settledOn = (change - changeGiven) < 0.01 ? now : null;
                }
                else if (deficit > 0 && pardonDeficit) {
                    finalUpdate.pardonedAmount = (lastOrder.pardonedAmount || 0) + deficit;
                    finalUpdate.notes = `${(lastOrder.notes || '')} Combined payment deficit of ${formatCurrency(deficit)} pardoned.`.trim();
                    finalUpdate.balanceDue = 0;
                    finalUpdate.paymentStatus = 'Paid';
                }
    
                if (reward) {
                    const rewardRef = doc(db, 'rewards', reward.customer.id);
                    batch.update(rewardRef, {
                        bagCount: reward.customer.bagCount - reward.bagsUsed,
                        totalRedeemed: (reward.customer.totalRedeemed || 0) + reward.discount,
                        updatedAt: serverTimestamp()
                    });
    
                    finalUpdate.rewardDiscount = (lastOrder.rewardDiscount || 0) + reward.discount;
                    finalUpdate.rewardCustomerTag = reward.customer.customerTag;
                }
                
                if (Object.keys(finalUpdate).length > 0) {
                    batch.update(lastOrderRef, finalUpdate);
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
            
            <div className="space-y-4 pt-2 p-4 border rounded-lg">
                <div>
                    <Label htmlFor="cashPaid">Amount Paid (Cash)</Label>
                    <Input id="cashPaid" type="number" value={cashPaidInput} onChange={(e) => setCashPaidInput(e.target.value)} placeholder="0.00" className="mt-1" />
                </div>
                 <div>
                    <Label htmlFor="momoPaid">Amount Paid (Momo/Card)</Label>
                    <Input id="momoPaid" type="number" value={momoPaidInput} onChange={(e) => setMomoPaidInput(e.target.value)} placeholder="0.00" className="mt-1" />
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
                    <Button onClick={() => processCombinedPayment({})} disabled={isProcessing || !isAmountPaidEntered} className="bg-green-500 hover:bg-green-600 text-white h-12 text-lg">
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

    


    
