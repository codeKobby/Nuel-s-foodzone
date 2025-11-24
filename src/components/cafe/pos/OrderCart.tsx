import React from 'react';
import { ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { OrderItem } from '@/lib/types';

interface OrderCartProps {
    currentOrder: Record<string, OrderItem>;
    total: number;
    updateQuantity: (itemId: string, amount: number) => void;
    setQuantity: (itemId: string, quantity: number) => void;
    removeItem: (itemId: string) => void;
    onClearOrder: () => void;
    onPlaceOrder: () => void;
    isSheet?: boolean;
}

export const OrderCart: React.FC<OrderCartProps> = ({
    currentOrder,
    total,
    updateQuantity,
    setQuantity,
    removeItem,
    onClearOrder,
    onPlaceOrder,
    isSheet = false
}) => {

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
        const value = e.target.value;
        if (value === '') return;
        const newQuantity = parseInt(value, 10);
        if (!isNaN(newQuantity) && newQuantity >= 1) {
            setQuantity(itemId, newQuantity);
        }
    };

    const handleQuantityBlur = (e: React.FocusEvent<HTMLInputElement>, itemId: string) => {
        const value = e.target.value;
        if (value === '' || parseInt(value, 10) < 1) {
            setQuantity(itemId, 1);
        }
    };

    const CartContent = () => (
        <>
            <div className="flex-grow flex flex-col overflow-hidden">
                {Object.keys(currentOrder).length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center text-muted-foreground p-6">
                        <ShoppingBag size={48} className="mb-4 opacity-20" />
                        <p className="font-medium">Your cart is empty</p>
                        <p className="text-sm opacity-70">Add items to start an order</p>
                    </div>
                ) : (
                    <div className="flex-grow overflow-y-auto px-4 md:px-6">
                        {Object.values(currentOrder).map(item => (
                            <div key={item.id} className="flex items-center justify-between py-3 px-0 border-b last:border-0">
                                <div className="flex flex-col min-w-0 pr-4">
                                    <p className="font-medium text-sm truncate">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">{formatCurrency(item.price)}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="flex items-center border rounded-md bg-background">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 rounded-none rounded-l-md hover:bg-muted"
                                            onClick={() => updateQuantity(item.id, -1)}
                                        >
                                            <Minus size={14} />
                                        </Button>
                                        <Input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleQuantityChange(e, item.id)}
                                            onBlur={(e) => handleQuantityBlur(e, item.id)}
                                            className="w-8 h-7 border-0 p-0 text-center text-sm focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 rounded-none rounded-r-md hover:bg-muted"
                                            onClick={() => updateQuantity(item.id, 1)}
                                        >
                                            <Plus size={14} />
                                        </Button>
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeItem(item.id)}
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className={`mt-auto p-4 md:p-6 bg-background z-10 ${isSheet ? '' : 'border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]'}`}>
                <div className="flex justify-between items-end mb-4">
                    <span className="text-muted-foreground font-medium">Total</span>
                    <span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
                </div>
                <div className="space-y-3">
                    <Button
                        onClick={onPlaceOrder}
                        disabled={Object.keys(currentOrder).length === 0}
                        className="w-full h-14 text-lg font-bold shadow-sm"
                    >
                        Place Order
                    </Button>
                    {Object.keys(currentOrder).length > 0 && (
                        <Button
                            onClick={onClearOrder}
                            variant="ghost"
                            className="w-full text-muted-foreground hover:text-foreground h-auto py-2"
                        >
                            Clear Order
                        </Button>
                    )}
                </div>
            </div>
        </>
    );

    if (isSheet) {
        return <CartContent />;
    }

    return (
        <div className="flex flex-col h-full bg-background">
            <CartContent />
        </div>
    );
};