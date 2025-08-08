"use client";

import Image from 'next/image';
import { Home, ClipboardList, Settings, BarChart2, Sun, Moon } from 'lucide-react';

interface SidebarProps {
    activeView: string;
    setActiveView: (view: string) => void;
    theme: string;
    setTheme: (theme: string) => void;
    pendingOrdersCount: number;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, theme, setTheme, pendingOrdersCount }) => {
    const navItems = [
        { id: 'pos', icon: Home, label: 'POS' },
        { id: 'orders', icon: ClipboardList, label: 'Orders', badge: pendingOrdersCount },
        { id: 'dashboard', icon: BarChart2, label: 'Dashboard' },
        { id: 'admin', icon: Settings, label: 'Admin' },
    ];

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    return (
        <nav className="w-20 bg-card border-r border-border flex flex-col items-center justify-between py-6 shadow-md">
            <div>
                <Image src="https://i.imgur.com/gJ54w4r.png" alt="Nuel's Food Zone Logo" width={48} height={48} className="mb-10 mx-auto rounded-full" />
                <ul className="space-y-4">
                    {navItems.map(item => (
                        <li key={item.id} className="relative">
                            <button
                                onClick={() => setActiveView(item.id)}
                                className={`w-14 h-14 flex items-center justify-center rounded-xl transition-all duration-300 ${
                                    activeView === item.id 
                                    ? 'bg-primary text-primary-foreground shadow-lg' 
                                    : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                                }`}
                                title={item.label}
                            >
                                <item.icon size={24} />
                            </button>
                            {item.badge > 0 && (
                                <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                                    {item.badge}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
            <button onClick={toggleTheme} className="w-14 h-14 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary">
                {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
            </button>
        </nav>
    );
};

export default Sidebar;
