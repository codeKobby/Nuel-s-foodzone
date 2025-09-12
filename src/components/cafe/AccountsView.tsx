
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CashierAccount } from '@/lib/types';
import { formatTimestamp } from '@/lib/utils';
import { PlusCircle, Trash2, KeyRound, Loader, Eye, EyeOff, Clipboard, Check } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
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
import { generateUniqueUsername, generateOneTimePassword, hashPassword } from '@/lib/auth-tools';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogContent } from '@/components/ui/dialog';

const AccountForm = ({
  isProcessing,
  handleSubmit,
}: {
  isProcessing: boolean;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) => (
  <form onSubmit={handleSubmit} className="space-y-4">
    <div>
      <Label htmlFor="fullName">Cashier Full Name</Label>
      <Input type="text" name="fullName" id="fullName" required placeholder="e.g., 'Ama Serwaa'" />
    </div>
    <div className="pt-4">
      <Button type="submit" className="w-full font-bold" disabled={isProcessing}>
        {isProcessing ? <><Loader className="animate-spin mr-2"/>Creating...</> : 'Create Account'}
      </Button>
    </div>
  </form>
);

const AccountsView: React.FC = () => {
    const [accounts, setAccounts] = useState<CashierAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showRevokeConfirm, setShowRevokeConfirm] = useState<CashierAccount | null>(null);
    const [newPasswordInfo, setNewPasswordInfo] = useState<{ username: string, otp: string } | null>(null);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const isMobile = useIsMobile();
    const { toast } = useToast();

    useEffect(() => {
        const accountsRef = collection(db, "cashierAccounts");
        const q = query(accountsRef, orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashierAccount)));
            setLoading(false);
        }, (e) => { setError("Failed to load cashier accounts."); setLoading(false); });
        return () => unsubscribe();
    }, []);

    const handleCreateAccount = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsProcessing(true);
        setError(null);
        
        const formData = new FormData(e.currentTarget);
        const fullName = formData.get('fullName') as string;
        
        try {
            const username = await generateUniqueUsername(fullName);
            const oneTimePassword = await generateOneTimePassword();
            
            const newAccount: Omit<CashierAccount, 'id'> = {
                fullName,
                username,
                passwordHash: await hashPassword(oneTimePassword),
                isTemporaryPassword: true,
                createdAt: Timestamp.now(),
                status: 'active',
            };
            
            await addDoc(collection(db, "cashierAccounts"), newAccount);
            
            setNewPasswordInfo({ username, otp: oneTimePassword });
            setIsSheetOpen(false);
            toast({ type: 'success', title: "Account Created", description: `Successfully created account for ${fullName}.` });
        } catch (e) {
            console.error("Error creating account:", e);
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
            setError(`Failed to create the account. Please try again. Error: ${errorMessage}`);
            toast({ type: 'error', title: "Creation Failed", description: `Could not create the new cashier account. ${errorMessage}`});
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleRevokeAccount = async (account: CashierAccount) => {
        if (!account) return;
        try {
            await updateDoc(doc(db, "cashierAccounts", account.id), { status: 'revoked' });
            toast({ type: 'success', title: "Account Revoked", description: `Access for ${account.fullName} has been revoked.`});
        } catch (e) {
            setError(`Failed to revoke account for ${account.fullName}.`);
        }
        setShowRevokeConfirm(null);
    };
    
    const handleResetPassword = async (account: CashierAccount) => {
        setIsProcessing(true);
        try {
            const oneTimePassword = await generateOneTimePassword();
            await updateDoc(doc(db, "cashierAccounts", account.id), {
                passwordHash: await hashPassword(oneTimePassword),
                isTemporaryPassword: true
            });
            setNewPasswordInfo({ username: account.username, otp: oneTimePassword });
             toast({ type: 'success', title: "Password Reset", description: `Temporary password created for ${account.fullName}.` });
        } catch(e) {
            setError(`Failed to reset password for ${account.fullName}.`);
            toast({ type: 'error', title: "Reset Failed", description: `Could not reset password.` });
        } finally {
            setIsProcessing(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ type: 'success', title: 'Copied to clipboard' });
    };

    return (
        <div className="flex h-full flex-col md:flex-row bg-secondary/50 dark:bg-background">
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                    <h2 className="text-2xl md:text-3xl font-bold">Cashier Accounts</h2>
                     {isMobile && (
                        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                            <SheetTrigger asChild><Button size="icon"><PlusCircle /></Button></SheetTrigger>
                            <SheetContent side="bottom" className="h-auto">
                                <SheetHeader><SheetTitle className="text-2xl">New Cashier Account</SheetTitle></SheetHeader>
                                <div className="p-4"><AccountForm isProcessing={isProcessing} handleSubmit={handleCreateAccount} /></div>
                            </SheetContent>
                        </Sheet>
                    )}
                </div>

                {loading && <LoadingSpinner />}
                {error && <Alert variant="destructive" className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                
                {!loading && !error && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Manage Accounts</CardTitle>
                            <CardDescription>Create, revoke, and manage passwords for cashier accounts.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="space-y-4">
                                {accounts.map(acc => (
                                    <div key={acc.id} className="p-3 bg-card rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold">{acc.fullName}</p>
                                            <p className="text-sm text-muted-foreground">@{acc.username}</p>
                                            <p className="text-xs text-muted-foreground mt-1">Created: {formatTimestamp(acc.createdAt)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <Button variant="outline" size="sm" onClick={() => handleResetPassword(acc)} disabled={isProcessing}>
                                                {isProcessing ? <Loader className="animate-spin"/> : <KeyRound className="h-4 w-4"/>}
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => setShowRevokeConfirm(acc)}>
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {accounts.length === 0 && <p className="text-center italic text-muted-foreground py-8">No cashier accounts created yet.</p>}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {!isMobile && (
                 <Card className="w-full md:w-80 lg:w-96 rounded-none border-t md:border-t-0 md:border-l">
                    <CardHeader>
                        <CardTitle className="text-xl md:text-2xl">New Cashier Account</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AccountForm isProcessing={isProcessing} handleSubmit={handleCreateAccount} />
                    </CardContent>
                </Card>
            )}
            
            {showRevokeConfirm && (
                 <AlertDialog open onOpenChange={() => setShowRevokeConfirm(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Revoke Account?</AlertDialogTitle><AlertDialogDescription>
                            Are you sure you want to revoke access for "{showRevokeConfirm.fullName}"? They will no longer be able to log in. This can be undone later.
                        </AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRevokeAccount(showRevokeConfirm)} className="bg-destructive hover:bg-destructive/90">Yes, Revoke</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            {newPasswordInfo && (
                <Dialog open onOpenChange={() => setNewPasswordInfo(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Account Credentials</DialogTitle>
                            <DialogDescription>
                                Please provide these temporary login details to the cashier. They will be required to change their password upon first login.
                            </DialogDescription>
                        </DialogHeader>
                        <Card className="my-4">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-center">
                                    <div><Label>Username</Label><p className="font-mono text-lg">{newPasswordInfo.username}</p></div>
                                    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(newPasswordInfo.username)}><Clipboard/></Button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <Label>One-Time Password</Label>
                                        <p className="font-mono text-lg">{passwordVisible ? newPasswordInfo.otp : '••••••••'}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button size="icon" variant="ghost" onClick={() => setPasswordVisible(!passwordVisible)}>{passwordVisible ? <EyeOff /> : <Eye />}</Button>
                                        <Button size="icon" variant="ghost" onClick={() => copyToClipboard(newPasswordInfo.otp)}><Clipboard/></Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <DialogFooter>
                            <Button onClick={() => setNewPasswordInfo(null)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};

export default AccountsView;
