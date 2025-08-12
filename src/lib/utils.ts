
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isToday, isYesterday, format, formatDistanceToNowStrict } from 'date-fns';
import type { Order } from './types';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatCurrency = (amount: number) => {
    if (isNaN(amount)) {
        return 'GH₵0.00';
    }
    return `GH₵${(amount || 0).toFixed(2)}`;
};

export const formatTimestamp = (timestamp: any): string => {
  if (!timestamp || !timestamp.toDate) return 'N/A';
  
  const orderDate = timestamp.toDate();
  const now = new Date();
  
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  if (orderDate >= startOfToday) {
    return `Today, ${orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  }
  if (orderDate >= startOfYesterday) {
    return `Yesterday, ${orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  }
  return orderDate.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });
};


export const generateSimpleOrderId = (count: number): string => {
  const date = new Date();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const num = (count).toString().padStart(4, '0');
  return `NFZ-${month}${day}-${num}`;
};

export const groupOrdersByDate = (orders: Order[]): Record<string, Order[]> => {
    const grouped: Record<string, Order[]> = {};

    orders.forEach(order => {
        const orderDate = order.timestamp.toDate();
        let key: string;

        if (isToday(orderDate)) {
            key = 'Today';
        } else if (isYesterday(orderDate)) {
            key = 'Yesterday';
        } else {
            const distance = formatDistanceToNowStrict(orderDate, { addSuffix: true });
            if (distance.includes('day')) {
                 key = format(orderDate, 'EEEE, LLL d'); // E.g., Wednesday, Aug 7
            } else {
                key = format(orderDate, 'LLL d, yyyy'); // E.g., Aug 7, 2024
            }
        }
        
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(order);
    });

    return grouped;
};

    