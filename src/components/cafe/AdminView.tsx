"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MenuItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Edit, Trash2 } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
} from "@/components/ui/alert-dialog"

interface AdminViewProps {
    appId: string;
}

const AdminView: React.FC<AdminViewProps> = ({ appId }) => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [formState, setFormState] = useState({ name: '', price: '', category: '', stock: '' });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<MenuItem | null>(null);

    useEffect(() => {
        const menuRef = collection(db, `/artifacts/${appId}/public/data/menuItems`);
        const unsubscribe = onSnapshot(menuRef, (snapshot) => {
            setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
            setLoading(false);
        }, (e) => { setError("Failed to load menu for admin."); setLoading(false); });
        return () => unsubscribe();
    }, [appId]);
    
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.name || !formState.price || !formState.category) return;
        const data = { 
            name: formState.name, 
            price: parseFloat(formState.price), 
            category: formState.category, 
            stock: parseInt(formState.stock, 10) || 0 
        };
        try {
            if (editingItem) {
                await updateDoc(doc(db, `/artifacts/${appId}/public/data/menuItems`, editingItem.id), data);
            } else {
                await addDoc(collection(db, `/artifacts/${appId}/public/data/menuItems`), data);
            }
            setFormState({ name: '', price: '', category: '', stock: '' });
            setEditingItem(null);
        } catch (e) { setError("Failed to save menu item."); }
    };

    const handleEdit = (item: MenuItem) => {
        setEditingItem(item);
        setFormState({ name: item.name, price: String(item.price), category: item.category, stock: String(item.stock || '') });
    };

    const handleDelete = async (itemId: string) => {
        try { await deleteDoc(doc(db, `/artifacts/${appId}/public/data/menuItems`, itemId)); } catch (e) { setError("Failed to delete menu item."); }
        setShowDeleteConfirm(null);
    };

    const groupedMenu = useMemo(() => {
        const categories = [...new Set(menuItems.map(item => item.category))].sort();
        return categories.map(category => ({ 
            category, 
            items: menuItems.filter(item => item.category === category) 
        }));
    }, [menuItems]);

    return (
        <div className="flex h-full bg-secondary/50 dark:bg-background">
            <div className="flex-1 p-6 overflow-y-auto">
                <h2 className="text-3xl font-bold mb-6">Menu Management</h2>
                {loading && <LoadingSpinner />}
                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                {!loading && !error && (
                    <div className="space-y-6">
                        {groupedMenu.map(({ category, items }) => (
                            <Card key={category}>
                                <CardHeader>
                                    <CardTitle>{category}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {items.map(item => (
                                        <div key={item.id} className="bg-secondary p-3 rounded-lg flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold">{item.name}</p>
                                                <p className="text-sm text-muted-foreground">{formatCurrency(item.price)} - Stock: {item.stock ?? 'N/A'}</p>
                                            </div>
                                            <div className="flex space-x-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="h-4 w-4 text-blue-500" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(item)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
            <Card className="w-96 rounded-none border-t-0 border-b-0 border-r-0">
                <CardHeader>
                    <CardTitle className="text-2xl">{editingItem ? 'Edit Item' : 'Add New Item'}</CardTitle>
                </CardHeader>
                <CardContent>
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
                        <div className="flex space-x-2 pt-4">
                            <Button type="submit" className="flex-1 font-bold">{editingItem ? 'Update Item' : 'Add Item'}</Button>
                            {editingItem && <Button type="button" variant="secondary" onClick={() => { setEditingItem(null); setFormState({ name: '', price: '', category: '', stock: '' }); }}>Cancel</Button>}
                        </div>
                    </form>
                </CardContent>
            </Card>

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
