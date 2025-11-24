import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Banknote, Smartphone, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CASH_DENOMINATIONS } from '@/lib/constants';

interface CashCountSectionProps {
    denominationQuantities: Record<string, string>;
    onDenominationChange: (value: string, denomination: string) => void;
    totalCountedCash: number;
    momoInput: string;
    setMomoInput: (value: string) => void;
    handleMomoInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    momoTransactions: number[];
    removeMomoTransaction: (index: number) => void;
    totalCountedMomo: number;
}

export const CashCountSection: React.FC<CashCountSectionProps> = ({
    denominationQuantities,
    onDenominationChange,
    totalCountedCash,
    momoInput,
    setMomoInput,
    handleMomoInputKeyDown,
    momoTransactions,
    removeMomoTransaction,
    totalCountedMomo
}) => {
    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Banknote className="h-5 w-5 text-green-600" />
                        Physical Cash Count
                    </CardTitle>
                    <CardDescription>Count each denomination in your cash drawer</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        {CASH_DENOMINATIONS.map(den => (
                            <div key={den} className="space-y-2">
                                <Label className="text-sm font-medium">GH₵{den}</Label>
                                <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg border">
                                    <span className="text-sm text-muted-foreground min-w-[20px]">×</span>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={denominationQuantities[String(den)]}
                                        onChange={(e) => onDenominationChange(e.target.value, String(den))}
                                        placeholder="0"
                                        className="text-center font-medium border-0 bg-transparent p-0 h-auto focus-visible:ring-1"
                                    />
                                </div>
                                <div className="text-xs text-center text-muted-foreground">
                                    {denominationQuantities[String(den)]
                                        ? formatCurrency(den * (parseInt(String(denominationQuantities[String(den)])) || 0))
                                        : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-green-800 dark:text-green-200">Total Cash Counted:</span>
                            <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                {formatCurrency(totalCountedCash)}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Smartphone className="h-5 w-5 text-purple-600" />
                        MoMo/Card Transactions
                    </CardTitle>
                    <CardDescription>Enter individual transaction amounts (press Space or Enter to add)</CardDescription>
                </CardHeader>
                <CardContent>
                    <Input
                        type="number"
                        step="0.01"
                        value={momoInput}
                        onChange={(e) => setMomoInput(e.target.value)}
                        onKeyDown={handleMomoInputKeyDown}
                        placeholder="Enter amount and press Space/Enter"
                        className="mb-4 h-12 text-lg"
                    />
                    {momoTransactions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {momoTransactions.map((amount, index) => (
                                <Badge key={index} variant="secondary" className="text-sm px-3 py-2">
                                    {formatCurrency(amount)}
                                    <button
                                        onClick={() => removeMomoTransaction(index)}
                                        className="ml-2 hover:bg-destructive/20 rounded-full p-0.5"
                                        aria-label="Remove transaction"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}
                    <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-purple-800 dark:text-purple-200">Total MoMo Counted:</span>
                            <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                                {formatCurrency(totalCountedMomo)}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </>
    );
};
