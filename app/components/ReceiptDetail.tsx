'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PriceComparison {
  itemName: string;
  originalPrice: number;
  cheaperPrice: number;
  cheaperStore: string;
  savings: number;
  savingsPercentage: string;
}

interface Receipt {
  id: string;
  store_name: string;
  created_at: string;
  total_amount: number;
  items: Array<{
    id: string;
    item_name: string;
    item_price: number;
  }>;
  total_discounts?: number;
}

interface ReceiptDetailProps {
  receipt: Receipt;
}

const ReceiptDetail: React.FC<ReceiptDetailProps> = ({ receipt }) => {
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadComparisons() {
      try {
        setLoading(true);
        console.log('🔍 Loading comparisons for receipt:', receipt.id);
        
        const response = await fetch(`/api/price-comparison?receiptId=${receipt.id}`);
        console.log('📥 API response received:', response.status);

        if (!response.ok) {
          throw new Error('Failed to fetch comparisons');
        }

        const data = await response.json();
        console.log('📦 Comparison data:', data);
        
        setComparisons(data);
        console.log('✅ State updated successfully');
      } catch (err) {
        console.error('❌ Error loading comparisons:', err);
        setError(err instanceof Error ? err.message : 'Failed to load comparisons');
      } finally {
        setLoading(false);
      }
    }

    loadComparisons();
  }, [receipt.id]);

  const totalSavings = comparisons.reduce((sum, item) => sum + item.savings, 0);
  const totalSavingsPercentage = comparisons.length > 0 
    ? (totalSavings / parseFloat(receipt.total_amount.toString()) * 100).toFixed(0) 
    : '0';

  if (loading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <Card className="receipt-card w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <div>
            {receipt.store_name}
            <div className="text-sm font-normal text-muted-foreground">
              {formatDate(receipt.created_at)}
            </div>
          </div>
          <div className="text-right">
            {formatCurrency(parseFloat(receipt.total_amount.toString()))}
          </div>
        </CardTitle>
        {comparisons.length > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950 p-3 rounded-md mt-2">
            <div className="font-medium text-emerald-700 dark:text-emerald-300">
              Store Discounts: {formatCurrency(receipt.total_discounts || 0)}
            </div>
            <div className="font-medium text-emerald-700 dark:text-emerald-300">
              Additional Potential Savings: {formatCurrency(totalSavings)} ({totalSavingsPercentage}%)
            </div>
            <div className="text-sm text-emerald-600 dark:text-emerald-400">
              {comparisons.length} item{comparisons.length !== 1 ? 's' : ''} with better prices elsewhere
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {comparisons.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Found cheaper alternatives
            </h3>
            {comparisons.map((comp, index) => (
              <div key={index} className="border-b pb-4">
                <p className="font-medium">{comp.itemName}</p>
                <div className="flex justify-between items-center mt-1">
                  <div className="text-sm text-gray-600">
                    {formatCurrency(comp.originalPrice)} at {receipt.store_name}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-emerald-600">
                      Save {comp.savingsPercentage}%
                    </Badge>
                    <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                    <div className="text-sm font-medium text-emerald-600">
                      {formatCurrency(comp.cheaperPrice)} at {comp.cheaperStore}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReceiptDetail; 