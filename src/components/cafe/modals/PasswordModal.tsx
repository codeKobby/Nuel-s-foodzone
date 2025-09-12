
"use client";

import React, { useState } from 'react';
import { verifyPassword } from '@/lib/auth-tools';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


interface PasswordModalProps {
    role: 'manager' | 'cashier';
    onSuccess: () => void;
    onClose: () => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ role, onSuccess, onClose }) => {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        
        try {
            const isCorrect = await verifyPassword({ role, password });
            if (isCorrect) {
                onSuccess();
            } else {
                setError("Incorrect password. Please try again.");
            }
        } catch (e) {
            console.error(e);
            setError("An error occurred. Please check your connection or contact support.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = () => {
        toast({
            title: 'Forgot Password',
            description: "Please contact another manager or administrator to help reset your password.",
        });
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleVerify}>
                    <DialogHeader>
                        <DialogTitle className="capitalize">{role} Login</DialogTitle>
                        <DialogDescription>
                            Please enter the password to access this view.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div>
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        {error && (
                             <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Login Failed</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </div>
                    <DialogFooter className="flex flex-col gap-2 sm:flex-row">
                         <Button type="button" variant="link" onClick={handleForgotPassword}>Forgot password?</Button>
                         <div className="flex-grow" />
                        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={isLoading || !password}>
                            {isLoading && <Loader className="mr-2 animate-spin" />}
                            {isLoading ? 'Verifying...' : 'Login'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default PasswordModal;

