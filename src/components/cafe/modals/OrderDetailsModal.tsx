
"use client";

import React, { useRef } from 'react';
import type { Order } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Pencil } from 'lucide-react';
import Image from 'next/image';
import logo from '@/app/logo.png';

interface OrderDetailsModalProps {
    order: Order;
    onClose: () => void;
    onEdit: (order: Order) => void;
}

const Receipt = React.forwardRef<HTMLDivElement, { order: Order }>(({ order }, ref) => {
    const isBalanceOwedByCustomer = order.paymentStatus === 'Partially Paid' && order.total > order.amountPaid;
    const isChangeOwedToCustomer = order.paymentMethod === 'cash' && order.balanceDue > 0 && order.amountPaid >= order.total;

    return (
        <div ref={ref} className="receipt p-4 bg-white text-black font-mono">
            <div className="text-center">
                <Image src={logo} alt="Logo" width={60} height={60} className="mx-auto rounded-md" />
                <h3 className="font-bold">Nuel's Food Zone</h3>
            </div>
            <hr className="my-2 border-dashed border-black" />
            <p><strong>Order:</strong> {order.simplifiedId}</p>
            <p><strong>Date:</strong> {new Date(order.timestamp.seconds * 1000).toLocaleString()}</p>
            <p><strong>Type:</strong> {order.orderType}</p>
            {order.tag && <p><strong>Tag:</strong> {order.tag}</p>}
            <hr className="my-2 border-dashed border-black" />
            <table className="w-full text-sm">
                <thead>
                    <tr>
                        <th className="text-left">Item</th>
                        <th className="text-center">Qty</th>
                        <th className="text-right">Price</th>
                    </tr>
                </thead>
                <tbody>
                    {order.items.map((item, i) => (
                        <tr key={i}>
                            <td>{item.name}</td>
                            <td className="text-center">{item.quantity}</td>
                            <td className="text-right">{formatCurrency(item.price * item.quantity)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <hr className="my-2 border-dashed border-black" />
            <p className="text-right font-bold">Total: {formatCurrency(order.total)}</p>
            <p className="text-right">Paid ({order.paymentMethod}): {formatCurrency(order.amountPaid)}</p>
            {isBalanceOwedByCustomer && <p className="text-right font-bold">Balance Due: {formatCurrency(order.balanceDue)}</p>}
            <p className="text-right">Change Given: {formatCurrency(order.changeGiven)}</p>
            {isChangeOwedToCustomer && <p className="text-right font-bold text-red-600">Change Owed: {formatCurrency(order.balanceDue)}</p>}
             {(order.creditSource && order.creditSource.length > 0) && (
                <p className="text-right text-xs">Credit from: {order.creditSource.join(', ')}</p>
            )}
            <hr className="my-2 border-dashed border-black" />
            <p className="text-center">Thank you!</p>
        </div>
    );
});
Receipt.displayName = "Receipt";

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, onClose, onEdit }) => {
    const receiptRef = useRef<HTMLDivElement>(null);
    const handlePrint = () => {
        const printContents = receiptRef.current?.innerHTML;
        if (!printContents) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Print Receipt</title>
                    <style>
                        body { font-family: monospace; margin: 0; }
                        .receipt { padding: 1rem; color: black; background: white; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .text-red-600 { color: #dc2626; }
                        hr { border: none; border-top: 1px dashed black; margin: 0.5rem 0; }
                        table { width: 100%; font-size: 0.875rem; border-collapse: collapse; }
                        th, td { padding: 2px 0; } .text-left { text-align: left; } .text-right { text-align: right; }
                        img { max-width: 60px; margin: 0 auto; border-radius: 0.375rem; }
                    </style>
                </head>
                <body>
                    ${printContents}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const handleEdit = () => {
        onEdit(order);
        onClose();
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Order Details - {order.simplifiedId}</DialogTitle>
                    <DialogDescription>
                        A printable receipt and summary of the order.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto my-4 rounded-lg border">
                    <Receipt order={order} ref={receiptRef} />
                </div>
                <DialogFooter className="sm:justify-between gap-2">
                     {order.status === 'Pending' && (
                        <Button onClick={handleEdit} variant="secondary">
                            <Pencil size={18} className="mr-2"/>
                            Edit Order
                        </Button>
                    )}
                    <Button onClick={handlePrint} className="flex-grow">
                        <Printer size={18} className="mr-2" />
                        Print Receipt
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default OrderDetailsModal;
