
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CustomerReward } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, UserPlus, PlusCircle, Gift, Package, BadgeCheck, Trophy, TrendingUp, Clock, CheckCircle2, History } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const AddCustomerForm = ({ onAdd, isAdding, newCustomerName, setNewCustomerName, newCustomerPhone, setNewCustomerPhone, initialBags, setInitialBags }: {
    onAdd: () => void;
    isAdding: boolean;
    newCustomerName: string;
    setNewCustomerName: (name: string) => void;
    newCustomerPhone: string;
    setNewCustomerPhone: (phone: string) => void;
    initialBags: string;
    setInitialBags: (bags: string) => void;
}) => (
    <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="customer-name">Customer Name *</Label>
            <Input
                id="customer-name"
                placeholder="Enter customer name"
                value={newCustomerName}
                onChange={e => setNewCustomerName(e.target.value)}
                disabled={isAdding}
            />
        </div>
        <div className="space-y-2">
            <Label htmlFor="customer-phone">Phone Number (Optional)</Label>
            <Input
                id="customer-phone"
                placeholder="+233 XX XXX XXXX"
                value={newCustomerPhone}
                onChange={e => setNewCustomerPhone(e.target.value)}
                disabled={isAdding}
            />
        </div>
        <div className="space-y-2">
            <Label htmlFor="initial-bags">Initial Bag Quantity (Optional)</Label>
            <Input
                id="initial-bags"
                type="number"
                placeholder="e.g., 5"
                value={initialBags}
                onChange={e => setInitialBags(e.target.value)}
                disabled={isAdding}
            />
        </div>
        <Button onClick={onAdd} disabled={isAdding || !newCustomerName.trim()} className="w-full">
            {isAdding ? <LoadingSpinner /> : <>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Customer
            </>}
        </Button>
    </div>
);

const RewardProgressBar = ({ bagCount, showLabel = true }: { bagCount: number, showLabel?: boolean }) => {
    const progress = (bagCount % 5) * 20;
    const remainingBags = 5 - (bagCount % 5);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress to next reward</span>
                <span>{remainingBags === 5 ? '5' : remainingBags} bags to go</span>
            </div>
            <Progress value={progress} className="h-2" />
            {showLabel && (
                <div className="text-xs text-center text-muted-foreground">
                    {bagCount % 5}/5 bags
                </div>
            )}
        </div>
    );
};

