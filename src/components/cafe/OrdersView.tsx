

"use client";

import React, { useState, useEffect, useMemo, useContext } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, orderBy, runTransaction, where, Timestamp, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, CustomerReward } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Tag, Coins, Hourglass, HandCoins, Check, CalendarDays, ShoppingCart, CheckCircle2, Pencil, Search, Trash2, Filter, X, Clock, Gift, PlusCircle, UserPlus, RefreshCw, MinusCircle, User, CreditCard, Landmark } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';
import { EmptyState, LoadingError, NoSearchResults } from '@/components/shared/ErrorPages';
import { ScrollArea } from '../ui/scroll-area';


interface OrderCardProps {
  order: Order;
  isSelected: boolean;
  onSelectionChange: (orderId: string, isSelected: boolean) => void;
  onDetailsClick: (order: Order) => void;
  onQuickPay: (order: Order) => void;
  onStatusUpdate: (id: string, status: 'Pending' | 'Completed') => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
  onChangeDueClick: (order: Order) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  isSelected,
  onSelectionChange,
  onDetailsClick,
  onQuickPay,
  onStatusUpdate,
  onEdit,
  onDelete,
  onChangeDueClick
}) => {
  const isBalanceOwedByCustomer = order.balanceDue > 0;
  const isChangeOwedToCustomer = order.balanceDue < 0;

  const paymentStatusConfig = {
    'Paid': { variant: 'default', className: 'bg-green-500 hover:bg-green-500 text-white' },
    'Unpaid': { variant: 'destructive', className: 'bg-red-500 hover:bg-red-500 text-white' },
    'Partially Paid': { variant: 'secondary', className: 'bg-yellow-500 hover:bg-yellow-500 text-black' },
    'Change Due': { variant: 'secondary', className: 'bg-blue-600 hover:bg-blue-600 text-white' },
  } as const;

  let displayedStatus = order.paymentStatus as keyof typeof paymentStatusConfig;
  if (isChangeOwedToCustomer) {
    displayedStatus = 'Change Due';
  }

  const isFullyPaidAndSettled = displayedStatus === 'Paid' && !isBalanceOwedByCustomer && !isChangeOwedToCustomer;
  const canBeSelected = isBalanceOwedByCustomer || isChangeOwedToCustomer;

  const itemSnippet = useMemo(() => {
    return order.items.map(item => `${item.quantity}x ${item.name}`).join(', ').substring(0, 80);
  }, [order.items]);

  const getOrderStatusIcon = () => {
    if (isChangeOwedToCustomer) {
      return <Coins className="h-4 w-4 text-primary" />;
    }
    if (isBalanceOwedByCustomer) {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
    if (displayedStatus === 'Paid') {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    return null;
  };

  const hasSplitPayment = order.paymentBreakdown && order.paymentBreakdown.cash > 0 && order.paymentBreakdown.momo > 0;

  return (
    <Card className={cn(
      "flex flex-col justify-between transition-all hover:shadow-lg border-2",
      isSelected ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-border',
      order.status === 'Completed' ? 'bg-card/50' : 'bg-card',
      !canBeSelected && !isFullyPaidAndSettled && 'opacity-75'
    )}>
      <CardHeader className="p-3 sm:p-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {canBeSelected && (
              <Checkbox
                id={`select-${order.id}`}
                checked={isSelected}
                onCheckedChange={(checked) => onSelectionChange(order.id, !!checked)}
                aria-label={`Select order ${order.simplifiedId}`}
                className="flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle
                  className="cursor-pointer text-sm sm:text-base truncate"
                  onClick={() => onDetailsClick(order)}
                >
                  {order.simplifiedId}
                </CardTitle>
                {getOrderStatusIcon()}
              </div>
              <CardDescription className="flex flex-wrap items-center gap-1 mt-1">
                <Badge variant="outline" className="text-xs">{order.orderType}</Badge>
                {order.tag && (
                  <Badge variant="secondary" className="text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    {order.tag}
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={paymentStatusConfig[displayedStatus]?.variant || 'secondary'}
            className={cn(paymentStatusConfig[displayedStatus]?.className, "text-xs flex-shrink-0")}
          >
            {displayedStatus}
          </Badge>
        </div>

        {/* Quick Pay Button */}
        {isBalanceOwedByCustomer && (
          <Button
            size="sm"
            variant="default"
            className="w-full mt-2"
            onClick={() => onQuickPay(order)}
          >
            <HandCoins size={16} className="mr-2" />
            Quick Pay {formatCurrency(order.balanceDue)}
          </Button>
        )}

        {/* Change Due Button */}
        {isChangeOwedToCustomer && (
          <Button
            variant="default"
            size="sm"
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => onChangeDueClick(order)}
          >
            <Coins size={16} className="mr-2" />
            Settle Change: {formatCurrency(Math.abs(order.balanceDue))}
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-3 sm:p-4 pt-0 flex-grow">
        <p className="text-muted-foreground text-xs truncate mb-2" title={itemSnippet}>
          {itemSnippet}
        </p>
        <div className="flex justify-between items-baseline">
          <p className="text-lg sm:text-xl font-bold text-primary">
            {formatCurrency(order.total)}
          </p>
          {order.rewardDiscount && order.rewardDiscount > 0 &&
            <Badge variant="outline" className="text-green-600 border-green-300">-{formatCurrency(order.rewardDiscount)}</Badge>
          }
        </div>

        {/* Payment Details */}
        <div className="space-y-1 mt-2 text-xs text-muted-foreground">
          {hasSplitPayment ? (
            <>
              <div className="flex justify-between font-medium text-foreground"><Landmark className="h-3 w-3 mr-1" />Cash Paid:<span>{formatCurrency(order.paymentBreakdown.cash)}</span></div>
              <div className="flex justify-between font-medium text-foreground"><CreditCard className="h-3 w-3 mr-1" />MoMo Paid:<span>{formatCurrency(order.paymentBreakdown.momo)}</span></div>
            </>
          ) : (
            <div className="flex justify-between"><span>Paid ({order.paymentMethod}):</span><span>{formatCurrency(order.amountPaid)}</span></div>
          )}
          <div className="flex justify-between">
            <span>Change Given:</span>
            <span>{formatCurrency(order.changeGiven)}</span>
          </div>
          {order.pardonedAmount && order.pardonedAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Pardoned:</span>
              <span>{formatCurrency(order.pardonedAmount)}</span>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-3 flex items-center">
          <CalendarDays size={12} className="mr-1.5" />
          {formatTimestamp(order.timestamp)}
        </p>
      </CardContent>

      <CardFooter className="p-3 sm:p-4 pt-0 mt-auto">
        {order.status === 'Pending' ? (
          <div className="grid grid-cols-2 gap-2 w-full">
            <Button onClick={() => onEdit(order)} variant="secondary" size="sm">
              <Pencil size={14} className="mr-1.5" /> Edit
            </Button>
            <Button
              onClick={() => onStatusUpdate(order.id, 'Completed')}
              className="bg-green-500 hover:bg-green-600"
              size="sm"
            >
              <Check size={14} className="mr-1.5" /> Complete
            </Button>
            <Button
              onClick={() => onDetailsClick(order)}
              variant="outline"
              size="sm"
            >
              Details
            </Button>
            <Button
              onClick={() => onDelete(order)}
              variant="destructive"
              size="sm"
            >
              <Trash2 size={14} className="mr-1.5" /> Delete
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => onDetailsClick(order)}
            variant="outline"
            className="w-full"
            size="sm"
          >
            View Details
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};


interface FilterState {
  paymentStatus: string[];
  orderType: string[];
  dateRange: string;
  showChangeOnly: boolean;
  showUnpaidOnly: boolean;
}

const OrdersView: React.FC<{ setActiveView: (view: string) => void }> = ({ setActiveView }) => {
  // State management
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [changeDueOrder, setChangeDueOrder] = useState<Order | null>(null);
  const [isCombinedPaymentModalOpen, setIsCombinedPaymentModalOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    paymentStatus: [],
    orderType: [],
    dateRange: 'Today',
    showChangeOnly: false,
    showUnpaidOnly: false,
  });

  const orderEditingContext = useContext(OrderEditingContext);

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

  // Selection handling
  const handleSelectionChange = (orderId: string, isSelected: boolean) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      const order = orders.find(o => o.id === orderId);

      const isFullyPaidAndSettled = order?.paymentStatus === 'Paid' && order.balanceDue === 0;
      if (isFullyPaidAndSettled) return prev;

      if (isSelected) {
        newSet.add(orderId);
      } else {
        newSet.delete(orderId);
      }
      return newSet;
    });
  };

  const handleQuickPay = (order: Order) => {
    setSelectedOrderIds(new Set([order.id]));
    setIsCombinedPaymentModalOpen(true);
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
    if (order.status === 'Pending' && orderEditingContext) {
      orderEditingContext.loadOrderForEditing(order);
      setActiveView('pos');
    }
  };

  const settleChange = async (orderId: string, settleAmount: number, isFullSettlement: boolean) => {
    const orderRef = doc(db, "orders", orderId);
    try {
      await runTransaction(db, async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists()) {
          throw "Document does not exist!";
        }
        const currentBalance = orderDoc.data().balanceDue || 0;
        const newBalance = currentBalance + settleAmount;
        const currentChangeGiven = orderDoc.data().changeGiven || 0;
        const newChangeGiven = currentChangeGiven + settleAmount;

        // If the order had no payment method set, consider this a cash
        // settlement for the purposes of tagging. Also update payment
        // status to Paid if balance reaches zero.
        const existingPaymentMethod = orderDoc.data().paymentMethod || 'Unpaid';
        // If the order was previously paid via momo and we are now
        // giving cash change, mark it as a split payment (momo+cash).
        let newPaymentMethod = existingPaymentMethod === 'Unpaid' ? 'cash' : existingPaymentMethod;
        if (existingPaymentMethod === 'momo' && settleAmount > 0) {
          newPaymentMethod = 'split';
        }
        const newPaymentStatus = Math.abs(newBalance) < 0.01 ? 'Paid' : (orderDoc.data().amountPaid && orderDoc.data().amountPaid > 0 ? 'Partially Paid' : orderDoc.data().paymentStatus || 'Unpaid');

        transaction.update(orderRef, {
          balanceDue: newBalance,
          changeGiven: newChangeGiven,
          lastPaymentTimestamp: serverTimestamp(),
          settledOn: isFullSettlement ? serverTimestamp() : orderDoc.data().settledOn || null,
          paymentMethod: newPaymentMethod,
          paymentStatus: newPaymentStatus,
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

  const filteredOrders = useMemo(() => {
    let baseOrders = orders;

    // Date filtering
    if (filters.dateRange === 'Today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();
      baseOrders = baseOrders.filter(o =>
        o.timestamp && o.timestamp.toDate().getTime() >= todayTimestamp
      );
    }

    // Special filters
    if (filters.showChangeOnly) {
      baseOrders = baseOrders.filter(o => o.balanceDue < 0);
    }

    if (filters.showUnpaidOnly) {
      baseOrders = baseOrders.filter(o =>
        (o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partially Paid') && o.balanceDue > 0
      );
    }

    // Payment status filtering
    if (filters.paymentStatus.length > 0) {
      baseOrders = baseOrders.filter(o => filters.paymentStatus.includes(o.paymentStatus));
    }

    // Order type filtering
    if (filters.orderType.length > 0) {
      baseOrders = baseOrders.filter(o => filters.orderType.includes(o.orderType));
    }

    // Search filtering
    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      baseOrders = baseOrders.filter(order => {
        const hasMatchingTag = order.tag?.toLowerCase().includes(lowercasedQuery);
        const hasMatchingId = order.simplifiedId.toLowerCase().includes(lowercasedQuery);
        const hasMatchingItem = order.items.some(item =>
          item.name.toLowerCase().includes(lowercasedQuery)
        );
        const hasMatchingPaymentMethod = order.paymentMethod.toLowerCase().includes(lowercasedQuery);
        return hasMatchingTag || hasMatchingId || hasMatchingItem || hasMatchingPaymentMethod;
      });
    }

    // Group by status for tabs
    return {
      pending: groupOrdersByDate(baseOrders.filter(o => o.status === 'Pending')),
      unpaid: groupOrdersByDate(baseOrders.filter(o =>
        (o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partially Paid') && o.balanceDue > 0
      )),
      completed: groupOrdersByDate(baseOrders.filter(o => o.status === 'Completed')),
      changeDue: groupOrdersByDate(baseOrders.filter(o => o.balanceDue < 0)),
    };
  }, [orders, filters, searchQuery]);

  // Total counts, independent of filters
  const totalCounts = useMemo(() => ({
    unpaid: orders.filter(o => (o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partially Paid') && o.balanceDue > 0).length,
    changeDue: orders.filter(o => o.balanceDue < 0).length,
  }), [orders]);

  // Filtered counts for tabs
  const filteredCounts = useMemo(() => ({
    pending: Object.values(filteredOrders.pending).flat().length,
    unpaid: Object.values(filteredOrders.unpaid).flat().length,
    completed: Object.values(filteredOrders.completed).flat().length,
    changeDue: Object.values(filteredOrders.changeDue).flat().length,
  }), [filteredOrders]);


  // Computed values
  const selectedOrders = useMemo(() =>
    orders.filter(o => selectedOrderIds.has(o.id)),
    [orders, selectedOrderIds]
  );

  const selectedOrdersTotal = useMemo(() =>
    selectedOrders.reduce((sum, order) => sum + Math.abs(order.balanceDue), 0),
    [selectedOrders]
  );

  const clearFilters = () => {
    setFilters({
      paymentStatus: [],
      orderType: [],
      dateRange: 'Today',
      showChangeOnly: false,
      showUnpaidOnly: false,
    });
    setSearchQuery('');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.paymentStatus.length > 0) count++;
    if (filters.orderType.length > 0) count++;
    if (filters.dateRange !== 'Today') count++;
    if (filters.showChangeOnly) count++;
    if (filters.showUnpaidOnly) count++;
    if (searchQuery) count++;
    return count;
  }, [filters, searchQuery]);

  const renderGroupedOrderList = (groupedOrders: Record<string, Order[]>, emptyMessage: string) => {
    if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

    if (error) return <LoadingError title="Failed to Load Orders" description={error} onRetry={() => window.location.reload()} />;

    const groups = Object.keys(groupedOrders);
    if (groups.length === 0) {
      if (searchQuery) return <NoSearchResults query={searchQuery} onClearSearch={() => setSearchQuery('')} />;
      return <EmptyState title={emptyMessage} description={activeFiltersCount > 0 ? "Try adjusting your filters" : "There are no orders in this category."} action={activeFiltersCount > 0 ? { label: "Clear Filters", onClick: clearFilters } : undefined} />;
    }

    return (
      <div className="space-y-4 md:space-y-6 pb-4">
        {groups.map(groupName => (
          <div key={groupName}>
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <h3 className="text-sm md:text-base font-semibold text-foreground">{groupName}</h3>
              <Separator className="flex-1" />
              <Badge variant="secondary" className="text-[10px] md:text-xs">{groupedOrders[groupName].length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
              {groupedOrders[groupName].map(order =>
                <OrderCard
                  key={order.id}
                  order={order}
                  onDetailsClick={setSelectedOrder}
                  onStatusUpdate={updateOrderStatus}
                  onQuickPay={handleQuickPay}
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
      <div className="flex flex-col h-full bg-background overflow-hidden">
        {/* FIXED HEADER - Mobile-first compact design */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b flex-shrink-0">
          <div className="px-3 py-2 md:p-4">
            {/* Top row - Title and main actions */}
            <div className="flex items-center justify-between mb-2 md:mb-3 gap-2">
              <h1 className="text-base md:text-xl font-bold truncate">Manage Orders</h1>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Change Due Indicator */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={filters.showChangeOnly ? "default" : "outline"}
                      size="sm"
                      className="relative h-8 w-8 p-0 md:h-9 md:w-auto md:px-3"
                      onClick={() => setFilters(prev => ({ ...prev, dateRange: 'All Time', showChangeOnly: !prev.showChangeOnly, showUnpaidOnly: false }))}
                    >
                      <Coins className="h-4 w-4" />
                      {totalCounts.changeDue > 0 && (
                        <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 h-4 w-4 text-[10px] p-0 flex items-center justify-center">
                          {totalCounts.changeDue}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Change Due ({totalCounts.changeDue})</p>
                  </TooltipContent>
                </Tooltip>

                {/* Unpaid Orders Indicator */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={filters.showUnpaidOnly ? "default" : "outline"}
                      size="sm"
                      className="relative h-8 w-8 p-0 md:h-9 md:w-auto md:px-3"
                      onClick={() => setFilters(prev => ({ ...prev, dateRange: 'All Time', showUnpaidOnly: !prev.showUnpaidOnly, showChangeOnly: false }))}
                    >
                      <Clock className="h-4 w-4" />
                      {totalCounts.unpaid > 0 && (
                        <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 text-xs p-0 flex items-center justify-center">
                          {totalCounts.unpaid}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Unpaid Orders ({totalCounts.unpaid})</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Search and filters row */}
            <div className="flex gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm w-full"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-1.5 flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="relative h-8 px-2 md:px-3">
                      <Filter className="h-3.5 w-3.5 md:mr-1.5" />
                      <span className="hidden md:inline text-xs">Filters</span>
                      {activeFiltersCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-4 w-4 text-[10px] p-0 flex items-center justify-center">
                          {activeFiltersCount}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 text-sm font-semibold">Date Range</div>
                    {['Today', 'This Week', 'This Month', 'All Time'].map(range => (
                      <DropdownMenuCheckboxItem
                        key={range}
                        checked={filters.dateRange === range}
                        onCheckedChange={() => setFilters(prev => ({ ...prev, dateRange: range }))}
                      >
                        {range}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-sm font-semibold">Payment Status</div>
                    {['Paid', 'Unpaid', 'Partially Paid'].map(status => (
                      <DropdownMenuCheckboxItem
                        key={status}
                        checked={filters.paymentStatus.includes(status)}
                        onCheckedChange={(checked) => {
                          setFilters(prev => ({
                            ...prev,
                            paymentStatus: checked
                              ? [...prev.paymentStatus, status]
                              : prev.paymentStatus.filter(s => s !== status)
                          }));
                        }}
                      >
                        {status}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={clearFilters} className="text-red-600">
                      <X className="h-4 w-4 mr-2" />
                      Clear All Filters
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Combined Payment Button */}
                {selectedOrderIds.size > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setIsCombinedPaymentModalOpen(true)}
                        className="relative h-8"
                        size="sm"
                      >
                        <ShoppingCart className="h-3.5 w-3.5 md:mr-1.5" />
                        <span className="hidden md:inline text-xs">Pay</span>
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          {selectedOrderIds.size}
                        </Badge>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Pay {formatCurrency(selectedOrdersTotal)} for {selectedOrderIds.size} orders</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-hidden min-h-0">
          {filters.showChangeOnly ? (
            <div className="h-full overflow-y-auto overflow-x-hidden px-3 md:px-4">
              {renderGroupedOrderList(filteredOrders.changeDue, "No orders with change due.")}
            </div>
          ) : filters.showUnpaidOnly ? (
            <div className="h-full overflow-y-auto overflow-x-hidden px-3 md:px-4">
              {renderGroupedOrderList(filteredOrders.unpaid, "No unpaid orders found.")}
            </div>
          ) : (
            <Tabs defaultValue="pending" className="h-full flex flex-col">
              <TabsList className="grid w-full max-w-md grid-cols-3 mx-3 md:mx-4 mt-2 md:mt-3 h-8 flex-shrink-0">
                <TabsTrigger value="pending" className="text-[10px] md:text-xs h-7">
                  Pending ({filteredCounts.pending})
                </TabsTrigger>
                <TabsTrigger value="unpaid" className="text-[10px] md:text-xs h-7">
                  Unpaid ({filteredCounts.unpaid})
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-[10px] md:text-xs h-7">
                  Done ({filteredCounts.completed})
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden min-h-0">
                <TabsContent value="pending" className="h-full overflow-y-auto overflow-x-hidden px-3 md:px-4 mt-2 md:mt-3 data-[state=inactive]:hidden">
                  {renderGroupedOrderList(filteredOrders.pending, "No pending orders found.")}
                </TabsContent>
                <TabsContent value="unpaid" className="h-full overflow-y-auto overflow-x-hidden px-3 md:px-4 mt-2 md:mt-3 data-[state=inactive]:hidden">
                  {renderGroupedOrderList(filteredOrders.unpaid, "No unpaid orders found.")}
                </TabsContent>
                <TabsContent value="completed" className="h-full overflow-y-auto overflow-x-hidden px-3 md:px-4 mt-2 md:mt-3 data-[state=inactive]:hidden">
                  {renderGroupedOrderList(filteredOrders.completed, "No completed orders found.")}
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>

        {/* MODALS */}
        {selectedOrder && (
          <OrderDetailsModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            showActions={true}
          />
        )}

        {changeDueOrder && (
          <PartialSettleModal
            order={changeDueOrder}
            onSettle={settleChange}
            onClose={() => setChangeDueOrder(null)}
          />
        )}

        {isCombinedPaymentModalOpen && (
          <CombinedPaymentModal
            orders={selectedOrders}
            onOrderPlaced={handleCombinedPaymentSuccess}
            onClose={() => {
              setIsCombinedPaymentModalOpen(false);
              setSelectedOrderIds(new Set());
            }}
          />
        )}

        {/* DELETE CONFIRMATION DIALOG */}
        {orderToDelete && (
          <AlertDialog open onOpenChange={() => setOrderToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Order?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete order <span className="font-bold">{orderToDelete.simplifiedId}</span>.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDeleteOrder(orderToDelete.id)}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Delete Order
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









