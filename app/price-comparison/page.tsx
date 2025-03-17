'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
  const [activeTab, setActiveTab] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [showAllItems, setShowAllItems] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Fetch price comparison data
        const comparisonResponse = await fetch('/api/price-comparison');
        
        if (!comparisonResponse.ok) {
          throw new Error(`HTTP error! Status: ${comparisonResponse.status}`);
        }
        
        const comparisonData = await comparisonResponse.json();
        
        if (Array.isArray(comparisonData)) {
          setComparisons(comparisonData);
          
          // Extract unique categories from comparison data
          const comparisonCategories = Array.from(
            new Set(comparisonData.map(item => item.category))
          ).filter(Boolean);
          
          // Fetch all items data
          const allItemsResponse = await fetch('/api/all-items');
          
          if (!allItemsResponse.ok) {
            throw new Error(`HTTP error! Status: ${allItemsResponse.status}`);
          }
          
          const allItemsData = await allItemsResponse.json();
          
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
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
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

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Price Comparison: Find Better Deals</h1>
      
      {/* View Toggle */}
      <div className="flex items-center space-x-2 mb-6">
        <Switch 
          id="view-toggle" 
          checked={showAllItems} 
          onCheckedChange={setShowAllItems} 
        />
        <Label htmlFor="view-toggle">
          {showAllItems ? "Showing all uploaded items" : "Showing items with cheaper alternatives"}
        </Label>
      </div>
      
      {/* Summary Cards */}
      {!showAllItems && (
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
      {showAllItems && (
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
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-md text-red-800">
              {error}
            </div>
          ) : showAllItems ? (
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
          ) : (
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 