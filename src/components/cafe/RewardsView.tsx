"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CustomerReward } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, User, UserPlus, PlusCircle, X, Gift } from 'lucide-react';
import { EmptyState } from '@/components/shared/ErrorPages';

const RewardsView: React.FC = () => {
    const [rewards, setRewards] = useState<CustomerReward[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newCustomerTag, setNewCustomerTag] = useState('');
    const [updatingCustomerId, setUpdatingCustomerId] = useState<string | null>(null);
    const [bagsToAdd, setBagsToAdd] = useState('');
    const { toast } = useToast();

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
            setNewCustomerTag('');
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
    
    return (
        <div className="flex h-full flex-col md:flex-row bg-secondary/50 dark:bg-background">
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                 <h2 className="text-2xl md:text-3xl font-bold mb-4">Customer Rewards</h2>
                 <Card>
                    <CardHeader>
                        <CardTitle>Rewards Program</CardTitle>
                        <CardDescription>Track customer bag returns and available discounts. 5 bags = {formatCurrency(10)} discount.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search customers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                        </div>
                    </CardContent>
                 </Card>

                 <div className="mt-6">
                    {loading ? <div className="flex justify-center py-10"><LoadingSpinner/></div> : filteredRewards.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredRewards.map(reward => {
                                const discount = Math.floor(reward.bagCount / 5) * 10;
                                return (
                                    <Card key={reward.id} className="flex flex-col">
                                        <CardContent className="p-4 flex-grow">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-lg flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground"/> {reward.customerTag}</p>
                                                    <p className="text-sm text-muted-foreground">Bags: {reward.bagCount} | Discount: {formatCurrency(discount)}</p>
                                                </div>
                                                <Button variant="outline" size="icon" onClick={() => setUpdatingCustomerId(reward.id)}>
                                                    <PlusCircle/>
                                                </Button>
                                            </div>
                                        </CardContent>
                                        {updatingCustomerId === reward.id && (
                                            <div className="p-4 border-t flex gap-2">
                                                <Input type="number" placeholder="Bags" value={bagsToAdd} onChange={(e) => setBagsToAdd(e.target.value)} autoFocus/>
                                                <Button onClick={() => handleUpdateBags(reward.id, reward.bagCount)}>Add</Button>
                                                <Button variant="ghost" size="icon" onClick={() => setUpdatingCustomerId(null)}><X/></Button>
                                            </div>
                                        )}
                                    </Card>
                                )
                            })}
                        </div>
                    ) : (
                        <EmptyState 
                          title="No Customers Found" 
                          description={searchQuery ? "No customers match your search." : "Add a customer to get started with the rewards program."} 
                          icon={Gift} 
                        />
                    )}
                </div>
            </div>

            <Card className="w-full md:w-80 lg:w-96 rounded-none border-t md:border-t-0 md:border-l">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><UserPlus/> Add New Customer</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <Input placeholder="New customer name..." value={newCustomerTag} onChange={e => setNewCustomerTag(e.target.value)} disabled={isAdding} />
                    <Button onClick={handleAddCustomer} disabled={isAdding || !newCustomerTag.trim()}>
                        {isAdding ? <LoadingSpinner/> : "Add Customer"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default RewardsView;
