"use client";

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bell, Wifi, WifiOff, Sun, Moon, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import type { Order } from '@/lib/types';

interface BackofficeHeaderProps {
  role: 'manager' | 'cashier';
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  pendingOrdersCount: number;
  lowStockCount: number;
}

const BackofficeHeader: React.FC<BackofficeHeaderProps> = ({
  role,
  theme,
  onToggleTheme,
  pendingOrdersCount,
  lowStockCount,
}) => {
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [lastNotificationTime, setLastNotificationTime] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const q = query(collection(db, 'orders'), where('timestamp', '>', twoMinutesAgo));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let additions = 0;
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const order = change.doc.data() as Order;
            if (order.orderType === 'Delivery') {
              additions++;
            }
          }
        });

        if (additions > 0) {
          setNewOrdersCount((prev) => prev + additions);
          setLastNotificationTime(new Date());

          if (Notification.permission === 'granted') {
            new Notification('New online order', {
              body: `${additions} incoming delivery ${additions === 1 ? 'ticket' : 'tickets'}.`,
              icon: '/logo.png',
            });
          }
        }
      },
      (error) => {
        console.error('Error fetching notifications:', error);
      }
    );

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const handleNotificationClick = () => setNewOrdersCount(0);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  return (
    <header className="flex flex-col gap-3 border-b bg-card/70 px-4 py-3 text-foreground backdrop-blur md:flex-row md:items-center md:justify-between md:px-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.35em] text-primary">Backoffice</p>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{role === 'manager' ? 'Manager Console' : 'Cashier Console'}</h1>
          <span className="rounded-full bg-muted/50 px-2 py-0.5 text-xs capitalize text-muted-foreground">{role} view</span>
        </div>
        <p className="text-sm text-muted-foreground">Stay in sync with live orders, inventory, and online activity.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span
          className={`flex items-center gap-2 rounded-full px-3 py-1 font-medium ${isOnline ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
            }`}
        >
          {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
          {isOnline ? 'Online' : 'Offline'}
        </span>
        <Button variant="ghost" size="sm" className="gap-2 text-xs" onClick={onToggleTheme}>
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          Toggle theme
        </Button>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span>Pending {pendingOrdersCount}</span>
          <span className="text-muted-foreground/60">•</span>
          <span>Low stock {lowStockCount}</span>
        </div>
        <Popover onOpenChange={requestNotificationPermission}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="relative" onClick={handleNotificationClick}>
              <Bell className="h-4 w-4" />
              {newOrdersCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0 text-[11px]">{newOrdersCount}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <div className="grid gap-3">
              <div>
                <h4 className="font-medium leading-none">Online order notifications</h4>
                <p className="text-sm text-muted-foreground">
                  Delivery and pre-paid orders from the site trigger alerts here.
                </p>
              </div>
              {lastNotificationTime ? (
                <div className="text-xs text-muted-foreground text-center">
                  Last new order {formatDistanceToNow(lastNotificationTime, { addSuffix: true })}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/80 px-3 py-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" /> No new online orders recently
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};

export default BackofficeHeader;
