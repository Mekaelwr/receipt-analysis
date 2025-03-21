'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import StorePriceComparison from '../components/StorePriceComparison';
import TemporalPriceComparison from '../components/TemporalPriceComparison';

// Define types
interface PriceComparison {
  item_name: string;
  your_store: string;
  your_price: number;
  cheapest_store: string;
  cheapest_price: number;
  price_difference: number;
  percentage_savings: number;
  category: string;
}

interface AllItems {
  item_name: string;
  store_name: string;
  price: number;
  category: string;
  purchase_date: string;
}

export default function PriceComparisonPage() {
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [allItems, setAllItems] = useState<AllItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [analysisType, setAnalysisType] = useState<'alternatives' | 'stores' | 'time' | 'all'>('alternatives');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        console.log("Fetching price comparison data...");
        
        // Fetch price comparison data
        const comparisonResponse = await fetch('/api/price-comparison');
        console.log("Price comparison response status:", comparisonResponse.status);
        
        if (!comparisonResponse.ok) {
          const errorText = await comparisonResponse.text();
          console.error("Price comparison API error:", errorText);
          throw new Error(`HTTP error! Status: ${comparisonResponse.status}, Details: ${errorText}`);
        }
        
        const comparisonData = await comparisonResponse.json();
        console.log("Price comparison data:", comparisonData);
        
        if (Array.isArray(comparisonData)) {
          setComparisons(comparisonData);
          setDebugInfo(prev => ({...prev, comparisonData}));
          
          // Extract unique categories from comparison data
          const comparisonCategories = Array.from(
            new Set(comparisonData.map(item => item.category))
          ).filter(Boolean);
          
          console.log("Fetching all items data...");
          // Fetch all items data
          const allItemsResponse = await fetch('/api/all-items');
          console.log("All items response status:", allItemsResponse.status);
          
          if (!allItemsResponse.ok) {
            const errorText = await allItemsResponse.text();
            console.error("All items API error:", errorText);
            throw new Error(`HTTP error! Status: ${allItemsResponse.status}, Details: ${errorText}`);
          }
          
          const allItemsData = await allItemsResponse.json();
          console.log("All items data:", allItemsData);
          setDebugInfo(prev => ({...prev, allItemsData}));
          
          if (Array.isArray(allItemsData)) {
            setAllItems(allItemsData);
            
            // Extract unique categories from all items
            const allItemsCategories = Array.from(
              new Set(allItemsData.map(item => item.category))
            ).filter(Boolean);
            
            // Combine categories from both datasets
            const uniqueCategories = Array.from(
              new Set([...comparisonCategories, ...allItemsCategories])
            ) as string[];
            
            setCategories(uniqueCategories);
          } else {
            throw new Error('Invalid data format received from all-items API');
          }
        } else {
          throw new Error('Invalid data format received from price-comparison API');
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load data. Please try again later.');
        setDebugInfo(prev => ({...prev, error: err.toString(), stack: err.stack}));
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  // Filter items based on active tab
  const filteredComparisons = activeTab === 'all' 
    ? comparisons 
    : comparisons.filter(item => item.category === activeTab);

  const filteredAllItems = activeTab === 'all'
    ? allItems
    : allItems.filter(item => item.category === activeTab);

  // Sort comparisons by percentage savings (highest first)
  const sortedComparisons = [...filteredComparisons].sort((a, b) => 
    b.percentage_savings - a.percentage_savings
  );

  // Sort all items by price (lowest first)
  const sortedAllItems = [...filteredAllItems].sort((a, b) => 
    a.price - b.price
  );

  // Calculate total potential savings
  const totalPotentialSavings = comparisons.reduce(
    (sum, item) => sum + item.price_difference, 
    0
  );

  // Check if we have any data to display
  const hasNoData = !loading && comparisons.length === 0 && allItems.length === 0;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Price Comparison: Find Better Deals</h1>
      
      {/* Analysis Type Selector */}
      <div className="flex items-center justify-center mb-6">
        <Tabs 
          defaultValue="alternatives" 
          value={analysisType} 
          onValueChange={(value) => setAnalysisType(value as any)} 
          className="w-full max-w-2xl"
        >
          <TabsList className="grid grid-cols-4 mb-6">
            <TabsTrigger value="alternatives">Cheaper Alternatives</TabsTrigger>
            <TabsTrigger value="stores">Store Differences</TabsTrigger>
            <TabsTrigger value="time">Price Changes</TabsTrigger>
            <TabsTrigger value="all">All Items</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Debug Information */}
      {hasNoData && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No data available</AlertTitle>
          <AlertDescription>
            <p>No price comparison data or items were found. This could be due to:</p>
            <ul className="list-disc pl-5 mt-2">
              <li>No receipts have been uploaded yet</li>
              <li>Item names haven't been standardized</li>
              <li>The database function hasn't been set up correctly</li>
            </ul>
            <p className="mt-2">Try running: <code>npm run db:setup-price-comparison</code></p>
            
            <details className="mt-4">
              <summary className="cursor-pointer font-medium">Technical Details (Click to expand)</summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-60">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">Technical Details (Click to expand)</summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-60">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Summary Cards for Alternatives */}
      {analysisType === 'alternatives' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Items with Cheaper Alternatives</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold">{comparisons.length}</p>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold">${totalPotentialSavings.toFixed(2)}</p>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average Savings Per Item</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold">
                  ${comparisons.length > 0 
                    ? (totalPotentialSavings / comparisons.length).toFixed(2) 
                    : '0.00'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* All Items Summary */}
      {analysisType === 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold">{allItems.length}</p>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Unique Products</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold">
                  {new Set(allItems.map(item => item.item_name)).size}
                </p>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Stores Visited</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold">
                  {new Set(allItems.map(item => item.store_name)).size}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Category Tabs */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="all">All Items</TabsTrigger>
          {categories.map(category => (
            <TabsTrigger key={category} value={category}>
              {category}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value={activeTab}>
          {loading && analysisType !== 'stores' && analysisType !== 'time' ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error && analysisType !== 'stores' && analysisType !== 'time' ? (
            <div className="bg-red-50 p-4 rounded-md text-red-800">
              {error}
            </div>
          ) : analysisType === 'all' ? (
            // All Items Table
            <Card>
              <CardContent className="p-0">
                {sortedAllItems.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No items found in this category.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Purchase Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAllItems.map((item, index) => (
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
                          <TableCell>${item.price.toFixed(2)}</TableCell>
                          <TableCell>{new Date(item.purchase_date).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : analysisType === 'alternatives' ? (
            // Cheaper Alternatives Table
            <Card>
              <CardContent className="p-0">
                {sortedComparisons.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No items found with cheaper alternatives.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Your Store</TableHead>
                        <TableHead>Your Price</TableHead>
                        <TableHead>Cheapest At</TableHead>
                        <TableHead>Cheapest Price</TableHead>
                        <TableHead>Savings</TableHead>
                        <TableHead>Savings %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedComparisons.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {item.item_name}
                            {item.category && (
                              <Badge variant="outline" className="ml-2">
                                {item.category}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{item.your_store}</TableCell>
                          <TableCell>${item.your_price.toFixed(2)}</TableCell>
                          <TableCell>{item.cheapest_store}</TableCell>
                          <TableCell className="text-green-600 font-medium">
                            ${item.cheapest_price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-green-600 font-medium">
                            ${item.price_difference.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="success" className="bg-green-100 text-green-800">
                              {item.percentage_savings.toFixed(0)}% cheaper
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : analysisType === 'stores' ? (
            // Store Price Comparison Component
            <StorePriceComparison activeCategory={activeTab} />
          ) : (
            // Temporal Price Comparison Component
            <TemporalPriceComparison activeCategory={activeTab} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 