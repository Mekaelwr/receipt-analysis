import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface TemporalComparison {
  item_name: string;
  store_name: string;
  price_points: {
    price: number;
    date: string;
    detailed_name: string;
  }[];
  max_price: number;
  min_price: number;
  price_difference: number;
  percentage_change: number;
  category: string;
}

export async function GET() {
  try {
    console.log("Temporal price comparison API called");
    
    // Get receipt items with their timestamps
    const { data, error } = await supabase
      .from('receipt_items')
      .select(`
        standardized_item_name,
        item_price,
        detailed_name,
        category,
        receipts:receipt_id (
          store_name,
          created_at
        )
      `)
      .not('standardized_item_name', 'is', null)
      .order('standardized_item_name');
    
    if (error) {
      console.error("Error fetching receipt items:", error);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} receipt items`);
    
    // Process the data to find price changes over time within the same store
    const storeItemsMap = new Map();
    
    for (const item of data as any[]) {
      let storeName = 'Unknown Store';
      let createdAt = new Date().toISOString();
      
      if (item.receipts) {
        if (Array.isArray(item.receipts) && item.receipts.length > 0) {
          storeName = item.receipts[0].store_name;
          createdAt = item.receipts[0].created_at;
        } else if (typeof item.receipts === 'object') {
          storeName = item.receipts.store_name;
          createdAt = item.receipts.created_at;
        }
      }
      
      const itemName = item.standardized_item_name;
      const price = parseFloat(item.item_price);
      
      if (!itemName || isNaN(price)) continue;
      
      const key = `${storeName}|||${itemName}`;
      
      if (!storeItemsMap.has(key)) {
        storeItemsMap.set(key, {
          item_name: itemName,
          store_name: storeName,
          price_points: [],
          category: item.category || 'Uncategorized'
        });
      }
      
      storeItemsMap.get(key).price_points.push({
        price: price,
        date: createdAt,
        detailed_name: item.detailed_name || itemName
      });
    }
    
    // Process the collected data
    const comparisons = [];
    
    for (const [_, itemData] of storeItemsMap.entries()) {
      // Only include items that appear in multiple receipts (have price changes)
      if (itemData.price_points.length < 2) continue;
      
      // Sort price points by date
      itemData.price_points.sort((a: { date: string }, b: { date: string }) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      // Find min and max prices
      const prices = itemData.price_points.map((p: { price: number }) => p.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      
      // Calculate price difference and percentage change
      const priceDifference = maxPrice - minPrice;
      const percentageChange = (priceDifference / minPrice) * 100;
      
      comparisons.push({
        item_name: itemData.item_name,
        store_name: itemData.store_name,
        price_points: itemData.price_points,
        min_price: minPrice,
        max_price: maxPrice,
        price_difference: priceDifference,
        percentage_change: percentageChange,
        category: itemData.category
      });
    }
    
    // Sort by percentage change (highest first)
    comparisons.sort((a, b) => b.percentage_change - a.percentage_change);
    
    return NextResponse.json(comparisons);
  } catch (error) {
    console.error('Error in temporal price comparison API:', error);
    
    // Return an empty array instead of an error object to prevent client-side format errors
    return NextResponse.json([]);
  }
} 