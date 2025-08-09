
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { initialMenuData } from '@/data/initial-data';
import { Search, ShoppingBag, Plus, Minus, PlusCircle, X, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { MenuItem, OrderItem } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import OrderOptionsModal from './modals/OrderOptionsModal';
import BreakfastModal from './modals/BreakfastModal';
import CustomOrderModal from './modals/CustomOrderModal';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from '@/components/ui/sheet';
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

interface PosViewProps {
    appId: string;
}

const OrderCart: React.FC<{
    currentOrder: Record<string, OrderItem>;
    total: number;
    updateQuantity: (itemId: string, amount: number) => void;
    setQuantity: (itemId: string, quantity: number) => void;
    removeItem: (itemId: string) => void;
    onClearOrder: () => void;
    onPlaceOrder: () => void;
    isSheet?: boolean;
}> = ({ currentOrder, total, updateQuantity, setQuantity, removeItem, onClearOrder, onPlaceOrder, isSheet = false }) => {
    
    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
        const value = e.target.value;
        if (value === '') return;
        const newQuantity = parseInt(value, 10);
        if (!isNaN(newQuantity) && newQuantity >= 1) {
            setQuantity(itemId, newQuantity);
        }
    };

    const handleQuantityBlur = (e: React.FocusEvent<HTMLInputElement>, itemId: string) => {
        const value = e.target.value;
        if (value === '' || parseInt(value, 10) < 1) {
            setQuantity(itemId, 1);
        }
    };
    
    const CartContent = () => (
        <>
            <div className="flex-grow flex flex-col p-0">
                {Object.keys(currentOrder).length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center text-muted-foreground p-6">
                        <ShoppingBag size={48} className="mb-4" />
                        <p>Your cart is empty.</p>
                        <p className="text-sm">Add items from the menu.</p>
                    </div>
                ) : (
                    <div className="flex-grow overflow-y-auto px-6 space-y-3">
                        {Object.values(currentOrder).map(item => (
                            <div key={item.id} className="flex items-center p-3 bg-secondary rounded-lg">
                                <div className="flex-grow">
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">{formatCurrency(item.price)}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></Button>
                                    <Input 
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => handleQuantityChange(e, item.id)}
                                        onBlur={(e) => handleQuantityBlur(e, item.id)}
                                        className="font-bold w-12 text-center h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, 1)}><Plus size={14} /></Button>
                                </div>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full ml-2 text-red-500" onClick={() => removeItem(item.id)}><Trash2 size={16} /></Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className={`mt-auto p-6 ${isSheet ? '' : 'border-t'}`}>
                <div className="flex justify-between items-center text-2xl font-bold mb-4">
                    <span>Total:</span>
                    <span className="text-primary">{formatCurrency(total)}</span>
                </div>
                <div className="space-y-3">
                    <Button onClick={onPlaceOrder} disabled={Object.keys(currentOrder).length === 0} className="w-full font-bold text-lg h-12">Place Order</Button>
                    <Button onClick={onClearOrder} disabled={Object.keys(currentOrder).length === 0} variant="secondary" className="w-full font-bold text-lg h-12">Clear Order</Button>
                </div>
            </div>
        </>
    );

    if (isSheet) {
        return <CartContent />;
    }

    return (
        <Card className="w-full md:w-96 rounded-none md:rounded-l-2xl border-l-0 md:border-l shadow-lg flex-col hidden md:flex">
            <CardHeader>
                <CardTitle className="text-2xl">Current Order</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col p-0">
                 <CartContent />
            </CardContent>
        </Card>
    );
};


const PosView: React.FC<PosViewProps> = ({ appId }) => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [currentOrder, setCurrentOrder] = useState<Record<string, OrderItem>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [showOrderOptionsModal, setShowOrderOptionsModal] = useState(false);
    const [showBreakfastModal, setShowBreakfastModal] = useState(false);
    const [showCustomOrderModal, setShowCustomOrderModal] = useState(false);
    const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    useEffect(() => {
        setLoading(true);
        const menuRef = collection(db, `/artifacts/${appId}/public/data/menuItems`);
        
        const initializeMenu = async () => {
            try {
                const existingSnapshot = await getDocs(menuRef);
                const existingNames = new Set(existingSnapshot.docs.map(doc => doc.data().name));

                for (const item of initialMenuData) {
                    if (!existingNames.has(item.name)) {
                        await addDoc(menuRef, { ...item });
                    }
                }
            } catch (e) {
                console.error("Error ensuring initial menu data:", e);
                setError("Failed to initialize menu data.");
            }
        };

        const unsubscribe = onSnapshot(menuRef, async (snapshot) => {
            if (snapshot.empty) {
                await initializeMenu();
            } else {
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
                setMenuItems(items);
            }
            setLoading(false);
        }, (e) => {
            console.error("Menu fetch error:", e);
            setError("Failed to load menu items.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [appId]);

    const total = useMemo(() => {
        return Object.values(currentOrder).reduce((acc, item) => acc + item.price * item.quantity, 0);
    }, [currentOrder]);
    
    const totalItems = useMemo(() => {
        return Object.values(currentOrder).reduce((acc, item) => acc + item.quantity, 0);
    }, [currentOrder]);

    const addToOrder = useCallback((item: MenuItem) => {
        if (item.requiresChoice) {
            setShowBreakfastModal(true);
            return;
        }
        setCurrentOrder(prev => {
            const existingItem = prev[item.id];
            if (existingItem) {
                return { ...prev, [item.id]: { ...existingItem, quantity: existingItem.quantity + 1 } };
            } else {
                return { ...prev, [item.id]: { ...item, quantity: 1 } };
            }
        });
    }, []);
    
    const addBreakfastToOrder = useCallback((drinkName: string) => {
        const breakfastItem = menuItems.find(item => item.name === 'English Breakfast');
        if (!breakfastItem) return;

        const combinedName = `English Breakfast with ${drinkName}`;
        
        setCurrentOrder(prev => {
            const existingEntry = Object.entries(prev).find(([, item]) => item.name === combinedName);

            if (existingEntry) {
                const [existingId, existingItem] = existingEntry;
                return { ...prev, [existingId]: { ...existingItem, quantity: existingItem.quantity + 1 } };
            } else {
                const newItemId = crypto.randomUUID();
                return { ...prev, [newItemId]: { ...breakfastItem, id: newItemId, name: combinedName, quantity: 1 } };
            }
        });
        setShowBreakfastModal(false);
    }, [menuItems]);

    const addCustomItemToOrder = useCallback((item: { name: string; price: number }) => {
        setCurrentOrder(prev => {
            const newItemId = crypto.randomUUID();
            return {
                ...prev,
                [newItemId]: { id: newItemId, name: item.name, price: item.price, quantity: 1, category: 'Custom' }
            };
        });
        setShowCustomOrderModal(false);
    }, []);

    const updateQuantity = useCallback((itemId: string, amount: number) => {
        setCurrentOrder(prev => {
            const item = prev[itemId];
            if (!item) return prev;
            const newQuantity = item.quantity + amount;
            if (newQuantity <= 0) {
                const { [itemId]: removed, ...rest } = prev;
                return rest;
            }
            return { ...prev, [itemId]: { ...item, quantity: newQuantity } };
        });
    }, []);
    
    const setQuantity = useCallback((itemId: string, quantity: number) => {
        setCurrentOrder(prev => {
            if (!prev[itemId]) return prev;
            if (quantity <= 0) {
                const { [itemId]: removed, ...rest } = prev;
                return rest;
            }
            return { ...prev, [itemId]: { ...prev[itemId], quantity: quantity } };
        });
    }, []);
    
    const removeItem = useCallback((itemId: string) => {
        setCurrentOrder(prev => {
            const { [itemId]: removed, ...rest } = prev;
            return rest;
        });
    }, []);

    const handleClearOrder = () => {
        setCurrentOrder({});
        setShowClearConfirm(false);
    };

    const handlePlaceOrder = () => {
        setIsCartSheetOpen(false);
        setShowOrderOptionsModal(true);
    };

    const categories = ['All', ...Array.from(new Set(menuItems.map(item => item.category)))].sort();
    const filteredItems = menuItems.filter(item => 
        (activeCategory === 'All' || item.category === activeCategory) &&
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-screen md:flex-row flex-col bg-background">
            <div className="flex-1 p-4 sm:p-6 bg-secondary/50 dark:bg-background overflow-y-auto">
                <header className="mb-4">
                    <h1 className="text-3xl font-bold">Menu</h1>
                    <p className="text-muted-foreground">Select items to add to the order.</p>
                </header>
                <div className="sticky top-0 bg-secondary/50 dark:bg-background py-2 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6">
                    <div className="flex gap-2 mb-4">
                        <div className="relative flex-grow">
                            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                            <Input
                                type="text"
                                placeholder="Search menu..."
                                value={searchQuery}
                                onClick={(e) => e.currentTarget.select()}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full p-3 pl-12 h-12 text-lg bg-card border-border rounded-xl focus:ring-2 focus:ring-primary pr-10"
                            />
                            {searchQuery && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full" 
                                    onClick={() => setSearchQuery('')}
                                >
                                    <X size={18} />
                                </Button>
                            )}
                        </div>
                        <Button
                            onClick={() => setShowCustomOrderModal(true)}
                            className="h-12 px-4 rounded-xl"
                            variant="outline"
                        >
                            <PlusCircle size={20} className="mr-0 sm:mr-2"/> <span className="hidden sm:inline">Custom</span>
                        </Button>
                    </div>
                    <div className="flex space-x-2 overflow-x-auto pb-2 -mx-2 px-2">
                        {categories.map(category => (
                            <Button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                variant={activeCategory === category ? 'default' : 'secondary'}
                                className="flex-shrink-0 rounded-lg"
                            >
                                {category}
                            </Button>
                        ))}
                    </div>
                </div>
                {loading && <div className="mt-8"><LoadingSpinner /></div>}
                {error && <Alert variant="destructive" className="mt-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                {!loading && !error && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-4">
                        {filteredItems.map(item => (
                            <Card key={item.id} onClick={() => addToOrder(item)} className="cursor-pointer hover:shadow-lg transition transform hover:-translate-y-1 hover:border-primary/50">
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base">{item.name}</CardTitle>
                                    <CardDescription className="text-xs">{item.category}</CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <p className="text-lg font-semibold text-primary mt-2">{formatCurrency(item.price)}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
            <OrderCart currentOrder={currentOrder} total={total} updateQuantity={updateQuantity} setQuantity={setQuantity} removeItem={removeItem} onClearOrder={() => setShowClearConfirm(true)} onPlaceOrder={handlePlaceOrder} />
            
            <div className="md:hidden fixed bottom-4 right-4 z-20">
                 <Sheet open={isCartSheetOpen} onOpenChange={setIsCartSheetOpen}>
                    <SheetTrigger asChild>
                        <Button className="h-16 w-16 rounded-full shadow-lg text-lg">
                            <ShoppingBag size={24} />
                             {totalItems > 0 && (
                                <span className="absolute -top-1 -right-1 bg-background text-primary text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-primary">
                                    {totalItems}
                                </span>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="flex flex-col h-[90vh]">
                        <SheetHeader className="p-4 border-b">
                            <SheetTitle className="text-2xl">Current Order</SheetTitle>
                        </SheetHeader>
                        <div className="flex-grow overflow-y-auto">
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
                    appId={appId}
                    total={total}
                    orderItems={currentOrder}
                    onClose={() => setShowOrderOptionsModal(false)}
                    onOrderPlaced={() => {
                        setCurrentOrder({});
                        setShowOrderOptionsİtems({});
                        setShowOrderOptionsModal(false);
                    }}
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

export default PosView;
