"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MenuItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Minus, Plus, Search } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const StockView: React.FC = () => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        
        const setupListener = () => {
            try {
                setError(null);
                setLoading(true);
                
                const menuRef = collection(db, "menuItems");
                // Fixed: Only include "Drinks" category, excluding "Breakfast Drinks"
                const q = query(menuRef, where("category", "==", "Drinks"));
                
                unsubscribe = onSnapshot(q, 
                    (snapshot) => {
                        try {
                            const items = snapshot.docs.map(doc => ({ 
                                id: doc.id, 
                                ...doc.data() 
                            } as MenuItem));
                            
                            // Sort items alphabetically
                            const sortedItems = items.sort((a, b) => a.name.localeCompare(b.name));
                            setMenuItems(sortedItems);
                            setLoading(false);
                            setError(null);
                        } catch (err) {
                            console.error("Error processing snapshot:", err);
                            setError("Error processing menu items data");
                            setLoading(false);
                        }
                    }, 
                    (err) => {
                        console.error("Firestore listener error:", err);
                        setError(`Connection error: ${err.message || 'Failed to connect to database'}`);
                        setLoading(false);
                    }
                );
            } catch (err) {
                console.error("Error setting up Firestore listener:", err);
                setError("Failed to initialize database connection");
                setLoading(false);
            }
        };

        setupListener();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);

    const handleStockUpdate = async (itemId: string, newStock: number) => {
        if (newStock < 0) return;
        
        setIsUpdating(itemId);
        try {
            await updateDoc(doc(db, "menuItems", itemId), { 
                stock: newStock,
                updatedAt: new Date() // Add timestamp for tracking
            });
        } catch (err) {
            console.error("Stock update error:", err);
            setError(`Failed to update stock: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsUpdating(null);
        }
    };

    const retryConnection = () => {
        setError(null);
        setLoading(true);
        // The useEffect will handle reconnection
        window.location.reload(); // Simple retry by reloading
    };

    const filteredItems = useMemo(() => {
        return menuItems.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [menuItems, searchQuery]);

    const lowStockItems = useMemo(() => {
        return filteredItems.filter(item => (item.stock ?? 0) <= 5);
    }, [filteredItems]);

    return (
        <div className="p-4 md:p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold">Drink Stock Management</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Managing {menuItems.length} drink items • {lowStockItems.length} low stock alerts
                    </p>
                </div>
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
            
            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Connection Error</AlertTitle>
                    <AlertDescription className="flex items-center justify-between">
                        <span>{error}</span>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={retryConnection}
                            className="ml-4"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Low Stock Warning */}
            {!loading && !error && lowStockItems.length > 0 && (
                <Alert className="mb-6 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <AlertTitle className="text-yellow-800 dark:text-yellow-200">Low Stock Warning</AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                        {lowStockItems.length} drink{lowStockItems.length > 1 ? 's' : ''} running low (≤5 items)
                    </AlertDescription>
                </Alert>
            )}

            {!loading && !error && (
                <Card>
                    <CardHeader>
                        <CardTitle>Current Stock</CardTitle>
                        <CardDescription>
                            Update stock levels for drinks only. Changes are saved automatically in real-time.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredItems.map(item => (
                                <div 
                                    key={item.id} 
                                    className={`p-4 bg-card rounded-lg border flex items-center justify-between transition-all ${
                                        (item.stock ?? 0) <= 5 
                                            ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950' 
                                            : ''
                                    } ${
                                        isUpdating === item.id ? 'opacity-50' : ''
                                    }`}
                                >
                                    <div>
                                        <p className="font-semibold">{item.name}</p>
                                        <p className="text-sm text-muted-foreground">{item.category}</p>
                                        {(item.stock ?? 0) <= 5 && (
                                            <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mt-1">
                                                Low Stock
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            size="icon" 
                                            variant="outline" 
                                            className="h-8 w-8" 
                                            onClick={() => handleStockUpdate(item.id, (item.stock || 0) - 1)}
                                            disabled={isUpdating === item.id || (item.stock || 0) <= 0}
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <span className={`font-bold text-lg w-12 text-center ${
                                            (item.stock ?? 0) <= 5 ? 'text-yellow-600 dark:text-yellow-400' : ''
                                        }`}>
                                            {item.stock ?? 0}
                                        </span>
                                        <Button 
                                            size="icon" 
                                            variant="outline" 
                                            className="h-8 w-8" 
                                            onClick={() => handleStockUpdate(item.id, (item.stock || 0) + 1)}
                                            disabled={isUpdating === item.id}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {filteredItems.length === 0 && !loading && (
                            <p className="text-muted-foreground text-center italic py-10">
                                No drinks match your search.
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default StockView;
