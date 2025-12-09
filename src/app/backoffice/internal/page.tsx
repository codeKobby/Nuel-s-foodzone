"use client";

import React, { useState, useEffect, Suspense, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, authReadyPromise } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu, LogOut, Package, Gift, LucideIcon } from 'lucide-react';
import Image from 'next/image';
import logo from '@/app/logo.png';

import Sidebar from '@/components/cafe/Sidebar';
import POSView from '@/components/cafe/POSView';
import OrdersView from '@/components/cafe/OrdersView';
import DashboardView from '@/components/cafe/DashboardView';
import AdminView from '@/components/cafe/AdminView';
import MiscView from '@/components/cafe/MiscView';
import AccountingView from '@/components/cafe/AccountingView';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import StockView from '@/components/cafe/StockView';
import RewardsView from '@/components/cafe/RewardsView';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Home, ClipboardList, Settings, BarChart2, Sun, Moon, Briefcase, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { AuthContext } from '@/context/AuthContext';
import type { MenuItem } from '@/lib/types';
import BackofficeHeader from '@/components/cafe/BackofficeHeader';

type NavItem = {
    id: string;
    icon: LucideIcon;
    label: string;
    badge?: number;
}

const MobileNav = ({
    activeView,
    setActiveView,
    theme,
    setTheme,
    pendingOrdersCount,
    lowStockCount,
    role,
    onLogout
}: {
    activeView: string;
    setActiveView: (view: string) => void;
    theme: 'light' | 'dark';
    setTheme: () => void;
    pendingOrdersCount: number;
    lowStockCount: number;
    role: 'manager' | 'cashier';
    onLogout: () => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const navItemsConfig: Record<'manager' | 'cashier', NavItem[]> = {
        manager: [
            { id: 'dashboard', icon: BarChart2, label: 'Dashboard' },
            { id: 'admin', icon: Settings, label: 'Admin Panel' },
        ],
        cashier: [
            { id: 'pos', icon: Home, label: 'POS' },
            { id: 'orders', icon: ClipboardList, label: 'Orders', badge: pendingOrdersCount },
            { id: 'stock', icon: Package, label: 'Stock', badge: lowStockCount },
            { id: 'rewards', icon: Gift, label: 'Rewards' },
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
            <div className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-card/95 px-3 py-2 shadow-sm backdrop-blur-md safe-top">
                <div className="flex items-center space-x-2 min-w-0">
                    <Image src={logo} alt="Nuel's Food Zone Logo" width={28} height={28} className="rounded-md flex-shrink-0" />
                    <h1 className="font-bold text-base truncate">Nuel's Foodzone</h1>
                </div>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0" title="Open menu" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
                </SheetTrigger>
            </div>
            <SheetContent side="left" className="w-[280px] max-w-[85vw] p-0 flex flex-col">
                <SheetHeader className="p-3 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <Image src={logo} alt="Nuel's Food Zone Logo" width={28} height={28} className="rounded-md" />
                        <div className="min-w-0">
                            <p className="truncate">Nuel's Foodzone Cafe</p>
                            <p className="text-xs font-normal text-muted-foreground capitalize">{role} View</p>
                        </div>
                    </SheetTitle>
                </SheetHeader>
                <div className="p-3 flex-grow overflow-y-auto">
                    <ul className="space-y-1">
                        {navItems.map(item => (
                            <li key={item.id}>
                                <Button
                                    variant={activeView === item.id ? 'default' : 'ghost'}
                                    className="w-full justify-start text-sm h-10"
                                    onClick={() => handleItemClick(item.id)}
                                >
                                    <item.icon className="mr-2 h-4 w-4" />
                                    {item.label}
                                    {item.badge != undefined && item.badge > 0 && (
                                        <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                            {item.badge}
                                        </span>
                                    )}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="p-3 border-t mt-auto safe-bottom">
                    <Button onClick={setTheme} variant="ghost" className="w-full justify-start text-sm h-10 mb-1">
                        {theme === 'light' ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                        Toggle Theme
                    </Button>
                    <Separator />
                    <Button onClick={onLogout} variant="ghost" className="w-full justify-start text-sm h-10 text-red-500 hover:bg-red-500/10 hover:text-red-500 mt-1">
                        <LogOut className="mr-2 h-4 w-4" />
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
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
    const [lowStockCount, setLowStockCount] = useState(0);
    const isMobile = useIsMobile();

    const viewLabels: Record<string, string> = {
        pos: 'Point of Sale',
        orders: 'Orders Queue',
        accounting: 'Accounting',
        misc: 'Miscellaneous',
        stock: 'Stock Monitor',
        rewards: 'Rewards',
        dashboard: 'Dashboard',
        admin: 'Admin Panel',
    };

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const init = async () => {
            const authInstance = await authReadyPromise;

            if (!authInstance || !db) {
                setAuthError("Firebase is not configured. Please check your environment variables.");
                setIsAuthReady(true);
                return;
            }

            if (typeof window !== 'undefined') {
                const storedTheme = localStorage.getItem('theme');
                const normalizedTheme: 'light' | 'dark' = storedTheme === 'dark' ? 'dark' : 'light';
                setTheme(normalizedTheme);
                document.documentElement.classList.add(normalizedTheme);
            }

            const { onAuthStateChanged, signInAnonymously } = await import('firebase/auth');

            unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                try {
                    if (!user) {
                        await signInAnonymously(authInstance);
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
        };

        init();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

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
        router.push('/backoffice');
    };

    useEffect(() => {
        if (!role) return;
        setActiveView((prev) => {
            if (prev) return prev;
            const fallback = defaultViews[role as 'manager' | 'cashier'] ?? 'pos';
            return fallback;
        });
    }, [role]);

    useEffect(() => {
        if (isAuthReady && !isAuthLoading && !role) {
            const timeout = setTimeout(() => router.replace('/backoffice'), 1500);
            return () => clearTimeout(timeout);
        }
    }, [isAuthReady, isAuthLoading, role, router]);

    useEffect(() => {
        if (!isAuthReady || !db) return;

        const ordersQuery = query(collection(db, "orders"), where("status", "==", "Pending"));
        const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
            setPendingOrdersCount(snapshot.size);
        }, (error) => {
            console.error("Error fetching pending orders count:", error);
        });

        const menuQuery = query(collection(db, "menuItems"), where("category", "in", ["Drinks", "Breakfast Drinks"]));
        const unsubscribeMenu = onSnapshot(menuQuery, (snapshot) => {
            const items = snapshot.docs.map(doc => doc.data() as MenuItem);
            const lowStock = items.filter(item => (item.stock ?? 0) <= 5).length;
            setLowStockCount(lowStock);
        }, (error) => {
            console.error("Error fetching menu items for stock count:", error);
        });

        return () => {
            unsubscribeOrders();
            unsubscribeMenu();
        };
    }, [isAuthReady]);


    const renderActiveView = () => {
        const isManager = role === 'manager';
        const isCashier = role === 'cashier';

        switch (activeView) {
            case 'pos': return isCashier ? <POSView setActiveView={setActiveView} /> : null;
            case 'orders': return isCashier ? <OrdersView setActiveView={setActiveView} /> : null;
            case 'accounting': return isCashier ? <AccountingView setActiveView={setActiveView} /> : null;
            case 'misc': return isCashier ? <MiscView /> : null;
            case 'stock': return isCashier ? <StockView /> : null;
            case 'rewards': return isCashier ? <RewardsView /> : null;

            case 'dashboard': return isManager ? <DashboardView /> : null;
            case 'admin': return isManager ? <AdminView /> : null;

            default:
                const fallbackId = role ? defaultViews[role as 'manager' | 'cashier'] : null;
                const fallbackLabel = fallbackId ? viewLabels[fallbackId] : 'Overview';
                return (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">No view selected</p>
                        <h2 className="text-2xl font-semibold">Choose a workspace to get started</h2>
                        <p className="max-w-md text-muted-foreground">
                            Your session is authenticated but no module is active. Pick a view from the sidebar or jump back into
                            {fallbackLabel ? ` ${fallbackLabel}.` : ' your default workspace.'}
                        </p>
                        {fallbackId && (
                            <Button onClick={() => setActiveView(fallbackId)} className="gap-2">
                                Jump to {fallbackLabel}
                            </Button>
                        )}
                    </div>
                );
        }
    };

    if (!isAuthReady || isAuthLoading) {
        return (
            <div className="min-h-dvh h-dvh w-screen bg-background flex flex-col items-center justify-center">
                <LoadingSpinner />
                <p className="mt-4 text-lg text-muted-foreground">Initializing Backoffice...</p>
            </div>
        );
    }

    if (!role) {
        return (
            <div className="min-h-dvh h-dvh w-screen bg-background flex flex-col items-center justify-center p-6 text-center">
                <LoadingSpinner />
                <p className="mt-4 text-lg font-medium">Routing you to the role selector…</p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    We could not find an active backoffice session. You&apos;ll be redirected to choose Manager or Cashier again.
                </p>
                <Button onClick={() => router.replace('/backoffice')} className="mt-6">
                    Go now
                </Button>
            </div>
        );
    }

    if (authError) {
        return (
            <div className="min-h-dvh h-dvh w-screen bg-background flex items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Application Error</AlertTitle>
                    <AlertDescription>{authError}</AlertDescription>
                </Alert>
            </div>
        );
    }

    const ViewContainer = () => {
        if (activeView === 'pos') {
            return (
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    {renderActiveView()}
                </div>
            );
        }
        return (
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-4 lg:px-8">
                <div className="flex h-full flex-col overflow-hidden rounded-xl md:rounded-2xl border border-border/60 bg-card/40">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-xl md:rounded-2xl bg-background/70 p-3 md:p-4 lg:p-6">
                        {renderActiveView()}
                    </div>
                </div>
            </div>
        );
    };

    const MainContent = () => (
        <div className="flex h-dvh min-h-dvh max-h-dvh bg-secondary/40 dark:bg-background font-body text-foreground overflow-hidden">
            <Sidebar
                activeView={activeView}
                setActiveView={setActiveView}
                theme={theme}
                setTheme={toggleTheme}
                pendingOrdersCount={pendingOrdersCount}
                lowStockCount={lowStockCount}
                role={role}
                onLogout={handleLogout}
            />
            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                <BackofficeHeader
                    role={role}
                    theme={theme}
                    onToggleTheme={toggleTheme}
                    pendingOrdersCount={pendingOrdersCount}
                    lowStockCount={lowStockCount}
                />
                <ViewContainer />
            </main>
        </div>
    );

    const MobileContent = () => (
        <div className="h-dvh min-h-dvh max-h-dvh flex flex-col bg-secondary/40 dark:bg-background font-body text-foreground overflow-hidden safe-bottom">
            <MobileNav
                activeView={activeView}
                setActiveView={setActiveView}
                theme={theme}
                setTheme={toggleTheme}
                pendingOrdersCount={pendingOrdersCount}
                lowStockCount={lowStockCount}
                role={role}
                onLogout={handleLogout}
            />
            <main className="flex-1 flex flex-col overflow-hidden min-h-0">
                <BackofficeHeader
                    role={role}
                    theme={theme}
                    onToggleTheme={toggleTheme}
                    pendingOrdersCount={pendingOrdersCount}
                    lowStockCount={lowStockCount}
                />
                <ViewContainer />
            </main>
        </div>
    );


    return isMobile ? <MobileContent /> : <MainContent />;
}

export default function CafePageWrapper() {
    return (
        <Suspense fallback={<div className="min-h-dvh h-dvh w-screen bg-background flex flex-col items-center justify-center"><LoadingSpinner /><p className="mt-4 text-lg text-muted-foreground">Loading...</p></div>}>
            <CafePage />
        </Suspense>
    )
}
