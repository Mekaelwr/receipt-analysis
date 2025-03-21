import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface StorePrice {
  store_name: string;
  price: number;
  detailed_name: string;
}

interface StoreComparison {
  item_name: string;
  stores: StorePrice[];
  price_difference: number;
  percentage_difference: number;
  category: string;
}

interface StorePriceComparisonProps {
  activeCategory: string;
}

export default function StorePriceComparison({ activeCategory }: StorePriceComparisonProps) {
  const [comparisons, setComparisons] = useState<StoreComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        console.log("Fetching store price comparison data...");
        
        const response = await fetch('/api/store-price-comparison');
        
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

  // Sort by percentage difference (highest first)
  const sortedComparisons = [...filteredComparisons].sort((a, b) => 
    b.percentage_difference - a.percentage_difference
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
        <p className="text-gray-500">No items found with price differences across stores.</p>
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
              <TableHead>Best Price</TableHead>
              <TableHead>Worst Price</TableHead>
              <TableHead>Price Difference</TableHead>
              <TableHead>Price Variation</TableHead>
              <TableHead>All Stores</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedComparisons.map((item, index) => {
              // Sort stores by price (lowest first)
              const sortedStores = [...item.stores].sort((a, b) => a.price - b.price);
              const lowestPrice = sortedStores[0];
              const highestPrice = sortedStores[sortedStores.length - 1];
              
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
                  <TableCell className="text-green-600">
                    ${lowestPrice.price.toFixed(2)} 
                    <span className="block text-xs text-gray-500">{lowestPrice.store_name}</span>
                  </TableCell>
                  <TableCell className="text-red-600">
                    ${highestPrice.price.toFixed(2)}
                    <span className="block text-xs text-gray-500">{highestPrice.store_name}</span>
                  </TableCell>
                  <TableCell>${item.price_difference.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-amber-100">
                      {item.percentage_difference.toFixed(0)}% variation
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      {sortedStores.map((store, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{store.store_name}:</span>
                          <span className="font-medium">${store.price.toFixed(2)}</span>
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