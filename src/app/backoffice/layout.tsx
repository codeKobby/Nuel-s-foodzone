
"use client";

import { AuthProvider } from '@/context/AuthContext';
import { OrderEditingProvider } from '@/context/OrderEditingContext';
import { Suspense } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

// This layout wraps the entire backoffice, providing authentication and order editing context.
export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OrderEditingProvider>
          <Suspense fallback={<div className="h-screen w-screen bg-background flex flex-col items-center justify-center"><LoadingSpinner /><p className="mt-4 text-lg text-muted-foreground">Loading Backoffice...</p></div>}>
            {children}
          </Suspense>
      </OrderEditingProvider>
    </AuthProvider>
  );
}
