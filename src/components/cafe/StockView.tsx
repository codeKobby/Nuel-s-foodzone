
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MenuItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Minus, Plus, Search } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const StockView: React.FC = () => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const menuRef = collection(db, "menuItems");
        const q = query(menuRef, where("category", "in", ["Drinks", "Breakfast Drinks"]));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)).sort((a,b) => a.name.localeCompare(b.name)));
            setLoading(false);
        }, (e) => { setError("Failed to load stock items."); setLoading(false); });
        return () => unsubscribe();
    }, []);

    const handleStockUpdate = async (itemId: string, newStock: number) => {
        if (newStock < 0) return;
        try {
            await updateDoc(doc(db, "menuItems", itemId), { stock: newStock });
        } catch (e) {
            setError("Failed to update stock.");
        }
    };

    const filteredItems = useMemo(() => {
        return menuItems.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [menuItems, searchQuery]);

    return (
        <div className="p-4 md:p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h2 className="text-2xl md:text-3xl font-bold">Drink Stock Management</h2>
                <div className="relative w-full md:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search drinks..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {loading && <LoadingSpinner />}
            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            {!loading && !error && (
                <Card>
                    <CardHeader>
                        <CardTitle>Current Stock</CardTitle>
                        <CardDescription>Update the stock levels for drinks. The changes are saved automatically.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredItems.map(item => (
                                <div key={item.id} className="p-4 bg-card rounded-lg border flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold">{item.name}</p>
                                        <p className="text-sm text-muted-foreground">{item.category}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleStockUpdate(item.id, (item.stock || 0) - 1)}>
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <span className="font-bold text-lg w-10 text-center">{item.stock ?? 0}</span>
                                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleStockUpdate(item.id, (item.stock || 0) + 1)}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                         {filteredItems.length === 0 && (
                            <p className="text-muted-foreground text-center italic py-10">No drinks match your search.</p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default StockView;
