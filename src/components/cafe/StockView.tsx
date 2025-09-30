
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Search, RefreshCw, Wifi, WifiOff, AlertTriangle, Package, 
  CheckCircle2, Edit3, Bell, BellOff, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import type { MenuItem } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

const LOW_STOCK_THRESHOLD = 5;

// Request notification permission on mount
const requestNotificationPermission = async () => {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

// Send browser notification
const sendNotification = (title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      // You can add an icon if you have one in your public folder
      // icon: '/logo.png',
    });
  }
};

const StockLevelIndicator: React.FC<{ stock: number }> = ({ stock }) => {
  const isOutOfStock = stock === 0;
  const isLowStock = stock > 0 && stock <= LOW_STOCK_THRESHOLD;
  const percentage = Math.min((stock / 20) * 100, 100); // Visual scale for progress bar
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Current stock</span>
        <span className={`font-semibold ${
          isOutOfStock ? 'text-red-600' : 
          isLowStock ? 'text-yellow-600' : 
          'text-green-600'
        }`}>
          {stock} {stock === 1 ? 'unit' : 'units'}
        </span>
      </div>
      <Progress 
        value={percentage} 
        className={`h-2 ${
          isOutOfStock ? '[&>div]:bg-red-500' : 
          isLowStock ? '[&>div]:bg-yellow-500' : 
          '[&>div]:bg-green-500'
        }`}
      />
    </div>
  );
};

