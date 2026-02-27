import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Landmark, CreditCard, Hourglass, MinusCircle, Gift, Ban, ArrowRightLeft, Coins } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import type { PeriodStats, Order } from '@/lib/types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatTimestamp } from '@/lib/utils';

const StatCard: React.FC<{
    icon: React.ReactNode,
    title: string,
    value: string | number,
    color?: string,
    description?: string | React.ReactNode,
    onClick?: () => void,
    className?: string
}> = ({ icon, title, value, color, description, onClick, className }) => (
    <Card onClick={onClick} className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className={`text-xl md:text-2xl font-bold ${color}`}>{value}</div>
            {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </CardContent>
    </Card>
);

interface FinancialSummaryProps {
    stats: PeriodStats;
}

export const FinancialSummary: React.FC<FinancialSummaryProps> = ({ stats }) => {
    // Helper function: must be defined before use
    const getOrderContribution = (order: Order, method: 'cash' | 'momo' = 'cash') => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        if (order.paymentHistory && Array.isArray(order.paymentHistory)) {
            let cashPaid = 0;
            let momoPaid = 0;
            order.paymentHistory.forEach(p => {
                const pDate = p.timestamp?.toDate();
                if (pDate && pDate >= todayStart && pDate <= todayEnd) {
                    if (p.method === 'cash') cashPaid += p.amount;
                    if (p.method === 'momo' || p.method === 'card') momoPaid += p.amount;
                }
            });
            if (method === 'cash') return Math.min(order.total, cashPaid);
            if (method === 'momo') return Math.min(order.total, momoPaid);
            return 0;
        }
        const paymentDate = order.lastPaymentTimestamp?.toDate() || order.timestamp.toDate();
        if (paymentDate && paymentDate >= todayStart && paymentDate <= todayEnd) {
            if (order.paymentBreakdown) {
                if (method === 'cash') return Math.min(order.total, order.paymentBreakdown.cash || 0);
                if (method === 'momo') return Math.min(order.total, order.paymentBreakdown.momo || 0);
            } else {
                if (method === 'cash') {
                    if (order.paymentMethod === 'cash' || order.paymentMethod === 'split') return Math.min(order.total, order.amountPaid);
                }
                if (method === 'momo') {
                    if (order.paymentMethod === 'momo') return Math.min(order.total, order.amountPaid);
                }
            }
        }
        return 0;
    };
    // Only include orders created today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const sourceOrders = (stats.orders || []).filter(order => {
        const orderDate = order.timestamp?.toDate?.() || order.timestamp;
        return orderDate >= todayStart && orderDate <= todayEnd;
    });

    // Cash sales card value: sum of contributions for today's orders
    const cashSalesCardValue = sourceOrders.reduce((sum, order) => sum + getOrderContribution(order), 0);
    const sortedItemStats = Object.entries(stats.itemStats).sort(([, a], [, b]) => b.count - a.count);
    const [detailsOpen, setDetailsOpen] = React.useState(false);
    const [selectedMethod, setSelectedMethod] = React.useState<'cash' | 'momo' | null>(null);

    const handleShowDetails = (method: 'cash' | 'momo') => {
        setSelectedMethod(method);
        setDetailsOpen(true);
    };


    const getFilteredOrders = () => {
        if (!selectedMethod) return [];
        // Only include orders created today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const sourceOrders = (stats.orders || []).filter(order => {
            const orderDate = order.timestamp?.toDate?.() || order.timestamp;
            return orderDate >= todayStart && orderDate <= todayEnd;
        });
        return sourceOrders.filter(order => getOrderContribution(order) !== 0);
    };

    const filteredOrders = getFilteredOrders();
    const totalForMethod = filteredOrders.reduce((sum, order) => sum + getOrderContribution(order), 0);


    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Financial Summary</CardTitle>
                            <CardDescription>Daily financial data for {format(new Date(), "EEEE, MMMM dd, yyyy")}</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <StatCard icon={<DollarSign className="text-muted-foreground" />} title="Total Sales" value={formatCurrency(stats.totalSales)} description={`${stats.totalItemsSold} items sold from completed orders`} />
                            <StatCard
                                icon={<Landmark className="text-muted-foreground" />}
                                title="Cash Sales"
                                value={formatCurrency(cashSalesCardValue)}
                                description="All cash payments received today"
                                onClick={() => handleShowDetails('cash')}
                                className="cursor-pointer hover:bg-accent/50 transition-colors"
                            />
                            <StatCard
                                icon={<CreditCard className="text-muted-foreground" />}
                                title="Momo/Card Sales"
                                value={formatCurrency(stats.momoSales)}
                                description="All momo/card payments received"
                                onClick={() => handleShowDetails('momo')}
                                className="cursor-pointer hover:bg-accent/50 transition-colors"
                            />
                            <StatCard
                                icon={<Hourglass className="text-muted-foreground" />}
                                title="Unpaid Orders (All Time)"
                                value={formatCurrency(stats.allTimeUnpaidOrdersValue)}
                                description={
                                    <span>
                                        <strong className="text-base font-semibold text-foreground">Today: {formatCurrency(stats.todayUnpaidOrdersValue)}</strong>
                                        {' | '}
                                        Previous: {formatCurrency(stats.previousUnpaidOrdersValue)}
                                    </span>
                                }
                            />
                            <StatCard icon={<MinusCircle className="text-muted-foreground" />} title="Total Misc. Expenses" value={formatCurrency(stats.miscCashExpenses + stats.miscMomoExpenses)} description={`Cash: ${formatCurrency(stats.miscCashExpenses)} | Momo: ${formatCurrency(stats.miscMomoExpenses)}`} />
                            <StatCard icon={<Gift className="text-muted-foreground" />} title="Reward Discounts" value={formatCurrency(stats.totalRewardDiscount)} description="Total discounts from rewards" />
                            <StatCard icon={<Ban className="text-muted-foreground" />} title="Pardoned Deficits" value={formatCurrency(stats.totalPardonedAmount)} description="Unplanned discounts given today" />
                            <StatCard icon={<ArrowRightLeft className="text-muted-foreground" />} title="Change Owed" value={formatCurrency(stats.changeOwedForPeriod)} description="Total change owed to customers today" />

                        </CardContent>
                        <CardFooter>
                            <div className="w-full p-4 border rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                                <div className="flex justify-between items-baseline">
                                    <Label className="text-sm font-semibold text-green-700 dark:text-green-300">Total Revenue</Label>
                                    <p className="text-3xl font-bold">{formatCurrency(stats.totalSales - stats.todayUnpaidOrdersValue)}</p>
                                </div>

                                {stats.settledUnpaidOrdersValue > 0 && (
                                    <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700 text-sm">
                                        <div className="flex justify-between items-center text-green-700 dark:text-green-300">
                                            <span className="font-bold">Today's Net: {formatCurrency(stats.netRevenue - stats.settledUnpaidOrdersValue)}</span>
                                            <span className="font-semibold">+ Collections: {formatCurrency(stats.settledUnpaidOrdersValue)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardFooter>
                    </Card>
                </div>
                <div className="flex flex-col">
                    <Card className="flex-1 flex flex-col">
                        <CardHeader>
                            <CardTitle>Item Sales (Completed Orders)</CardTitle>
                            <CardDescription>Total count and value of each item sold today.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto">
                            <div className="space-y-2">
                                {sortedItemStats.length > 0 ? (
                                    sortedItemStats.map(([name, itemStat]) => (
                                        <div key={name} className="flex justify-between items-center p-3 rounded-lg bg-secondary">
                                            <div>
                                                <p className="font-semibold">{name}</p>
                                                <p className="text-sm text-muted-foreground">{itemStat.count} sold</p>
                                            </div>
                                            <Badge variant="destructive">{formatCurrency(itemStat.totalValue)}</Badge>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex items-center justify-center text-muted-foreground">
                                        <p>No items sold today.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle>{selectedMethod === 'cash' ? 'Cash Sales' : 'Momo/Card Sales'} Details</DialogTitle>
                        <DialogDescription>
                            Total: {formatCurrency(totalForMethod)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto min-h-0 p-6"><Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Order Total</TableHead>
                                <TableHead className="text-right">Contribution</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredOrders.length > 0 ? (
                                filteredOrders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">{order.simplifiedId}</TableCell>
                                        <TableCell>{formatTimestamp(order.timestamp)}</TableCell>
                                        <TableCell>{formatCurrency(order.total)}</TableCell>
                                        <TableCell className="text-right font-bold">
                                            {formatCurrency(getOrderContribution(order))}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center">No orders found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table></div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
