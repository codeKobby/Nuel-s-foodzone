
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isToday, isYesterday, format, formatDistanceToNowStrict } from 'date-fns';
import type { Order, MiscExpense } from './types';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatCurrency = (amount: number) => {
    if (isNaN(amount) || amount === null) {
        return 'GH₵0.00';
    }
    return `GH₵${amount.toFixed(2)}`;
};

export const formatTimestamp = (timestamp: any, timeOnly: boolean = false): string => {
  if (!timestamp || !timestamp.toDate) return 'N/A';
  
  const date = timestamp.toDate();
  
  if (timeOnly) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  const now = new Date();
  
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  if (date >= startOfToday) {
    return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  }
  if (date >= startOfYesterday) {
    return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  }
  return date.toLocaleString('en-US', {
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

export const groupOrdersByDate = <T extends Order | MiscExpense>(items: T[]): Record<string, T[]> => {
    const grouped: Record<string, T[]> = {};

    items.forEach(item => {
        if (!item.timestamp) return;
        const itemDate = item.timestamp.toDate();
        let key: string;

        if (isToday(itemDate)) {
            key = 'Today';
        } else if (isYesterday(itemDate)) {
            key = 'Yesterday';
        } else {
            const distance = formatDistanceToNowStrict(itemDate, { addSuffix: true });
             if (distance.includes('day') && (parseInt(distance.split(' ')[0]) <= 6)) {
                 key = format(itemDate, 'EEEE, LLL d'); // E.g., Wednesday, Aug 7
            } else {
                key = format(itemDate, 'LLL d, yyyy'); // E.g., Aug 7, 2024
            }
        }
        
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(item);
    });

    return grouped;
};