const UpdateStockDialog: React.FC<{ item: MenuItem, onSave: (itemId: string, newStock: number) => Promise<void>, onClose: () => void }> = ({ item, onSave, onClose }) => {
  const [newStock, setNewStock] = useState(item?.stock?.toString() || '0');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const stockValue = parseInt(newStock);
    if (isNaN(stockValue) || stockValue < 0) return;
    
    setIsSaving(true);
    await onSave(item.id, stockValue);
    setIsSaving(false);
    onClose();
  };

  const handleQuickSet = (value: number) => {
    setNewStock(value.toString());
  };

  if (!item) return null;

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Update Stock Count</DialogTitle>
        <DialogDescription>
          Update the current stock count for {item.name} based on your fridge count
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Current Stock</Label>
            <span className="text-2xl font-bold text-muted-foreground">{item.stock}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-stock">New Stock Count</Label>
          <Input
            id="new-stock"
            type="number"
            min="0"
            placeholder="Enter counted stock"
            value={newStock}
            onChange={(e) => setNewStock(e.target.value)}
            autoFocus
            className="text-xl font-semibold"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Quick Set</Label>
          <div className="grid grid-cols-5 gap-2">
            {[0, 5, 10, 15, 20].map(value => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                onClick={() => handleQuickSet(value)}
                className="h-10"
              >
                {value}
              </Button>
            ))}
          </div>
        </div>

        {newStock && (
          <Alert className={
            parseInt(newStock) === 0 ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' :
            parseInt(newStock) <= LOW_STOCK_THRESHOLD ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800' :
            'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
          }>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {parseInt(newStock) === 0 ? (
                <span className="font-medium text-red-800 dark:text-red-200">
                  ⚠️ Item will be marked as out of stock
                </span>
              ) : parseInt(newStock) <= LOW_STOCK_THRESHOLD ? (
                <span className="font-medium text-yellow-800 dark:text-yellow-200">
                  ⚠️ This is below the low stock threshold ({LOW_STOCK_THRESHOLD})
                </span>
              ) : (
                <span className="font-medium text-green-800 dark:text-green-200">
                  ✓ Stock level is healthy
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={!newStock || isSaving}
        >
          {isSaving ? <LoadingSpinner /> : 'Update Stock'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

const StockItemCard: React.FC<{ item: MenuItem, onUpdate: (itemId: string, newStock: number) => Promise<void>, isUpdating: boolean }> = ({ item, onUpdate, isUpdating }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const stockLevel = item.stock ?? 0;
  const isOutOfStock = stockLevel === 0;
  const isLowStock = stockLevel > 0 && stockLevel <= LOW_STOCK_THRESHOLD;

  return (
    <>
      <Card className={`transition-all hover:shadow-md ${
        isOutOfStock ? 'border-red-300 bg-red-50/50 dark:border-red-700 dark:bg-red-950/30' :
        isLowStock ? 'border-yellow-300 bg-yellow-50/50 dark:border-yellow-700 dark:bg-yellow-950/30' :
        'hover:border-primary/50'
      } ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate mb-2">{item.name}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {isOutOfStock ? (
                  <Badge variant="destructive" className="text-xs font-medium">
                    <AlertTriangle className="h-3 w-3 mr-1"/>
                    Out of Stock
                  </Badge>
                ) : isLowStock ? (
                  <Badge className="text-xs font-medium bg-yellow-500 hover:bg-yellow-600">
                    <AlertCircle className="h-3 w-3 mr-1"/>
                    Low Stock
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1"/>
                    In Stock
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <StockLevelIndicator stock={stockLevel} />

          <div className="mt-4">
            <Button 
              size="sm" 
              variant={isLowStock || isOutOfStock ? "default" : "outline"}
              className="w-full"
              onClick={() => setIsDialogOpen(true)}
            >
              <Edit3 className="h-3.5 w-3.5 mr-2"/>
              Update Count
            </Button>
          </div>

          {isUpdating && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
              <LoadingSpinner />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <UpdateStockDialog
          item={item}
          onSave={onUpdate}
          onClose={() => setIsDialogOpen(false)}
        />
      </Dialog>
    </>
  );
};

const StatsCard: React.FC<{ icon: React.ElementType, label: string, value: number | string, color?: string, alert?: boolean }> = ({ icon: Icon, label, value, color = "text-primary", alert }) => (
  <Card className={alert ? 'border-2' : ''}>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg bg-secondary ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const StockView = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [filterView, setFilterView] = useState('all');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    lastSync: new Date(),
  });
  const [previousStats, setPreviousStats] = useState<{ outOfStock: number; lowStock: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    requestNotificationPermission();

    const q = query(collection(db, "menuItems"), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
        setMenuItems(items);
        setConnectionStatus({ isConnected: true, lastSync: new Date() });
        setLoading(false);
    }, (error) => {
        console.error("Error fetching stock:", error);
        toast({
            title: "Connection Error",
            description: "Could not sync stock data from the database.",
            type: "error"
        });
        setConnectionStatus(prev => ({ ...prev, isConnected: false }));
        setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const handleStockUpdate = async (itemId: string, newStock: number) => {
    setUpdatingItemId(itemId);
    
    const item = menuItems.find(i => i.id === itemId);
    if (!item) {
        setUpdatingItemId(null);
        return;
    }
    const oldStock = item.stock || 0;
    
    try {
        await updateDoc(doc(db, "menuItems", itemId), { stock: newStock });
        toast({
            title: "Stock Updated",
            description: `${item.name} stock is now ${newStock}.`,
            type: 'success'
        });

        if (notificationsEnabled) {
          if (newStock === 0 && oldStock > 0) {
            sendNotification(
              '🔴 Out of Stock Alert',
              `${item.name} is now out of stock in the fridge!`
            );
          } else if (newStock <= LOW_STOCK_THRESHOLD && newStock > 0 && oldStock > LOW_STOCK_THRESHOLD) {
            sendNotification(
              '🟡 Low Stock Alert',
              `${item.name} is running low (${newStock} left). Time to restock!'`
            );
          }
        }
    } catch (error) {
        console.error("Error updating stock:", error);
        toast({
            title: "Update Failed",
            description: `Could not update stock for ${item.name}.`,
            type: "error"
        });
    } finally {
        setUpdatingItemId(null);
    }
  };

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        sendNotification('Notifications Enabled', 'You\'ll now receive stock alerts');
        toast({ title: 'Alerts Enabled', description: 'You will now receive stock notifications.', type: 'success' });
      } else {
        toast({ title: 'Alerts Blocked', description: 'Please enable notifications in your browser settings.', type: 'error' });
      }
    } else {
      setNotificationsEnabled(false);
      toast({ title: 'Alerts Disabled', type: 'info' });
    }
  };

  const drinkItems = useMemo(() => menuItems.filter(item => item.category === 'Drinks' || item.category === 'Breakfast Drinks'), [menuItems]);

  const stats = useMemo(() => {
    const total = drinkItems.length;
    const outOfStock = drinkItems.filter(i => (i.stock ?? 0) === 0).length;
    const lowStock = drinkItems.filter(i => (i.stock ?? 0) > 0 && (i.stock ?? 0) <= LOW_STOCK_THRESHOLD).length;
    const inStock = drinkItems.filter(i => (i.stock ?? 0) > LOW_STOCK_THRESHOLD).length;

    return { total, outOfStock, lowStock, inStock };
  }, [drinkItems]);

  useEffect(() => {
    if (previousStats && notificationsEnabled) {
      if (stats.outOfStock > previousStats.outOfStock) {
        const diff = stats.outOfStock - previousStats.outOfStock;
        sendNotification(
          '🔴 Stock Alert',
          `${diff} item${diff > 1 ? 's have' : ' has'} run out of stock!`
        );
      }
      if (stats.lowStock > previousStats.lowStock) {
        const diff = stats.lowStock - previousStats.lowStock;
        sendNotification(
          '🟡 Low Stock Alert',
          `${diff} item${diff > 1 ? 's are' : ' is'} now running low!`
        );
      }
    }
    setPreviousStats(stats);
  }, [stats.outOfStock, stats.lowStock, notificationsEnabled, previousStats]);

  const filteredItems = useMemo(() => {
    let filtered = drinkItems.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filterView === 'low') {
      filtered = filtered.filter(item => 
        (item.stock ?? 0) > 0 && (item.stock ?? 0) <= LOW_STOCK_THRESHOLD
      );
    } else if (filterView === 'out') {
      filtered = filtered.filter(item => (item.stock ?? 0) === 0);
    }

    return filtered.sort((a, b) => {
      const stockA = a.stock ?? 0;
      const stockB = b.stock ?? 0;
      if (stockA === 0 && stockB !== 0) return -1;
      if (stockA !== 0 && stockB === 0) return 1;
      if (stockA <= LOW_STOCK_THRESHOLD && stockB > LOW_STOCK_THRESHOLD) return -1;
      if (stockA > LOW_STOCK_THRESHOLD && stockB <= LOW_STOCK_THRESHOLD) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [drinkItems, searchQuery, filterView]);

  return (
    <div className="bg-background p-4 md:p-6 h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Fridge Stock Monitor</h1>
            <div className="flex items-center gap-4 flex-wrap">
              <p className="text-muted-foreground">
                Real-time drink inventory tracking
              </p>
              <div className="flex items-center gap-2">
                {connectionStatus.isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Live • {connectionStatus.lastSync.toLocaleTimeString()}
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <span className="text-xs text-red-600">Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
              {notificationsEnabled ? (
                <Bell className="h-4 w-4 text-primary" />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Alerts</span>
              <Switch 
                checked={notificationsEnabled}
                onCheckedChange={toggleNotifications}
              />
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            icon={Package}
            label="Total Drinks"
            value={stats.total}
            color="text-blue-600"
          />
          <StatsCard
            icon={CheckCircle2}
            label="Well Stocked"
            value={stats.inStock}
            color="text-green-600"
          />
          <StatsCard
            icon={AlertCircle}
            label="Low Stock"
            value={stats.lowStock}
            color="text-yellow-600"
            alert={stats.lowStock > 0}
          />
          <StatsCard
            icon={AlertTriangle}
            label="Out of Stock"
            value={stats.outOfStock}
            color="text-red-600"
            alert={stats.outOfStock > 0}
          />
        </div>

        {/* Alerts */}
        {stats.outOfStock > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Critical: Items Out of Stock</AlertTitle>
            <AlertDescription>
              {stats.outOfStock} drink{stats.outOfStock > 1 ? 's are' : ' is'} completely out of stock. Restock or prepare a new batch immediately!
            </AlertDescription>
          </Alert>
        )}

        {stats.lowStock > 0 && stats.outOfStock === 0 && (
          <Alert className="border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-200">Warning: Low Stock Items</AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              {stats.lowStock} drink{stats.lowStock > 1 ? 's are' : ' is'} running low (≤{LOW_STOCK_THRESHOLD} units). Plan to restock soon.
            </AlertDescription>
          </Alert>
        )}

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search drinks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Tabs value={filterView} onValueChange={setFilterView}>
                <TabsList>
                  <TabsTrigger value="all">
                    All ({stats.total})
                  </TabsTrigger>
                  <TabsTrigger value="low" className="text-yellow-700 dark:text-yellow-400 data-[state=active]:text-yellow-900 dark:data-[state=active]:text-yellow-200">
                    Low ({stats.lowStock})
                  </TabsTrigger>
                  <TabsTrigger value="out" className="text-red-700 dark:text-red-400 data-[state=active]:text-red-900 dark:data-[state=active]:text-red-200">
                    Out ({stats.outOfStock})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Stock Items Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <LoadingSpinner />
              <p className="mt-4 text-muted-foreground">Loading fridge inventory...</p>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No drinks found</h3>
              <p className="text-muted-foreground">
                {searchQuery 
                  ? "No drinks match your search"
                  : "No drinks match the selected filter"
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map(item => (
              <StockItemCard
                key={item.id}
                item={item}
                onUpdate={handleStockUpdate}
                isUpdating={updatingItemId === item.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockView;
