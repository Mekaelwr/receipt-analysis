import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // First, get all receipt items
    const { data: items, error: itemsError } = await supabase
      .from('receipt_items')
      .select(`
        id,
        standardized_item_name,
        original_item_name,
        final_price,
        quantity,
        category,
        receipt_id
      `)
      .not('standardized_item_name', 'is', null);

    if (itemsError) {
      throw itemsError;
    }

    // Get all receipts to join manually
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, store_name, purchase_date');

    if (receiptsError) {
      throw receiptsError;
    }

    // Create a map of receipts by ID for faster lookup
    const receiptsMap = new Map();
    receipts.forEach(receipt => {
      receiptsMap.set(receipt.id, receipt);
    });

    // Process the data to format it for the frontend
    const processedItems = items.map(item => {
      // Calculate unit price
      const unitPrice = item.final_price / (item.quantity || 1);
      
      // Get receipt data
      const receipt = receiptsMap.get(item.receipt_id);
      const storeName = receipt?.store_name || 'Unknown Store';
      const purchaseDate = receipt?.purchase_date || new Date().toISOString();
      
      return {
        item_name: item.standardized_item_name || item.original_item_name,
        store_name: storeName,
        price: unitPrice,
        category: item.category || 'Uncategorized',
        purchase_date: purchaseDate
      };
    });
    
    return NextResponse.json(processedItems);
  } catch (error) {
    console.error('Error in all-items API:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve items data' },
      { status: 500 }
    );
  }
} 