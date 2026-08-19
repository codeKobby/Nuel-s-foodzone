'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ShieldCheck, ShoppingCart, Loader, Clock } from 'lucide-react';
import logo from '@/app/logo.png';
import PasswordModal from '@/components/cafe/modals/PasswordModal';

export default function RoleSelectionPage() {
  const [loadingRole, setLoadingRole] = useState<'manager' | 'cashier' | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<'manager' | 'cashier' | null>(null);
  const [now, setNow] = useState(() => new Date());
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const formattedDate = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  const openLogin = (role: 'manager' | 'cashier') => {
    setLoadingRole(role);
    setShowLoginModal(role);
  };

  const handleLoginSuccess = () => {
    const role = showLoginModal;
    setShowLoginModal(null);
    setLoadingRole(null);
    if (role) router.push('/backoffice/internal');
  };

  const handleLoginClose = () => {
    setShowLoginModal(null);
    setLoadingRole(null);
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-br from-background via-secondary/40 to-primary/10 dark:via-background/80 font-body">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_60%)] dark:opacity-40" />
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:gap-10 md:py-12 sm:px-6 lg:px-10">
        <div className="space-y-3 text-center md:space-y-4">
          <Badge variant="outline" className="mx-auto w-fit bg-card/80 text-xs backdrop-blur">
            Secure Back-office Portal
          </Badge>
          <div className="flex flex-col items-center gap-2 md:gap-3">
            <Image src={logo} alt="Nuel's Foodzone Logo" width={72} height={72} className="rounded-xl shadow-xl md:h-24 md:w-24 md:rounded-2xl" />
            <h1 className="text-2xl font-bold tracking-tight md:text-4xl sm:text-5xl">Nuel's Foodzone</h1>
            <p className="max-w-2xl px-4 text-sm text-muted-foreground md:text-lg">
              Sign in with your assigned Firebase Auth account to continue.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground md:text-sm">
              <Clock className="h-3 w-3 md:h-4 md:w-4" />
              <span>{formattedDate}</span>
              <span className="text-muted-foreground/70">•</span>
              <span>{formattedTime}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <Card className="group relative overflow-hidden border-primary/20 bg-card/90 backdrop-blur transition-all duration-300 hover:border-primary hover:shadow-primary/20">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 rounded-l-full bg-gradient-to-l from-primary/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <CardHeader className="p-4 text-center md:p-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary md:h-16 md:w-16 md:rounded-2xl">
                <ShieldCheck className="h-6 w-6 md:h-8 md:w-8" />
              </div>
              <CardTitle className="mt-3 text-xl md:mt-4 md:text-2xl">Manager Portal</CardTitle>
              <CardDescription className="text-xs md:text-sm">Manage sales, staff, content, inventory, and approvals.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6">
              <Button className="h-10 w-full text-sm md:h-12 md:text-lg" onClick={() => openLogin('manager')} disabled={!!loadingRole}>
                {loadingRole === 'manager' ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Opening…</> : <>Enter Manager <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-primary/20 bg-card/90 backdrop-blur transition-all duration-300 hover:border-primary hover:shadow-primary/20">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 rounded-l-full bg-gradient-to-l from-primary/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <CardHeader className="p-4 text-center md:p-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary md:h-16 md:w-16 md:rounded-2xl">
                <ShoppingCart className="h-6 w-6 md:h-8 md:w-8" />
              </div>
              <CardTitle className="mt-3 text-xl md:mt-4 md:text-2xl">Cashier Workspace</CardTitle>
              <CardDescription className="text-xs md:text-sm">Sign in with your named cashier account to take accountable orders.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6">
              <Button onClick={() => openLogin('cashier')} className="h-10 w-full text-sm md:h-12 md:text-lg" disabled={!!loadingRole}>
                {loadingRole === 'cashier' ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Opening…</> : <>Enter Cashier <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </CardContent>
          </Card>
        </div>

        <footer className="text-center text-xs text-muted-foreground md:text-sm">
          <p>&copy; {new Date().getFullYear()} Nuel's Foodzone. All rights reserved.</p>
        </footer>
      </div>

      {showLoginModal && (
        <PasswordModal
          role={showLoginModal}
          onSuccess={handleLoginSuccess}
          onClose={handleLoginClose}
        />
      )}
    </div>
  );
}
