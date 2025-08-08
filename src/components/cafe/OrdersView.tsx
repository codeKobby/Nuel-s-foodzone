
"use client";

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Tag, Coins, Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import OrderDetailsModal from './modals/OrderDetailsModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface OrdersViewProps {
    appId: string;
}

const OrderCard: React.FC<{ order: Order, onDetailsClick: (order: Order) => void, onStatusUpdate: (id: string, status: 'Pending' | 'Completed') => void }> = ({ order, onDetailsClick, onStatusUpdate }) => {
    const paymentStatusVariant = {
        'Paid': 'default',
        'Unpaid': 'destructive',
        'Partially Paid': 'secondary',
    } as const;

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
                {order.balanceDue > 0 && 
                    <p className="text-sm text-amber-500 flex items-center">
                        <Hourglass size={14} className="inline mr-2"/>Balance: {formatCurrency(order.balanceDue)}
                    </p>
                }
                 {order.changeGiven > 0 && 
                    <p className="text-sm text-green-500 flex items-center">
                        <Coins size={14} className="inline mr-2"/>Change: {formatCurrency(order.changeGiven)}
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, `/artifacts/${appId}/public/data/orders`), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
            setOrders(fetchedOrders);
            setLoading(false);
        }, (e) => { setError("Failed to load orders."); setLoading(false); });
        return () => unsubscribe();
    }, [appId]);

    const updateOrderStatus = async (orderId: string, newStatus: 'Pending' | 'Completed') => {
        try {
            await updateDoc(doc(db, `/artifacts/${appId}/public/data/orders`, orderId), { status: newStatus });
        } catch (e) {
            console.error("Error updating status:", e);
        }
    };
    
    const pendingOrders = orders.filter(o => o.status === 'Pending');
    const completedOrders = orders.filter(o => o.status === 'Completed');
    const unpaidOrders = orders.filter(o => o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partially Paid');

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
        <div className="p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
            <h2 className="text-3xl font-bold mb-6">Order Management</h2>
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="pending">Pending ({pendingOrders.length})</TabsTrigger>
                <TabsTrigger value="unpaid">Unpaid ({unpaidOrders.length})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({completedOrders.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="pending">
                {renderOrderList(pendingOrders, "No pending orders.")}
              </TabsContent>
               <TabsContent value="unpaid">
                {renderOrderList(unpaidOrders, "No unpaid orders.")}
              </TabsContent>
              <TabsContent value="completed">
                {renderOrderList(completedOrders, "No completed orders.")}
              </TabsContent>
            </Tabs>

            {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
        </div>
    );
};

export default OrdersView;
