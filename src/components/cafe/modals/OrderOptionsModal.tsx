
"use client";

import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, writeBatch, serverTimestamp, collection, Timestamp, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency, generateSimpleOrderId } from '@/lib/utils';
import type { OrderItem, Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Calculator, Info } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/card';
import { AuthContext } from '@/context/AuthContext';
import { useContext } from 'react';


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
  const [orderType, setOrderType] = useState<'Dine-In' | 'Takeout' | 'Delivery'>('Dine-In');
  const [orderTag, setOrderTag] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo'>('cash');
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [changeGivenInput, setChangeGivenInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useContext(AuthContext);

  useEffect(() => {
    if (editingOrder) {
      setOrderType(editingOrder.orderType);
      setOrderTag(editingOrder.tag || '');
    }
  }, [editingOrder]);

  const calculateBalances = () => {
    const newPaymentAmount = parseFloat(amountPaidInput) || 0;
    const changeGivenNum = parseFloat(changeGivenInput) || 0;
    
    let totalPaidSoFar = 0;
    let changeGivenSoFar = 0;
    
    if (editingOrder) {
      totalPaidSoFar = editingOrder.amountPaid;
      changeGivenSoFar = editingOrder.changeGiven || 0;
    }
    
    const finalAmountPaid = totalPaidSoFar + newPaymentAmount;
    const finalChangeGiven = changeGivenSoFar + changeGivenNum;
    
    let newBalance = total - finalAmountPaid;
    
    const deficit = newBalance > 0 ? newBalance : 0;
    let change = newBalance < 0 ? Math.abs(newBalance) : 0;
     if (paymentMethod === 'cash' && newPaymentAmount > total) {
      change = newPaymentAmount - total;
      if (editingOrder) {
         change = newPaymentAmount - (total - editingOrder.amountPaid);
      }
    } else {
        change = 0;
    }

    
    return {
      finalAmountPaid,
      finalChangeGiven,
      newPaymentAmount,
      newBalance,
      deficit,
      change,
    };
  };

  const balances = calculateBalances();
  const isAmountPaidEntered = amountPaidInput.trim() !== '' && !isNaN(parseFloat(amountPaidInput));
  const showDeficitOptions = paymentMethod === 'cash' && isAmountPaidEntered && balances.deficit > 0;
  const canConfirmPayment = paymentMethod === 'momo' || (paymentMethod === 'cash' && isAmountPaidEntered);

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

  const processOrder = async (options: { isPaid: boolean, pardonDeficit?: boolean }) => {
    setIsProcessing(true);
    setError(null);

    const { isPaid, pardonDeficit = false } = options;
    
    try {
      const pardonedAmount = isPaid && pardonDeficit && balances.deficit > 0 ? balances.deficit : 0;
      
      const orderData: any = {
        tag: orderTag,
        orderType,
        items: Object.values(orderItems).map(i => ({ 
          name: i.name, 
          price: i.price, 
          quantity: i.quantity 
        })),
        total,
        paymentMethod: isPaid ? paymentMethod : 'Unpaid',
        pardonedAmount: (editingOrder?.pardonedAmount || 0) + pardonedAmount,
        notes: editingOrder?.notes || '',
        status: editingOrder?.status || 'Pending',
        fulfilledItems: editingOrder?.fulfilledItems || [],
        creditSource: editingOrder?.creditSource || [],
        cashierId: session?.uid,
        cashierName: session?.fullName || session?.username || 'Unknown',
      };
      
      if (isPaid) {
          orderData.lastPaymentTimestamp = serverTimestamp();
          orderData.lastPaymentAmount = balances.newPaymentAmount;
      }
      
      if (pardonedAmount > 0) {
        orderData.notes = `Deficit of ${formatCurrency(pardonedAmount)} pardoned. ${orderData.notes}`.trim();
      }

      let finalOrderForPopup: Order;

      if (editingOrder) {
          const orderRef = doc(db, "orders", editingOrder.id);
          const finalAmountPaid = editingOrder.amountPaid + (isPaid ? balances.newPaymentAmount : 0);
          const changeGivenNum = parseFloat(changeGivenInput) || 0;
          const finalChangeGiven = (editingOrder.changeGiven || 0) + changeGivenNum;
          
          let finalBalance = total - finalAmountPaid;
          if(pardonDeficit){
              finalBalance = 0;
          }
          
          orderData.amountPaid = finalAmountPaid;
          orderData.balanceDue = finalBalance;
          orderData.changeGiven = finalChangeGiven;
          
          if (finalBalance <= 0) {
              orderData.paymentStatus = 'Paid';
          } else if (finalAmountPaid > 0) {
              orderData.paymentStatus = 'Partially Paid';
          } else {
              orderData.paymentStatus = 'Unpaid';
          }
          
          await updateDoc(orderRef, orderData);
          const docSnap = await getDoc(orderRef);
          finalOrderForPopup = { id: docSnap.id, ...docSnap.data() } as Order;

      } else {
          const { newPaymentAmount, change } = balances;
          const changeGiven = parseFloat(changeGivenInput) || 0;
          
          orderData.amountPaid = isPaid ? newPaymentAmount : 0;
          orderData.changeGiven = isPaid && newPaymentAmount > total ? changeGiven : 0;
          
          let finalBalance = total - orderData.amountPaid;
           if (pardonDeficit) {
              finalBalance = 0;
          }

          orderData.balanceDue = finalBalance;
          
          if (isPaid && finalBalance <= 0) {
            orderData.paymentStatus = 'Paid';
          } else if (isPaid && finalBalance > 0) {
            orderData.paymentStatus = 'Partially Paid';
          } else {
            orderData.paymentStatus = 'Unpaid';
          }

          const counterRef = doc(db, "counters", "orderIdCounter");
          const newOrderRef = doc(collection(db, "orders"));
          
          await runTransaction(db, async (transaction) => {
              const counterDoc = await transaction.get(counterRef);
              const newCount = (counterDoc.exists() ? counterDoc.data().count : 0) + 1;
              const simplifiedId = generateSimpleOrderId(newCount);
              
              const newOrderWithId = { 
                ...orderData, 
                simplifiedId,
                timestamp: serverTimestamp(),
              };
              transaction.set(newOrderRef, newOrderWithId);
              transaction.set(counterRef, { count: newCount }, { merge: true });
              
              finalOrderForPopup = { ...newOrderWithId, id: newOrderRef.id, timestamp: Timestamp.now(), balanceDue: finalBalance };
          });
      }
      
      onOrderPlaced(finalOrderForPopup);
      
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
              <span className="text-muted-foreground">Previous Total:</span>
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
              <span>{formatCurrency(editingOrder.changeGiven || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Previous Balance:</span>
              <span className={editingOrder.balanceDue > 0 ? "text-red-500" : editingOrder.balanceDue < 0 ? "text-green-500" : ""}>
                {editingOrder.balanceDue > 0 ? 'Owed: ' : editingOrder.balanceDue < 0 ? 'Change Due: ' : 'Settled: '}
                {formatCurrency(Math.abs(editingOrder.balanceDue))}
              </span>
            </div>
            {isAmountPaidEntered && (
              <>
                <hr className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>New Balance After Payment:</span>
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
      <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        {step === 1 && (
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
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>
                {editingOrder ? `Add Payment - ${editingOrder.simplifiedId}` : 'Process Payment'}
              </DialogTitle>
              <DialogDescription>
                {editingOrder 
                  ? 'Add a payment to this existing order.' 
                  : 'Complete the payment for this new order.'
                }
              </DialogDescription>
              <div className="text-center text-3xl font-bold text-primary pt-2">
                {formatCurrency(editingOrder ? total - editingOrder.amountPaid : total)}
              </div>
            </DialogHeader>
            
            <div className="space-y-4">
              {renderBalanceBreakdown()}
              
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => setPaymentMethod('cash')} 
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  size="sm"
                >
                  Cash
                </Button>
                <Button 
                  onClick={() => setPaymentMethod('momo')} 
                  variant={paymentMethod === 'momo' ? 'default' : 'outline'}
                  size="sm"
                >
                  Digital
                </Button>
              </div>
              
              {paymentMethod === 'cash' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="cashPaid">Amount Received from Customer</Label>
                    <Input 
                      id="cashPaid" 
                      type="number" 
                      value={amountPaidInput} 
                      onChange={(e) => setAmountPaidInput(e.target.value)} 
                      placeholder="Enter amount..." 
                      onFocus={(e) => e.target.select()} 
                      autoFocus 
                      className="text-lg h-12 mt-2" 
                    />
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
                        Leave empty or enter less if not giving full change
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
              )}
              
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            
            <DialogFooter className="grid grid-cols-1 gap-3 pt-4">
              {showDeficitOptions ? (
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
