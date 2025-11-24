"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, updateDoc, writeBatch, serverTimestamp, collection, Timestamp, runTransaction, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency, generateSimpleOrderId } from '@/lib/utils';
import type { OrderItem, Order, CustomerReward, Payment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Calculator, Info, Gift, Search as SearchIcon, User as UserIcon, Coins, CreditCard } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/card';
import { AuthContext } from '@/context/AuthContext';
import { useContext } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RewardApplication {
  customer: CustomerReward;
  discount: number;
  bagsUsed: number;
}

const RewardContent = ({ total, onApplyReward, onBack }: { total: number; onApplyReward: (reward: RewardApplication) => void; onBack: () => void; }) => {
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

  const filteredCustomers = React.useMemo(() => {
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
      const discountToApply = Math.min(availableDiscount, total);
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


interface OrderOptionsModalProps {
  total: number;
  orderItems: Record<string, OrderItem>;
  editingOrder: Order | null;
  onClose: () => void;
  onOrderPlaced: (order: Order) => void;
}

const OrderOptionsModal: React.FC<OrderOptionsModalProps> = ({
  total,
  orderItems,
  editingOrder,
  onClose,
  onOrderPlaced
}) => {
  const [step, setStep] = useState(1);
  const [orderType, setOrderType] = useState<'Dine-In' | 'Takeout' | 'Delivery' | 'Pickup'>('Dine-In');
  const [orderTag, setOrderTag] = useState('');

  const [amountPaidCashInput, setAmountPaidCashInput] = useState('');
  const [amountPaidMomoInput, setAmountPaidMomoInput] = useState('');
  const [changeGivenInput, setChangeGivenInput] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useContext(AuthContext);
  const [isApplyingReward, setIsApplyingReward] = useState(false);
  const [reward, setReward] = useState<RewardApplication | null>(null);

  useEffect(() => {
    if (editingOrder) {
      setOrderType(editingOrder.orderType);
      setOrderTag(editingOrder.tag || '');
      setStep(2);
    }
  }, [editingOrder]);

  const finalTotal = Math.max(0, total - (reward?.discount ?? 0));

  const paymentAmounts = useMemo(() => {
    const cash = parseFloat(amountPaidCashInput) || 0;
    const momo = parseFloat(amountPaidMomoInput) || 0;
    const totalPaidNow = cash + momo;
    return { cash, momo, totalPaidNow };
  }, [amountPaidCashInput, amountPaidMomoInput]);

  const balances = React.useMemo(() => {
    const amountPaid = paymentAmounts.totalPaidNow;
    const alreadyPaid = editingOrder?.amountPaid || 0;
    const alreadyGivenChange = editingOrder?.changeGiven || 0;

    const finalAmountPaid = alreadyPaid + amountPaid;

    let effectivePayment = finalAmountPaid - alreadyGivenChange;
    const newBalance = finalTotal - effectivePayment;

    const deficit = newBalance > 0 ? newBalance : 0;
    const change = newBalance < 0 ? Math.abs(newBalance) : 0;

    return {
      amountPaid,
      finalAmountPaid,
      newBalance,
      deficit,
      change,
    };
  }, [paymentAmounts.totalPaidNow, finalTotal, editingOrder]);

  const isAmountPaidEntered = paymentAmounts.totalPaidNow > 0;
  const amountOwedNow = editingOrder ? finalTotal - (editingOrder.amountPaid - (editingOrder.changeGiven || 0)) : finalTotal;
  const isOverpaid = editingOrder && (editingOrder.amountPaid - (editingOrder.changeGiven || 0)) >= finalTotal;

  const showDeficitOptions = isAmountPaidEntered && balances.deficit > 0;
  const canConfirmPayment = !isOverpaid && isAmountPaidEntered;

  const handleProceedToPayment = () => {
    if (!orderTag.trim()) {
      setError("Please add a tag (e.g., customer name or table number) to the order.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handlePayLater = () => {
    if (!orderTag.trim()) {
      setError("Please add a tag before creating a 'Pay Later' order.");
      return;
    }
    setError(null);
    processOrder({ isPaid: false });
  };

  const handleApplyReward = (appliedReward: RewardApplication) => {
    setReward(appliedReward);
    setIsApplyingReward(false);
  };

  const processOrder = async (options: { isPaid: boolean, pardonDeficit?: boolean }) => {
    setIsProcessing(true);
    setError(null);

    const { isPaid, pardonDeficit = false } = options;

    try {
      const pardonedAmount = isPaid && pardonDeficit && balances.newBalance > 0 ? balances.newBalance : 0;

      const newCashPayment = paymentAmounts.cash;
      const newMomoPayment = paymentAmounts.momo;

      const orderData: any = {
        tag: orderTag,
        orderType,
        items: Object.values(orderItems).map(i => ({
          name: i.name,
          price: i.price,
          quantity: i.quantity
        })),
        total: total,
        pardonedAmount: (editingOrder?.pardonedAmount || 0) + pardonedAmount,
        notes: editingOrder?.notes || '',
        status: editingOrder?.status || 'Pending',
        fulfilledItems: editingOrder?.fulfilledItems || [],
        creditSource: editingOrder?.creditSource || [],
        cashierId: session?.uid || 'unknown',
        cashierName: session?.fullName || session?.username || 'Unknown',
        rewardDiscount: (editingOrder?.rewardDiscount || 0) + (reward?.discount || 0),
        rewardCustomerTag: reward?.customer.customerTag || editingOrder?.rewardCustomerTag || '',
      };

      if (pardonedAmount > 0) {
        orderData.notes = `Deficit of ${formatCurrency(pardonedAmount)} pardoned. ${orderData.notes}`.trim();
      }

      if (editingOrder) {
        const orderRef = doc(db, "orders", editingOrder.id);

        const existingBreakdown = editingOrder.paymentBreakdown || { cash: 0, momo: 0 };
        const newBreakdown = {
          cash: existingBreakdown.cash + newCashPayment,
          momo: existingBreakdown.momo + newMomoPayment
        };
        orderData.paymentBreakdown = newBreakdown;

        let finalPaymentMethod: 'cash' | 'momo' | 'split' | 'Unpaid' = 'Unpaid';
        if (newBreakdown.cash > 0 && newBreakdown.momo > 0) finalPaymentMethod = 'split';
        else if (newBreakdown.cash > 0) finalPaymentMethod = 'cash';
        else if (newBreakdown.momo > 0) finalPaymentMethod = 'momo';
        orderData.paymentMethod = finalPaymentMethod;

        orderData.amountPaid = (editingOrder.amountPaid || 0) + paymentAmounts.totalPaidNow;
        const newChangeGiven = (editingOrder.changeGiven || 0) + (balances.change > 0 ? parseFloat(changeGivenInput) || 0 : 0);
        orderData.changeGiven = newChangeGiven;

        let balanceDue = finalTotal - (orderData.amountPaid - orderData.changeGiven);
        if (pardonDeficit) balanceDue = 0;

        orderData.balanceDue = balanceDue;

        if (balanceDue <= 0.01) {
          orderData.paymentStatus = 'Paid';
        } else if (orderData.amountPaid > 0) {
          orderData.paymentStatus = 'Partially Paid';
        } else {
          orderData.paymentStatus = 'Unpaid';
        }

        if (paymentAmounts.totalPaidNow > 0) {
          orderData.lastPaymentTimestamp = serverTimestamp();
          orderData.lastPaymentAmount = paymentAmounts.totalPaidNow;
        }

        await updateDoc(orderRef, orderData);
        const docSnap = await getDoc(orderRef);
        const finalOrderForPopup = { id: docSnap.id, ...docSnap.data() } as Order;
        onOrderPlaced(finalOrderForPopup);

      } else { // New Order
        await runTransaction(db, async (transaction) => {
          const newBreakdown = { cash: newCashPayment, momo: newMomoPayment };
          orderData.paymentBreakdown = newBreakdown;

          let finalPaymentMethod: 'cash' | 'momo' | 'split' | 'Unpaid' = 'Unpaid';
          if (newBreakdown.cash > 0 && newBreakdown.momo > 0) finalPaymentMethod = 'split';
          else if (newBreakdown.cash > 0) finalPaymentMethod = 'cash';
          else if (newBreakdown.momo > 0) finalPaymentMethod = 'momo';
          orderData.paymentMethod = finalPaymentMethod;

          orderData.amountPaid = isPaid ? paymentAmounts.totalPaidNow : 0;
          const changeGiven = isPaid && balances.change > 0 ? (parseFloat(changeGivenInput) || 0) : 0;
          orderData.changeGiven = changeGiven;

          let balanceDue = finalTotal - (orderData.amountPaid - orderData.changeGiven);
          if (pardonDeficit) balanceDue = 0;
          orderData.balanceDue = balanceDue;

          if (isPaid && balanceDue <= 0.01) {
            orderData.paymentStatus = 'Paid';
          } else if (isPaid && balanceDue > 0) {
            orderData.paymentStatus = 'Partially Paid';
          } else {
            orderData.paymentStatus = 'Unpaid';
          }

          const counterRef = doc(db, "counters", "orderIdCounter");
          const newOrderRef = doc(collection(db, "orders"));

          if (reward) {
            const rewardRef = doc(db, 'rewards', reward.customer.id);
            const newBagCount = reward.customer.bagCount - reward.bagsUsed;
            const newTotalRedeemed = (reward.customer.totalRedeemed || 0) + reward.discount;
            transaction.update(rewardRef, {
              bagCount: newBagCount,
              totalRedeemed: newTotalRedeemed,
              updatedAt: serverTimestamp()
            });
          }

          const counterDoc = await transaction.get(counterRef);
          const newCount = (counterDoc.exists() ? counterDoc.data().count : 0) + 1;
          const simplifiedId = generateSimpleOrderId(newCount);

          const newOrderWithId = {
            ...orderData,
            simplifiedId,
            timestamp: serverTimestamp(),
          };

          if (paymentAmounts.totalPaidNow > 0) {
            newOrderWithId.lastPaymentTimestamp = serverTimestamp();
            newOrderWithId.lastPaymentAmount = paymentAmounts.totalPaidNow;
          }

          transaction.set(newOrderRef, newOrderWithId);
          transaction.set(counterRef, { count: newCount }, { merge: true });

          const finalOrderForPopup: Order = { ...newOrderWithId, id: newOrderRef.id, timestamp: Timestamp.now(), balanceDue: orderData.balanceDue };
          onOrderPlaced(finalOrderForPopup);
        });
      }
    } catch (e) {
      console.error("Error processing order:", e);
      setError("Failed to process order. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };


  const renderBalanceBreakdown = () => {
    if (!editingOrder) return null;

    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-4 w-4 text-blue-500" />
            <h4 className="font-semibold text-sm">Balance Calculation</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Original Order Total:</span>
              <span>{formatCurrency(editingOrder.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">New Total:</span>
              <span className="font-semibold">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Already Paid:</span>
              <span>{formatCurrency(editingOrder.amountPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Change Already Given:</span>
              <span>-{formatCurrency(editingOrder.changeGiven || 0)}</span>
            </div>
            <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t">
              <span>Amount Owed Now:</span>
              <span>{formatCurrency(amountOwedNow)}</span>
            </div>
            {isAmountPaidEntered && !isOverpaid && (
              <>
                <hr className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>New Balance:</span>
                  <span className={balances.newBalance > 0 ? "text-red-500" : balances.newBalance < 0 ? "text-green-500" : "text-blue-500"}>
                    {balances.newBalance > 0 ? 'Customer Owes: ' : balances.newBalance < 0 ? 'Change Due: ' : 'Fully Paid'}
                    {balances.newBalance !== 0 ? formatCurrency(Math.abs(balances.newBalance)) : ''}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-[95vw] flex flex-col max-h-[90vh]">
        {isApplyingReward ? <RewardContent total={total} onApplyReward={handleApplyReward} onBack={() => setIsApplyingReward(false)} /> : step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {editingOrder ? `Update Order ${editingOrder.simplifiedId}` : 'New Order Setup'}
              </DialogTitle>
              <DialogDescription>
                {editingOrder
                  ? 'Update the order details and proceed to payment if needed.'
                  : 'Configure the order details before payment.'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {editingOrder && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Order Edit</AlertTitle>
                  <AlertDescription>
                    Total changed from {formatCurrency(editingOrder.total)} to {formatCurrency(total)}
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <Label>Order Type</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {(['Dine-In', 'Takeout', 'Delivery'] as const).map(type => (
                    <Button
                      key={type}
                      onClick={() => setOrderType(type)}
                      variant={orderType === type ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs"
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="tag">Tag (Customer Name / Table No.) *</Label>
                <Input
                  id="tag"
                  type="text"
                  value={orderTag}
                  onChange={(e) => setOrderTag(e.target.value)}
                  placeholder="e.g., 'Table 5' or 'John D.'"
                  className="mt-2"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="grid grid-cols-2 gap-2">
              <Button
                onClick={handlePayLater}
                disabled={isProcessing}
                variant="secondary"
                className="bg-yellow-500 hover:bg-yellow-600 text-white"
              >
                {isProcessing ? <LoadingSpinner /> : 'Save Unpaid'}
              </Button>
              <Button onClick={handleProceedToPayment}>
                Add Payment
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {editingOrder ? `Add Payment - ${editingOrder.simplifiedId}` : 'Process Payment'}
              </DialogTitle>
              <div className="space-y-1 text-center pt-2">
                {reward && (
                  <p className="text-sm text-muted-foreground line-through">{formatCurrency(total)}</p>
                )}
                <p className="text-3xl font-bold text-primary">{formatCurrency(finalTotal)}</p>
                {reward && (
                  <Badge variant="secondary">
                    <Gift className="h-3 w-3 mr-1.5" />
                    {formatCurrency(reward.discount)} discount applied
                  </Badge>
                )}
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4">
                {renderBalanceBreakdown()}

                {!isOverpaid ? (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="amountPaidCash">Amount Paid (Cash)</Label>
                      <Input id="amountPaidCash" type="number" value={amountPaidCashInput} onChange={(e) => setAmountPaidCashInput(e.target.value)} placeholder="0.00" autoFocus className="h-12 text-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amountPaidMomo">Amount Paid (MoMo/Card)</Label>
                      <Input id="amountPaidMomo" type="number" value={amountPaidMomoInput} onChange={(e) => setAmountPaidMomoInput(e.target.value)} placeholder="0.00" className="h-12 text-lg" />
                    </div>

                    {balances.change > 0 && (
                      <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="font-semibold text-red-600 dark:text-red-400 text-center mb-2">
                          Change Due: {formatCurrency(balances.change)}
                        </p>
                        <Label htmlFor="changeGiven">Amount Given as Change</Label>
                        <Input
                          id="changeGiven"
                          type="number"
                          value={changeGivenInput}
                          onChange={(e) => setChangeGivenInput(e.target.value)}
                          placeholder={formatCurrency(balances.change)}
                          className="text-center mt-2"
                        />
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 text-center">
                          Enter amount given. Leave empty if change not given yet.
                        </p>
                      </div>
                    )}
                    {showDeficitOptions && (
                      <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertTitle className="text-orange-800 dark:text-orange-200">Payment Insufficient</AlertTitle>
                        <AlertDescription className="text-orange-700 dark:text-orange-300">
                          Customer still owes: <span className="font-bold">{formatCurrency(balances.deficit)}</span>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                    <Info className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800 dark:text-green-200">Customer Overpaid</AlertTitle>
                    <AlertDescription className="text-green-700 dark:text-green-300">
                      The customer's previous payment covers the new total.
                      A change of <span className="font-bold">{formatCurrency(Math.abs(amountOwedNow))}</span> is now due.
                    </AlertDescription>
                  </Alert>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="grid grid-cols-1 gap-3 pt-4 border-t">
              {!isOverpaid && (
                <Button variant="outline" size="sm" onClick={() => setIsApplyingReward(true)}>
                  <Gift className="h-4 w-4 mr-2" /> Apply Reward Discount
                </Button>
              )}
              {isOverpaid ? (
                <Button
                  onClick={() => processOrder({ isPaid: true })}
                  disabled={isProcessing}
                  className="bg-green-500 hover:bg-green-600 text-white h-12 text-lg"
                >
                  {isProcessing ? <LoadingSpinner /> : "Confirm & Settle Change"}
                </Button>
              ) : showDeficitOptions ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => processOrder({ isPaid: true, pardonDeficit: true })}
                    disabled={isProcessing}
                    className="bg-green-500 hover:bg-green-600 text-white"
                    size="sm"
                  >
                    {isProcessing ? <LoadingSpinner /> : 'Pardon Deficit'}
                  </Button>
                  <Button
                    onClick={() => processOrder({ isPaid: true, pardonDeficit: false })}
                    disabled={isProcessing}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                    size="sm"
                  >
                    {isProcessing ? <LoadingSpinner /> : 'Keep Balance'}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => processOrder({ isPaid: true })}
                  disabled={isProcessing || !canConfirmPayment}
                  className="bg-green-500 hover:bg-green-600 text-white h-12 text-lg"
                >
                  {isProcessing ? <LoadingSpinner /> : 'Process Payment'}
                </Button>
              )}
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                ← Back to Details
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OrderOptionsModal;