const CustomerCard = ({ reward, onAddBags, onRedeemDiscount, updatingCustomerId, bagsToAdd, setBagsToAdd }: {
    reward: CustomerReward;
    onAddBags: (customerId: string, currentBags: number) => void;
    onRedeemDiscount: (customerId: string, discount: number) => void;
    updatingCustomerId: string | null;
    bagsToAdd: string;
    setBagsToAdd: (bags: string) => void;
}) => {
    const discount = Math.floor(reward.bagCount / 5) * 10;
    const canClaim = discount > 0;
    const completedRewards = Math.floor(reward.bagCount / 5);

    return (
        <Card className="hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-4 md:p-6">
                <div className="flex items-start justify-between mb-3 md:mb-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                            <h3 className="font-semibold text-base md:text-lg truncate">{reward.customerTag}</h3>
                            {completedRewards > 0 && (
                                <Badge variant="secondary" className="ml-1 flex-shrink-0 text-xs">
                                    <Trophy className="h-3 w-3 mr-1" />
                                    {completedRewards}x
                                </Badge>
                            )}
                        </div>
                        {reward.phone && (
                            <p className="text-xs md:text-sm text-muted-foreground mb-2 truncate">{reward.phone}</p>
                        )}
                        <div className="flex items-center gap-2 md:gap-4 mb-2 md:mb-3 flex-wrap">
                            <div className="flex items-center gap-1 md:gap-1.5">
                                <Package className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs md:text-sm font-medium">{reward.bagCount} bags</span>
                            </div>
                            <div className="flex items-center gap-1 md:gap-1.5">
                                <Clock className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs md:text-sm text-muted-foreground">
                                    {reward.joinedDate ? reward.joinedDate.toDate().toLocaleDateString() : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-3 md:mb-4">
                    <RewardProgressBar bagCount={reward.bagCount} />
                </div>

                {canClaim && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Gift className="h-5 w-5 text-green-600" />
                                <span className="font-medium text-green-800 dark:text-green-200">
                                    {formatCurrency(discount)} discount available!
                                </span>
                            </div>
                            <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => onRedeemDiscount(reward.id, 10)} // Redeem in 10 GHS increments
                            >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Redeem
                            </Button>
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="flex-1">
                                <PlusCircle className="h-4 w-4 mr-2" />
                                Add Bags
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-medium mb-2">Record Returned Bags</h4>
                                    <p className="text-sm text-muted-foreground">For {reward.customerTag}</p>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <Label htmlFor={`bags-${reward.id}`}>Number of bags returned</Label>
                                        <Input
                                            id={`bags-${reward.id}`}
                                            type="number"
                                            placeholder="e.g., 3"
                                            value={bagsToAdd}
                                            onChange={(e) => setBagsToAdd(e.target.value)}
                                            autoFocus
                                            min="1"
                                            disabled={updatingCustomerId === reward.id}
                                            className="mt-1"
                                        />
                                    </div>
                                    <Button
                                        onClick={() => onAddBags(reward.id, reward.bagCount)}
                                        disabled={updatingCustomerId === reward.id || !bagsToAdd}
                                        className="w-full"
                                    >
                                        {updatingCustomerId === reward.id ? <LoadingSpinner /> : 'Record Return'}
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <History className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Customer History - {reward.customerTag}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/50 rounded-lg">
                                    <div>
                                        <p className="text-sm font-medium">Total Bags Returned</p>
                                        <p className="text-2xl font-bold">{reward.bagCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Total Discounts Redeemed</p>
                                        <p className="text-2xl font-bold">{formatCurrency(reward.totalRedeemed)}</p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-medium mb-2">Recent Activity</h4>
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p>Note: Detailed activity history is coming soon.</p>
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardContent>
        </Card>
    );
};

const StatsCards = ({ rewards }: { rewards: CustomerReward[] }) => {
    const totalCustomers = rewards.length;
    const totalBags = rewards.reduce((sum, r) => sum + r.bagCount, 0);
    const totalPendingDiscounts = rewards.reduce((sum, r) => sum + Math.floor(r.bagCount / 5) * 10, 0);
    const totalRedeemed = rewards.reduce((sum, r) => sum + r.totalRedeemed, 0);

    const stats = [
        { label: 'Total Customers', value: totalCustomers, icon: User, color: 'text-blue-600' },
        { label: 'Bags Returned', value: totalBags, icon: Package, color: 'text-green-600' },
        { label: 'Pending Discounts', value: formatCurrency(totalPendingDiscounts), icon: Gift, color: 'text-orange-600' },
        { label: 'Total Redeemed', value: formatCurrency(totalRedeemed), icon: TrendingUp, color: 'text-purple-600' },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
            {stats.map((stat, index) => (
                <Card key={index}>
                    <CardContent className="p-3 md:p-4">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className={`p-1.5 md:p-2 rounded-full bg-secondary ${stat.color} flex-shrink-0`}>
                                <stat.icon className="h-3 w-3 md:h-4 md:w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-lg md:text-2xl font-bold truncate">{stat.value}</p>
                                <p className="text-[10px] md:text-xs text-muted-foreground truncate">{stat.label}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

const RewardsView = () => {
    const [rewards, setRewards] = useState<CustomerReward[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');
    const [initialBags, setInitialBags] = useState('');
    const [updatingCustomerId, setUpdatingCustomerId] = useState<string | null>(null);
    const [bagsToAdd, setBagsToAdd] = useState('');
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        setLoading(true);
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
        if (!newCustomerName.trim()) return;
        setIsAddingCustomer(true);
        const initialBagCount = parseInt(initialBags, 10) || 0;

        try {
            await addDoc(collection(db, 'rewards'), {
                customerTag: newCustomerName,
                phone: newCustomerPhone,
                bagCount: initialBagCount,
                totalRedeemed: 0,
                joinedDate: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            toast({ title: 'Customer Added', description: `${newCustomerName} has been added with ${initialBagCount} bags.` });
            setNewCustomerName('');
            setNewCustomerPhone('');
            setInitialBags('');
            setIsAddSheetOpen(false);
        } catch (e) {
            console.error(e);
            toast({ type: 'error', title: 'Error', description: 'Could not add new customer.' });
        } finally {
            setIsAddingCustomer(false);
        }
    };

    const handleAddBags = async (customerId: string, currentBags: number) => {
        const numBags = parseInt(bagsToAdd, 10);
        if (isNaN(numBags) || numBags <= 0) {
            toast({ type: 'error', title: 'Invalid number', description: 'Please enter a valid number of bags.' });
            return;
        };

        setUpdatingCustomerId(customerId);
        try {
            await updateDoc(doc(db, 'rewards', customerId), {
                bagCount: currentBags + numBags,
                updatedAt: serverTimestamp(),
            });
            toast({ title: 'Bags Updated', description: `Added ${numBags} bag(s).` });
            setBagsToAdd('');
        } catch (e) {
            console.error(e);
            toast({ type: 'error', title: 'Error', description: 'Failed to update bag count.' });
        } finally {
            setUpdatingCustomerId(null);
        }
    };

    const handleRedeemDiscount = async (customerId: string, discountAmount: number) => {
        const bagsToRedeem = 5; // Fixed at 5 bags for a 10 GHS discount.

        try {
            await runTransaction(db, async (transaction) => {
                const customerRef = doc(db, 'rewards', customerId);
                const customerDoc = await transaction.get(customerRef);
                if (!customerDoc.exists()) {
                    throw new Error("Customer not found");
                }
                const currentData = customerDoc.data() as CustomerReward;

                if (currentData.bagCount < bagsToRedeem) {
                    throw new Error("Not enough bags to redeem this discount.");
                }

                transaction.update(customerRef, {
                    bagCount: currentData.bagCount - bagsToRedeem,
                    totalRedeemed: (currentData.totalRedeemed || 0) + discountAmount,
                    updatedAt: serverTimestamp()
                });
            });
            toast({ title: 'Discount Marked as Redeemed', description: 'The customer\'s bag count has been updated.' });
        } catch (e) {
            console.error(e);
            toast({ type: 'error', title: 'Redemption Failed', description: e instanceof Error ? e.message : 'An unknown error occurred.' });
        }
    };

    const filteredRewards = useMemo(() => {
        let filtered = rewards.filter(r =>
            r.customerTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.phone && r.phone.includes(searchQuery))
        );

        if (activeTab === 'eligible') {
            filtered = filtered.filter(r => Math.floor(r.bagCount / 5) > 0);
        }

        return filtered.sort((a, b) => {
            if (activeTab === 'eligible') {
                const aDiscount = Math.floor(a.bagCount / 5);
                const bDiscount = Math.floor(b.bagCount / 5);
                if (bDiscount !== aDiscount) return bDiscount - aDiscount;
            }
            return b.bagCount - a.bagCount;
        });
    }, [rewards, searchQuery, activeTab]);

    const eligibleCustomersCount = useMemo(() => rewards.filter(r => Math.floor(r.bagCount / 5) > 0).length, [rewards]);

    return (
        <div className="h-full overflow-y-auto overflow-x-hidden bg-background p-3 md:p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 mb-4 md:mb-6">
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold truncate">Customer Rewards</h1>
                        <p className="text-sm md:text-base text-muted-foreground">
                            Track bag returns • 5 bags = {formatCurrency(10)} discount
                        </p>
                    </div>

                    <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
                        <SheetTrigger asChild>
                            <Button className="flex-shrink-0">
                                <UserPlus className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Add Customer</span>
                                <span className="sm:hidden">Add</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                            <SheetHeader>
                                <SheetTitle>Add New Customer</SheetTitle>
                            </SheetHeader>
                            <div className="mt-6">
                                <AddCustomerForm
                                    onAdd={handleAddCustomer}
                                    isAdding={isAddingCustomer}
                                    newCustomerName={newCustomerName}
                                    setNewCustomerName={setNewCustomerName}
                                    newCustomerPhone={newCustomerPhone}
                                    setNewCustomerPhone={setNewCustomerPhone}
                                    initialBags={initialBags}
                                    setInitialBags={setInitialBags}
                                />
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                {/* Stats */}
                <StatsCards rewards={rewards} />

                {/* Search and Filters */}
                <Card className="mb-4 md:mb-6">
                    <CardContent className="p-3 md:p-4 lg:p-6">
                        <div className="flex flex-col lg:flex-row gap-3 md:gap-4">
                            <div className="flex-1 relative min-w-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or phone..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-9"
                                />
                            </div>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-shrink-0">
                                <TabsList className="h-9">
                                    <TabsTrigger value="all" className="text-xs md:text-sm">All</TabsTrigger>
                                    <TabsTrigger value="eligible" className="text-xs md:text-sm">
                                        Eligible ({eligibleCustomersCount})
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </CardContent>
                </Card>

                {/* Customer List */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <LoadingSpinner />
                    </div>
                ) : filteredRewards.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="font-semibold mb-2">
                                {searchQuery ? "No customers found" : "No customers yet"}
                            </h3>
                            <p className="text-muted-foreground mb-4">
                                {searchQuery
                                    ? "Try adjusting your search terms"
                                    : "Add your first customer to get started with the rewards program"
                                }
                            </p>
                            {!searchQuery && (
                                <Button onClick={() => setIsAddSheetOpen(true)}>
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Add Customer
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredRewards.map(reward => (
                            <CustomerCard
                                key={reward.id}
                                reward={reward}
                                onAddBags={handleAddBags}
                                onRedeemDiscount={handleRedeemDiscount}
                                updatingCustomerId={updatingCustomerId}
                                bagsToAdd={bagsToAdd}
                                setBagsToAdd={setBagsToAdd}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RewardsView;
