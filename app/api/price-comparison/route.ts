import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Exported interfaces for use in other files
export interface ReceiptItem {
  standardized_item_name: string;
  final_price: number;
  quantity: number;
  category: string;
  receipts: {
    store_name: string;
  };
}

export interface PriceComparison {
  standardized_item_name: string;
  store_name: string;
  min_price: number;
}

export interface ProcessedItem {
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
    console.log("Price comparison API called");
    
    // Check if the database function exists
    const functionExists = false;
    let functionCheckError = null;
    
    try {
      const result = await supabase.rpc(
        'get_items_with_cheaper_alternatives',
        {},
        { count: 'exact', head: true }
      );
      functionCheckError = result.error;
    } catch (err) {
      functionCheckError = err;
    }
    
    if (functionCheckError) {
      console.error("Function check error:", functionCheckError);
      
      // Check if the error is because the function doesn't exist
      const errorMessage = functionCheckError instanceof Error 
        ? functionCheckError.message 
        : String(functionCheckError);
        
      if (errorMessage.includes('function') && errorMessage.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Database function not found', 
            message: 'The required database function "get_items_with_cheaper_alternatives" does not exist. Please run "npm run db:setup-price-comparison" to set it up.',
            details: functionCheckError
          },
          { status: 500 }
        );
      }
      
      throw functionCheckError;
    }
    
    // Try to get data from the function
    const { data, error } = await supabase.rpc('get_items_with_cheaper_alternatives');
    
    if (error) {
      console.error("Error calling function:", error);
      throw error;
    }
    
    // If no data is returned, try a direct query approach
    if (!data || data.length === 0) {
      console.log("No data from function, trying direct query");
      
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
        console.error("Error fetching user items:", userItemsError);
        throw userItemsError;
      }

      // Get cheapest prices for each standardized item across all stores
      const { data: cheapestPrices, error: cheapestPricesError } = await supabase
        .from('item_price_comparison')
        .select('standardized_item_name, store_name, min_price')
        .gt('min_price', 0);

      if (cheapestPricesError) {
        console.error("Error fetching cheapest prices:", cheapestPricesError);
        throw cheapestPricesError;
      }
      
      console.log(`Found ${userItems?.length || 0} user items and ${cheapestPrices?.length || 0} price comparison records`);
      
      // If we don't have enough data for comparison, return diagnostic info
      if (!userItems?.length || !cheapestPrices?.length) {
        return NextResponse.json(
          { 
            items: [], 
            diagnostics: {
              userItemsCount: userItems?.length || 0,
              cheapestPricesCount: cheapestPrices?.length || 0,
              message: "Not enough data for price comparison. Upload more receipts or run the standardization process."
            }
          }
        );
      }

      // Process the data to find items with cheaper alternatives
      const processedItems = [];
      
      for (const item of userItems) {
        const unitPrice = item.final_price / (item.quantity || 1);
        
        // Handle the receipts data structure safely
        let storeName = null;
        if (item.receipts) {
          if (Array.isArray(item.receipts) && item.receipts.length > 0) {
            storeName = item.receipts[0].store_name;
          } else if (typeof item.receipts === 'object' && item.receipts !== null) {
            storeName = (item.receipts as { store_name: string }).store_name;
          }
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
    }
    
    // Ensure we always return an array even if there's no data
    return NextResponse.json([]);
  } catch (error: Error | unknown) {
    console.error('Error in price comparison API:', error);
    
    // Provide detailed error information
    const err = error as { message?: string; code?: string; hint?: string; details?: string; stack?: string };
    return NextResponse.json(
      { 
        error: 'Failed to retrieve price comparison data',
        message: err.message || 'Unknown error',
        details: {
          code: err.code,
          hint: err.hint,
          details: err.details,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }
      },
      { status: 500 }
    );
  }
} 