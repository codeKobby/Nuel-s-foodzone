
'use client';

import React, { useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ShieldCheck, ShoppingCart, Loader, Clock } from 'lucide-react';
import logo from '@/app/logo.png';
import PasswordModal from '@/components/cafe/modals/PasswordModal';
import { AuthContext } from '@/context/AuthContext';

export default function RoleSelectionPage() {
  const [loadingRole, setLoadingRole] = useState<'manager' | 'cashier' | null>(null);
  const [showManagerPasswordModal, setShowManagerPasswordModal] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const { login } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const formattedDate = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  const handleManagerNavigation = () => {
    setShowManagerPasswordModal(true);
  };

  const onManagerPasswordSuccess = () => {
    setLoadingRole('manager');
    login({ role: 'manager' });
    setShowManagerPasswordModal(false);
    router.push(`/backoffice/internal`);
  };

  const handleCashierLogin = () => {
    setLoadingRole('cashier');
    login({ role: 'cashier', fullName: 'Cashier', username: 'cashier' });
    router.push(`/backoffice/internal`);
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-br from-background via-secondary/40 to-primary/10 dark:via-background/80 font-body">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_60%)] dark:opacity-40" />
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 md:gap-10 px-4 py-8 md:py-12 sm:px-6 lg:px-10">
        <div className="text-center space-y-3 md:space-y-4">
          <Badge variant="outline" className="mx-auto w-fit bg-card/80 backdrop-blur text-xs">
            Welcome to the Backoffice Portal
          </Badge>
          <div className="flex flex-col items-center gap-2 md:gap-3">
            <Image src={logo} alt="Nuel's Food Zone Logo" width={72} height={72} className="rounded-xl md:rounded-2xl shadow-xl md:w-24 md:h-24" />
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight sm:text-5xl">Nuel's Foodzone</h1>
            <p className="text-sm md:text-lg text-muted-foreground max-w-2xl px-4">
              Choose the workspace tailored to your role.
            </p>
            <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
              <Clock className="h-3 w-3 md:h-4 md:w-4" />
              <span>{formattedDate}</span>
              <span className="text-muted-foreground/70">•</span>
              <span>{formattedTime}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          <Card className="group relative overflow-hidden border-primary/20 bg-card/90 backdrop-blur transition-all duration-300 hover:border-primary hover:shadow-primary/20">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 rounded-l-full bg-gradient-to-l from-primary/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <CardHeader className="text-center p-4 md:p-6">
              <div className="mx-auto flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-xl md:rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6 md:h-8 md:w-8" />
              </div>
              <CardTitle className="text-xl md:text-2xl mt-3 md:mt-4">Manager Portal</CardTitle>
              <CardDescription className="text-xs md:text-sm">Track revenue, reconcile inventory, and approve adjustments.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <Button
                className="w-full text-sm md:text-lg h-10 md:h-12"
                onClick={handleManagerNavigation}
                disabled={!!loadingRole}
              >
                {loadingRole === 'manager' ? (
                  <><Loader className="mr-2 animate-spin h-4 w-4" /> Checking...</>
                ) : (
                  <>Enter Manager <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-primary/20 bg-card/90 backdrop-blur transition-all duration-300 hover:border-primary hover:shadow-primary/20">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 rounded-l-full bg-gradient-to-l from-primary/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <CardHeader className="text-center p-4 md:p-6">
              <div className="mx-auto flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-xl md:rounded-2xl bg-primary/10 text-primary">
                <ShoppingCart className="h-6 w-6 md:h-8 md:w-8" />
              </div>
              <CardTitle className="text-xl md:text-2xl mt-3 md:mt-4">Cashier Workspace</CardTitle>
              <CardDescription className="text-xs md:text-sm">Ring up orders, redeem rewards, and monitor stock.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <Button
                onClick={handleCashierLogin}
                className="w-full text-sm md:text-lg h-10 md:h-12"
                disabled={!!loadingRole}
              >
                {loadingRole === 'cashier' ? (
                  <><Loader className="mr-2 animate-spin h-4 w-4" /> Preparing...</>
                ) : (
                  <>Enter Cashier <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <footer className="text-center text-muted-foreground text-xs md:text-sm">
          <p>&copy; {new Date().getFullYear()} Nuel's Food Zone. All rights reserved.</p>
        </footer>
      </div>

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
