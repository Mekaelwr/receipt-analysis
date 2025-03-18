import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

export async function POST(request: Request) {
  try {
    const { receipt_id } = await request.json();

    if (!receipt_id) {
      return NextResponse.json(
        { error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // Fetch the receipt from the database
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receipt_id)
      .single();

    if (receiptError || !receipt) {
      console.error('Error fetching receipt:', receiptError);
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Check if the receipt already has items in the receipt_items table
    const { data: existingItems, error: existingItemsError } = await supabase
      .from('receipt_items')
      .select('id')
      .eq('receipt_id', receipt_id);

    if (existingItemsError) {
      console.error('Error checking existing items:', existingItemsError);
      return NextResponse.json(
        { error: 'Failed to check existing items' },
        { status: 500 }
      );
    }

    if (existingItems && existingItems.length > 0) {
      console.log(`Receipt ${receipt_id} already has ${existingItems.length} items`);
      
      // Delete existing items
      const { error: deleteError } = await supabase
        .from('receipt_items')
        .delete()
        .eq('receipt_id', receipt_id);
        
      if (deleteError) {
        console.error('Error deleting existing items:', deleteError);
        return NextResponse.json(
          { error: 'Failed to delete existing items' },
          { status: 500 }
        );
      }
      
      console.log(`Deleted ${existingItems.length} existing items for receipt ${receipt_id}`);
    }

    // Process the items from the raw receipt JSON
    const rawReceiptData = receipt.raw_receipt_json;
    
    if (!rawReceiptData || !rawReceiptData.items || !Array.isArray(rawReceiptData.items)) {
      return NextResponse.json(
        { error: 'Receipt does not have valid items data' },
        { status: 400 }
      );
    }

    console.log(`Processing ${rawReceiptData.items.length} receipt items for insertion`);
    
    // Prepare the items for insertion
    const receiptItems = rawReceiptData.items.map((item: any) => {
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
    
    console.log(`Prepared ${receiptItems.length} receipt items for database insertion`);
    
    // Insert the items into the receipt_items table
    const { data: insertedItems, error: insertError } = await supabase
      .from('receipt_items')
      .insert(receiptItems)
      .select();
    
    if (insertError) {
      console.error('Error inserting receipt items:', insertError);
      return NextResponse.json(
        { error: 'Failed to insert receipt items' },
        { status: 500 }
      );
    }
    
    console.log(`Successfully inserted ${insertedItems.length} receipt items for receipt ${receipt_id}`);
    
    return NextResponse.json({
      success: true,
      receipt_id: receipt_id,
      items_count: insertedItems.length
    });
    
  } catch (error) {
    console.error('Error processing receipt items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error processing receipt items' },
      { status: 500 }
    );
  }
} 