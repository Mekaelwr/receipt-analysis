import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Exported interfaces for use in other files
export interface ReceiptData {
  id: string;
  store_name: string;
  created_at: string;
}

interface ReceiptItem {
  original_item_name: string;
  standardized_item_name: string;
  item_price: number;
  receipts: {
    store_name: string;
    created_at: string;
  };
}

// Add interface for the database response
interface CheaperPrice {
  original_item_name: string;
  original_price: number;
  better_price: number;
  better_store: string;
  better_date: Date;
  savings: number;
  savings_percentage: number;
  is_temporal: boolean;
}

interface DatabaseComparison {
  original_item_name: string;
  current_price: number;
  cheaper_price: number;
  cheaper_store: string;
}

export interface PriceComparison {
  itemName: string;
  originalPrice: number;
  cheaperPrice: number;
  cheaperStore: string;
  savings: number;
  savingsPercentage: string;
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

interface HistoricalPriceResponse {
  item_price: number;
  receipts: {
    created_at: string;
  };
}

export interface HistoricalPrice {
  standardized_item_name: string;
  lowest_price: number;
  price_date: string;
}

export interface TemporalComparison {
  standardized_item_name: string;
  current_price: number;
  lowest_price: number;
  store_name: string;
  price_date: string;
}

interface TemporalItem {
  standardized_item_name: string;
  item_price: number;
  receipts: {
    store_name: string;
    created_at: string;
  };
}

interface HistoricalItem {
  item_price: number;
  receipts: {
    created_at: string;
  };
}

function standardizeItemName(name: string): string {
  // Remove common variations and standardize
  return name.toLowerCase()
    .replace(/raspberry |, raspberry flavor/, '')  // Normalize flavors
    .replace(/mixed |assorted |premium /, '')      // Remove quality prefixes
    .replace(/fresh |frozen |canned /, '')         // Remove state prefixes
    .replace(/blend |product |kit /, '')           // Remove generic suffixes
    .trim();
}

interface TransformedComparison {
  itemName: string;
  originalPrice: number;
  cheaperPrice: number;
  cheaperStore: string;
  savings: number;
  savingsPercentage: string;
}

interface DatabaseReceiptItem {
  original_item_name: string;
  standardized_item_name: string;
  item_price: number;
  receipts: {
    store_name: string;
    created_at: string;
  }[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const receiptId = searchParams.get('receiptId');

  console.log('Price comparison API called:', { receiptId });

  if (!receiptId) {
    console.error('Missing receiptId parameter');
    return NextResponse.json({ error: 'Receipt ID is required' }, { status: 400 });
  }

  try {
    // Use our new unified function to get all cheaper prices
    const { data: allCheaperPrices, error } = await supabase
      .rpc('find_all_cheaper_prices', {
        receipt_id_param: receiptId
      });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Raw cheaper prices:', allCheaperPrices);

    // Transform the data to match the frontend format
    const transformedComparisons: PriceComparison[] = (allCheaperPrices || []).map((item: CheaperPrice) => {
      // Calculate days ago if we have a better_date
      const daysAgo = item.better_date ? 
        Math.floor((Date.now() - new Date(item.better_date).getTime()) / (1000 * 60 * 60 * 24)) : 
        undefined;

      return {
        itemName: item.original_item_name,
        originalPrice: item.original_price,
        cheaperPrice: item.better_price,
        cheaperStore: item.better_store,
        savings: item.savings,
        savingsPercentage: item.savings_percentage.toFixed(1),
        is_temporal: item.is_temporal,
        days_ago: daysAgo
      };
    });

    console.log('Transformed comparisons:', transformedComparisons);
    return NextResponse.json(transformedComparisons);
  } catch (error) {
    console.error('Error in price comparison API:', error);
    return NextResponse.json({ error: 'Failed to fetch price comparisons' }, { status: 500 });
  }
}

export async function fetchReceiptComparisons(receiptId: string): Promise<PriceComparison[]> {
  try {
    console.log(`Fetching comparisons for receipt: ${receiptId}`);
    
    // Call the Supabase RPC function to get comparisons
    const { data, error } = await supabase
      .rpc('find_receipt_cheaper_alternatives', { receipt_id: receiptId });
    
    if (error) {
      console.error('Error fetching comparisons:', error);
      return [];
    }
    
    // Add detailed logging of the returned data
    console.log(`Found ${data?.length || 0} comparisons`);
    console.log('Raw comparison data:', JSON.stringify(data, null, 2));
    
    // Direct check for honey mustard comparison
    const { data: honeyMustardItems } = await supabase
      .from('receipt_items')
      .select('id, item_name, standardized_item_name, item_price, receipt_id')
      .ilike('item_name', '%honey%mustard%');

    console.log('Honey mustard items in database:', honeyMustardItems);
    
    return data || [];
  } catch (error) {
    console.error('Error in comparison service:', error);
    return [];
  }
} 