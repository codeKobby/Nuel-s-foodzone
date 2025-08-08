"use client";

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import Sidebar from '@/components/cafe/Sidebar';
import PosView from '@/components/cafe/PosView';
import OrdersView from '@/components/cafe/OrdersView';
import DashboardView from '@/components/cafe/DashboardView';
import AdminView from '@/components/cafe/AdminView';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function CafePage() {
    const [activeView, setActiveView] = useState('pos');
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [theme, setTheme] = useState('light');
    const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
    const [appId, setAppId] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedTheme = localStorage.getItem('theme') || 'light';
            setTheme(storedTheme);
        }
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'light' ? 'dark' : 'light');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (!user) {
                    await signInAnonymously(auth);
                }
                const token = await user?.getIdTokenResult();
                const firebaseAppId = token?.claims.firebase.identities['firebase.appId']?.[0] || process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
                if(firebaseAppId) {
                    setAppId(firebaseAppId as string);
                } else {
                     setAppId(process.env.NEXT_PUBLIC_FIREBASE_APP_ID as string);
                }

            } catch (e) {
                console.error("Authentication Error:", e);
                setAuthError("Failed to authenticate. Please refresh the page.");
            } finally {
                setIsAuthReady(true);
            }
        });
        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        if (!isAuthReady || !appId) return;
        const q = query(collection(db, `/artifacts/${appId}/public/data/orders`), where("status", "==", "Pending"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPendingOrdersCount(snapshot.size);
        }, (error) => {
            console.error("Error fetching pending orders count:", error);
        });
        return () => unsubscribe();
    }, [isAuthReady, appId]);


    const renderActiveView = () => {
        if (!appId) return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
        switch (activeView) {
            case 'pos': return <PosView appId={appId} />;
            case 'orders': return <OrdersView appId={appId} />;
            case 'dashboard': return <DashboardView appId={appId} />;
            case 'admin': return <AdminView appId={appId} />;
            default: return <PosView appId={appId}/>;
        }
    };

    if (!isAuthReady) {
        return (
            <div className="h-screen w-screen bg-background flex flex-col items-center justify-center">
                <LoadingSpinner />
                <p className="mt-4 text-lg text-muted-foreground">Initializing Nuel's Cafe POS...</p>
            </div>
        );
    }

    if (authError) {
        return (
            <div className="h-screen w-screen bg-background flex items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Authentication Error</AlertTitle>
                    <AlertDescription>{authError}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-secondary/50 dark:bg-background font-body text-foreground">
            <Sidebar 
                activeView={activeView} 
                setActiveView={setActiveView} 
                theme={theme} 
                setTheme={setTheme} 
                pendingOrdersCount={pendingOrdersCount} 
            />
            <main className="flex-1 flex flex-col overflow-hidden">
                {renderActiveView()}
            </main>
        </div>
    );
}
