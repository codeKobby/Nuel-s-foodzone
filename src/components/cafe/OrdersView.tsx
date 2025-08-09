
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, orderBy, writeBatch, runTransaction, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Tag, Coins, Hourglass, HandCoins, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import OrderDetailsModal from './modals/OrderDetailsModal';
import ChangeDueModal from './modals/ChangeDueModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OrdersViewProps {
    appId: string;
}

const OrderCard: React.FC<{ order: Order, onDetailsClick: (order: Order) => void, onStatusUpdate: (id: string, status: 'Pending' | 'Completed') => void }> = ({ order, onDetailsClick, onStatusUpdate }) => {
    const paymentStatusVariant = {
        'Paid': 'default',
        'Unpaid': 'destructive',
        'Partially Paid': 'secondary',
    } as const;
    
    const isBalanceOwedByCustomer = order.paymentStatus === 'Partially Paid' || order.paymentStatus === 'Unpaid';
    const isChangeOwedToCustomer = order.paymentMethod === 'cash' && order.balanceDue > 0 && order.amountPaid >= order.total;

    return (
        <Card className="flex flex-col justify-between transition hover:shadow-lg">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>{order.simplifiedId}</CardTitle>
                        <CardDescription>
                            <Badge variant="outline" className="mt-1">{order.orderType}</Badge>
                        </CardDescription>
                    </div>
                    <Badge variant={paymentStatusVariant[order.paymentStatus]}>{order.paymentStatus}</Badge>
                </div>
                 {order.tag && <p className="text-muted-foreground text-sm pt-2 flex items-center"><Tag size={14} className="inline mr-2"/>{order.tag}</p>}
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-bold text-primary">{formatCurrency(order.total)}</p>
                {isBalanceOwedByCustomer && 
                    <p className="text-sm text-amber-500 flex items-center">
                        <Hourglass size={14} className="inline mr-2"/>Balance: {formatCurrency(order.balanceDue)}
                    </p>
                }
                 {isChangeOwedToCustomer && 
                    <p className="text-sm text-red-500 flex items-center">
                        <Coins size={14} className="inline mr-2"/>Change Due: {formatCurrency(order.balanceDue)}
                    </p>
                }
                <p className="text-xs text-muted-foreground mt-2">{formatTimestamp(order.timestamp)}</p>
            </CardContent>
            <CardFooter className="flex space-x-2">
                <Button onClick={() => onDetailsClick(order)} variant="outline" className="w-full">Details</Button>
                {order.status === 'Pending' ? (
                    <Button onClick={() => onStatusUpdate(order.id, 'Completed')} className="w-full bg-green-500 hover:bg-green-600 text-white">Complete</Button>
                ) : (
                    <Button onClick={() => onStatusUpdate(order.id, 'Pending')} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white">Re-Open</Button>
                )}
            </CardFooter>
        </Card>
    );
};

