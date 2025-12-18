
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { collection, doc, writeBatch, serverTimestamp, getDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency } from '@/lib/utils';
import type { Order, CustomerReward } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Gift, Search as SearchIcon, Coins, CreditCard } from 'lucide-react';
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
                        <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>
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

    const amountPaidNum = parseFloat(amountPaidInput) || 0;

    const deficit = amountPaidNum < finalTotal ? finalTotal - amountPaidNum : 0;
    const change = amountPaidNum > finalTotal ? amountPaidNum - finalTotal : 0;

    const rawChangeInput = parseFloat(changeGivenInput);
    const normalizedChangeInput = Number.isFinite(rawChangeInput)
        ? Math.max(0, rawChangeInput)
        : 0;
    const changeGivenAmount = change > 0
        ? Math.min(normalizedChangeInput, change)
        : 0;
    const changeStillDue = change > 0
        ? Math.max(0, Number((change - changeGivenAmount).toFixed(2)))
        : 0;
    const hasOutstandingChange = changeStillDue > 0.009;
    const exceedsChangeDue = change > 0 && normalizedChangeInput - change > 0.009;

    const isAmountPaidEntered = amountPaidInput.trim() !== '';
    const showDeficitOptions = isAmountPaidEntered && deficit > 0;

    const handleApplyReward = (appliedReward: RewardApplication) => {
        setReward(appliedReward);
        setIsApplyingReward(false);
    };

    const processCombinedPayment = async ({ pardonDeficit = false }) => {
        if (!isAmountPaidEntered) {
            setError("Please enter an amount paid.");
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const batch = writeBatch(db);
            // Firestore doesn't support serverTimestamp() inside arrays.
            // Use server timestamp for top-level fields, and a concrete Timestamp for history entries.
            const nowServer = serverTimestamp();
            const nowClient = Timestamp.now();
            let paymentToApply = amountPaidNum;

            // This will hold the total payments applied to each order
            const paymentDistribution: Record<string, { cash: number, momo: number }> = {};

            const sortedOrders = [...orders].sort((a, b) => a.balanceDue - b.balanceDue);

            for (const order of sortedOrders) {
                if (order.balanceDue <= 0 || paymentToApply <= 0) continue;

                let remainingBalance = order.balanceDue;
                const paymentForThisOrder = Math.min(paymentToApply, remainingBalance);

                const cashForThisOrder = paymentMethod === 'cash' ? paymentForThisOrder : 0;
                const momoForThisOrder = paymentMethod === 'momo' ? paymentForThisOrder : 0;

                paymentDistribution[order.id] = { cash: cashForThisOrder, momo: momoForThisOrder };
                paymentToApply -= paymentForThisOrder;
            }

            for (const order of sortedOrders) {
                if (!paymentDistribution[order.id]) continue;

                const orderRef = doc(db, "orders", order.id);
                const orderData = (await getDoc(orderRef)).data() as Order;

                const cashApplied = paymentDistribution[order.id].cash;
                const momoApplied = paymentDistribution[order.id].momo;
                const totalApplied = cashApplied + momoApplied;

                const newAmountPaid = orderData.amountPaid + totalApplied;
                let newBalanceDue = orderData.balanceDue - totalApplied;

                const existingBreakdown = orderData.paymentBreakdown || { cash: 0, momo: 0 };
                const newBreakdown = {
                    cash: existingBreakdown.cash + cashApplied,
                    momo: existingBreakdown.momo + momoApplied,
                };

                let finalPaymentMethod: 'cash' | 'momo' | 'split' = 'split';
                if (newBreakdown.cash > 0 && newBreakdown.momo === 0) finalPaymentMethod = 'cash';
                if (newBreakdown.momo > 0 && newBreakdown.cash === 0) finalPaymentMethod = 'momo';

                const updateData: any = {
                    amountPaid: newAmountPaid,
                    lastPaymentTimestamp: nowServer,
                    lastPaymentAmount: totalApplied,
                    paymentMethod: finalPaymentMethod,
                    paymentBreakdown: newBreakdown
                };

                const existingHistory = Array.isArray((orderData as any).paymentHistory)
                    ? (orderData as any).paymentHistory
                    : [];
                const newHistoryEntries: any[] = [];
                if (cashApplied > 0) {
                    newHistoryEntries.push({ amount: cashApplied, method: 'cash', timestamp: nowClient });
                }
                if (momoApplied > 0) {
                    // Treat card as momo for now (momo/card are displayed together).
                    newHistoryEntries.push({ amount: momoApplied, method: 'momo', timestamp: nowClient });
                }
                if (newHistoryEntries.length > 0) {
                    updateData.paymentHistory = [...existingHistory, ...newHistoryEntries];
                }

                if (newBalanceDue <= 0.01) {
                    updateData.paymentStatus = 'Paid';
                } else {
                    updateData.paymentStatus = 'Partially Paid';
                }

                updateData.balanceDue = newBalanceDue;
                batch.update(orderRef, updateData);
            }

            const lastOrder = sortedOrders.find(o => paymentDistribution[o.id]);
            if (lastOrder) {
                const lastOrderRef = doc(db, "orders", lastOrder.id);
                let finalUpdate: any = {};

                if (change > 0) {
                    const newChangeStillDue = Math.max(0, Number((change - changeGivenAmount).toFixed(2)));
                    finalUpdate.balanceDue = -(change - changeGivenAmount);
                    finalUpdate.changeGiven = (lastOrder.changeGiven || 0) + changeGivenAmount;
                    finalUpdate.paymentStatus = newChangeStillDue < 0.01 ? 'Paid' : 'Partially Paid';
                    finalUpdate.settledOn = newChangeStillDue < 0.01 ? nowServer : null;
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
                    <Label>Payment Method</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                        <Button onClick={() => setPaymentMethod('cash')} variant={paymentMethod === 'cash' ? 'default' : 'outline'} className="h-12"><Coins className="mr-2" />Cash</Button>
                        <Button onClick={() => setPaymentMethod('momo')} variant={paymentMethod === 'momo' ? 'default' : 'outline'} className="h-12"><CreditCard className="mr-2" />Momo</Button>
                    </div>
                </div>
                <div>
                    <Label htmlFor="amountPaid">Amount Paid ({paymentMethod})</Label>
                    <Input id="amountPaid" type="number" value={amountPaidInput} onChange={(e) => setAmountPaidInput(e.target.value)} placeholder="0.00" autoFocus className="mt-1 h-12 text-lg" />
                </div>

                {change > 0 && (
                    <div className="text-center">
                        <p className="font-semibold text-red-500">Change Due: {formatCurrency(change)}</p>
                        <div className="mt-2">
                            <Label htmlFor="changeGiven">Amount Given as Change</Label>
                            <Input id="changeGiven" type="number" value={changeGivenInput} onChange={(e) => setChangeGivenInput(e.target.value)} placeholder={formatCurrency(change)} className="text-center" />
                            <p className="text-xs text-red-600 mt-1">
                                Enter amount given. Leave empty if change not given yet.
                            </p>
                            {hasOutstandingChange && (
                                <p className="text-xs text-orange-600 mt-1">
                                    Remaining change owed: {formatCurrency(changeStillDue)}
                                </p>
                            )}
                            {exceedsChangeDue && (
                                <p className="text-xs text-amber-600 mt-1">
                                    Amount exceeds required change and will be capped at {formatCurrency(change)}.
                                </p>
                            )}
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
