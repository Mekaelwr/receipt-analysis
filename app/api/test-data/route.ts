import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'edge';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { action } = await request.json();
    
    switch (action) {
      case 'setup-orange-juice-comparison':
        return await setupOrangeJuiceComparison();
      case 'setup-multiple-comparisons':
        return await setupMultipleComparisons();
      case 'insert-direct-sql':
        return await insertDirectSQL();
      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in test data API:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

async function insertDirectSQL() {
  try {
    // Create a few direct SQL statements that are guaranteed to work
    const receiptsInsert = await supabase.rpc('execute_sql', {
      sql_statement: `
        INSERT INTO receipts (id, store_name, raw_receipt_json)
        VALUES ('00000000-1111-2222-3333-444444444444', 'Jewel Osco', 
          '{"store_name": "Jewel Osco", "items": [{"name": "BREAD", "price": "3.49"}]}'::jsonb)
        RETURNING id
      `
    });
    
    const receiptItemsInsert = await supabase.rpc('execute_sql', {
      sql_statement: `
        INSERT INTO receipt_items (receipt_id, original_item_name, standardized_item_name, category, quantity, final_price, item_price)
        VALUES ('00000000-1111-2222-3333-444444444444', 'BREAD', 'Bread', 'Bakery', 1, 3.49, 3.49)
        RETURNING id
      `
    });
    
    return NextResponse.json({
      success: true,
      message: 'Direct SQL execution attempted',
      details: {
        receipts_result: receiptsInsert,
        receipt_items_result: receiptItemsInsert
      }
    });
  } catch (error) {
    console.error('Error executing direct SQL:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error executing direct SQL',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

async function setupOrangeJuiceComparison() {
  try {
    const results = [];
    
    // Step 1: Create test receipt with orange juice at ALDI
    const receiptId = uuidv4();
    console.log('Creating receipt with ID:', receiptId);
    
    // Insert receipt
    const receiptInsert = await supabase
      .from('receipts')
      .insert({
        id: receiptId,
        store_name: 'ALDI',
        subtotal: 5.99,
        total_price: 5.99,
        purchase_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        raw_receipt_json: {
          store_name: 'ALDI',
          subtotal: 5.99,
          total_price: 5.99,
          items: [
            { name: 'TRPNCA OJ', price: '5.99' }
          ]
        }
      });
    
    results.push({ operation: 'insert_receipt', result: receiptInsert });
    console.log('Receipt insert result:', receiptInsert);
    
    if (receiptInsert.error) {
      throw new Error(`Receipt insert failed: ${receiptInsert.error.message}`);
    }
    
    // Insert receipt item
    const receiptItemInsert = await supabase
      .from('receipt_items')
      .insert({
        receipt_id: receiptId,
        original_item_name: 'TRPNCA OJ',
        standardized_item_name: 'Orange Juice',
        category: 'Beverages',
        quantity: 1,
        final_price: 5.99,
        item_price: 5.99
      });
    
    results.push({ operation: 'insert_receipt_item', result: receiptItemInsert });
    console.log('Receipt item insert result:', receiptItemInsert);
    
    if (receiptItemInsert.error) {
      throw new Error(`Receipt item insert failed: ${receiptItemInsert.error.message}`);
    }
    
    // Step 2: Insert product prices for orange juice at different stores
    const productPrices = [
      {
        standardized_item_name: 'Orange Juice',
        store_name: 'ALDI',
        price: 5.99,
        unit_size: '52 oz',
        last_updated: new Date().toISOString()
      },
      {
        standardized_item_name: 'Orange Juice',
        store_name: 'Walmart',
        price: 4.99,
        unit_size: '52 oz',
        last_updated: new Date().toISOString()
      },
      {
        standardized_item_name: 'Orange Juice',
        store_name: 'Jewel Osco',
        price: 6.99,
        unit_size: '52 oz',
        last_updated: new Date().toISOString()
      }
    ];
    
    const productPricesInsert = await supabase
      .from('product_prices')
      .upsert(productPrices, { 
        onConflict: 'standardized_item_name,store_name',
        ignoreDuplicates: false
      });
    
    results.push({ operation: 'insert_product_prices', result: productPricesInsert });
    console.log('Product prices insert result:', productPricesInsert);
    
    if (productPricesInsert.error) {
      throw new Error(`Product prices insert failed: ${productPricesInsert.error.message}`);
    }
    
    // Step 3: Check if our item has been standardized correctly
    const standardizationsResult = await supabase
      .from('item_standardization')
      .select('*')
      .eq('standardized_name', 'Orange Juice')
      .limit(1);
    
    results.push({ operation: 'check_standardizations', result: standardizationsResult });
    console.log('Standardizations check result:', standardizationsResult);
    
    // If no standardization exists, create one
    if (!standardizationsResult.data || standardizationsResult.data.length === 0) {
      const standardizationsInsert = await supabase
        .from('item_standardization')
        .upsert([
          {
            original_pattern: '%TRPNCA OJ%',
            standardized_name: 'Orange Juice',
            category: 'Beverages'
          },
          {
            original_pattern: '%Orange Juice%',
            standardized_name: 'Orange Juice',
            category: 'Beverages'
          }
        ], {
          onConflict: 'original_pattern',
          ignoreDuplicates: true
        });
      
      results.push({ operation: 'insert_standardizations', result: standardizationsInsert });
      console.log('Standardizations insert result:', standardizationsInsert);
      
      if (standardizationsInsert.error) {
        throw new Error(`Standardizations insert failed: ${standardizationsInsert.error.message}`);
      }
    }
    
    // Check if we can query the receipt and item we just created
    const verifyReceiptResult = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .limit(1);
    
    results.push({ operation: 'verify_receipt', result: verifyReceiptResult });
    console.log('Verify receipt result:', verifyReceiptResult);
    
    const verifyReceiptItemResult = await supabase
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', receiptId)
      .limit(1);
    
    results.push({ operation: 'verify_receipt_item', result: verifyReceiptItemResult });
    console.log('Verify receipt item result:', verifyReceiptItemResult);
    
    return NextResponse.json({
      success: true,
      message: 'Orange juice comparison data has been set up',
      details: {
        receipt_id: receiptId,
        product_prices: productPrices,
        operations_results: results
      }
    });
  } catch (error) {
    console.error('Error setting up orange juice comparison:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error setting up orange juice comparison',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

async function setupMultipleComparisons() {
  try {
    // Create a receipt with multiple items at Jewel Osco
    const receiptId = uuidv4();
    
    // Calculate the subtotal
    const subtotal = 0.89 + 3.99 + 3.49;
    
    // Insert receipt
    await supabase
      .from('receipts')
      .insert({
        id: receiptId,
        store_name: 'Jewel Osco',
        subtotal: subtotal,
        total_price: subtotal,
        purchase_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        raw_receipt_json: {
          store_name: 'Jewel Osco',
          subtotal: subtotal,
          total_price: subtotal,
          items: [
            { name: 'ORGANIC BANANA', price: '0.89' },
            { name: 'WHOLE MILK', price: '3.99' },
            { name: 'BREAD', price: '3.49' }
          ]
        }
      });
    
    // Insert receipt items
    const receiptItems = [
      {
        receipt_id: receiptId,
        original_item_name: 'ORGANIC BANANA',
        standardized_item_name: 'Bananas',
        category: 'Produce',
        quantity: 1,
        final_price: 0.89,
        item_price: 0.89
      },
      {
        receipt_id: receiptId,
        original_item_name: 'WHOLE MILK',
        standardized_item_name: 'Milk',
        category: 'Dairy',
        quantity: 1,
        final_price: 3.99,
        item_price: 3.99
      },
      {
        receipt_id: receiptId,
        original_item_name: 'BREAD',
        standardized_item_name: 'Bread',
        category: 'Bakery',
        quantity: 1,
        final_price: 3.49,
        item_price: 3.49
      }
    ];
    
    await supabase
      .from('receipt_items')
      .insert(receiptItems);
    
    // Insert product prices for comparison
    const productPrices = [
      // Bananas
      {
        standardized_item_name: 'Bananas',
        store_name: 'Jewel Osco',
        price: 0.89,
        unit_size: '1 lb',
        last_updated: new Date().toISOString()
      },
      {
        standardized_item_name: 'Bananas',
        store_name: 'ALDI',
        price: 0.59,
        unit_size: '1 lb',
        last_updated: new Date().toISOString()
      },
      {
        standardized_item_name: 'Bananas',
        store_name: 'Walmart',
        price: 0.58,
        unit_size: '1 lb',
        last_updated: new Date().toISOString()
      },
      
      // Milk
      {
        standardized_item_name: 'Milk',
        store_name: 'Jewel Osco',
        price: 3.99,
        unit_size: '1 gallon',
        last_updated: new Date().toISOString()
      },
      {
        standardized_item_name: 'Milk',
        store_name: 'ALDI',
        price: 3.29,
        unit_size: '1 gallon',
        last_updated: new Date().toISOString()
      },
      {
        standardized_item_name: 'Milk',
        store_name: 'Walmart',
        price: 3.49,
        unit_size: '1 gallon',
        last_updated: new Date().toISOString()
      },
      
      // Bread
      {
        standardized_item_name: 'Bread',
        store_name: 'Jewel Osco',
        price: 3.49,
        unit_size: '1 loaf',
        last_updated: new Date().toISOString()
      },
      {
        standardized_item_name: 'Bread',
        store_name: 'ALDI',
        price: 1.29,
        unit_size: '1 loaf',
        last_updated: new Date().toISOString()
      },
      {
        standardized_item_name: 'Bread',
        store_name: 'Walmart',
        price: 1.99,
        unit_size: '1 loaf',
        last_updated: new Date().toISOString()
      }
    ];
    
    await supabase
      .from('product_prices')
      .upsert(productPrices, { 
        onConflict: 'standardized_item_name,store_name',
        ignoreDuplicates: false
      });
    
    // Make sure standardization patterns exist
    const standardizations = [
      {
        original_pattern: '%Bananas%',
        standardized_name: 'Bananas',
        category: 'Produce'
      },
      {
        original_pattern: '%BANANA%',
        standardized_name: 'Bananas',
        category: 'Produce'
      },
      {
        original_pattern: '%Milk%',
        standardized_name: 'Milk',
        category: 'Dairy'
      },
      {
        original_pattern: '%MILK%',
        standardized_name: 'Milk',
        category: 'Dairy'
      },
      {
        original_pattern: '%Bread%',
        standardized_name: 'Bread',
        category: 'Bakery'
      },
      {
        original_pattern: '%BREAD%',
        standardized_name: 'Bread',
        category: 'Bakery'
      }
    ];
    
    await supabase
      .from('item_standardization')
      .upsert(standardizations, { 
        onConflict: 'original_pattern',
        ignoreDuplicates: true
      });
    
    return NextResponse.json({
      success: true,
      message: 'Multiple comparison items have been set up',
      details: {
        receipt_id: receiptId,
        items: receiptItems.map(item => item.standardized_item_name),
        product_prices: productPrices.length
      }
    });
  } catch (error) {
    console.error('Error setting up multiple comparisons:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error setting up multiple comparisons' },
      { status: 500 }
    );
  }
} 