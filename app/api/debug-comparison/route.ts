import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const receiptId = searchParams.get('receipt_id');

  if (!receiptId) {
    return NextResponse.json({ error: 'receipt_id is required' }, { status: 400 });
  }

  try {
    console.log(`Running direct query for receipt: ${receiptId}`);
    
    // Direct SQL query using Supabase
    const { data: directData, error: directError } = await supabase
      .rpc('find_receipt_cheaper_alternatives', { receipt_id: receiptId });
    
    // RPC query
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('find_receipt_cheaper_alternatives', { receipt_id: receiptId });
    
    // Get receipt items
    const { data: receiptItems, error: receiptItemsError } = await supabase
      .from('receipt_items')
      .select('id, original_item_name, standardized_item_name, detailed_name, item_price')
      .eq('receipt_id', receiptId);
    
    // Check for honey mustard item specifically
    const { data: honeyMustardItems, error: honeyMustardError } = await supabase
      .from('receipt_items')
      .select('id, original_item_name, standardized_item_name, detailed_name, item_price')
      .eq('receipt_id', receiptId)
      .ilike('standardized_item_name', '%honey%mustard%');
    
    // Get all possible cheaper alternatives with a direct query
    const { data: allPossibleAlternatives, error: allPossibleError } = await supabase
      .from('receipt_items')
      .select(`
        id, 
        original_item_name, 
        standardized_item_name, 
        detailed_name, 
        item_price,
        receipts!inner(id, store_name, purchase_date)
      `)
      .neq('receipt_id', receiptId)
      .order('standardized_item_name');
    
    // Get receipt info
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('id, store_name, purchase_date, total_price')
      .eq('id', receiptId)
      .single();
    
    return NextResponse.json({
      receipt,
      receipt_error: receiptError ? receiptError.message : null,
      direct_query: {
        data: directData,
        error: directError ? directError.message : null,
        count: directData ? directData.length : 0
      },
      rpc_query: {
        data: rpcData,
        error: rpcError ? rpcError.message : null,
        count: rpcData ? rpcData.length : 0
      },
      receipt_items: {
        data: receiptItems,
        error: receiptItemsError ? receiptItemsError.message : null,
        count: receiptItems ? receiptItems.length : 0
      },
      honey_mustard_items: {
        data: honeyMustardItems,
        error: honeyMustardError ? honeyMustardError.message : null,
        count: honeyMustardItems ? honeyMustardItems.length : 0
      },
      all_possible_alternatives: {
        data: allPossibleAlternatives,
        error: allPossibleError ? allPossibleError.message : null,
        count: allPossibleAlternatives ? allPossibleAlternatives.length : 0
      }
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json({ error: 'Server error processing request' }, { status: 500 });
  }
} 