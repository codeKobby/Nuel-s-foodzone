
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, ShieldCheck, ShoppingCart, Loader } from 'lucide-react';
import logo from '@/app/logo.png';
import PasswordModal from '@/components/cafe/modals/PasswordModal';

export default function RoleSelectionPage() {
  const [loadingRole, setLoadingRole] = useState<'manager' | 'cashier' | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const router = useRouter();

  const handleCashierNavigation = () => {
    setLoadingRole('cashier');
    router.push(`/main?role=cashier`);
  };
  
  const handleManagerNavigation = () => {
      setShowPasswordModal(true);
  }

  const onPasswordSuccess = () => {
    setLoadingRole('manager');
    setShowPasswordModal(false);
    router.push(`/main?role=manager`);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary/50 dark:bg-background p-4 font-body">
      <div className="text-center mb-10">
        <Image src={logo} alt="Nuel's Food Zone Logo" width={80} height={80} className="mx-auto rounded-xl mb-4" />
        <h1 className="text-4xl font-bold tracking-tight">Welcome to Nuel's Cafe POS</h1>
        <p className="text-lg text-muted-foreground mt-2">Please select your role to continue.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        <Card className="transform hover:scale-105 transition-transform duration-300 ease-in-out">
          <CardHeader className="text-center">
             <ShieldCheck className="h-12 w-12 mx-auto text-primary" />
            <CardTitle className="text-2xl mt-4">Manager View</CardTitle>
            <CardDescription>Access to dashboard and admin controls.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full text-lg h-12"
              onClick={handleManagerNavigation}
              disabled={!!loadingRole}
            >
              {loadingRole === 'manager' ? (
                <>
                  <Loader className="mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Login as Manager <ArrowRight className="ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="transform hover:scale-105 transition-transform duration-300 ease-in-out">
          <CardHeader className="text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-primary" />
            <CardTitle className="text-2xl mt-4">Cashier View</CardTitle>
            <CardDescription>Access to POS, Orders, and Accounting for daily operations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full text-lg h-12"
              onClick={handleCashierNavigation}
              disabled={!!loadingRole}
            >
               {loadingRole === 'cashier' ? (
                <>
                  <Loader className="mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Login as Cashier <ArrowRight className="ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
       <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} Nuel's Food Zone. All rights reserved.</p>
        <p>A secure and efficient Point of Sale System.</p>
      </footer>
      
      {showPasswordModal && (
        <PasswordModal 
            role="manager"
            onSuccess={onPasswordSuccess}
            onClose={() => setShowPasswordModal(false)}
        />
      )}
    </div>
  );
}
