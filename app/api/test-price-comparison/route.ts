import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ReceiptItem {
  name?: string;
  price?: number;
  quantity?: number;
  [key: string]: unknown;
}

interface DebugInfo {
  item_name: string;
  status: string;
  reason: string;
  [key: string]: unknown;
}

// Function to standardize item names
function standardizeItemName(itemName: string): string {
  // Convert to lowercase
  let standardized = itemName.toLowerCase();
  
  // Remove common words and characters that don't affect the item identity
  standardized = standardized.replace(/\b(the|a|an|of|with|in|for|by|at|from|to)\b/g, '');
  
  // Remove special characters and extra spaces
  standardized = standardized.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  
  return standardized;
}

// Function to find cheaper alternatives for items
async function findCheaperAlternatives(items: ReceiptItem[], storeName: string) {
  const itemsWithAlternatives = [];
  const debugInfo: DebugInfo[] = [];
  
  for (const item of items) {
    // Skip items without a name or price
    if (!item.name || !item.price) {
      debugInfo.push({
        item_name: item.name || 'Unknown',
        status: 'skipped',
        reason: 'Missing name or price'
      });
      itemsWithAlternatives.push(item);
      continue;
    }
    
    // Standardize the item name for better matching
    const standardizedName = standardizeItemName(item.name);
    
    debugInfo.push({
      item_name: item.name,
      standardized_name: standardizedName,
      original_price: item.price,
      original_store: storeName
    });
    
    // Look for the same item at other stores
    const { data: alternatives, error } = await supabase
      .from('product_prices')
      .select('store_name, price, standardized_item_name, unit_size')
      .ilike('standardized_item_name', standardizedName)
      .neq('store_name', storeName)
      .order('price', { ascending: true })
      .limit(5);
    
    if (error) {
      console.error('Error finding alternatives:', error);
      debugInfo[debugInfo.length - 1].status = 'error';
      debugInfo[debugInfo.length - 1].error = error.message;
      itemsWithAlternatives.push(item);
      continue;
    }
    
    // Find the cheapest alternative
    const cheaperAlternatives = alternatives?.filter(alt => parseFloat(alt.price) < parseFloat(item.price)) || [];
    
    debugInfo[debugInfo.length - 1].alternatives_found = alternatives?.length || 0;
    debugInfo[debugInfo.length - 1].cheaper_alternatives_found = cheaperAlternatives.length;
    debugInfo[debugInfo.length - 1].all_alternatives = alternatives;
    
    if (cheaperAlternatives.length > 0) {
      // Get the cheapest alternative
      const cheapestAlternative = cheaperAlternatives[0];
      const savings = parseFloat(item.price) - parseFloat(cheapestAlternative.price);
      
      debugInfo[debugInfo.length - 1].status = 'found_cheaper';
      debugInfo[debugInfo.length - 1].cheapest_alternative = cheapestAlternative;
      debugInfo[debugInfo.length - 1].savings = savings;
      
      itemsWithAlternatives.push({
        ...item,
        cheaper_alternative: {
          store_name: cheapestAlternative.store_name,
          price: cheapestAlternative.price,
          unit_size: cheapestAlternative.unit_size,
          savings: savings
        }
      });
    } else {
      debugInfo[debugInfo.length - 1].status = 'no_cheaper_alternative';
      itemsWithAlternatives.push(item);
    }
  }
  
  return { itemsWithAlternatives, debugInfo };
}

export async function POST(request: Request) {
  try {
    const { store_name, items } = await request.json();
    
    if (!store_name) {
      return NextResponse.json(
        { error: 'Store name is required' },
        { status: 400 }
      );
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items array is required and must not be empty' },
        { status: 400 }
      );
    }
    
    // Check if the specified store exists in the product_prices table
    const { data: storeExists, error: storeError } = await supabase
      .from('product_prices')
      .select('store_name')
      .eq('store_name', store_name)
      .limit(1);
    
    if (storeError) {
      console.error('Error checking store existence:', storeError);
      return NextResponse.json(
        { error: 'Failed to check store existence' },
        { status: 500 }
      );
    }
    
    if (!storeExists || storeExists.length === 0) {
      // Check available stores for reference
      const { data: allStores } = await supabase
        .from('product_prices')
        .select('store_name');
      
      // Extract unique store names
      const uniqueStores = [...new Set(allStores?.map(s => s.store_name))];
      
      return NextResponse.json(
        { 
          error: `Store "${store_name}" not found in the database`,
          available_stores: uniqueStores || []
        },
        { status: 400 }
      );
    }
    
    // Find cheaper alternatives for the provided items
    const { itemsWithAlternatives, debugInfo } = await findCheaperAlternatives(items, store_name);
    
    // Count items with cheaper alternatives
    const itemsWithCheaperCount = itemsWithAlternatives.filter(item => item.cheaper_alternative).length;
    
    return NextResponse.json({
      success: true,
      total_items: items.length,
      items_with_cheaper_alternatives: itemsWithCheaperCount,
      items: itemsWithAlternatives,
      debug_info: debugInfo
    });
    
  } catch (error) {
    console.error('Error testing price comparison:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error testing price comparison' },
      { status: 500 }
    );
  }
} 