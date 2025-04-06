export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface UnifiedPriceComparison {
  item_name: string;
  current_price: number;
  current_store: string;
  current_date: string;
  best_price: number;
  best_store: string;
  best_date: string;
  savings: number;
  savings_percentage: number;
  comparison_type: 'temporal' | 'store' | 'alternative';
  is_alternative: boolean;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const receiptId = searchParams.get('receipt_id');
  const daysLookback = parseInt(searchParams.get('days_lookback') || '30');
  
  if (!receiptId) {
    return NextResponse.json(
      { error: 'receipt_id is required' },
      { status: 400 }
    );
  }

  try {
    // Call our unified price comparison function
    const { data, error } = await supabase.rpc(
      'find_all_cheaper_prices',
      { 
        receipt_id_param: receiptId
      }
    );

    if (error) {
      console.error('Error finding best prices:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('=== API DEBUG ===');
    console.log('Raw data from database:', data);
    
    // Add detailed date debugging
    console.log('=== DATE DEBUG ===');
    (data || []).forEach((item: any) => {
      console.log(`Date info for ${item.original_item_name}:`, {
        better_date: item.better_date,
        debug_current_date: item.debug_current_date,
        debug_cheaper_date: item.debug_cheaper_date,
        store_match: item.better_store === item.store_name,
        is_temporal: item.is_temporal
      });
    });

    // Transform the data to include proper temporal vs store information
    const transformedData = (data || []).map((item: any) => {
      console.log('=== DATE TRACE ===', {
        itemName: item.original_item_name,
        rawDate: item.cheaper_date,  // Date from SQL
        betterDate: item.better_date // Date being passed to frontend
      });

      return {
        id: item.id,
        name: item.original_item_name,
        original_price: `$${item.original_price.toFixed(2)}`,
        final_price: `$${item.original_price.toFixed(2)}`,
        cheaper_alternative: {
          store_name: item.better_store,
          price: `$${item.better_price.toFixed(2)}`,
          item_name: item.original_item_name,
          savings: `$${item.savings.toFixed(2)}`,
          percentage_savings: `${item.savings_percentage.toFixed(1)}%`,
          is_temporal: Boolean(item.is_temporal),
          better_date: item.better_date
        }
      };
    });

    console.log('Transformed data:', transformedData);

    // Calculate total savings
    const totalSavings = (data || []).reduce((sum: number, item: any) => sum + (item.savings || 0), 0);

    return NextResponse.json({
      total_savings: totalSavings,
      items: transformedData
    });
  } catch (error) {
    console.error('Error in unified price comparison API:', error);
    return NextResponse.json(
      { error: 'Server error processing request' },
      { status: 500 }
    );
  }
} 