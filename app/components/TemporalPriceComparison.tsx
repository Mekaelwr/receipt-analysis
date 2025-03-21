import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PricePoint {
  price: number;
  date: string;
  detailed_name: string;
}

interface TemporalComparison {
  item_name: string;
  store_name: string;
  price_points: PricePoint[];
  min_price: number;
  max_price: number;
  price_difference: number;
  percentage_change: number;
  category: string;
}

interface TemporalPriceComparisonProps {
  activeCategory: string;
}

export default function TemporalPriceComparison({ activeCategory }: TemporalPriceComparisonProps) {
  const [comparisons, setComparisons] = useState<TemporalComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        console.log("Fetching temporal price comparison data...");
        
        const response = await fetch('/api/temporal-price-comparison');
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setComparisons(data);
        } else {
          throw new Error('Invalid data format received from API');
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  // Filter by active category
  const filteredComparisons = activeCategory === 'all' 
    ? comparisons 
    : comparisons.filter(item => item.category === activeCategory);

  // Sort by percentage change (highest first)
  const sortedComparisons = [...filteredComparisons].sort((a, b) => 
    b.percentage_change - a.percentage_change
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (sortedComparisons.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No items found with price changes over time.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Lowest Price</TableHead>
              <TableHead>Highest Price</TableHead>
              <TableHead>Price Change</TableHead>
              <TableHead>Trend</TableHead>
              <TableHead>Price History</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedComparisons.map((item, index) => {
              // Sort price points by date (oldest first)
              const sortedPrices = [...item.price_points].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              );
              
              const oldestPrice = sortedPrices[0];
              const newestPrice = sortedPrices[sortedPrices.length - 1];
              const trending = newestPrice.price > oldestPrice.price 
                ? 'up' 
                : newestPrice.price < oldestPrice.price ? 'down' : 'flat';
              
              return (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {item.item_name}
                    {item.category && (
                      <Badge variant="outline" className="ml-2">
                        {item.category}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{item.store_name}</TableCell>
                  <TableCell className="text-green-600">
                    ${item.min_price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-red-600">
                    ${item.max_price.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={trending === 'up' 
                        ? 'bg-red-100' 
                        : trending === 'down' ? 'bg-green-100' : 'bg-gray-100'
                      }
                    >
                      {item.percentage_change.toFixed(1)}% variation
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {trending === 'up' && (
                      <div className="flex items-center text-red-600">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        <span>Increasing</span>
                      </div>
                    )}
                    {trending === 'down' && (
                      <div className="flex items-center text-green-600">
                        <TrendingDown className="h-4 w-4 mr-1" />
                        <span>Decreasing</span>
                      </div>
                    )}
                    {trending === 'flat' && (
                      <div className="flex items-center text-gray-600">
                        <Minus className="h-4 w-4 mr-1" />
                        <span>Unchanged</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      {sortedPrices.map((point, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{new Date(point.date).toLocaleDateString()}: </span>
                          <span className="font-medium">${point.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
} 