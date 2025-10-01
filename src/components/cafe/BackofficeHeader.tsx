
"use client";

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bell, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from '../ui/badge';
import { formatDistanceToNow } from 'date-fns';
import type { Order } from '@/lib/types';

const BackofficeHeader = ({ role }: { role: 'manager' | 'cashier' }) => {
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [lastNotificationTime, setLastNotificationTime] = useState<Date | null>(null);

  useEffect(() => {
    // Check network status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    // Subscribe to new online orders
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const q = query(
      collection(db, "orders"),
      where("timestamp", ">", twoMinutesAgo)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let newOrders = 0;
      let shouldNotify = false;
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const order = change.doc.data() as Order;
          if (order.orderType === 'Delivery' || order.orderType === 'Pickup') {
            newOrders++;
            shouldNotify = true;
          }
        }
      });
      
      if (newOrders > 0) {
        setNewOrdersCount(prev => prev + newOrders);
        setLastNotificationTime(new Date());

        if (shouldNotify && Notification.permission === 'granted') {
          new Notification('New Online Order!', {
            body: `${newOrders} new order(s) have been placed online.`,
            icon: '/logo.png',
          });
          
          // Play a sound
          const audio = new Audio('/notification.mp3');
          audio.play().catch(e => console.error("Error playing sound:", e));
        }
      }
    }, (error) => {
        // Firestore error handling
        console.error("Error fetching new orders:", error);
    });

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleNotificationClick = () => {
    setNewOrdersCount(0);
  };
  
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      await Notification.requestPermission();
    }
  };

  return (
    <header className="flex-shrink-0 bg-card border-b p-4 flex justify-between items-center">
      <div>
        <h1 className="text-xl font-bold">Backoffice</h1>
        <p className="text-sm text-muted-foreground capitalize">{role} Panel</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs">
          {isOnline ? (
            <Wifi size={16} className="text-green-500" />
          ) : (
            <WifiOff size={16} className="text-red-500" />
          )}
          <span className={isOnline ? "text-green-600" : "text-red-600"}>
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>

        <Popover onOpenChange={requestNotificationPermission}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="relative" onClick={handleNotificationClick}>
              <Bell />
              {newOrdersCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-6 w-6 justify-center p-0">{newOrdersCount}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
             <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Online Order Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  New orders from the website will appear here.
                </p>
              </div>
              {lastNotificationTime ? (
                  <div className="text-xs text-muted-foreground text-center">
                      Last new order: {formatDistanceToNow(lastNotificationTime, { addSuffix: true })}
                  </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                    No new online orders recently.
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
