
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, ShieldCheck, ShoppingCart, Loader } from 'lucide-react';
import logo from '@/app/logo.png';
import { useRouter } from 'next/navigation';

export default function RoleSelectionPage() {
  const [loadingRole, setLoadingRole] = useState<'manager' | 'cashier' | null>(null);
  const router = useRouter();

  const handleNavigation = (role: 'manager' | 'cashier') => {
    setLoadingRole(role);
    // The link will handle the navigation, but the loading state is set.
    // We can also use router.push if we want more control.
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary/50 dark:bg-background p-4 font-body">
      <div className="text-center mb-10">
        <Image src={logo} alt="Nuel's Food Zone Logo" width={80} height={80} className="mx-auto rounded-xl shadow-lg mb-4" />
        <h1 className="text-4xl font-bold tracking-tight">Welcome to Nuel's Cafe POS</h1>
        <p className="text-lg text-muted-foreground mt-2">Please select your role to continue.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        <Card className="transform hover:scale-105 transition-transform duration-300 ease-in-out">
          <CardHeader className="text-center">
             <ShieldCheck className="h-12 w-12 mx-auto text-primary" />
            <CardTitle className="text-2xl mt-4">Manager View</CardTitle>
            <CardDescription>Full access to dashboard and admin controls.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/main?role=manager" passHref legacyBehavior>
              <Button 
                className="w-full text-lg h-12"
                onClick={() => handleNavigation('manager')}
                disabled={loadingRole === 'manager' || loadingRole === 'cashier'}
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
            </Link>
          </CardContent>
        </Card>

        <Card className="transform hover:scale-105 transition-transform duration-300 ease-in-out">
          <CardHeader className="text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-primary" />
            <CardTitle className="text-2xl mt-4">Cashier View</CardTitle>
            <CardDescription>Access to POS, Orders, Accounting, and Misc for daily operations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/main?role=cashier" passHref legacyBehavior>
              <Button 
                className="w-full text-lg h-12"
                onClick={() => handleNavigation('cashier')}
                disabled={loadingRole === 'manager' || loadingRole === 'cashier'}
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
            </Link>
          </CardContent>
        </Card>
      </div>
       <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} Nuel's Food Zone. All rights reserved.</p>
        <p>A secure and efficient Point of Sale System.</p>
      </footer>
    </div>
  );
}
