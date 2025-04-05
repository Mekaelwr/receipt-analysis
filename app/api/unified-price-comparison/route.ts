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
      'find_best_price',
      { 
        p_receipt_id: receiptId,
        p_days_lookback: daysLookback
      }
    );

    if (error) {
      console.error('Error finding best prices:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform the data to include proper temporal vs store information
    const transformedData = (data || []).map((item: any) => {
      // Calculate days ago for temporal comparisons
      const daysAgo = item.better_date ? 
        Math.floor((Date.now() - new Date(item.better_date).getTime()) / (1000 * 60 * 60 * 24)) : 
        undefined;

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
          is_temporal: item.is_temporal,
          days_ago: daysAgo
        }
      };
    });

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