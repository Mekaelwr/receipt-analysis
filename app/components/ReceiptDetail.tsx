'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PriceComparison, fetchReceiptComparisons, calculateTotalSavings } from '../services/priceComparisonService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownRight, Sparkles } from 'lucide-react';

interface ReceiptItem {
  id: string;
  item_name: string;
  item_price: string;
  standardized_item_name?: string;
  category?: string;
}

interface Receipt {
  id: string;
  store_name: string;
  purchase_date: string;
  total_amount: string;
  receipt_items: ReceiptItem[];
}

interface ReceiptDetailProps {
  receipt: Receipt;
}

const ReceiptDetail: React.FC<ReceiptDetailProps> = ({ receipt }) => {
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadComparisons() {
      if (receipt.id) {
        setLoading(true);
        try {
          console.log('Fetching comparisons for receipt:', receipt.id);
          
          // First try the direct API endpoint for debugging
          const debugResponse = await fetch(`/api/debug-comparison?receipt_id=${receipt.id}`);
          const debugData = await debugResponse.json();
          console.log('Debug data:', debugData);
          
          // Then use the regular service
          const data = await fetchReceiptComparisons(receipt.id);
          console.log('Comparisons found:', data.length, data);
          setComparisons(data);
        } catch (error) {
          console.error('Error loading comparisons:', error);
        } finally {
          setLoading(false);
        }
      }
    }

    loadComparisons();
  }, [receipt.id]);

  const totalSavings = calculateTotalSavings(comparisons);
  const totalSavingsPercentage = comparisons.length > 0 
    ? (totalSavings / parseFloat(receipt.total_amount) * 100).toFixed(0) 
    : '0';

  return (
    <Card className="receipt-card w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <div>
            {receipt.store_name}
            <div className="text-sm font-normal text-muted-foreground">
              {formatDate(receipt.purchase_date)}
            </div>
          </div>
          <div className="text-right">
            {formatCurrency(parseFloat(receipt.total_amount))}
          </div>
        </CardTitle>
        {comparisons.length > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950 p-3 rounded-md mt-2">
            <div className="font-medium text-emerald-700 dark:text-emerald-300">
              Potential Savings: {formatCurrency(totalSavings)} ({totalSavingsPercentage}%)
            </div>
            <div className="text-sm text-emerald-600 dark:text-emerald-400">
              {comparisons.length} item{comparisons.length !== 1 ? 's' : ''} with better prices elsewhere
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-6 flex-1" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Regular receipt items */}
            <div className="receipt-items space-y-2 mb-6">
              <h3 className="font-medium text-sm text-gray-500 mb-1">Receipt Items</h3>
              {receipt.receipt_items.map((item, index) => (
                <div key={item.id} className="receipt_receiptItem__reC9d">
                  <div className="receipt_receiptItemMain__wMDnh">
                    <div className="receipt_receiptNumber__dHnlo">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="receipt_receiptName__xUEtX">
                      {item.item_name}
                      {item.standardized_item_name && (
                        <span className="text-xs text-gray-500 ml-1">({item.standardized_item_name})</span>
                      )}
                      {item.category && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {item.category}
                        </Badge>
                      )}
                    </div>
                    <div className="receipt_receiptPrice__jRlKy">
                      {formatCurrency(parseFloat(item.item_price))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Fallback message if we find no savings */}
            {comparisons.length === 0 && (
              <div className="text-center p-4 border border-gray-200 rounded-md">
                <p className="text-gray-500">No cheaper alternatives found for items in this receipt.</p>
                <p className="text-xs text-gray-400 mt-1">This might be the best price already!</p>
              </div>
            )}
            
            {/* Savings opportunities section */}
            {comparisons.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center mb-3">
                  <Sparkles className="h-5 w-5 text-emerald-500 mr-2" />
                  <h3 className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Savings Opportunities
                  </h3>
                </div>
                
                <div className="space-y-3">
                  {comparisons.map((comparison) => (
                    <div key={comparison.receipt_item_id} className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-md">
                      <div className="font-medium">
                        {comparison.current_item}
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <div>
                          Current: {formatCurrency(comparison.current_price)} at {comparison.current_store}
                        </div>
                        <div className="text-emerald-700 dark:text-emerald-400">
                          Save {formatCurrency(comparison.price_difference)} ({Math.round(comparison.percentage_savings)}%)
                        </div>
                      </div>
                      <div className="flex items-center mt-2 text-sm text-emerald-600 dark:text-emerald-300">
                        <ArrowDownRight className="h-4 w-4 mr-1" />
                        <span>
                          {formatCurrency(comparison.cheaper_price)} at {comparison.cheaper_store}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ReceiptDetail; 