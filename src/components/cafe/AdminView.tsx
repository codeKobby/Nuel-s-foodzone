
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MenuItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Edit, Trash2, PlusCircle, Search, AlertCircle, KeyRound, ShieldCheck, RefreshCw, Loader, Wrench } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { updatePassword } from '@/lib/auth-tools';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { initialMenuData } from '@/data/initial-data';
import { Checkbox } from '../ui/checkbox';


const AdminForm = ({
    editingItem,
    formState,
    handleFormChange,
    handleSubmit,
    onCancel,
}: {
    editingItem: MenuItem | null;
    formState: { name: string; price: string; category: string; stock: string, requiresChoice: boolean };
    handleFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement>) => void;
    handleSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
}) => (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div>
            <Label htmlFor="name">Item Name</Label>
            <Input type="text" name="name" id="name" value={formState.name} onChange={handleFormChange} required />
        </div>
        <div>
            <Label htmlFor="price">Price</Label>
            <Input type="number" name="price" id="price" value={formState.price} onChange={handleFormChange} required />
        </div>
        <div>
            <Label htmlFor="category">Category</Label>
            <Input type="text" name="category" id="category" value={formState.category} onChange={handleFormChange} required />
        </div>
        <div>
            <Label htmlFor="stock">Stock Quantity</Label>
            <Input type="number" name="stock" id="stock" value={formState.stock} onChange={handleFormChange} />
        </div>
        <div className="flex items-center space-x-2">
            <Checkbox
                id="requiresChoice"
                name="requiresChoice"
                checked={formState.requiresChoice}
                onCheckedChange={(checked) => handleFormChange({ target: { name: 'requiresChoice', value: checked } } as any)}
            />
            <Label htmlFor="requiresChoice" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Requires a choice? (e.g., for breakfast drinks)
            </Label>
        </div>
        <div className="flex space-x-2 pt-4">
            <Button type="submit" className="flex-1 font-bold">{editingItem ? 'Update Item' : 'Add Item'}</Button>
            {editingItem && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
        </div>
    </form>
);

const SecuritySettings = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const { toast } = useToast();

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast({ type: 'error', title: "Passwords do not match." });
            return;
        }
        if (newPassword.length < 6) {
            toast({ type: 'error', title: "Password must be at least 6 characters." });
            return;
        }
        setIsUpdatingPassword(true);
        const result = await updatePassword({
            role: 'manager',
            currentPassword: currentPassword,
            newPassword: newPassword,
        });

        toast({
            type: result.success ? 'success' : 'error',
            title: result.success ? "Success" : "Error",
            description: result.message,
        });

        if (result.success) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }
        setIsUpdatingPassword(false);
    };

    return (
        <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div>
                <Label htmlFor="current-password">Current Password</Label>
                <Input type="password" id="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input type="password" id="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div>
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input type="password" id="confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={isUpdatingPassword}>
                {isUpdatingPassword ? <><Loader className="animate-spin mr-2" />Updating...</> : <><KeyRound className="mr-2" />Update Password</>}
            </Button>
        </form>
    )
}


