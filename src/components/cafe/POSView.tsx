"use client";

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { collection, onSnapshot, runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, PlusCircle, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { MenuItem, Order } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import OrderOptionsModal from './modals/OrderOptionsModal';
import BreakfastModal from './modals/BreakfastModal';
import CustomOrderModal from './modals/CustomOrderModal';
import PartialSettleModal from './modals/PartialSettleModal';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { OrderEditingContext } from '@/context/OrderEditingContext';
import { useCart } from '@/hooks/useCart';
import { OrderCart } from './pos/OrderCart';

const POSView: React.FC<{ setActiveView: (view: string) => void }> = ({ setActiveView }) => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [showOrderOptionsModal, setShowOrderOptionsModal] = useState(false);
    const [showBreakfastModal, setShowBreakfastModal] = useState(false);
    const [showCustomOrderModal, setShowCustomOrderModal] = useState(false);
    const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const orderEditingContext = useContext(OrderEditingContext);
    const editingOrder = orderEditingContext?.editingOrder;
    const clearEditingOrder = orderEditingContext?.clearEditingOrder;
    const [orderWithChangeDue, setOrderWithChangeDue] = useState<Order | null>(null);

    const {
        currentOrder,
        total,
        totalItems,
        addToOrder: addToCart,
        updateQuantity,
        setQuantity,
        removeItem,
        clearOrder,
        setCart
    } = useCart();

    useEffect(() => {
        if (editingOrder) {
            const orderItemsAsCart: Record<string, any> = editingOrder.items.reduce((acc: Record<string, any>, item: any) => {
                const id = crypto.randomUUID();
                acc[id] = {
                    ...item,
                    id: id,
                    category: 'N/A'
                };
                return acc;
            }, {});
            setCart(orderItemsAsCart);
        }
    }, [editingOrder, setCart]);

    useEffect(() => {
        setLoading(true);
        const menuRef = collection(db, "menuItems");
        const unsubscribe = onSnapshot(menuRef, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
            setMenuItems(items);
            setLoading(false);
        }, (e) => {
            console.error("Menu fetch error:", e);
            setError("Failed to load menu items.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleAddToOrder = useCallback((item: MenuItem) => {
        if (item.name.toLowerCase() === 'english breakfast' || item.requiresChoice) {
            setShowBreakfastModal(true);
            return;
        }
        addToCart(item);
    }, [addToCart]);

    const addBreakfastToOrder = useCallback((drinkName: string) => {
        const breakfastItem = menuItems.find(item => item.name === 'English Breakfast');
        if (!breakfastItem) return;

        const combinedName = `English Breakfast with ${drinkName}`;

        const itemToAdd = {
            ...breakfastItem,
            name: combinedName
        };
        addToCart(itemToAdd);
        setShowBreakfastModal(false);
    }, [menuItems, addToCart]);

    const addCustomItemToOrder = useCallback((item: { name: string; price: number }) => {
        addToCart({
            id: crypto.randomUUID(),
            name: item.name,
            price: item.price,
            category: 'Custom',
            quantity: 1
        } as any);
        setShowCustomOrderModal(false);
    }, [addToCart]);

    const handleClearOrder = () => {
        clearOrder();
        if (clearEditingOrder) {
            clearEditingOrder();
        }
        setShowClearConfirm(false);
    };

    const handlePlaceOrder = () => {
        setIsCartSheetOpen(false);
        setShowOrderOptionsModal(true);
    };

    const handleOrderPlaced = (order: Order) => {
        clearOrder();
        setShowOrderOptionsModal(false);
        if (clearEditingOrder) {
            clearEditingOrder();
        }
        if (order.balanceDue < 0) {
            setOrderWithChangeDue(order);
        } else {
            setActiveView('orders');
        }
    };

    const handleSettleChange = async (orderId: string, settleAmount: number, isFullSettlement: boolean) => {
        const orderRef = doc(db, "orders", orderId);
        try {
            await runTransaction(db, async (transaction) => {
                const orderDoc = await transaction.get(orderRef);
                if (!orderDoc.exists()) throw "Document does not exist!";

                const currentBalance = orderDoc.data().balanceDue || 0;
                const newBalance = currentBalance + settleAmount;
                const currentChangeGiven = orderDoc.data().changeGiven || 0;
                const newChangeGiven = currentChangeGiven + settleAmount;

                // Preserve existing payment method unless it's unset/Unpaid —
                // settling change in the POS should mark an otherwise-unpaid
                // order as cash-settled. Also mark paymentStatus as Paid when
                // the balance reaches zero.
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
            setOrderWithChangeDue(null);
            setActiveView('orders');
        } catch (e) {
            console.error(e);
            setError("Failed to settle change.");
        }
    };


    const categories = ['All', ...Array.from(new Set(menuItems.map(item => item.category)))].sort();
    const filteredItems = menuItems.filter(item =>
        (activeCategory === 'All' || item.category === activeCategory) &&
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-full overflow-hidden bg-background">
            {/* Left Pane (Menu) */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Header & Search (Compact Sticky) */}
                <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b px-3 py-2 md:px-4 md:py-3">
                    <header className="mb-1.5 flex justify-between items-center">
                        <div className="min-w-0">
                            <h1 className="text-base md:text-lg font-bold leading-none truncate">{editingOrder ? 'Editing Order' : 'Menu'}</h1>
                            {editingOrder && <p className="text-[10px] text-muted-foreground truncate">ID: {editingOrder.simplifiedId}</p>}
                        </div>
                        {editingOrder && (
                            <Button variant="destructive" size="sm" className="h-7 text-xs ml-2 flex-shrink-0" onClick={handleClearOrder}>Cancel</Button>
                        )}
                    </header>

                    <div className="space-y-1.5">
                        <div className="flex gap-1.5">
                            <div className="relative flex-grow">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                                <Input
                                    type="text"
                                    placeholder="Search menu..."
                                    value={searchQuery}
                                    onClick={(e) => e.currentTarget.select()}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-8 text-sm bg-secondary/50 border-transparent focus:bg-background focus:border-primary rounded-md pl-8"
                                />
                                {searchQuery && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full"
                                        onClick={() => setSearchQuery('')}
                                    >
                                        <X size={12} />
                                    </Button>
                                )}
                            </div>
                            <Button
                                onClick={() => setShowCustomOrderModal(true)}
                                className="h-8 px-2 md:px-3 flex-shrink-0"
                                variant="outline"
                                size="sm"
                            >
                                <PlusCircle size={14} className="md:mr-1.5" /> <span className="hidden md:inline text-xs">Custom</span>
                            </Button>
                        </div>
                        <div className="flex space-x-1.5 overflow-x-auto pb-1 no-scrollbar -mx-3 px-3">
                            {categories.map(category => (
                                <Button
                                    key={category}
                                    onClick={() => setActiveCategory(category)}
                                    variant={activeCategory === category ? 'default' : 'secondary'}
                                    size="sm"
                                    className="flex-shrink-0 rounded-full px-3 h-6 text-[10px] md:text-xs"
                                >
                                    {category}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Menu Grid */}
                <div className="flex-1 overflow-y-auto p-2 md:p-4">
                    {loading && <div className="mt-8"><LoadingSpinner /></div>}
                    {error && <Alert variant="destructive" className="mt-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

                    {!loading && !error && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 md:gap-2 pb-16 md:pb-4">
                            {filteredItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleAddToOrder(item)}
                                    className="flex flex-col justify-between p-2 md:p-3 h-20 md:h-24 bg-card border rounded-lg transition-all text-left shadow-sm hover:shadow-md active:scale-[0.98] hover:border-primary hover:ring-1 hover:ring-primary/50"
                                >
                                    <span className="font-semibold text-xs md:text-sm leading-tight line-clamp-2 text-foreground">{item.name}</span>
                                    <span className="font-mono text-primary text-xs md:text-sm font-semibold">{formatCurrency(item.price)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Pane (Cart) */}
            <div className="hidden md:flex w-[300px] lg:w-[350px] xl:w-[400px] border-l bg-background flex-col h-full">
                <div className="p-3 border-b">
                    <h2 className="text-base font-bold">Current Order</h2>
                </div>
                <div className="flex-grow flex flex-col overflow-hidden">
                    <OrderCart
                        currentOrder={currentOrder}
                        total={total}
                        updateQuantity={updateQuantity}
                        setQuantity={setQuantity}
                        removeItem={removeItem}
                        onClearOrder={() => setShowClearConfirm(true)}
                        onPlaceOrder={handlePlaceOrder}
                    />
                </div>
            </div>

            {/* Mobile Cart Trigger */}
            <div className="md:hidden">
                <Sheet open={isCartSheetOpen} onOpenChange={setIsCartSheetOpen}>
                    <SheetTrigger asChild>
                        <div className="fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground px-3 py-2.5 flex justify-between items-center z-50 cursor-pointer shadow-[0_-2px_8px_rgba(0,0,0,0.15)] safe-bottom">
                            <span className="font-medium text-sm flex items-center gap-1.5">
                                View Order
                                <span className="bg-primary-foreground/20 px-2 py-0.5 rounded-full text-xs">
                                    {totalItems} items
                                </span>
                            </span>
                            <span className="font-bold text-base">{formatCurrency(total)}</span>
                        </div>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="flex flex-col h-[85dvh] max-h-[85dvh] rounded-t-2xl">
                        <SheetHeader className="p-3 border-b flex-shrink-0">
                            <SheetTitle className="text-lg">{editingOrder ? 'Editing Order' : 'Current Order'}</SheetTitle>
                        </SheetHeader>
                        <div className="flex-grow overflow-y-auto min-h-0">
                            <OrderCart
                                currentOrder={currentOrder}
                                total={total}
                                updateQuantity={updateQuantity}
                                setQuantity={setQuantity}
                                removeItem={removeItem}
                                onClearOrder={() => setShowClearConfirm(true)}
                                onPlaceOrder={handlePlaceOrder}
                                isSheet={true}
                            />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {showOrderOptionsModal && (
                <OrderOptionsModal
                    total={total}
                    orderItems={currentOrder}
                    editingOrder={editingOrder ?? null}
                    onClose={() => setShowOrderOptionsModal(false)}
                    onOrderPlaced={handleOrderPlaced}
                />
            )}
            {orderWithChangeDue && (
                <PartialSettleModal
                    order={orderWithChangeDue}
                    onClose={() => {
                        setOrderWithChangeDue(null);
                        setActiveView('orders');
                    }}
                    onSettle={handleSettleChange}
                    isPopup={true}
                />
            )}
            {showBreakfastModal && (
                <BreakfastModal onSelect={addBreakfastToOrder} onClose={() => setShowBreakfastModal(false)} />
            )}
            {showCustomOrderModal && (
                <CustomOrderModal
                    menuItems={menuItems}
                    onAddItem={addCustomItemToOrder}
                    onClose={() => setShowCustomOrderModal(false)}
                />
            )}
            {showClearConfirm && (
                <AlertDialog open onOpenChange={() => setShowClearConfirm(false)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Clear Order</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to clear the entire order? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearOrder} className="bg-destructive hover:bg-destructive/90">Clear Order</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
};

export default POSView;
