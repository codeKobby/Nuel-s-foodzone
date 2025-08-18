"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, addDoc, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, MiscExpense, ReconciliationReport, PreviousDaySettlement, ChangeFund } from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { DollarSign, CreditCard, MinusCircle, History, Landmark, Coins, AlertCircle, Search, Package, Calendar as CalendarIcon, FileCheck, Hourglass, ShoppingCart, Lock, X, Ban, HelpCircle, TrendingUp, TrendingDown, Plus, Calculator, Eye, Clock, AlertTriangle as AlertTriangleIcon } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AdvancedReconciliationModal from './modals/AdvancedReconciliationModal';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { addDays, format, isToday } from "date-fns"
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';


interface EnhancedPeriodStats {
    // Today's New Business
    todayNewSales: number;
    todayNewItemsSold: number;
    todayNewCashSales: number;
    todayNewMomoSales: number;
    
    // Previous Days Collections
    previousDaysCashCollected: number;
    previousDaysMomoCollected: number;
    previousDaysOrdersSettled: PreviousDaySettlement[];
    
    // Total Expected
    totalExpectedCash: number;
    totalExpectedMomo: number;
    
    // Expenses
    miscCashExpenses: number;
    miscMomoExpenses: number;
    
    // Change Management
    changeFund: ChangeFund;
    changeImpactOnNet: number;
    
    // Revenue
    netRevenueFromNewSales: number;
    totalNetRevenue: number;
    
    // Unpaid tracking
    allTimeUnpaidOrdersValue: number;
    todayUnpaidOrdersValue: number;
    overdueOrdersCount: number;
    
    totalPardonedAmount: number;
    orders: Order[];
    itemStats: Record<string, { count: number; totalValue: number }>;
}


