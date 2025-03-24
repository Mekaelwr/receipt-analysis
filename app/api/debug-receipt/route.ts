export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Debug endpoint to check receipt data and comparisons
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const receiptId = searchParams.get('receiptId');

  if (!receiptId) {
    return NextResponse.json({ error: 'Receipt ID is required' }, { status: 400 });
  }

  try {
    // Get receipt with items
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select(`
        id,
        store_name,
        purchase_date,
        total_price,
        receipt_items (
          id,
          original_item_name,
          standardized_item_name,
          detailed_name,
          item_price
        )
      `)
      .eq('id', receiptId)
      .single();

    if (receiptError) {
      console.error('Error fetching receipt:', receiptError);
      return NextResponse.json({ error: receiptError.message }, { status: 500 });
    }

    // Get comparison data
    const { data: comparisons, error: comparisonsError } = await supabase
      .rpc('find_receipt_cheaper_alternatives', { receipt_id: receiptId });

    if (comparisonsError) {
      console.error('Error fetching comparisons:', comparisonsError);
      return NextResponse.json({ error: comparisonsError.message }, { status: 500 });
    }

    // Create map of comparison items
    const comparisonMap = new Map();
    comparisons.forEach(comp => {
      comparisonMap.set(comp.standardized_item_name, comp);
    });

    // Add debug info to each item
    const debugItems = receipt.receipt_items.map(item => {
      const comparison = comparisonMap.get(item.standardized_item_name);
      return {
        id: item.id,
        original_item_name: item.original_item_name,
        standardized_item_name: item.standardized_item_name,
        detailed_name: item.detailed_name,
        item_price: item.item_price,
        has_comparison: !!comparison,
        comparison: comparison || null
      };
    });

    // Return detailed debug info
    return NextResponse.json({
      receipt_id: receipt.id,
      store_name: receipt.store_name,
      purchase_date: receipt.purchase_date,
      total_price: receipt.total_price,
      total_items: receipt.receipt_items.length,
      total_comparisons: comparisons.length,
      comparisons_found: comparisons,
      debug_items: debugItems
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 