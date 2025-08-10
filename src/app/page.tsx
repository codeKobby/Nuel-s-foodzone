
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
import MiscView from '@/components/cafe/MiscView';
import AccountingView from '@/components/cafe/AccountingView';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import AiFlow from '@/ai/flows/analyze-business-flow';

export default function CafePage() {
    const [activeView, setActiveView] = useState('pos');
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [theme, setTheme] = useState('light');
    const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

    useEffect(() => {
        if (!auth || !db) {
            setAuthError("Firebase is not configured. Please check your environment variables.");
            setIsAuthReady(true);
            return;
        }

        if (typeof window !== 'undefined') {
            const storedTheme = localStorage.getItem('theme') || 'light';
            setTheme(storedTheme);
            document.documentElement.classList.add(storedTheme);
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (!user) {
                    await signInAnonymously(auth);
                }
                setIsAuthReady(true);
            } catch (e) {
                console.error("Authentication Error:", e);
                if (e instanceof Error) {
                    if (e.message.includes("auth/invalid-api-key")) {
                        setAuthError("Firebase configuration is invalid. Please check your API key and other settings in your .env.local file.");
                    } else if (e.message.includes("auth/configuration-not-found")) {
                        setAuthError("Anonymous sign-in is not enabled in your Firebase project. Please go to the Firebase console, navigate to Authentication > Sign-in method, and enable the Anonymous provider.");
                    } else {
                        setAuthError("Failed to authenticate. Please check your connection and refresh the page.");
                    }
                } else {
                     setAuthError("An unknown authentication error occurred.");
                }
                setIsAuthReady(true);
            }
        });
        return () => unsubscribe();
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
        if (!isAuthReady || !db) return;
        const q = query(collection(db, "orders"), where("status", "==", "Pending"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPendingOrdersCount(snapshot.size);
        }, (error) => {
            console.error("Error fetching pending orders count:", error);
        });
        return () => unsubscribe();
    }, [isAuthReady]);


    const renderActiveView = () => {
        switch (activeView) {
            case 'pos': return <PosView />;
            case 'orders': return <OrdersView />;
            case 'dashboard': return <DashboardView />;
            case 'accounting': return <AccountingView />;
            case 'misc': return <MiscView />;
            case 'admin': return <AdminView />;
            default: return <PosView />;
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
                <AiFlow />
            </main>
        </div>
    );
}
