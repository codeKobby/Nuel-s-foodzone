
"use client";

import React, { useState, useMemo } from 'react';
import type { MenuItem } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from '@/lib/utils';

interface CustomOrderModalProps {
    menuItems: MenuItem[];
    onAddItem: (item: { name: string; price: number }) => void;
    onClose: () => void;
}

const CustomOrderModal: React.FC<CustomOrderModalProps> = ({ menuItems, onAddItem, onClose }) => {
    const [customName, setCustomName] = useState('');
    const [customPrice, setCustomPrice] = useState('');
    const [selectedItemId, setSelectedItemId] = useState<string | undefined>(undefined);
    const [overridePrice, setOverridePrice] = useState('');

    const selectedItem = useMemo(() => {
        return menuItems.find(item => item.id === selectedItemId);
    }, [selectedItemId, menuItems]);

    const handleAddCustomItem = () => {
        if (customName && customPrice) {
            onAddItem({ name: customName, price: parseFloat(customPrice) });
        }
    };

    const handleAddOverrideItem = () => {
        if (selectedItem && overridePrice) {
            onAddItem({
                name: `${selectedItem.name} (Custom)`,
                price: parseFloat(overridePrice)
            });
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create Custom Order</DialogTitle>
                    <DialogDescription>
                        Add a new item or override the price of an existing one.
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="custom" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="custom">New Item</TabsTrigger>
                        <TabsTrigger value="override">Override Price</TabsTrigger>
                    </TabsList>
                    <TabsContent value="custom" className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="custom-name">Item Name</Label>
                            <Input
                                id="custom-name"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                placeholder="e.g., Extra Gizzard"
                            />
                        </div>
                        <div>
                            <Label htmlFor="custom-price">Price</Label>
                            <Input
                                id="custom-price"
                                type="number"
                                value={customPrice}
                                onChange={(e) => setCustomPrice(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddCustomItem} disabled={!customName || !customPrice}>Add Custom Item</Button>
                        </DialogFooter>
                    </TabsContent>
                    <TabsContent value="override" className="space-y-4 py-4">
                        <div>
                            <Label>Select Item to Override</Label>
                            <Select onValueChange={setSelectedItemId} value={selectedItemId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an item" />
                                </SelectTrigger>
                                <SelectContent>
                                    {menuItems.map(item => (
                                        <SelectItem key={item.id} value={item.id}>
                                            {item.name} - {formatCurrency(item.price)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="override-price">New Price</Label>
                            <Input
                                id="override-price"
                                type="number"
                                value={overridePrice}
                                onChange={(e) => setOverridePrice(e.target.value)}
                                placeholder={selectedItem ? formatCurrency(selectedItem.price) : "0.00"}
                                disabled={!selectedItem}
                            />
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddOverrideItem} disabled={!selectedItem || !overridePrice}>Add Overridden Item</Button>
                        </DialogFooter>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default CustomOrderModal;

    