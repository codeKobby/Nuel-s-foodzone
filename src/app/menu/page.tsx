
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MenuItem, OrderItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Search, ShoppingBag, Plus, Minus, X, Star, Utensils, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import Image from 'next/image';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useRouter } from 'next/navigation';
import logo from '@/app/logo.png';

const MenuPage = () => {
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [cart, setCart] = useState<Record<string, OrderItem>>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const router = useRouter();

    useEffect(() => {
        const q = query(collection(db, "menuItems"), orderBy('category'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMenu(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching menu:", error);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = Object.values(prev).find(cartItem => cartItem.name === item.name);
            if (existing) {
                return { ...prev, [existing.id]: { ...existing, quantity: existing.quantity + 1 } };
            }
            const newId = item.id || crypto.randomUUID();
            return { ...prev, [newId]: { ...item, id: newId, quantity: 1 } };
        });
    };
    
    const updateQuantity = (itemId: string, amount: number) => {
        setCart(prev => {
            const item = prev[itemId];
            if (!item) return prev;
            const newQuantity = item.quantity + amount;
            if (newQuantity <= 0) {
                const { [itemId]: removed, ...rest } = prev;
                return rest;
            }
            return { ...prev, [itemId]: { ...item, quantity: newQuantity } };
        });
    };

    const cartCount = useMemo(() => Object.values(cart).reduce((sum, item) => sum + item.quantity, 0), [cart]);
    const cartTotal = useMemo(() => Object.values(cart).reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

    const categories = useMemo(() => ['All', ...[...new Set(menu.map(item => item.category))].sort()], [menu]);

    const filteredMenu = useMemo(() => {
        return menu.filter(item =>
            (selectedCategory === 'All' || item.category === selectedCategory) &&
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [menu, selectedCategory, searchQuery]);
    
    const handleCheckout = () => {
        // Here you would navigate to a checkout page, passing cart info
        // For now, we'll just log it
        console.log("Proceeding to checkout with:", cart);
        router.push('/checkout'); // Placeholder for checkout page
    }

    const CartSidebar = () => (
        <Card className="w-full md:w-96 rounded-none md:rounded-l-lg border-l-0 md:border-l flex flex-col">
            <CardHeader>
                <CardTitle>Your Order</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-y-auto">
                {cartCount === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
                        <ShoppingBag className="h-12 w-12 mb-4" />
                        <p>Your cart is empty.</p>
                    </div>
                ) : (
                    Object.values(cart).map(item => (
                        <div key={item.id} className="flex items-center gap-3">
                            <div className="w-16 h-16 rounded-md bg-secondary overflow-hidden">
                                <Image src={`https://picsum.photos/seed/${item.name.split(' ').join('-')}/200`} alt={item.name} data-ai-hint={item.name} width={64} height={64} className="object-cover"/>
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-sm">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, -1)} title="Decrease quantity" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></Button>
                                <span className="font-bold text-sm w-6 text-center">{item.quantity}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, 1)} title="Increase quantity" aria-label="Increase quantity"><Plus className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
            <div className="p-4 border-t mt-auto">
                <div className="flex justify-between items-center text-lg font-bold mb-4">
                    <span>Total:</span>
                    <span>{formatCurrency(cartTotal)}</span>
                </div>
                <Button size="lg" className="w-full h-12" disabled={cartCount === 0} onClick={handleCheckout}>
                    Proceed to Checkout
                </Button>
            </div>
        </Card>
    );

    return (
        <>
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b">
            <div className="container mx-auto px-4 h-20 flex justify-between items-center">
                <Link href="/" className="flex items-center gap-2">
                    <Image src={logo} alt="Nuel's Cafe Logo" width={40} height={40} className="rounded-lg"/>
                    <h1 className="text-xl font-bold">Nuel's Cafe</h1>
                </Link>
                <nav className="hidden md:flex items-center gap-6">
                    <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">Home</Link>
                    <Link href="/menu" className="text-sm font-medium text-primary transition-colors">Menu</Link>
                    <Link href="/catering" className="text-sm font-medium hover:text-primary transition-colors">Catering</Link>
                    <Link href="/contact" className="text-sm font-medium hover:text-primary transition-colors">Contact</Link>
                </nav>
                 <div className="flex items-center gap-2">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" className="md:hidden relative">
                                <ShoppingBag />
                                {cartCount > 0 && <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{cartCount}</Badge>}
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="p-0 flex flex-col">
                            <CartSidebar />
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>

        <div className="flex">
            <main className="flex-1 container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h2 className="text-4xl font-bold tracking-tight">Our Menu</h2>
                    <p className="text-muted-foreground mt-2">Explore our delicious offerings, crafted with passion.</p>
                </div>

                {/* Filters */}
                <div className="sticky top-20 z-30 bg-background/95 py-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search for a dish..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                        </div>
                        <div className="flex-shrink-0 overflow-x-auto">
                            <div className="flex gap-2">
                            {categories.map(cat => (
                                <Button key={cat} variant={selectedCategory === cat ? 'default' : 'outline'} onClick={() => setSelectedCategory(cat)}>
                                    {cat}
                                </Button>
                            ))}
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Menu Grid */}
                {loading ? (
                    <div className="flex justify-center items-center h-64"><LoadingSpinner /></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                        {filteredMenu.map(item => (
                            <Card key={item.id} className="group overflow-hidden">
                                <div className="relative h-48 bg-secondary">
                                    <Image 
                                        src={`https://picsum.photos/seed/${item.name.split(' ').join('-')}/400/300`} 
                                        alt={item.name}
                                        data-ai-hint={item.name}
                                        fill
                                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                </div>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-semibold text-lg">{item.name}</h3>
                                        <p className="font-bold text-primary">{formatCurrency(item.price)}</p>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1 h-10">{item.category}</p>
                                    <Button className="w-full mt-4" onClick={() => addToCart(item)}>
                                        <Plus className="mr-2 h-4 w-4" /> Add to Order
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>

            <aside className="hidden md:block w-96 sticky top-20 h-[calc(100vh-5rem)]">
                <CartSidebar />
            </aside>
        </div>
        </>
    );
};

export default MenuPage;

    