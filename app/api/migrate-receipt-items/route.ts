import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Receipt {
  id: string;
  raw_receipt_json: {
    items?: ReceiptItem[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ReceiptItem {
  name?: string;
  price?: number;
  quantity?: number;
  [key: string]: unknown;
}

// Helper function to standardize item names
function standardizeItemName(itemName: string): string {
  // Convert to lowercase
  let standardized = itemName.toLowerCase();
  
  // Remove common words and characters that don't affect the item identity
  standardized = standardized.replace(/\b(the|a|an|of|with|in|for|by|at|from|to)\b/g, '');
  
  // Remove special characters and extra spaces
  standardized = standardized.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  
  return standardized;
}

// Process a single receipt
async function processReceipt(receipt: Receipt) {
  try {
    const receipt_id = receipt.id;
    
    // Check if the receipt already has items in the receipt_items table
    const { data: existingItems, error: existingItemsError } = await supabase
      .from('receipt_items')
      .select('id')
      .eq('receipt_id', receipt_id);

    if (existingItemsError) {
      console.error(`Error checking existing items for receipt ${receipt_id}:`, existingItemsError);
      return { success: false, receipt_id, error: 'Failed to check existing items' };
    }

    if (existingItems && existingItems.length > 0) {
      console.log(`Receipt ${receipt_id} already has ${existingItems.length} items - skipping`);
      return { success: true, receipt_id, status: 'skipped', items_count: existingItems.length };
    }

    // Process the items from the raw receipt JSON
    const rawReceiptData = receipt.raw_receipt_json;
    
    if (!rawReceiptData || !rawReceiptData.items || !Array.isArray(rawReceiptData.items)) {
      console.log(`Receipt ${receipt_id} does not have valid items data - skipping`);
      return { success: false, receipt_id, error: 'Receipt does not have valid items data' };
    }

    console.log(`Processing ${rawReceiptData.items.length} receipt items for insertion for receipt ${receipt_id}`);
    
    // Prepare the items for insertion
    const receiptItems = rawReceiptData.items.map((item: ReceiptItem) => {
      // Create a standardized name for each item
      const standardizedName = standardizeItemName(item.name || '');
      
      return {
        receipt_id: receipt_id,
        original_item_name: item.name || 'Unknown Item',
        standardized_item_name: standardizedName,
        item_price: item.price || 0,
        quantity: item.quantity || 1,
        regular_price: item.regular_price || item.price || 0,
        final_price: item.final_price || (item.price * (item.quantity || 1)) || 0,
        cheaper_alternative: item.cheaper_alternative ? JSON.stringify(item.cheaper_alternative) : null
      };
    });
    
    if (receiptItems.length === 0) {
      console.log(`No valid items found for receipt ${receipt_id} - skipping`);
      return { success: true, receipt_id, status: 'skipped', items_count: 0 };
    }
    
    console.log(`Prepared ${receiptItems.length} receipt items for database insertion for receipt ${receipt_id}`);
    
    // Insert the items into the receipt_items table
    const { data: insertedItems, error: insertError } = await supabase
      .from('receipt_items')
      .insert(receiptItems)
      .select();
    
    if (insertError) {
      console.error(`Error inserting receipt items for receipt ${receipt_id}:`, insertError);
      return { success: false, receipt_id, error: 'Failed to insert receipt items' };
    }
    
    console.log(`Successfully inserted ${insertedItems.length} receipt items for receipt ${receipt_id}`);
    return { success: true, receipt_id, status: 'processed', items_count: insertedItems.length };
    
  } catch (error) {
    console.error(`Error processing receipt ${receipt.id}:`, error);
    return { success: false, receipt_id: receipt.id, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function GET() {
  try {
    // Get all receipts
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, raw_receipt_json')
      .order('created_at', { ascending: false });

    if (receiptsError) {
      console.error('Error fetching receipts:', receiptsError);
      return NextResponse.json(
        { error: 'Failed to fetch receipts' },
        { status: 500 }
      );
    }

    if (!receipts || receipts.length === 0) {
      return NextResponse.json(
        { message: 'No receipts found to process' },
        { status: 200 }
      );
    }

    console.log(`Found ${receipts.length} receipts to potentially process`);
    
    // Process each receipt
    const results = await Promise.all(receipts.map(processReceipt));
    
    // Summarize the results
    const processed = results.filter(r => r.success && r.status === 'processed').length;
    const skipped = results.filter(r => r.success && r.status === 'skipped').length;
    const failed = results.filter(r => !r.success).length;
    
    return NextResponse.json({
      success: true,
      total_receipts: receipts.length,
      processed,
      skipped,
      failed,
      results
    });
    
  } catch (error) {
    console.error('Error migrating receipt items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error migrating receipt items' },
      { status: 500 }
    );
  }
} 