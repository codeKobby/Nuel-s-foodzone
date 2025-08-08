
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { initialMenuData } from '@/data/initial-data';
import { Search, ShoppingBag, Plus, Minus, PlusCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { MenuItem, OrderItem } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import OrderOptionsModal from './modals/OrderOptionsModal';
import BreakfastModal from './modals/BreakfastModal';
import CustomOrderModal from './modals/CustomOrderModal';

interface PosViewProps {
    appId: string;
}

const OrderCart: React.FC<{
    currentOrder: Record<string, OrderItem>;
    total: number;
    updateQuantity: (itemId: string, amount: number) => void;
    clearOrder: () => void;
    onPlaceOrder: () => void;
}> = ({ currentOrder, total, updateQuantity, clearOrder, onPlaceOrder }) => (
    <Card className="w-full md:w-96 rounded-l-2xl border-l-0 md:border-l shadow-lg flex flex-col">
        <CardHeader>
            <CardTitle className="text-2xl">Current Order</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col p-0">
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
                                <span className="font-bold w-6 text-center">{item.quantity}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, 1)}><Plus size={14} /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="mt-auto p-6 border-t">
                <div className="flex justify-between items-center text-2xl font-bold mb-4">
                    <span>Total:</span>
                    <span className="text-primary">{formatCurrency(total)}</span>
                </div>
                <div className="space-y-3">
                    <Button onClick={onPlaceOrder} disabled={Object.keys(currentOrder).length === 0} className="w-full font-bold text-lg h-12">Place Order</Button>
                    <Button onClick={clearOrder} disabled={Object.keys(currentOrder).length === 0} variant="secondary" className="w-full font-bold text-lg h-12">Clear Order</Button>
                </div>
            </div>
        </CardContent>
    </Card>
);

const PosView: React.FC<PosViewProps> = ({ appId }) => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [currentOrder, setCurrentOrder] = useState<Record<string, OrderItem>>({});
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [showOrderOptionsModal, setShowOrderOptionsModal] = useState(false);
    const [showBreakfastModal, setShowBreakfastModal] = useState(false);
    const [showCustomOrderModal, setShowCustomOrderModal] = useState(false);

    useEffect(() => {
        setLoading(true);
        const menuRef = collection(db, `/artifacts/${appId}/public/data/menuItems`);
        const unsubscribe = onSnapshot(menuRef, async (snapshot) => {
            if (snapshot.empty) {
                try {
                    for (const item of initialMenuData) {
                        await addDoc(menuRef, { ...item });
                    }
                } catch (e) { console.error("Error populating initial menu data:", e); }
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

    useEffect(() => {
        setTotal(Object.values(currentOrder).reduce((acc, item) => acc + item.price * item.quantity, 0));
    }, [currentOrder]);

    const addToOrder = useCallback((item: MenuItem) => {
        if (item.requiresChoice) {
            setShowBreakfastModal(true);
            return;
        }
        setCurrentOrder(prev => {
            const newOrder = { ...prev };
            const existingItem = Object.values(newOrder).find(i => i.name === item.name);
            if (existingItem) {
                newOrder[existingItem.id].quantity += 1;
            } else {
                newOrder[item.id] = { ...item, quantity: 1 };
            }
            return newOrder;
        });
    }, []);
    
    const addBreakfastToOrder = useCallback((drinkName: string) => {
        const breakfastItem = menuItems.find(item => item.name === 'English Breakfast');
        if (!breakfastItem) return;

        const combinedName = `English Breakfast with ${drinkName}`;
        
        setCurrentOrder(prev => {
            const newOrder = { ...prev };
            const existingItem = Object.values(newOrder).find(i => i.name === combinedName);
    
            if (existingItem) {
                newOrder[existingItem.id].quantity += 1;
            } else {
                const newItemId = crypto.randomUUID();
                newOrder[newItemId] = { ...breakfastItem, id: newItemId, name: combinedName, quantity: 1 };
            }
            return newOrder;
        });
        setShowBreakfastModal(false);
    }, [menuItems]);

    const addCustomItemToOrder = useCallback((item: { name: string; price: number }) => {
        setCurrentOrder(prev => {
            const newOrder = { ...prev };
            const newItemId = crypto.randomUUID();
            newOrder[newItemId] = {
                id: newItemId,
                name: item.name,
                price: item.price,
                quantity: 1,
                category: 'Custom'
            };
            return newOrder;
        });
        setShowCustomOrderModal(false);
    }, []);

    const updateQuantity = useCallback((itemId: string, amount: number) => {
        setCurrentOrder(prev => {
            const newOrder = { ...prev };
            if (!newOrder[itemId]) return prev;

            const newQuantity = newOrder[itemId].quantity + amount;
            if (newQuantity > 0) {
                newOrder[itemId].quantity = newQuantity;
            } else {
                delete newOrder[itemId];
            }
            return newOrder;
        });
    }, []);

    const clearOrder = () => setCurrentOrder({});

    const categories = ['All', ...Array.from(new Set(menuItems.map(item => item.category)))].sort();
    const filteredItems = menuItems.filter(item => 
        (activeCategory === 'All' || item.category === activeCategory) &&
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-full md:flex-row flex-col bg-background">
            <div className="flex-1 p-6 bg-secondary/50 dark:bg-background overflow-y-auto">
                <header className="mb-6">
                    <h1 className="text-3xl font-bold">Menu</h1>
                    <p className="text-muted-foreground">Select items to add to the order.</p>
                </header>
                <div className="sticky top-0 bg-secondary/50 dark:bg-background py-2 z-10 -mx-6 px-6">
                    <div className="flex gap-2 mb-4">
                        <div className="relative flex-grow">
                            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search menu..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full p-3 pl-12 h-12 text-lg bg-card border-border rounded-xl focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <Button
                            onClick={() => setShowCustomOrderModal(true)}
                            className="h-12 px-4 rounded-xl"
                            variant="outline"
                        >
                            <PlusCircle size={20} className="mr-2"/> Custom
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-4">
                        {filteredItems.map(item => (
                            <Card key={item.id} onClick={() => addToOrder(item)} className="cursor-pointer hover:shadow-lg transition transform hover:-translate-y-1 hover:border-primary/50">
                                <CardHeader>
                                    <CardTitle>{item.name}</CardTitle>
                                    <CardDescription>{item.category}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xl font-semibold text-primary mt-2">{formatCurrency(item.price)}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
            <OrderCart currentOrder={currentOrder} total={total} updateQuantity={updateQuantity} clearOrder={clearOrder} onPlaceOrder={() => setShowOrderOptionsModal(true)} />
            
            {showOrderOptionsModal && (
                <OrderOptionsModal
                    appId={appId}
                    total={total}
                    orderItems={currentOrder}
                    onClose={() => setShowOrderOptionsModal(false)}
                    onOrderPlaced={() => {
                        clearOrder();
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
        </div>
    );
};

export default PosView;

    