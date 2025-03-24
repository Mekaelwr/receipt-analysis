import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const receiptId = searchParams.get('receipt_id');
  const debug = searchParams.get('debug') === 'true';
  
  console.log(`Processing receipt: ${receiptId}, debug mode: ${debug}`);

  if (!receiptId) {
    return NextResponse.json({ error: 'receipt_id is required' }, { status: 400 });
  }

  try {
    // Call the RPC function to find cheaper alternatives
    const startTime = Date.now();
    const { data, error } = await supabase
      .rpc('find_receipt_cheaper_alternatives', { receipt_id: receiptId });
    const endTime = Date.now();

    if (error) {
      console.error('Error finding cheaper alternatives:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (debug) {
      console.log(`Query execution time: ${endTime - startTime}ms`);
      console.log(`Found ${data ? data.length : 0} cheaper alternatives`);
      if (data && data.length > 0) {
        console.log('Sample alternative:', data[0]);
      }
    }

    // Return the results
    return NextResponse.json({
      data,
      count: data ? data.length : 0,
      execution_time_ms: endTime - startTime,
      debug_info: debug ? {
        receipt_id: receiptId,
        query_time: endTime - startTime,
        alternative_count: data ? data.length : 0,
        function_name: 'find_receipt_cheaper_alternatives'
      } : null
    });
  } catch (error) {
    console.error('Error in price comparison endpoint:', error);
    return NextResponse.json({ error: 'Server error processing request' }, { status: 500 });
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