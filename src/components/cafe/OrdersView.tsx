

"use client";

import React, { useState, useEffect, useMemo, useContext } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, orderBy, runTransaction, where, Timestamp, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Tag, Coins, Hourglass, HandCoins, Check, CalendarDays, ShoppingCart, CheckCircle2, Pencil, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatTimestamp, groupOrdersByDate } from '@/lib/utils';
import OrderDetailsModal from './modals/OrderDetailsModal';
import PartialSettleModal from './modals/PartialSettleModal';
import CombinedPaymentModal from './modals/CombinedPaymentModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { OrderEditingContext } from '@/context/OrderEditingContext';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';


interface OrderCardProps {
    order: Order;
    isSelected: boolean;
    onSelectionChange: (orderId: string, isSelected: boolean) => void;
    onDetailsClick: (order: Order) => void;
    onStatusUpdate: (id: string, status: 'Pending' | 'Completed') => void;
    onEdit: (order: Order) => void;
    onDelete: (order: Order) => void;
    onChangeDueClick: (order: Order) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, isSelected, onSelectionChange, onDetailsClick, onStatusUpdate, onEdit, onDelete, onChangeDueClick }) => {
    
    const paymentStatusConfig = {
        'Paid': {
            variant: 'default',
            className: 'bg-green-500 hover:bg-green-500 text-primary-foreground',
        },
        'Unpaid': {
            variant: 'destructive',
            className: 'bg-red-500 hover:bg-red-500 text-destructive-foreground',
        },
        'Partially Paid': {
            variant: 'secondary',
            className: 'bg-yellow-500 hover:bg-yellow-500 text-secondary-foreground',
        },
    } as const;

    
    const isBalanceOwedByCustomer = order.balanceDue > 0;
    const isChangeOwedToCustomer = order.balanceDue < 0;
    
    const itemSnippet = useMemo(() => {
        return order.items.map(item => `${item.quantity}x ${item.name}`).join(', ').substring(0, 100);
    }, [order.items]);


    return (
        <Card className={`flex flex-col justify-between transition hover:shadow-md ${isSelected ? 'border-primary ring-2 ring-primary' : ''} ${order.status === 'Completed' ? 'bg-card' : 'bg-card'}`}>
             <CardHeader className="p-4">
                <div className="flex justify-between items-start">
                     <div className="flex items-center space-x-3">
                        <Checkbox
                            id={`select-${order.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => onSelectionChange(order.id, !!checked)}
                            aria-label={`Select order ${order.simplifiedId}`}
                            disabled={order.paymentStatus === 'Paid' && order.balanceDue === 0}
                        />
                        <div>
                            <CardTitle className="cursor-pointer text-base" onClick={() => onSelectionChange(order.id, !isSelected)}>{order.simplifiedId}</CardTitle>
                            <CardDescription>
                                <Badge variant="outline" className="mt-1">{order.orderType}</Badge>
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant={paymentStatusConfig[order.paymentStatus].variant} className={paymentStatusConfig[order.paymentStatus].className}>{order.paymentStatus}</Badge>
                </div>
                 {order.tag && <p className={cn("text-muted-foreground text-sm pt-2 flex items-center font-semibold")}><Tag size={14} className="inline mr-2"/>{order.tag}</p>}
            </CardHeader>
            <CardContent className="p-4 flex-grow">
                <p className="text-muted-foreground text-xs truncate" title={itemSnippet}>{itemSnippet}</p>
                <p className="text-xl md:text-2xl font-bold text-primary mt-2">{formatCurrency(order.total)}</p>
                {isBalanceOwedByCustomer && 
                    <p className="text-sm text-amber-500 flex items-center">
                        <Hourglass size={14} className="inline mr-2"/>Balance: {formatCurrency(order.balanceDue)}
                    </p>
                }
                 {isChangeOwedToCustomer && 
                    <Button variant="link" className="p-0 h-auto text-sm text-red-500 flex items-center" onClick={() => onChangeDueClick(order)}>
                        <Coins size={14} className="inline mr-2"/>Change Owed: {formatCurrency(Math.abs(order.balanceDue))}
                    </Button>
                }
                <p className="text-xs text-muted-foreground mt-2 flex items-center"><CalendarDays size={12} className="inline mr-1.5" />{formatTimestamp(order.timestamp)}</p>
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2 p-4 mt-auto">
                 {order.status === 'Pending' ? (
                    <>
                        <Button onClick={() => onEdit(order)} variant="secondary"><Pencil size={16} className="mr-2"/> Edit</Button>
                        <Button onClick={() => onStatusUpdate(order.id, 'Completed')} className="bg-green-500 hover:bg-green-600"><Check size={16} className="mr-2"/> Complete</Button>
                        <Button onClick={() => onDetailsClick(order)} variant="outline" className="col-span-1">Details</Button>
                        <Button onClick={() => onDelete(order)} variant="destructive" className="col-span-1"><Trash2 size={16} className="mr-2"/> Delete</Button>
                    </>
                ) : (
                    <>
                     <Button onClick={() => onDetailsClick(order)} variant="outline" className="col-span-2">Details</Button>
                    </>
                )}
            </CardFooter>
        </Card>
    );
};

const OrdersView: React.FC<{setActiveView: (view: string) => void}> = ({setActiveView}) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [changeDueOrder, setChangeDueOrder] = useState<Order | null>(null);
    const [isCombinedPaymentModalOpen, setIsCombinedPaymentModalOpen] = useState(false);
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [timeRange, setTimeRange] = useState('Today');
    const [searchQuery, setSearchQuery] = useState('');
    const { loadOrderForEditing } = useContext(OrderEditingContext);
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);


    useEffect(() => {
        setLoading(true);
        setError(null);
        
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
            setOrders(fetchedOrders);
            setLoading(false);
        }, (e) => { 
            console.error(e);
            setError("Failed to load orders. You may need to create a Firestore index if filtering. Check console for details."); 
            setLoading(false); 
        });
        return () => unsubscribe();
    }, []);


    const handleSelectionChange = (orderId: string, isSelected: boolean) => {
        setSelectedOrderIds(prev => {
            const newSet = new Set(prev);
            const order = orders.find(o => o.id === orderId);
             if (order?.paymentStatus === 'Paid' && order.balanceDue === 0) return prev; 

            if (isSelected) {
                newSet.add(orderId);
            } else {
                newSet.delete(orderId);
            }
            return newSet;
        });
    };

    const updateOrderStatus = async (orderId: string, newStatus: 'Pending' | 'Completed') => {
        try {
            await updateDoc(doc(db, "orders", orderId), { status: newStatus });
        } catch (e) {
            console.error("Error updating status:", e);
        }
    };
    
    const handleDeleteOrder = async (orderId: string) => {
        try {
            await deleteDoc(doc(db, "orders", orderId));
            setOrderToDelete(null);
        } catch (e) {
            console.error("Error deleting order:", e);
            setError("Failed to delete order.");
        }
    };


    const handleEditOrder = (order: Order) => {
        if(order.status === 'Pending') {
            loadOrderForEditing(order);
            setActiveView('pos');
        }
    }
    
    const settleChange = async (orderId: string, settleAmount: number, isFullSettlement: boolean) => {
        const orderRef = doc(db, "orders", orderId);
        try {
             await runTransaction(db, async (transaction) => {
                const orderDoc = await transaction.get(orderRef);
                if (!orderDoc.exists()) {
                    throw "Document does not exist!";
                }
                const currentBalance = orderDoc.data().balanceDue || 0;
                const newBalance = currentBalance + settleAmount; // Adding because change is negative
                const currentChangeGiven = orderDoc.data().changeGiven || 0;
                const newChangeGiven = currentChangeGiven + settleAmount;

                transaction.update(orderRef, { 
                    balanceDue: newBalance,
                    changeGiven: newChangeGiven,
                    lastPaymentTimestamp: serverTimestamp(),
                    settledOn: isFullSettlement ? serverTimestamp() : orderDoc.data().settledOn || null,
                });
            });
            setChangeDueOrder(null);
        } catch (e) {
            console.error(e);
            setError("Failed to settle change.");
        }
    };
    
    const handleCombinedPaymentSuccess = () => {
        setSelectedOrderIds(new Set());
        setIsCombinedPaymentModalOpen(false);
    };
    
    const filteredOrdersByTime = useMemo(() => {
        if (timeRange === 'All Time') {
            return orders;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today).toMillis();
        return orders.filter(o => o.timestamp && o.timestamp.toMillis() >= todayTimestamp);
    }, [orders, timeRange]);

    const finalFilteredOrders = useMemo(() => {
        const baseOrders = searchQuery ? orders : filteredOrdersByTime;
        
        const searchFiltered = searchQuery 
            ? baseOrders.filter(order => {
                const lowercasedQuery = searchQuery.toLowerCase();
                const hasMatchingTag = order.tag?.toLowerCase().includes(lowercasedQuery);
                const hasMatchingId = order.simplifiedId.toLowerCase().includes(lowercasedQuery);
                const hasMatchingItem = order.items.some(item => item.name.toLowerCase().includes(lowercasedQuery));
                const hasMatchingPaymentMethod = order.paymentMethod.toLowerCase().includes(lowercasedQuery);
                return hasMatchingTag || hasMatchingId || hasMatchingItem || hasMatchingPaymentMethod;
            })
            : baseOrders;

        return {
            pending: groupOrdersByDate(searchFiltered.filter(o => o.status === 'Pending')),
            unpaid: groupOrdersByDate(searchFiltered.filter(o => (o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partially Paid') && o.balanceDue > 0)),
            completed: groupOrdersByDate(searchFiltered.filter(o => o.status === 'Completed')),
            changeDue: groupOrdersByDate(searchFiltered.filter(o => o.balanceDue < 0)),
        };
    }, [orders, filteredOrdersByTime, searchQuery]);
    
    const selectedOrders = useMemo(() => orders.filter(o => selectedOrderIds.has(o.id)), [orders, selectedOrderIds]);
    const pendingOrdersCount = useMemo(() => Object.values(finalFilteredOrders.pending).flat().length, [finalFilteredOrders.pending]);
    const unpaidOrdersCount = useMemo(() => Object.values(finalFilteredOrders.unpaid).flat().length, [finalFilteredOrders.unpaid]);
    const completedOrdersCount = useMemo(() => Object.values(finalFilteredOrders.completed).flat().length, [finalFilteredOrders.completed]);
    const changeDueOrdersCount = useMemo(() => Object.values(finalFilteredOrders.changeDue).flat().length, [finalFilteredOrders.changeDue]);


    const renderGroupedOrderList = (groupedOrders: Record<string, Order[]>, emptyMessage: string) => {
        if (loading) return <div className="mt-8"><LoadingSpinner /></div>;
        if (error) return <Alert variant="destructive" className="mt-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
        const groups = Object.keys(groupedOrders);
        if (groups.length === 0) {
            return <p className="text-muted-foreground italic col-span-full text-center mt-8">{emptyMessage}</p>;
        }
        return (
            <div className="pt-4 space-y-6">
                {groups.map(groupName => (
                    <div key={groupName}>
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold">{groupName}</h3>
                            <Separator className="flex-1" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-3">
                            {groupedOrders[groupName].map(order =>
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    onDetailsClick={setSelectedOrder}
                                    onStatusUpdate={updateOrderStatus}
                                    isSelected={selectedOrderIds.has(order.id)}
                                    onSelectionChange={handleSelectionChange}
                                    onEdit={handleEditOrder}
                                    onDelete={setOrderToDelete}
                                    onChangeDueClick={setChangeDueOrder}
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };


    return (
        <TooltipProvider>
            <div className="p-4 md:p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                    <div className="flex-grow">
                        <h2 className="text-2xl md:text-3xl font-bold">Order Management</h2>
                    </div>
                     <div className="relative w-full md:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by ID, Tag, Item, Method..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex items-center space-x-2 w-full md:w-auto">
                        {selectedOrderIds.size > 0 && (
                             <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="default" size="sm" className="relative flex-grow" onClick={() => setIsCombinedPaymentModalOpen(true)}>
                                        <ShoppingCart className="mr-2" /> Pay for Selected
                                        <Badge variant="secondary" className="ml-2">{selectedOrderIds.size}</Badge>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Settle payment for all selected orders</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                         <div className="flex flex-grow space-x-1 bg-card p-1 rounded-lg shadow-sm">
                            {['Today', 'All Time'].map(range => (
                                <Button key={range} onClick={() => { setSearchQuery(''); setTimeRange(range);}} variant={timeRange === range && !searchQuery ? 'default' : 'ghost'} size="sm" className="flex-1">{range}</Button>
                            ))}
                        </div>
                    </div>
                </div>
                <Tabs defaultValue="pending" className="w-full">
                  <TabsList className="grid w-full max-w-lg grid-cols-4">
                    <TabsTrigger value="pending">Pending ({pendingOrdersCount})</TabsTrigger>
                    <TabsTrigger value="unpaid">Unpaid ({unpaidOrdersCount})</TabsTrigger>
                    <TabsTrigger value="changeDue">Change Due ({changeDueOrdersCount})</TabsTrigger>
                    <TabsTrigger value="completed">Completed ({completedOrdersCount})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pending">
                    {renderGroupedOrderList(finalFilteredOrders.pending, "No pending orders found.")}
                  </TabsContent>
                   <TabsContent value="unpaid">
                    {renderGroupedOrderList(finalFilteredOrders.unpaid, "No unpaid orders found.")}
                  </TabsContent>
                   <TabsContent value="changeDue">
                    {renderGroupedOrderList(finalFilteredOrders.changeDue, "No orders with change due found.")}
                  </TabsContent>
                  <TabsContent value="completed">
                    {renderGroupedOrderList(finalFilteredOrders.completed, "No completed orders found.")}
                  </TabsContent>
                </Tabs>

                {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} showActions={true} />}
                {changeDueOrder && <PartialSettleModal order={changeDueOrder} onSettle={settleChange} onClose={() => setChangeDueOrder(null)} />}
                {isCombinedPaymentModalOpen && <CombinedPaymentModal orders={selectedOrders} onOrderPlaced={handleCombinedPaymentSuccess} onClose={() => setIsCombinedPaymentModalOpen(false)} />}

                {orderToDelete && (
                     <AlertDialog open onOpenChange={() => setOrderToDelete(null)}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete order <span className="font-bold">{orderToDelete.simplifiedId}</span>. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteOrder(orderToDelete.id)} className="bg-destructive hover:bg-destructive/90">
                                    Yes, delete it
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
        </TooltipProvider>
    );
};

export default OrdersView;
