"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button";

interface BreakfastModalProps {
    onSelect: (drink: string) => void;
    onClose: () => void;
}

const BreakfastModal: React.FC<BreakfastModalProps> = ({ onSelect, onClose }) => {
    const drinks = ['Oat', 'Tea', 'Rice Porridge', 'Tom Brown', 'Milo', 'Coffee'];
    
    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center">Choose a Drink</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 pt-4">
                    {drinks.map(drink => (
                        <Button 
                            key={drink} 
                            onClick={() => onSelect(drink)} 
                            variant="secondary"
                            className="h-16 text-lg"
                        >
                            {drink}
                        </Button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default BreakfastModal;