const OrdersView: React.FC<OrdersViewProps> = ({ appId }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [allTimeOrders, setAllTimeOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
    const [timeRange, setTimeRange] = useState('Today');

    useEffect(() => {
        setLoading(true);
        setError(null);
        
        const ordersRef = collection(db, `/artifacts/${appId}/public/data/orders`);
        const q = query(ordersRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
            setAllTimeOrders(fetchedOrders);
            setLoading(false);
        }, (e) => { 
            console.error(e);
            setError("Failed to load orders. You may need to create a Firestore index if filtering. Check console for details."); 
            setLoading(false); 
        });
        return () => unsubscribe();
    }, [appId]);

    useEffect(() => {
        if (timeRange === 'Today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayTimestamp = Timestamp.fromDate(today).toMillis();
            setOrders(allTimeOrders.filter(o => o.timestamp && o.timestamp.toMillis() >= todayTimestamp));
        } else {
            setOrders(allTimeOrders);
        }
    }, [timeRange, allTimeOrders]);

    const updateOrderStatus = async (orderId: string, newStatus: 'Pending' | 'Completed') => {
        try {
            await updateDoc(doc(db, `/artifacts/${appId}/public/data/orders`, orderId), { status: newStatus });
        } catch (e) {
            console.error("Error updating status:", e);
        }
    };
    
    const settleChange = async (orderId: string, settleAmount: number) => {
        const orderRef = doc(db, `/artifacts/${appId}/public/data/orders`, orderId);
        try {
             await runTransaction(db, async (transaction) => {
                const orderDoc = await transaction.get(orderRef);
                if (!orderDoc.exists()) {
                    throw "Document does not exist!";
                }
                const currentBalance = orderDoc.data().balanceDue || 0;
                const newBalance = Math.max(0, currentBalance - settleAmount);
                const currentChangeGiven = orderDoc.data().changeGiven || 0;
                const newChangeGiven = currentChangeGiven + settleAmount;

                transaction.update(orderRef, { 
                    balanceDue: newBalance,
                    changeGiven: newChangeGiven
                });
            });
        } catch (e) {
            console.error(e);
            setError("Failed to settle change.");
        }
    };
    
    const pendingOrders = useMemo(() => orders.filter(o => o.status === 'Pending'), [orders]);
    const completedOrders = useMemo(() => orders.filter(o => o.status === 'Completed'), [orders]);
    
    // Unpaid and Change Due should reflect all-time data to not miss outstanding payments
    const unpaidOrders = useMemo(() => allTimeOrders.filter(o => o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partially Paid'), [allTimeOrders]);
    const changeDueOrders = useMemo(() => allTimeOrders.filter(o => o.paymentMethod === 'cash' && o.balanceDue > 0 && o.amountPaid >= o.total), [allTimeOrders]);

    const renderOrderList = (orderList: Order[], emptyMessage: string) => {
        if (loading) return <div className="mt-8"><LoadingSpinner /></div>;
        if (error) return <Alert variant="destructive" className="mt-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
        return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-4">
                {orderList.length > 0 ? orderList.map(order => <OrderCard key={order.id} order={order} onDetailsClick={setSelectedOrder} onStatusUpdate={updateOrderStatus} />) : <p className="text-muted-foreground italic col-span-full text-center mt-8">{emptyMessage}</p>}
            </div>
        )
    }

    return (
        <TooltipProvider>
            <div className="p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-4">
                        <h2 className="text-3xl font-bold">Order Management</h2>
                        {changeDueOrders.length > 0 && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" className="relative" onClick={() => setIsChangeModalOpen(true)}>
                                        <HandCoins className="text-red-500" />
                                        <Badge className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{changeDueOrders.length}</Badge>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>View Orders with Change Due</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                     <div className="flex space-x-1 bg-card p-1 rounded-lg shadow-sm">
                        {['Today', 'All Time'].map(range => (
                            <Button key={range} onClick={() => setTimeRange(range)} variant={timeRange === range ? 'default' : 'ghost'} size="sm">{range}</Button>
                        ))}
                    </div>
                </div>
                <Tabs defaultValue="pending" className="w-full">
                  <TabsList className="grid w-full max-w-md grid-cols-3">
                    <TabsTrigger value="pending">Pending ({pendingOrders.length})</TabsTrigger>
                    <TabsTrigger value="unpaid">Unpaid ({unpaidOrders.length})</TabsTrigger>
                    <TabsTrigger value="completed">Completed ({completedOrders.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pending">
                    {renderOrderList(pendingOrders, "No pending orders for this period.")}
                  </TabsContent>
                   <TabsContent value="unpaid">
                    {renderOrderList(unpaidOrders, "No unpaid orders. All caught up!")}
                  </TabsContent>
                  <TabsContent value="completed">
                    {renderOrderList(completedOrders, "No completed orders for this period.")}
                  </TabsContent>
                </Tabs>

                {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
                {isChangeModalOpen && <ChangeDueModal orders={changeDueOrders} onSettle={settleChange} onClose={() => setIsChangeModalOpen(false)} />}
            </div>
        </TooltipProvider>
    );
};

export default OrdersView;

    