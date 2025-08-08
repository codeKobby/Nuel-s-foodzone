import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatCurrency = (amount: number) => `GH₵${(amount || 0).toFixed(2)}`;

export const formatTimestamp = (timestamp: any): string => {
  if (!timestamp || !timestamp.toDate) return 'N/A';
  return timestamp.toDate().toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

export const generateSimpleOrderId = (count: number): string => {
  const date = new Date();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const num = (count).toString().padStart(4, '0');
  return `NFZ-${month}${day}-${num}`;
};
