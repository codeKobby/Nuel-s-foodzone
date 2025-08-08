"use client";

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

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
            document.documentElement.classList.add(storedTheme);
            
            // Set appId from environment variable on the client
            const firebaseAppId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
            if (firebaseAppId) {
                setAppId(firebaseAppId);
            } else {
                console.error("Firebase App ID is not configured.");
                setAuthError("Application is not configured correctly. Missing Firebase App ID.");
            }
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        const root = window.document.documentElement;
        root.classList.remove(theme);
        root.classList.add(newTheme);
        localStorage.setItem('theme', newTheme);
        setTheme(newTheme);
    };

    useEffect(() => {
        // Firebase auth operations should only run on the client
        if (typeof window === 'undefined') return;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (!user) {
                    await signInAnonymously(auth);
                }
                // Once user is available, auth is ready
                 setIsAuthReady(true);

            } catch (e) {
                console.error("Authentication Error:", e);
                if (e instanceof Error && (e.message.includes("auth/invalid-api-key") || e.message.includes("Firebase: Error"))) {
                     setAuthError("Firebase configuration is invalid. Please check your API key and other settings.");
                } else {
                     setAuthError("Failed to authenticate. Please check your connection and refresh the page.");
                }
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
                    <AlertTitle>Application Error</AlertTitle>
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
                setTheme={toggleTheme} 
                pendingOrdersCount={pendingOrdersCount} 
            />
            <main className="flex-1 flex flex-col overflow-hidden">
                {renderActiveView()}
            </main>
        </div>
    );
}
