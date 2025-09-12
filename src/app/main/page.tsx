
"use client";

import React, { useState, useEffect, Suspense, useContext } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu, LogOut, Package, Users } from 'lucide-react';
import Image from 'next/image';
import logo from '@/app/logo.png';

import Sidebar from '@/components/cafe/Sidebar';
import PosView from '@/components/cafe/PosView';
import OrdersView from '@/components/cafe/OrdersView';
import DashboardView from '@/components/cafe/DashboardView';
import AdminView from '@/components/cafe/AdminView';
import AccountsView from '@/components/cafe/AccountsView';
import MiscView from '@/components/cafe/MiscView';
import AccountingView from '@/components/cafe/AccountingView';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import StockView from '@/components/cafe/StockView';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Home, ClipboardList, Settings, BarChart2, Sun, Moon, Briefcase, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { OrderEditingProvider } from '@/context/OrderEditingContext';
import { AuthContext } from '@/context/AuthContext';

const MobileNav = ({
    activeView,
    setActiveView,
    theme,
    setTheme,
    pendingOrdersCount,
    role,
    onLogout
}: {
    activeView: string;
    setActiveView: (view: string) => void;
    theme: string;
    setTheme: () => void;
    pendingOrdersCount: number;
    role: 'manager' | 'cashier';
    onLogout: () => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const navItemsConfig = {
        manager: [
            { id: 'dashboard', icon: BarChart2, label: 'Dashboard' },
            { id: 'admin', icon: Settings, label: 'Admin Panel' },
            { id: 'accounts', icon: Users, label: 'Cashier Accounts' },
        ],
        cashier: [
            { id: 'pos', icon: Home, label: 'POS' },
            { id: 'orders', icon: ClipboardList, label: 'Orders', badge: pendingOrdersCount },
            { id: 'stock', icon: Package, label: 'Stock' },
            { id: 'accounting', icon: Scale, label: 'Accounting' },
            { id: 'misc', icon: Briefcase, label: 'Miscellaneous' },
        ],
    };

    const navItems = navItemsConfig[role] || [];

    const handleItemClick = (view: string) => {
        setActiveView(view);
        setIsOpen(false);
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <div className="md:hidden flex justify-between items-center p-4 bg-card border-b">
                 <div className="flex items-center space-x-2">
                    <Image src={logo} alt="Nuel's Food Zone Logo" width={32} height={32} className="rounded-md" />
                    <h1 className="font-bold text-lg">Nuel's Foodzone Cafe</h1>
                </div>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon"><Menu /></Button>
                </SheetTrigger>
            </div>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <Image src={logo} alt="Nuel's Food Zone Logo" width={32} height={32} className="rounded-md" />
                        <div>
                            <p>Nuel's Foodzone Cafe</p>
                            <p className="text-sm font-normal text-muted-foreground capitalize">{role} View</p>
                        </div>
                    </SheetTitle>
                </SheetHeader>
                 <div className="p-4 flex-grow">
                    <ul className="space-y-2">
                        {navItems.map(item => (
                            <li key={item.id}>
                                <Button
                                    variant={activeView === item.id ? 'default' : 'ghost'}
                                    className="w-full justify-start text-base"
                                    onClick={() => handleItemClick(item.id)}
                                >
                                    <item.icon className="mr-3 h-5 w-5" />
                                    {item.label}
                                     {item.badge > 0 && (
                                        <span className="ml-auto bg-green-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                            {item.badge}
                                        </span>
                                    )}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="p-4 border-t mt-auto">
                     <Button onClick={setTheme} variant="ghost" className="w-full justify-start text-base mb-2">
                        {theme === 'light' ? <Moon className="mr-3 h-5 w-5" /> : <Sun className="mr-3 h-5 w-5" />}
                        Toggle Theme
                    </Button>
                    <Separator />
                     <Button onClick={onLogout} variant="ghost" className="w-full justify-start text-base text-red-500 hover:bg-red-500/10 hover:text-red-500 mt-2">
                        <LogOut className="mr-3 h-5 w-5" />
                        Logout
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
};


function CafePage() {
    const router = useRouter();
    const { session, logout, isLoading: isAuthLoading } = useContext(AuthContext);
    const role = session?.role;

    const defaultViews = {
        manager: 'dashboard',
        cashier: 'pos',
    };

    const [activeView, setActiveView] = useState('');
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [theme, setTheme] = useState('light');
    const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
    const isMobile = useIsMobile();

    useEffect(() => {
        if (isAuthLoading) return;
        
        if (!role || !['manager', 'cashier'].includes(role)) {
            router.push('/');
            return;
        }

        setActiveView(defaultViews[role]);

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
    }, [role, router, isAuthLoading]);
    
    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        const root = window.document.documentElement;
        root.classList.remove(theme);
        root.classList.add(newTheme);
        localStorage.setItem('theme', newTheme);
        setTheme(newTheme);
    };

    const handleLogout = () => {
        logout();
        router.push('/');
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
        // Client-side role check for security reinforcement
        const isManager = role === 'manager';
        const isCashier = role === 'cashier';

        switch (activeView) {
            // Cashier Views
            case 'pos': return isCashier ? <PosView setActiveView={setActiveView} /> : null;
            case 'orders': return isCashier ? <OrdersView setActiveView={setActiveView} /> : null;
            case 'accounting': return isCashier ? <AccountingView setActiveView={setActiveView}/> : null;
            case 'misc': return isCashier ? <MiscView /> : null;
            case 'stock': return isCashier ? <StockView /> : null;
            
            // Manager Views
            case 'dashboard': return isManager ? <DashboardView /> : null;
            case 'admin': return isManager ? <AdminView /> : null;
            case 'accounts': return isManager ? <AccountsView /> : null;
            
            default: return null;
        }
    };

    if (!isAuthReady || isAuthLoading || !role) {
        return (
            <div className="h-screen w-screen bg-background flex flex-col items-center justify-center">
                <LoadingSpinner />
                <p className="mt-4 text-lg text-muted-foreground">Initializing Nuel's Foodzone Cafe POS...</p>
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
    
    const MainContent = () => (
        <div className="flex h-screen bg-secondary/50 dark:bg-background font-body text-foreground">
            <Sidebar 
                activeView={activeView} 
                setActiveView={setActiveView} 
                theme={theme} 
                setTheme={toggleTheme} 
                pendingOrdersCount={pendingOrdersCount}
                role={role}
                onLogout={handleLogout}
            />
            <main className="flex-1 flex flex-col overflow-hidden">
                {renderActiveView()}
            </main>
        </div>
    );

    const MobileContent = () => (
        <div className="h-screen flex flex-col bg-secondary/50 dark:bg-background font-body text-foreground">
             <MobileNav 
                activeView={activeView}
                setActiveView={setActiveView}
                theme={theme}
                setTheme={toggleTheme}
                pendingOrdersCount={pendingOrdersCount}
                role={role}
                onLogout={handleLogout}
            />
            <main className="flex-1 flex flex-col overflow-hidden">
                {renderActiveView()}
            </main>
        </div>
    );


    return isMobile ? <MobileContent /> : <MainContent />;
}

export default function CafePageWrapper() {
    return (
        <Suspense fallback={<div className="h-screen w-screen bg-background flex flex-col items-center justify-center"><LoadingSpinner /><p className="mt-4 text-lg text-muted-foreground">Loading...</p></div>}>
            <OrderEditingProvider>
                <CafePage />
            </OrderEditingProvider>
        </Suspense>
    )
}
