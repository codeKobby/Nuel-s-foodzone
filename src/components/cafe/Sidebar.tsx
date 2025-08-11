
"use client";

import Image from 'next/image';
import { Home, ClipboardList, Settings, BarChart2, Sun, Moon, Briefcase, Scale, LogOut } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import logo from '@/app/logo.png';
import { useRouter } from 'next/navigation';
import { Separator } from '../ui/separator';

interface SidebarProps {
    activeView: string;
    setActiveView: (view: string) => void;
    theme: string;
    setTheme: () => void;
    pendingOrdersCount: number;
    role: 'manager' | 'cashier';
    onLogout: () => void;
}

const NavItem = ({ item, activeView, setActiveView }: { item: any, activeView: string, setActiveView: (view: string) => void }) => (
    <li className="relative">
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={() => setActiveView(item.id)}
                    className={`w-14 h-14 flex items-center justify-center rounded-xl transition-all duration-300 group ${
                        activeView === item.id 
                        ? 'bg-primary text-primary-foreground shadow-lg scale-110' 
                        : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                    }`}
                >
                    <item.icon size={24} />
                </button>
            </TooltipTrigger>
            <TooltipContent side="right">
                <p>{item.label}</p>
            </TooltipContent>
        </Tooltip>
        {item.badge > 0 && (
            <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse border-2 border-card">
                {item.badge}
            </span>
        )}
    </li>
);

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, theme, setTheme, pendingOrdersCount, role, onLogout }) => {
    
    const navItemsConfig = {
        manager: [
            { id: 'dashboard', icon: BarChart2, label: 'Dashboard' },
            { id: 'admin', icon: Settings, label: 'Admin' },
        ],
        cashier: [
            { id: 'pos', icon: Home, label: 'POS' },
            { id: 'orders', icon: ClipboardList, label: 'Orders', badge: pendingOrdersCount },
            { id: 'accounting', icon: Scale, label: 'Accounting' },
            { id: 'misc', icon: Briefcase, label: 'Miscellaneous' },
        ],
    };

    const navItems = navItemsConfig[role] || [];

    return (
        <TooltipProvider>
            <nav className="hidden md:flex w-20 bg-card border-r border-border flex-col items-center justify-between py-6 z-20">
                <div className="flex flex-col items-center gap-10">
                    <Tooltip>
                         <TooltipTrigger asChild>
                            <div className='mx-auto text-center'>
                                <Image src={logo} alt="Nuel's Food Zone Logo" width={48} height={48} className="rounded-md" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            <p className="capitalize">{role} View</p>
                        </TooltipContent>
                    </Tooltip>
                    
                    <ul className="space-y-4">
                        {navItems.map(item => (
                            <NavItem key={item.id} item={item} activeView={activeView} setActiveView={setActiveView} />
                        ))}
                    </ul>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button onClick={setTheme} className="w-14 h-14 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-primary">
                                {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            <p>Toggle {theme === 'light' ? 'Dark' : 'Light'} Mode</p>
                        </TooltipContent>
                    </Tooltip>
                    <Separator className="w-10" />
                     <Tooltip>
                        <TooltipTrigger asChild>
                            <button onClick={onLogout} className="w-14 h-14 flex items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10">
                                <LogOut size={24} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            <p>Logout</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </nav>
        </TooltipProvider>
    );
};

export default Sidebar;
