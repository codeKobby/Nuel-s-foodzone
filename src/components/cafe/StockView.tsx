"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { MenuItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Minus, Plus, Search, RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface ConnectionStatus {
  isConnected: boolean;
  lastSync: Date | null;
  retryCount: number;
}

const StockView: React.FC = () => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
        isConnected: false,
        lastSync: null,
        retryCount: 0
    });
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authChecking, setAuthChecking] = useState(true);

    const { toast } = useToast();

    // Check authentication status
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setIsAuthenticated(!!user);
            setAuthChecking(false);
            if (!user) {
                setError("Authentication required. Please log in.");
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (authChecking || !isAuthenticated) return;

        let unsubscribe: (() => void) | undefined;
        let retryTimeout: NodeJS.Timeout;
        
        const setupListener = async () => {
            try {
                setError(null);
                setLoading(true);
                
                const menuRef = collection(db, "menuItems");
                // Fixed: Only query for "Drinks" category, excluding "Breakfast Drinks"
                const q = query(
                    menuRef, 
                    where("category", "==", "Drinks"),
                    orderBy("name", "asc")
                );
                
                unsubscribe = onSnapshot(q, 
                    (snapshot) => {
                        try {
                            const items = snapshot.docs.map(doc => ({ 
                                id: doc.id, 
                                ...doc.data() 
                            } as MenuItem));
                            
                            setMenuItems(items);
                            setLoading(false);
                            setError(null);
                            setConnectionStatus({
                                isConnected: true,
                                lastSync: new Date(),
                                retryCount: 0
                            });

                            toast({
                                title: "Stock data updated",
                                description: `${items.length} drinks loaded successfully`,
                            });
                        } catch (err) {
                            console.error("Error processing snapshot:", err);
                            setError("Error processing stock data");
                            setLoading(false);
                            setConnectionStatus(prev => ({ ...prev, isConnected: false }));
                        }
                    }, 
                    (err) => {
                        console.error("Firestore listener error:", err);
                        
                        let errorMessage = "Database connection failed";
                        if (err.code === 'permission-denied') {
                            errorMessage = "Permission denied. Please check your authentication.";
                        } else if (err.code === 'unavailable') {
                            errorMessage = "Database temporarily unavailable. Retrying...";
                        } else if (err.message.includes('CORS')) {
                            errorMessage = "Network connection blocked. Please check your browser settings.";
                        }
                        
                        setError(errorMessage);
                        setLoading(false);
                        setConnectionStatus(prev => ({
                            isConnected: false,
                            lastSync: prev.lastSync,
                            retryCount: prev.retryCount + 1
                        }));

                        // Auto-retry for certain errors
                        if (err.code === 'unavailable' && connectionStatus.retryCount < 3) {
                            retryTimeout = setTimeout(() => {
                                setupListener();
                            }, 2000 * (connectionStatus.retryCount + 1));
                        }
                    }
                );
            } catch (err) {
                console.error("Error setting up Firestore listener:", err);
                setError("Failed to initialize database connection");
                setLoading(false);
                setConnectionStatus(prev => ({ ...prev, isConnected: false }));
            }
        };

        setupListener();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
        };
    }, [isAuthenticated, authChecking, connectionStatus.retryCount, toast]);

    const handleStockUpdate = async (itemId: string, newStock: number) => {
        if (newStock < 0) return;
        
        setIsUpdating(itemId);
        try {
            await updateDoc(doc(db, "menuItems", itemId), { 
                stock: newStock,
                updatedAt: new Date()
            });

            toast({
                title: "Stock updated",
                description: `Stock level updated to ${newStock}`,
            });
        } catch (err) {
            console.error("Stock update error:", err);
            
            let errorMessage = "Failed to update stock";
            if (err instanceof Error) {
                if (err.message.includes('permission-denied')) {
                    errorMessage = "Permission denied. You don't have access to update stock.";
                } else if (err.message.includes('unavailable')) {
                    errorMessage = "Database unavailable. Please try again.";
                }
            }
            
            setError(errorMessage);
            toast({
                title: "Update failed",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsUpdating(null);
        }
    };

    const retryConnection = () => {
        setError(null);
        setLoading(true);
        setConnectionStatus(prev => ({ ...prev, retryCount: 0 }));
        // Trigger useEffect by clearing and resetting connection status
        window.location.reload();
    };

    const filteredItems = useMemo(() => {
        return menuItems.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [menuItems, searchQuery]);

    const lowStockItems = useMemo(() => {
        return filteredItems.filter(item => (item.stock ?? 0) <= 5);
    }, [filteredItems]);

    const outOfStockItems = useMemo(() => {
        return filteredItems.filter(item => (item.stock ?? 0) === 0);
    }, [filteredItems]);

    if (authChecking) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="text-center">
                    <LoadingSpinner />
                    <p className="mt-4 text-muted-foreground">Checking authentication...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Authentication Required</AlertTitle>
                    <AlertDescription>
                        Please log in to access stock management.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold">Drink Stock Management</h2>
                    <div className="flex items-center gap-4 mt-2">
                        <p className="text-sm text-muted-foreground">
                            {menuItems.length} drinks • {lowStockItems.length} low stock • {outOfStockItems.length} out of stock
                        </p>
                        <div className="flex items-center gap-2">
                            {connectionStatus.isConnected ? (
                                <>
                                    <Wifi className="h-4 w-4 text-green-500" />
                                    <span className="text-xs text-green-600">Connected</span>
                                </>
                            ) : (
                                <>
                                    <WifiOff className="h-4 w-4 text-red-500" />
                                    <span className="text-xs text-red-600">Disconnected</span>
                                </>
                            )}
                            {connectionStatus.lastSync && (
                                <span className="text-xs text-muted-foreground">
                                    Last sync: {connectionStatus.lastSync.toLocaleTimeString()}
                                </span>
                            )}
                        </div>
                    </div>
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

            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <LoadingSpinner />
                        <p className="mt-4 text-muted-foreground">Loading drink inventory...</p>
                    </div>
                </div>
            )}
            
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

            {/* Out of Stock Alert */}
            {!loading && !error && outOfStockItems.length > 0 && (
                <Alert variant="destructive" className="mb-6">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Out of Stock Items</AlertTitle>
                    <AlertDescription>
                        {outOfStockItems.length} drink{outOfStockItems.length > 1 ? 's are' : ' is'} completely out of stock: {outOfStockItems.map(item => item.name).join(', ')}
                    </AlertDescription>
                </Alert>
            )}

            {/* Low Stock Warning */}
            {!loading && !error && lowStockItems.length > 0 && outOfStockItems.length !== lowStockItems.length && (
                <Alert className="mb-6 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <AlertTitle className="text-yellow-800 dark:text-yellow-200">Low Stock Warning</AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                        {lowStockItems.length - outOfStockItems.length} drink{lowStockItems.length - outOfStockItems.length > 1 ? 's' : ''} running low (≤5 items)
                    </AlertDescription>
                </Alert>
            )}

            {!loading && !error && (
                <Card>
                    <CardHeader>
                        <CardTitle>Current Stock</CardTitle>
                        <CardDescription>
                            Update stock levels for drinks only. Changes are saved automatically in real-time.
                            {connectionStatus.lastSync && (
                                <span className="block mt-1 text-xs">
                                    Last updated: {connectionStatus.lastSync.toLocaleString()}
                                </span>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredItems.map(item => {
                                const stockLevel = item.stock ?? 0;
                                const isOutOfStock = stockLevel === 0;
                                const isLowStock = stockLevel <= 5 && stockLevel > 0;
                                
                                return (
                                    <div 
                                        key={item.id} 
                                        className={`p-4 bg-card rounded-lg border flex items-center justify-between transition-all ${
                                            isOutOfStock 
                                                ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950' 
                                                : isLowStock
                                                ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950' 
                                                : ''
                                        } ${
                                            isUpdating === item.id ? 'opacity-50' : ''
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">{item.name}</p>
                                            <p className="text-sm text-muted-foreground">{item.category}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {isOutOfStock && (
                                                    <Badge variant="destructive" className="text-xs">
                                                        Out of Stock
                                                    </Badge>
                                                )}
                                                {isLowStock && (
                                                    <Badge variant="destructive" className="text-xs">
                                                        Low Stock
                                                    </Badge>
                                                )}
                                                {item.price && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatCurrency(item.price)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Button 
                                                size="icon" 
                                                variant="outline" 
                                                className="h-8 w-8" 
                                                onClick={() => handleStockUpdate(item.id, Math.max(0, stockLevel - 1))}
                                                disabled={isUpdating === item.id || stockLevel <= 0}
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className={`font-bold text-lg w-12 text-center ${
                                                isOutOfStock ? 'text-red-600 dark:text-red-400' :
                                                isLowStock ? 'text-yellow-600 dark:text-yellow-400' : ''
                                            }`}>
                                                {stockLevel}
                                            </span>
                                            <Button 
                                                size="icon" 
                                                variant="outline" 
                                                className="h-8 w-8" 
                                                onClick={() => handleStockUpdate(item.id, stockLevel + 1)}
                                                disabled={isUpdating === item.id}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {filteredItems.length === 0 && !loading && (
                            <div className="text-center py-12">
                                <div className="text-muted-foreground">
                                    {searchQuery ? (
                                        <>
                                            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p>No drinks match your search "{searchQuery}"</p>
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p>No drinks found in inventory</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default StockView;
