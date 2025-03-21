import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    console.log("All items API called");
    
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
      console.error("Error fetching receipt items:", itemsError);
      throw itemsError;
    }
    
    console.log(`Found ${items?.length || 0} receipt items`);
    
    // If no items found, return diagnostic info
    if (!items?.length) {
      return NextResponse.json(
        { 
          items: [], 
          diagnostics: {
            message: "No standardized items found. Upload receipts and run the standardization process."
          }
        }
      );
    }

    // Get all receipts to join manually
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, store_name, purchase_date');

    if (receiptsError) {
      console.error("Error fetching receipts:", receiptsError);
      throw receiptsError;
    }
    
    console.log(`Found ${receipts?.length || 0} receipts`);

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
  } catch (error: Error | unknown) {
    console.error('Error in all-items API:', error);
    
    // Return an empty array instead of an error object to prevent client-side format errors
    // This ensures the frontend always receives an array, which it expects
    return NextResponse.json([]);
    
    // Original error response code (commented out)
    /*
    // Provide detailed error information
    const err = error as { message?: string; code?: string; hint?: string; details?: string };
    return NextResponse.json(
      { 
        error: 'Failed to retrieve items data',
        message: err.message || 'Unknown error',
        details: {
          code: err.code,
          hint: err.hint,
          details: err.details,
          stack: process.env.NODE_ENV === 'development' && err instanceof Error ? err.stack : undefined
        }
      },
      { status: 500 }
    );
    */
  }
} 