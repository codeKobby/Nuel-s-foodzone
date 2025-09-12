
'use client';

import React, { useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, ShieldCheck, ShoppingCart, Loader, AlertTriangle } from 'lucide-react';
import logo from '@/app/logo.png';
import PasswordModal from '@/components/cafe/modals/PasswordModal';
import { AuthContext } from '@/context/AuthContext';
import { verifyCashierPassword } from '@/lib/auth-tools';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RoleSelectionPage() {
  const [loadingRole, setLoadingRole] = useState<'manager' | 'cashier' | null>(null);
  const [showManagerPasswordModal, setShowManagerPasswordModal] = useState(false);
  const [cashierError, setCashierError] = useState<string | null>(null);
  const { login } = useContext(AuthContext);
  const router = useRouter();

  const handleManagerNavigation = () => {
    setShowManagerPasswordModal(true);
  }

  const onManagerPasswordSuccess = () => {
    setLoadingRole('manager');
    login({ role: 'manager' });
    setShowManagerPasswordModal(false);
    router.push(`/main`);
  }

  const handleCashierLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingRole('cashier');
    setCashierError(null);

    const formData = new FormData(event.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    
    const result = await verifyCashierPassword(username, password);

    if (result.success && result.user) {
        login({ 
            role: 'cashier', 
            uid: result.user.id, 
            fullName: result.user.fullName, 
            username: result.user.username 
        });
        router.push(`/main`);
    } else {
        setCashierError(result.message);
        setLoadingRole(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary/50 dark:bg-background p-4 font-body">
      <div className="text-center mb-10">
        <Image src={logo} alt="Nuel's Food Zone Logo" width={80} height={80} className="mx-auto rounded-xl mb-4" />
        <h1 className="text-4xl font-bold tracking-tight">Welcome to Nuel's Foodzone Cafe POS</h1>
        <p className="text-lg text-muted-foreground mt-2">Please select your role to continue.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        <Card className="transform hover:scale-105 transition-transform duration-300 ease-in-out">
          <CardHeader className="text-center">
             <ShieldCheck className="h-12 w-12 mx-auto text-primary" />
            <CardTitle className="text-2xl mt-4">Manager</CardTitle>
            <CardDescription>Access dashboard, accounts, and admin controls.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full text-lg h-12"
              onClick={handleManagerNavigation}
              disabled={!!loadingRole}
            >
              {loadingRole === 'manager' ? (
                <><Loader className="mr-2 animate-spin" /> Loading...</>
              ) : (
                <>Login as Manager <ArrowRight className="ml-2" /></>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-primary" />
            <CardTitle className="text-2xl mt-4">Cashier</CardTitle>
            <CardDescription>Enter your credentials for daily operations.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCashierLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input name="username" id="username" placeholder="Enter your username" required />
              </div>
               <div>
                <Label htmlFor="password">Password</Label>
                <Input name="password" id="password" type="password" placeholder="Enter your password" required />
              </div>
              {cashierError && (
                 <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Login Failed</AlertTitle>
                    <AlertDescription>{cashierError}</AlertDescription>
                </Alert>
              )}
              <Button 
                type="submit"
                className="w-full text-lg h-12"
                disabled={!!loadingRole}
              >
                {loadingRole === 'cashier' ? (
                  <><Loader className="mr-2 animate-spin" /> Logging in...</>
                ) : (
                  <>Login as Cashier <ArrowRight className="ml-2" /></>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
       <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} Nuel's Food Zone. All rights reserved.</p>
        <p>A secure and efficient Point of Sale System.</p>
      </footer>
      
      {showManagerPasswordModal && (
        <PasswordModal 
            role="manager"
            onSuccess={onManagerPasswordSuccess}
            onClose={() => setShowManagerPasswordModal(false)}
        />
      )}
    </div>
  );
}
