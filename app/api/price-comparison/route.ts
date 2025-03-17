import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define types
interface ReceiptItem {
  standardized_item_name: string;
  final_price: number;
  quantity: number;
  category: string;
  receipts: {
    store_name: string;
  };
}

interface PriceComparison {
  standardized_item_name: string;
  store_name: string;
  min_price: number;
}

interface ProcessedItem {
  item_name: string;
  your_store: string;
  your_price: number;
  cheapest_store: string;
  cheapest_price: number;
  price_difference: number;
  percentage_savings: number;
  category: string;
}

export async function GET() {
  try {
    // Get user's purchased items with their prices and stores
    const { data: userItems, error: userItemsError } = await supabase
      .from('receipt_items')
      .select(`
        standardized_item_name,
        final_price,
        quantity,
        category,
        receipts:receipt_id (
          store_name
        )
      `)
      .not('standardized_item_name', 'is', null);

    if (userItemsError) {
      throw userItemsError;
    }

    // Get cheapest prices for each standardized item across all stores
    const { data: cheapestPrices, error: cheapestPricesError } = await supabase
      .from('item_price_comparison')
      .select('standardized_item_name, store_name, min_price')
      .gt('min_price', 0);

    if (cheapestPricesError) {
      throw cheapestPricesError;
    }

    // Process the data to find items with cheaper alternatives
    const processedItems = [];
    
    if (userItems && cheapestPrices) {
      for (const item of userItems) {
        const unitPrice = item.final_price / (item.quantity || 1);
        
        // Access store_name correctly based on the actual structure
        let storeName = null;
        if (item.receipts && Array.isArray(item.receipts) && item.receipts.length > 0) {
          storeName = item.receipts[0].store_name;
        }
        
        if (!storeName || !item.standardized_item_name) continue;
        
        // Find the cheapest price for this item
        const cheaperAlternatives = cheapestPrices
          .filter(cp => 
            cp.standardized_item_name === item.standardized_item_name && 
            cp.store_name !== storeName &&
            cp.min_price < unitPrice
          )
          .sort((a, b) => a.min_price - b.min_price);
        
        if (cheaperAlternatives.length > 0) {
          const cheapest = cheaperAlternatives[0];
          const priceDifference = unitPrice - cheapest.min_price;
          const percentageSavings = (priceDifference / unitPrice) * 100;
          
          processedItems.push({
            item_name: item.standardized_item_name,
            your_store: storeName,
            your_price: unitPrice,
            cheapest_store: cheapest.store_name,
            cheapest_price: cheapest.min_price,
            price_difference: priceDifference,
            percentage_savings: percentageSavings,
            category: item.category
          });
        }
      }
    }
    
    // Remove duplicates (keep the one with highest savings for each item)
    const uniqueItemsMap = new Map();
    
    for (const item of processedItems) {
      const existingItem = uniqueItemsMap.get(item.item_name);
      
      if (!existingItem || item.percentage_savings > existingItem.percentage_savings) {
        uniqueItemsMap.set(item.item_name, item);
      }
    }
    
    const uniqueItems = Array.from(uniqueItemsMap.values());
    
    return NextResponse.json(uniqueItems);
  } catch (error) {
    console.error('Error in price comparison API:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve price comparison data' },
      { status: 500 }
    );
  }
} 