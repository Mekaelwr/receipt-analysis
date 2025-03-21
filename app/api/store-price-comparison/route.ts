import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface StoreComparison {
  item_name: string;
  stores: {
    store_name: string;
    price: number;
    detailed_name: string;
  }[];
  price_difference: number;
  percentage_difference: number;
  category: string;
}

interface ReceiptItem {
  standardized_item_name: string;
  item_price: string;
  detailed_name?: string;
  category?: string;
  receipts: {
    store_name: string;
    created_at: string;
  } | {
    store_name: string;
    created_at: string;
  }[];
}

interface ItemData {
  stores: Map<string, { price: number; detailed_name: string }>;
  category: string;
}

export async function GET() {
  try {
    console.log("Store price comparison API called");
    
    // SQL query to find items that appear in multiple stores with price differences
    const { data, error } = await supabase.from('receipt_items')
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
    
    // Process the data to find items available at multiple stores
    const itemsMap = new Map<string, ItemData>();
    
    for (const item of data as any[]) {
      let storeName = 'Unknown Store';
      
      if (item.receipts) {
        if (Array.isArray(item.receipts) && item.receipts.length > 0) {
          storeName = item.receipts[0].store_name;
        } else if (typeof item.receipts === 'object') {
          storeName = item.receipts.store_name;
        }
      }
      
      const itemName = item.standardized_item_name;
      const price = parseFloat(item.item_price);
      
      if (!itemName || isNaN(price)) continue;
      
      if (!itemsMap.has(itemName)) {
        itemsMap.set(itemName, {
          stores: new Map<string, { price: number; detailed_name: string }>(),
          category: item.category || 'Uncategorized'
        });
      }
      
      const itemData = itemsMap.get(itemName)!;
      
      // Either add the store or update with lower price if we've seen this store before
      if (!itemData.stores.has(storeName) || itemData.stores.get(storeName)!.price > price) {
        itemData.stores.set(storeName, {
          price: price,
          detailed_name: item.detailed_name || itemName
        });
      }
    }
    
    // Convert the map to the desired output format
    const comparisons: StoreComparison[] = [];
    
    for (const [itemName, itemData] of itemsMap.entries()) {
      // Only include items available at multiple stores
      if (itemData.stores.size < 2) continue;
      
      // Convert stores map to array and find min/max prices
      const storesArray = Array.from(itemData.stores.entries()).map(([store_name, storeData]) => ({
        store_name,
        price: storeData.price,
        detailed_name: storeData.detailed_name
      }));
      
      // Sort by price (low to high)
      storesArray.sort((a, b) => a.price - b.price);
      
      const minPrice = storesArray[0].price;
      const maxPrice = storesArray[storesArray.length - 1].price;
      const priceDifference = maxPrice - minPrice;
      const percentageDifference = (priceDifference / minPrice) * 100;
      
      comparisons.push({
        item_name: itemName,
        stores: storesArray,
        price_difference: priceDifference,
        percentage_difference: percentageDifference,
        category: itemData.category
      });
    }
    
    // Sort by percentage difference (highest first)
    comparisons.sort((a, b) => b.percentage_difference - a.percentage_difference);
    
    return NextResponse.json(comparisons);
  } catch (error) {
    console.error('Error in store price comparison API:', error);
    
    // Return an empty array instead of an error object to prevent client-side format errors
    return NextResponse.json([]);
  }
} 