const AdminView: React.FC = () => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [formState, setFormState] = useState({ name: '', price: '', category: '', stock: '', requiresChoice: false });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<MenuItem | null>(null);
    const [isMenuSheetOpen, setIsMenuSheetOpen] = useState(false);
    const [isSecuritySheetOpen, setIsSecuritySheetOpen] = useState(false);
    const isMobile = useIsMobile();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const { toast } = useToast();


    useEffect(() => {
        const menuRef = collection(db, "menuItems");
        const unsubscribe = onSnapshot(menuRef, (snapshot) => {
            setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
            setLoading(false);
        }, (e) => { setError("Failed to load menu for admin."); setLoading(false); });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (editingItem) {
            setIsMenuSheetOpen(true);
        }
    }, [editingItem]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormState(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormState(prev => ({ ...prev, [name]: value }));
        }
    };

    const clearForm = () => {
        setFormState({ name: '', price: '', category: '', stock: '', requiresChoice: false });
        setEditingItem(null);
        setIsMenuSheetOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.name || !formState.price || !formState.category) return;
        const data = {
            name: formState.name,
            price: parseFloat(formState.price),
            category: formState.category,
            stock: parseInt(formState.stock, 10) || 0,
            requiresChoice: formState.requiresChoice,
        };
        try {
            if (editingItem) {
                await updateDoc(doc(db, "menuItems", editingItem.id), data);
            } else {
                await addDoc(collection(db, "menuItems"), data);
            }
            clearForm();
        } catch (e) { setError("Failed to save menu item."); }
    };

    const handleEdit = (item: MenuItem) => {
        setEditingItem(item);
        setFormState({
            name: String(item.name),
            price: String(item.price),
            category: String(item.category),
            stock: String(item.stock || ''),
            requiresChoice: item.requiresChoice || false
        });
    };

    const handleDelete = async (itemId: string) => {
        try { await deleteDoc(doc(db, "menuItems", itemId)); } catch (e) { setError("Failed to delete expense."); }
        setShowDeleteConfirm(null);
    };

    const handleSyncInitialMenu = async () => {
        setIsSyncing(true);
        setError(null);
        try {
            const menuRef = collection(db, "menuItems");
            const existingSnapshot = await getDocs(menuRef);
            const existingNames = new Set(existingSnapshot.docs.map(doc => doc.data().name));

            const itemsToAdd = initialMenuData.filter(item => !existingNames.has(item.name));

            if (itemsToAdd.length > 0) {
                const batch = writeBatch(db);
                for (const item of itemsToAdd) {
                    const newItemRef = doc(menuRef);
                    batch.set(newItemRef, item);
                }
                await batch.commit();
                toast({
                    title: "Menu Synced",
                    description: `Added ${itemsToAdd.length} new items to the menu.`,
                });
            } else {
                toast({
                    title: "Menu Synced",
                    description: "No new items to add. Menu is already up to date.",
                });
            }
        } catch (e) {
            console.error("Error syncing initial menu data:", e);
            setError("Failed to sync initial menu data.");
            toast({
                type: 'error',
                title: "Sync Failed",
                description: "Could not sync the initial menu data.",
            });
        } finally {
            setIsSyncing(false);
        }
    };

    const groupedMenu = useMemo(() => {
        const filteredItems = menuItems.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const categories = [...new Set(filteredItems.map(item => item.category))].sort();
        return categories.map(category => ({
            category,
            items: filteredItems.filter(item => item.category === category)
        }));
    }, [menuItems, searchQuery]);

    const isDrinkCategory = (category: string) => ['Drinks', 'Breakfast Drinks'].includes(category);

    return (
        <div className="flex h-full flex-col md:flex-row bg-secondary/50 dark:bg-background">
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                    <h2 className="text-2xl md:text-3xl font-bold">Admin Panel</h2>
                    <div className="flex gap-2">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search menu..."
                                className="pl-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {isMobile && (
                            <>
                                <Sheet open={isMenuSheetOpen} onOpenChange={(open) => { setIsMenuSheetOpen(open); if (!open) clearForm(); }}>
                                    <SheetTrigger asChild>
                                        <Button size="icon" className="flex-shrink-0" title="Add item" aria-label="Add item"><PlusCircle /></Button>
                                    </SheetTrigger>
                                    <SheetContent side="bottom" className="h-[85vh]">
                                        <SheetHeader>
                                            <SheetTitle className="text-2xl">{editingItem ? 'Edit Item' : 'Add New Item'}</SheetTitle>
                                        </SheetHeader>
                                        <div className="p-4 overflow-y-auto">
                                            <AdminForm
                                                editingItem={editingItem}
                                                formState={formState}
                                                handleFormChange={handleFormChange}
                                                handleSubmit={handleSubmit}
                                                onCancel={clearForm}
                                            />
                                        </div>
                                    </SheetContent>
                                </Sheet>
                                <Sheet open={isSecuritySheetOpen} onOpenChange={setIsSecuritySheetOpen}>
                                    <SheetTrigger asChild>
                                        <Button size="icon" variant="outline" className="flex-shrink-0" title="Security settings" aria-label="Open security settings"><ShieldCheck /></Button>
                                    </SheetTrigger>
                                    <SheetContent side="bottom" className="h-auto">
                                        <SheetHeader>
                                            <SheetTitle className="text-2xl">Security</SheetTitle>
                                        </SheetHeader>
                                        <div className="p-4 overflow-y-auto">
                                            <SecuritySettings />
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </>
                        )}
                    </div>
                </div>

                {loading && <LoadingSpinner />}
                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                {!loading && !error && (
                    <div className="space-y-6">
                        {groupedMenu.map(({ category, items }) => (
                            <Card key={category}>
                                <CardHeader className="p-4 md:p-6">
                                    <CardTitle>{category}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 p-4 md:p-6 pt-0">
                                    {items.map(item => (
                                        <div key={item.id} className="bg-secondary p-3 rounded-lg flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold text-sm">{item.name}</p>
                                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <span>{formatCurrency(item.price)}</span>
                                                    {isDrinkCategory(category) && (
                                                        <>
                                                            <span>- Stock: {item.stock ?? 'N/A'}</span>
                                                            {(item.stock ?? 0) <= 5 && (
                                                                <Badge variant="destructive" className="flex items-center gap-1">
                                                                    <AlertCircle className="h-3 w-3" />
                                                                    Low Stock
                                                                </Badge>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex space-x-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} title="Edit item" aria-label="Edit item"><Edit className="h-4 w-4 text-blue-500" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(item)} title="Delete item" aria-label="Delete item"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {!isMobile && (
                <Card className="w-full md:w-80 lg:w-96 rounded-none border-t md:border-t-0 md:border-l flex flex-col">
                    <Tabs defaultValue="menu" className="w-full flex flex-col flex-grow">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="menu">Menu</TabsTrigger>
                            <TabsTrigger value="security">Security</TabsTrigger>
                        </TabsList>
                        <TabsContent value="menu" className="flex-grow">
                            <CardHeader>
                                <CardTitle className="text-xl md:text-2xl">{editingItem ? 'Edit Item' : 'Add New Item'}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <AdminForm
                                    editingItem={editingItem}
                                    formState={formState}
                                    handleFormChange={handleFormChange}
                                    handleSubmit={handleSubmit}
                                    onCancel={clearForm}
                                />
                                <div className="mt-4 pt-4 border-t">
                                    <Button variant="outline" className="w-full" onClick={handleSyncInitialMenu} disabled={isSyncing}>
                                        {isSyncing ? <><RefreshCw className="mr-2 animate-spin" /> Syncing...</> : <><RefreshCw className="mr-2" />Sync Initial Menu</>}
                                    </Button>
                                    <p className="text-xs text-muted-foreground mt-2">Adds any missing default menu items to your database. This will not overwrite any changes you have made.</p>
                                </div>
                            </CardContent>
                        </TabsContent>
                        <TabsContent value="security" className="flex-grow">
                            <CardHeader>
                                <CardTitle className="text-xl md:text-2xl flex items-center"><ShieldCheck className="mr-2" /> Security Settings</CardTitle>
                                <CardDescription>Update your account password.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <SecuritySettings />
                            </CardContent>
                        </TabsContent>
                    </Tabs>
                </Card>
            )}

            {showDeleteConfirm && (
                <AlertDialog open onOpenChange={() => setShowDeleteConfirm(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete "{showDeleteConfirm.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(showDeleteConfirm.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
};

export default AdminView;