const StatCard: React.FC<{ 
  icon: React.ReactNode; 
  title: string; 
  value: string | number; 
  color?: string; 
  description?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
}> = ({ icon, title, value, color, description, onClick, badge }) => (
  <Card className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="flex items-center gap-2">
        {badge}
        {icon}
      </div>
    </CardHeader>
    <CardContent onClick={onClick}>
      <div className={`text-xl md:text-2xl font-bold ${color}`}>{value}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

// Enhanced denomination component for better desktop experience
const DenominationCounter: React.FC<{
  denominations: number[];
  quantities: Record<string, string>;
  onChange: (denomination: string, value: string) => void;
  totalCounted: number;
}> = ({ denominations, quantities, onChange, totalCounted }) => {
  const [quickCalcMode, setQuickCalcMode] = useState(false);
  
  const handleQuickAdd = (denomination: number, addAmount: number) => {
    const current = parseInt(quantities[denomination], 10) || 0;
    const newQuantity = current + addAmount;
    onChange(String(denomination), String(Math.max(0, newQuantity)));
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-lg font-semibold">Cash by Denomination</Label>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setQuickCalcMode(!quickCalcMode)}
        >
          <Calculator className="h-4 w-4 mr-2" />
          {quickCalcMode ? 'Manual' : 'Quick Add'}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {denominations.map(den => {
          const quantity = parseInt(quantities[den], 10) || 0;
          const total = den * quantity;
          
          return (
            <div key={den} className="p-3 border rounded-lg bg-secondary/50 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-medium text-lg text-primary">
                  GH₵{den}
                </Label>
                <Badge variant="outline" className="text-xs">
                  = {formatCurrency(total)}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm min-w-[20px]">×</span>
                <Input 
                  type="number" 
                  value={quantities[den]} 
                  onChange={e => onChange(String(den), e.target.value)} 
                  placeholder="0"
                  className="h-10 text-center text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min="0"
                />
              </div>
              
              {quickCalcMode && (
                <div className="flex gap-1 mt-2">
                  {[1, 5, 10].map(add => (
                    <Button 
                      key={add}
                      variant="outline" 
                      size="sm" 
                      className="flex-1 h-7 text-xs"
                      onClick={() => handleQuickAdd(den, add)}
                    >
                      +{add}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="p-4 bg-primary/10 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-primary">Total Counted Cash:</span>
          <span className="text-xl font-bold text-primary">{formatCurrency(totalCounted)}</span>
        </div>
      </div>
    </div>
  );
};

// Change tracking display component
const ChangeFundDisplay: React.FC<{
  changeFund: ChangeFund;
  onViewHistory: () => void;
}> = ({ changeFund, onViewHistory }) => {
  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="bg-amber-50 dark:bg-amber-900/20">
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <Coins className="h-5 w-5" />
          Change Fund Status
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span>Opening:</span>
            <span className="font-medium">{formatCurrency(changeFund.openingBalance)}</span>
          </div>
          <div className="flex justify-between">
            <span>Available:</span>
            <span className="font-medium">{formatCurrency(changeFund.totalAvailable)}</span>
          </div>
          <div className="flex justify-between">
            <span>Set Aside:</span>
            <span className="font-medium">{formatCurrency(changeFund.setAsideAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Used Today:</span>
            <span className="font-medium">{formatCurrency(changeFund.changeSettled)}</span>
          </div>
        </div>
        
        {changeFund.setAsideAmount > 0 && (
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-xs text-amber-700 dark:text-amber-300">
            💰 {formatCurrency(changeFund.setAsideAmount)} carried forward from previous day
          </div>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full" 
          onClick={onViewHistory}
        >
          <History className="h-4 w-4 mr-2" />
          View Change History
        </Button>
      </CardContent>
    </Card>
  );
};

// Previous day settlements display
const PreviousDaySettlements: React.FC<{
  settlements: PreviousDaySettlement[];
  totalCash: number;
  totalMomo: number;
}> = ({ settlements, totalCash, totalMomo }) => {
  if (settlements.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No previous day settlements today
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded">
          <p className="text-sm text-green-600 dark:text-green-400">Cash Collections</p>
          <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(totalCash)}</p>
        </div>
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
          <p className="text-sm text-purple-600 dark:text-purple-400">MoMo Collections</p>
          <p className="text-lg font-bold text-purple-700 dark:text-purple-300\">{formatCurrency(totalMomo)}</p>
        </div>
      </div>
      
      <ScrollArea className="h-40">
        <div className="space-y-2">
          {settlements.map((settlement, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-secondary rounded text-sm">
              <div>
                <p className="font-medium">{settlement.orderNumber}</p>
                <p className="text-xs text-muted-foreground">
                  From {settlement.originalDate} • {settlement.method.toUpperCase()}
                </p>
              </div>
              <Badge variant={settlement.method === 'cash' ? 'default' : 'secondary'}>
                {formatCurrency(settlement.amount)}
              </Badge>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

const AccountingView: React.FC<{setActiveView: (view: string) => void;}> = ({setActiveView}) => {
    // Mock data for demonstration
    const [stats, setStats] = useState<EnhancedPeriodStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // This is where you would fetch your actual data
        const mockStats: EnhancedPeriodStats = {
            todayNewSales: 450.50,
            todayNewItemsSold: 25,
            todayNewCashSales: 300.00,
            todayNewMomoSales: 150.50,
            previousDaysCashCollected: 75.00,
            previousDaysMomoCollected: 25.00,
            previousDaysOrdersSettled: [
              { originalDate: '2024-01-16', orderId: '1', orderNumber: 'ORD-001', amount: 75.00, method: 'cash', customerName: 'John Doe' },
              { originalDate: '2024-01-15', orderId: '2', orderNumber: 'ORD-002', amount: 25.00, method: 'momo' }
            ],
            totalExpectedCash: 375.00,
            totalExpectedMomo: 175.50,
            miscCashExpenses: 20.00,
            miscMomoExpenses: 5.00,
            changeFund: {
              openingBalance: 30.00,
              changeGenerated: 15.50,
              changeSettled: 12.00,
              totalAvailable: 33.50,
              setAsideAmount: 18.00,
              wasSetAside: true,
              id: 'cf-1',
              date: '2024-07-24',
              closingBalance: 33.50,
              changeTransactions: [],
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            },
            changeImpactOnNet: -8.50,
            netRevenueFromNewSales: 420.00,
            totalNetRevenue: 512.00,
            allTimeUnpaidOrdersValue: 125.00,
            todayUnpaidOrdersValue: 50.00,
            overdueOrdersCount: 3,
            totalPardonedAmount: 10.00,
            orders: [],
            itemStats: {}
        };
        setStats(mockStats);
        setLoading(false);
    }, []);

    
    const [denominationQuantities, setDenominationQuantities] = useState<Record<string, string>>({
      '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': ''
    });
    
    const [momoTransactions, setMomoTransactions] = useState<number[]>([]);
    const [momoInput, setMomoInput] = useState('');
    const [isCloseOutOpen, setIsCloseOutOpen] = useState(false);
    const [showChangeHistory, setShowChangeHistory] = useState(false);
    
    const cashDenominations = [200, 100, 50, 20, 10, 5, 2, 1];
    
    const totalCountedCash = useMemo(() => {
      return cashDenominations.reduce((total, den) => {
        const quantity = parseInt(denominationQuantities[den], 10) || 0;
        return total + (den * quantity);
      }, 0);
    }, [denominationQuantities]);
    
    const totalCountedMomo = useMemo(() => {
      return momoTransactions.reduce((total, amount) => total + amount, 0);
    }, [momoTransactions]);
    
    const handleDenominationChange = (denomination: string, value: string) => {
      setDenominationQuantities(prev => ({ ...prev, [denomination]: value }));
    };
    
    const handleMomoInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.key === 'Enter' || e.key === ' ') && momoInput.trim() !== '') {
        e.preventDefault();
        const amount = parseFloat(momoInput);
        if (!isNaN(amount) && amount > 0) {
          setMomoTransactions([...momoTransactions, amount]);
          setMomoInput('');
        }
      }
    };
    
    const removeMomoTransaction = (indexToRemove: number) => {
      setMomoTransactions(momoTransactions.filter((_, index) => index !== indexToRemove));
    };
    
    const today = new Date();
    const todayFormatted = format(today, "EEEE, MMMM dd, yyyy");

    if (loading || !stats) {
        return <div className="h-full flex items-center justify-center"><LoadingSpinner /></div>
    }
    
    return (
      <TooltipProvider>
        <div className="p-4 md:p-6 h-full bg-secondary/50 dark:bg-background overflow-y-auto">
          <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">Enhanced Accounting</h2>
              <p className="text-muted-foreground">Daily accounting for {todayFormatted}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setIsCloseOutOpen(true)} className="w-full md:w-auto">
                <FileCheck className="mr-2" />
                Start End-of-Day
              </Button>
            </div>
          </div>
          
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Financial Summary</TabsTrigger>
              <TabsTrigger value="collections">
                Previous Collections 
                {stats.previousDaysOrdersSettled.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.previousDaysOrdersSettled.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="change">Change Fund</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Today's Business Summary</CardTitle>
                      <CardDescription>Breakdown of new sales vs previous day collections</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <StatCard 
                        icon={<DollarSign className="text-primary"/>} 
                        title="Today's New Sales" 
                        value={formatCurrency(stats.todayNewSales)} 
                        description={`${stats.todayNewItemsSold} items sold`}
                      />
                      <StatCard 
                        icon={<History className="text-green-500"/>} 
                        title="Previous Day Collections" 
                        value={formatCurrency(stats.previousDaysCashCollected + stats.previousDaysMomoCollected)} 
                        description={`+${formatCurrency(stats.previousDaysCashCollected)} cash, +${formatCurrency(stats.previousDaysMomoCollected)} momo`}
                        color="text-green-600"
                      />
                      <StatCard 
                        icon={<Landmark className="text-blue-500"/>} 
                        title="Total Cash Expected" 
                        value={formatCurrency(stats.totalExpectedCash)} 
                        description={`${formatCurrency(stats.todayNewCashSales)} new + ${formatCurrency(stats.previousDaysCashCollected)} collections`}
                      />
                      <StatCard 
                        icon={<CreditCard className="text-purple-500"/>} 
                        title="Total MoMo Expected" 
                        value={formatCurrency(stats.totalExpectedMomo)}
                        description={`${formatCurrency(stats.todayNewMomoSales)} new + ${formatCurrency(stats.previousDaysMomoCollected)} collections`}
                      />
                      <StatCard 
                        icon={<MinusCircle className="text-orange-500"/>} 
                        title="Total Expenses" 
                        value={formatCurrency(stats.miscCashExpenses + stats.miscMomoExpenses)} 
                        description={`Cash: ${formatCurrency(stats.miscCashExpenses)} | MoMo: ${formatCurrency(stats.miscMomoExpenses)}`}
                      />
                      <StatCard 
                        icon={<Hourglass className={stats.overdueOrdersCount === 0 ? "text-muted-foreground" : "text-amber-500"}/>} 
                        title="Unpaid Orders" 
                        value={formatCurrency(stats.allTimeUnpaidOrdersValue)} 
                        description={`${formatCurrency(stats.todayUnpaidOrdersValue)} from today`}
                        badge={stats.overdueOrdersCount > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            {stats.overdueOrdersCount} overdue
                          </Badge>
                        ) : undefined}
                        onClick={() => stats.overdueOrdersCount > 0 ? alert('Show overdue orders') : undefined}
                      />
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-4">
                      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                          <Label className="text-base font-semibold text-green-700 dark:text-green-300">Today's New Business Net</Label>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.netRevenueFromNewSales)}</p>
                          <p className="text-xs text-muted-foreground">(New Sales - Expenses - Pardons)</p>
                        </div>
                        <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                          <Label className="text-base font-semibold text-blue-700 dark:text-blue-300">Total Net Revenue</Label>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(stats.totalNetRevenue)}</p>
                          <p className="text-xs text-muted-foreground">(Including Previous Day Collections)</p>
                        </div>
                      </div>
                      
                      {stats.changeImpactOnNet !== 0 && (
                        <div className="w-full">
                          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                            <Coins className="h-4 w-4 text-amber-600" />
                            <AlertTitle className="text-amber-700 dark:text-amber-300">Change Impact on Net Revenue</AlertTitle>
                            <AlertDescription className="text-amber-600 dark:text-amber-400">
                              Net revenue shows {formatCurrency(stats.changeImpactOnNet)} impact from change not set aside.
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="p-0 h-auto text-amber-700 dark:text-amber-300"
                                onClick={() => setShowChangeHistory(true)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View change history
                              </Button>
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                </div>
                
                <div className="space-y-4">
                  <ChangeFundDisplay 
                    changeFund={stats.changeFund}
                    onViewHistory={() => setShowChangeHistory(true)}
                  />
                  
                  {stats.overdueOrdersCount > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangleIcon className="h-4 w-4" />
                      <AlertTitle>Overdue Orders Alert</AlertTitle>
                      <AlertDescription>
                        You have {stats.overdueOrdersCount} orders that are overdue for payment.
                        <Button variant="link" size="sm" className="p-0 h-auto ml-2">
                          Review overdue orders →
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="collections" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Previous Day Collections</CardTitle>
                  <CardDescription>
                    Orders from previous days that were settled today
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PreviousDaySettlements 
                    settlements={stats.previousDaysOrdersSettled}
                    totalCash={stats.previousDaysCashCollected}
                    totalMomo={stats.previousDaysMomoCollected}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="change" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Change Fund Overview</CardTitle>
                    <CardDescription>Track change money carried forward and used</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <p className="text-sm text-blue-600 dark:text-blue-400">Opening Balance</p>
                          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                            {formatCurrency(stats.changeFund.openingBalance)}
                          </p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded">
                          <p className="text-sm text-green-600 dark:text-green-400">Generated Today</p>
                          <p className="text-lg font-bold text-green-700 dark:text-green-300">
                            {formatCurrency(stats.changeFund.changeGenerated)}
                          </p>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded">
                          <p className="text-sm text-orange-600 dark:text-orange-400">Settled Today</p>
                          <p className="text-lg font-bold text-orange-700 dark:text-orange-300">
                            {formatCurrency(stats.changeFund.changeSettled)}
                          </p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
                          <p className="text-sm text-purple-600 dark:text-purple-400">Available Now</p>
                          <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                            {formatCurrency(stats.changeFund.totalAvailable)}
                          </p>
                        </div>
                      </div>
                      
                      {stats.changeFund.setAsideAmount > 0 && (
                        <div className="p-4 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Coins className="h-4 w-4 text-amber-600" />
                            <span className="font-medium text-amber-700 dark:text-amber-300">Money Set Aside</span>
                          </div>
                          <p className="text-sm text-amber-600 dark:text-amber-400">
                            {formatCurrency(stats.changeFund.setAsideAmount)} was carried forward from previous day.
                            This money is tracked separately and doesn't affect today's net revenue calculations.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Change Transactions</CardTitle>
                    <CardDescription>Recent change fund activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-secondary rounded text-sm">
                        <div>
                          <p className="font-medium">Order ORD-045 overpayment</p>
                          <p className="text-xs text-muted-foreground">Today 2:30 PM</p>
                        </div>
                        <Badge variant="secondary">+{formatCurrency(5.50)}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-secondary rounded text-sm">
                        <div>
                          <p className="font-medium">Change given to customer</p>
                          <p className="text-xs text-muted-foreground">Today 1:15 PM</p>
                        </div>
                        <Badge variant="outline">-{formatCurrency(3.00)}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-secondary rounded text-sm">
                        <div>
                          <p className="font-medium">Used for Order ORD-042</p>
                          <p className="text-xs text-muted-foreground">Today 12:45 PM</p>
                        </div>
                        <Badge variant="outline">-{formatCurrency(9.50)}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
          
          {/* End of Day Modal */}
          <Dialog open={isCloseOutOpen} onOpenChange={setIsCloseOutOpen}>
            <DialogContent className="max-w-7xl max-h-[95vh]">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="text-2xl font-bold">End-of-Day Reconciliation</DialogTitle>
                <DialogDescription className="text-base">
                  Complete daily cash reconciliation for {todayFormatted}
                </DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="max-h-[75vh]">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 py-6 pr-4">
                  {/* Left Column - Cash Count */}
                  <div className="xl:col-span-2 space-y-6">
                    <DenominationCounter 
                      denominations={cashDenominations}
                      quantities={denominationQuantities}
                      onChange={handleDenominationChange}
                      totalCounted={totalCountedCash}
                    />
                    
                    {/* MoMo Section */}
                    <div className="space-y-4">
                      <Label className="text-lg font-semibold">MoMo/Card Transactions</Label>
                      <Input 
                        type="number" 
                        value={momoInput} 
                        onChange={e => setMomoInput(e.target.value)} 
                        onKeyDown={handleMomoInputKeyDown}
                        placeholder="Enter amount and press Space/Enter"
                        className="h-12 text-lg"
                      />
                      <div className="flex flex-wrap gap-2">
                        {momoTransactions.map((amount, index) => (
                          <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
                            {formatCurrency(amount)}
                            <button onClick={() => removeMomoTransaction(index)} className="ml-2 hover:bg-destructive/20 rounded-full p-0.5">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                        <p className="font-semibold text-purple-600 dark:text-purple-400">Total Counted MoMo: {formatCurrency(totalCountedMomo)}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Column - Summary */}
                  <div className="space-y-6">
                    <Card className="border-2">
                      <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                          Expected vs Counted
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Expected Cash:</span>
                            <span className="font-bold">{formatCurrency(stats.totalExpectedCash)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Counted Cash:</span>
                            <span className="font-bold">{formatCurrency(totalCountedCash)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Expected MoMo:</span>
                            <span className="font-bold">{formatCurrency(stats.totalExpectedMomo)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Counted MoMo:</span>
                            <span className="font-bold">{formatCurrency(totalCountedMomo)}</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="bg-green-50 dark:bg-green-900/20 p-4">
                        <div className="w-full text-center">
                          <p className="text-sm text-muted-foreground mb-1">Total Variance</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency((totalCountedCash + totalCountedMomo) - (stats.totalExpectedCash + stats.totalExpectedMomo))}
                          </p>
                        </div>
                      </CardFooter>
                    </Card>
                    
                    {/* Previous Day Collections Summary */}
                    {stats.previousDaysOrdersSettled.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Previous Day Collections</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Cash Collections:</span>
                              <span className="font-medium text-green-600">+{formatCurrency(stats.previousDaysCashCollected)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>MoMo Collections:</span>
                              <span className="font-medium text-purple-600">+{formatCurrency(stats.previousDaysMomoCollected)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground pt-2">
                              These amounts are included in today's expected totals but don't affect today's net revenue.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Change Fund Status */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Change Fund Status</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Available:</span>
                            <span className="font-medium">{formatCurrency(stats.changeFund.totalAvailable)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Set Aside:</span>
                            <span className="font-medium">{formatCurrency(stats.changeFund.setAsideAmount)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground pt-2">
                            Change fund is tracked separately and doesn't affect cash reconciliation.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </ScrollArea>
              
              <DialogFooter className="pt-6 border-t">
                <Button className="w-full h-12 text-lg font-bold">
                  Finalize & Save Report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Change History Modal */}
          <Dialog open={showChangeHistory} onOpenChange={setShowChangeHistory}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Change Fund History</DialogTitle>
                <DialogDescription>
                  Detailed history of change fund transactions
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-96">
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded">
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-300">Order ORD-045 overpayment</p>
                      <p className="text-sm text-green-600 dark:text-green-400">Customer paid GH₵25 for GH₵19.50 order</p>
                      <p className="text-xs text-muted-foreground">Today 2:30 PM</p>
                    </div>
                    <Badge variant="default" className="bg-green-500">+{formatCurrency(5.50)}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded">
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-300">Change settled for yesterday's order</p>
                      <p className="text-sm text-red-600 dark:text-red-400">ORD-038 from Jan 16 - Customer collected change</p>
                      <p className="text-xs text-muted-foreground">Today 1:15 PM</p>
                    </div>
                    <Badge variant="destructive">-{formatCurrency(3.00)}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <div>
                      <p className="font-medium text-blue-700 dark:text-blue-300">Used as payment for Order ORD-042</p>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Customer used change credit for new order</p>
                      <p className="text-xs text-muted-foreground">Today 12:45 PM</p>
                    </div>
                    <Badge variant="secondary">-{formatCurrency(9.50)}</Badge>
                  </div>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    );
  };
  
  export default EnhancedAccountingView;