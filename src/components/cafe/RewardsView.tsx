
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CustomerReward } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast.tsx';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, User, UserPlus, PlusCircle, X, Gift, Package, BadgeCheck } from 'lucide-react';
import { EmptyState } from '@/components/shared/ErrorPages';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

const AddCustomerForm = ({ onAdd, isAdding, newCustomerTag, setNewCustomerTag }: {
    onAdd: () => void;
    isAdding: boolean;
    newCustomerTag: string;
    setNewCustomerTag: (tag: string) => void;
}) => (
    <div className="flex flex-col gap-3">
        <Input 
            placeholder="New customer name..." 
            value={newCustomerTag} 
            onChange={e => setNewCustomerTag(e.target.value)} 
            disabled={isAdding} 
        />
        <Button onClick={onAdd} disabled={isAdding || !newCustomerTag.trim()}>
            {isAdding ? <LoadingSpinner/> : "Add Customer"}
        </Button>
    </div>
);

const RewardsView: React.FC = () => {
    const [rewards, setRewards] = useState<CustomerReward[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newCustomerTag, setNewCustomerTag] = useState('');
    const [updatingCustomerId, setUpdatingCustomerId] = useState<string | null>(null);
    const [bagsToAdd, setBagsToAdd] = useState('');
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);


    useEffect(() => {
        const q = query(collection(db, "rewards"), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRewards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerReward)));
            setLoading(false);
        }, (error) => {
            console.error(error);
            setLoading(false);
            toast({ type: 'error', title: 'Error', description: 'Could not load rewards data.' });
        });
        return unsubscribe;
    }, [toast]);

    const handleAddCustomer = async () => {
        if (!newCustomerTag.trim()) return;
        setIsAdding(true);
        try {
            await addDoc(collection(db, 'rewards'), {
                customerTag: newCustomerTag,
                bagCount: 0,
                updatedAt: serverTimestamp(),
            });
            toast({ type: 'success', title: 'Customer Added', description: `${newCustomerTag} can now earn rewards.` });
            setNewCustomerTag('');
            setIsAddSheetOpen(false);
        } catch (e) {
            console.error(e);
            toast({ type: 'error', title: 'Error', description: 'Could not add new customer.' });
        } finally {
            setIsAdding(false);
        }
    };
    
    const handleUpdateBags = async (customerId: string, currentBags: number) => {
        const numBags = parseInt(bagsToAdd, 10);
        if (isNaN(numBags) || numBags <= 0) return;
        
        try {
            await updateDoc(doc(db, 'rewards', customerId), {
                bagCount: currentBags + numBags,
                updatedAt: serverTimestamp(),
            });
            toast({ type: 'success', title: 'Bags Updated', description: `Added ${numBags} bag(s).` });
            setUpdatingCustomerId(null);
            setBagsToAdd('');
        } catch (e) {
            console.error(e);
             toast({ type: 'error', title: 'Error', description: 'Failed to update bag count.' });
        }
    };

    const filteredRewards = useMemo(() => {
        return rewards.filter(r => r.customerTag.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [rewards, searchQuery]);
    
    const renderCustomerList = () => {
        if (loading) return <div className="flex justify-center py-10"><LoadingSpinner/></div>;
        
        if (filteredRewards.length === 0) {
            return (
                <EmptyState 
                  title={searchQuery ? "No Customers Found" : "No Customers in Program"}
                  description={searchQuery ? "No customers match your search." : "Add a customer to get started with the rewards program."} 
                  icon={Gift} 
                />
            );
        }
        
        return (
            <div className="space-y-3">
                {filteredRewards.map(reward => {
                    const discount = Math.floor(reward.bagCount / 5) * 10;
                    const canClaim = discount > 0;
                    
                    return (
                        <div key={reward.id} className="p-4 bg-card rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex-grow">
                                <p className="font-bold text-lg flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground"/> 
                                    {reward.customerTag}
                                </p>
                                <div className="flex items-center gap-4 mt-2">
                                    <Badge variant="secondary" className="text-sm">
                                        <Package className="h-3 w-3 mr-1.5"/>
                                        {reward.bagCount} Bags
                                    </Badge>
                                    <Badge variant={canClaim ? "default" : "outline"} className={`text-sm ${canClaim ? 'bg-green-500 hover:bg-green-500' : ''}`}>
                                        <BadgeCheck className="h-3 w-3 mr-1.5"/>
                                        {formatCurrency(discount)} Discount
                                    </Badge>
                                </div>
                            </div>

                             <Popover onOpenChange={(open) => { if(!open) { setUpdatingCustomerId(null); setBagsToAdd(''); }}}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={() => setUpdatingCustomerId(reward.id)}>
                                        <PlusCircle className="h-4 w-4 mr-2"/> Add Bags
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-60">
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <h4 className="font-medium leading-none">Add Returned Bags</h4>
                                            <p className="text-sm text-muted-foreground">For {reward.customerTag}</p>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor={`bags-${reward.id}`}>Bags to Add</Label>
                                            <Input 
                                                id={`bags-${reward.id}`}
                                                type="number" 
                                                placeholder="e.g., 5" 
                                                value={bagsToAdd} 
                                                onChange={(e) => setBagsToAdd(e.target.value)} 
                                                autoFocus
                                            />
                                            <Button onClick={() => handleUpdateBags(reward.id, reward.bagCount)}>Save</Button>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    );
                })}
            </div>
        );
    }
    
    return (
        <div className="flex h-full flex-col md:flex-row bg-secondary/50 dark:bg-background">
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold">Customer Rewards</h2>
                    {isMobile && (
                        <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
                            <SheetTrigger asChild>
                                <Button size="icon"><UserPlus /></Button>
                            </SheetTrigger>
                            <SheetContent side="bottom" className="h-auto">
                                <SheetHeader>
                                    <SheetTitle className="text-2xl">Add New Customer</SheetTitle>
                                </SheetHeader>
                                <div className="p-4">
                                <AddCustomerForm 
                                    onAdd={handleAddCustomer}
                                    isAdding={isAdding}
                                    newCustomerTag={newCustomerTag}
                                    setNewCustomerTag={setNewCustomerTag}
                                />
                                </div>
                            </SheetContent>
                        </Sheet>
                    )}
                 </div>

                 <Card>
                    <CardHeader>
                        <CardTitle>Rewards Program</CardTitle>
                        <CardDescription>Track customer bag returns. 5 bags = {formatCurrency(10)} discount.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search customers by name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                        </div>
                    </CardContent>
                 </Card>

                 <div className="mt-6">
                    {renderCustomerList()}
                </div>
            </div>

            {!isMobile && (
                 <Card className="w-full md:w-80 lg:w-96 rounded-none border-t md:border-t-0 md:border-l">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><UserPlus/> Add New Customer</CardTitle>
                        <CardDescription>Add a new customer to the rewards program.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AddCustomerForm 
                            onAdd={handleAddCustomer}
                            isAdding={isAdding}
                            newCustomerTag={newCustomerTag}
                            setNewCustomerTag={setNewCustomerTag}
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default RewardsView;
