export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { SupabaseClient } from '@supabase/supabase-js';

interface ReceiptItem {
  id: string;
  standardized_item_name: string;
  detailed_name?: string;
  item_price: number;
  receipts: Array<{
    id: string;
    store_name: string;
  }>;
}

interface ProductPrice {
  store_name: string;
  price: number;
  standardized_item_name: string;
}

interface TestItem {
  name: string;
  price: string;
  standardized_name: string;
  cheaper_alternative?: {
    store_name: string;
    price: number;
    item_name: string;
    savings: number;
    percentage_savings: number;
  };
}

// Function to find cheaper alternatives for items - simplified version of what's in upload-receipt
async function findCheaperAlternatives(items: TestItem[], storeName: string) {
  const supabase = await createClient();
  const itemsWithAlternatives: TestItem[] = [];
  let alternativesCount = 0;
  
  console.log(`Testing findCheaperAlternatives for ${items.length} items from ${storeName}`);
  
  for (const item of items) {
    // Skip items without a name or price
    if (!item.name || !item.price) {
      console.log(`Skipping item without name or price: ${JSON.stringify(item)}`);
      continue;
    }
    
    // Get the standardized name
    const standardizedName = item.standardized_name || '';
    
    if (!standardizedName) {
      console.log(`Item has no standardized name: ${item.name}`);
      itemsWithAlternatives.push(item);
      continue;
    }
    
    console.log(`Processing item: ${item.name} (${standardizedName}) - price: ${item.price}`);
    
    try {
      // First approach: Use receipt_items table
      const { data: alternativesFromReceipts, error: receiptsError } = await supabase
        .from('receipt_items')
        .select(`
          id,
          standardized_item_name,
          detailed_name,
          item_price,
          receipts:receipts(id, store_name)
        `)
        .eq('standardized_item_name', standardizedName)
        .lt('item_price', parseFloat(item.price.toString()));
      
      // Filter out items from the wrong store and sort by price
      const filteredAlternativesFromReceipts = (alternativesFromReceipts as ReceiptItem[] | null)
        ?.filter((alt: ReceiptItem) => alt.receipts && alt.receipts[0]?.store_name !== storeName)
        .sort((a: ReceiptItem, b: ReceiptItem) => parseFloat(a.item_price.toString()) - parseFloat(b.item_price.toString()))
        .slice(0, 5) || [];
      
      if (receiptsError) {
        console.error('Error finding alternatives from receipts:', receiptsError);
      }
      
      console.log(`Found ${filteredAlternativesFromReceipts.length} alternatives from receipts for ${item.name}`);
      
      // Second approach: Try the product_prices table as a fallback
      const { data: alternativesFromPrices, error: pricesError } = await supabase
        .from('product_prices')
        .select('store_name, price, standardized_item_name')
        .eq('standardized_item_name', standardizedName)
        .neq('store_name', storeName)
        .lt('price', parseFloat(item.price.toString()))
        .order('price', { ascending: true })
        .limit(5);
      
      if (pricesError) {
        console.error('Error finding alternatives from product_prices:', pricesError);
      }
      
      console.log(`Found ${alternativesFromPrices?.length || 0} alternatives from prices for ${item.name}`);
      
      // Prioritize alternatives from receipts, then fall back to product_prices
      const cheaperAlternatives: Array<{store_name: string; price: number; item_name: string}> = [];
      
      if (filteredAlternativesFromReceipts.length > 0) {
        // Format alternatives from receipts to match our expected structure
        cheaperAlternatives.push(...filteredAlternativesFromReceipts.map((alt: ReceiptItem) => ({
          store_name: alt.receipts[0]?.store_name || 'Unknown',
          price: alt.item_price,
          item_name: alt.detailed_name || alt.standardized_item_name
        })));
      } else if (alternativesFromPrices && alternativesFromPrices.length > 0) {
        // Format alternatives from product_prices
        cheaperAlternatives.push(...(alternativesFromPrices as ProductPrice[]).map((alt: ProductPrice) => ({
          store_name: alt.store_name,
          price: alt.price,
          item_name: alt.standardized_item_name
        })));
      }
      
      if (cheaperAlternatives.length > 0) {
        // Get the cheapest alternative
        const cheapestAlternative = cheaperAlternatives[0];
        const itemPrice = parseFloat(item.price?.toString() || '0');
        const alternativePrice = parseFloat(cheapestAlternative.price?.toString() || '0');
        const savings = itemPrice - alternativePrice;
        const percentageSavings = (savings / itemPrice) * 100;
        
        alternativesCount++;
        
        console.log(`Found cheaper alternative for ${item.name}: ${cheapestAlternative.item_name} at ${cheapestAlternative.store_name} for $${cheapestAlternative.price} (savings: ${percentageSavings.toFixed(2)}%)`);
        
        itemsWithAlternatives.push({
          ...item,
          cheaper_alternative: {
            store_name: cheapestAlternative.store_name,
            price: cheapestAlternative.price,
            item_name: cheapestAlternative.item_name,
            savings: savings,
            percentage_savings: percentageSavings
          }
        });
      } else {
        console.log(`No cheaper alternatives found for ${item.name}`);
        itemsWithAlternatives.push(item);
      }
    } catch (error) {
      console.error(`Error processing alternatives for item ${item.name}:`, error);
      itemsWithAlternatives.push(item);
    }
  }
  
  console.log(`Found cheaper alternatives for ${alternativesCount} out of ${items.length} items`);
  return {
    itemsWithAlternatives,
    alternativesCount,
    totalItems: items.length
  };
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Test with some common grocery items
    const testItems = [
      { name: "KIND Snack Bar", price: 4.49, standardized_name: "Snack Bar" },
      { name: "Simply Orange Juice, No Pulp (52 oz)", price: 4.99, standardized_name: "Orange Juice" },
      { name: "Signature Select Honey Mustard", price: 3.29, standardized_name: "Honey Mustard" }
    ];
    
    // Find alternatives for these items
    const itemsWithAlternatives = [];
    let alternativesCount = 0;
    
    for (const item of testItems) {
      const standardizedName = item.standardized_name;
      
      // Try to find cheaper alternatives from product_prices
      const { data: alternatives } = await supabase
        .from('product_prices')
        .select('store_name, price, standardized_item_name')
        .eq('standardized_item_name', standardizedName)
        .lt('price', item.price)
        .order('price', { ascending: true })
        .limit(5);
      
      if (alternatives && alternatives.length > 0) {
        // Get the cheapest alternative
        const cheapestAlternative = alternatives[0];
        const itemPrice = item.price;
        const alternativePrice = cheapestAlternative.price;
        const savings = itemPrice - alternativePrice;
        const percentageSavings = (savings / itemPrice) * 100;
        
        alternativesCount++;
        
        const cheaper_alternative = {
          store_name: cheapestAlternative.store_name || "Unknown",
          price: alternativePrice,
          item_name: cheapestAlternative.standardized_item_name,
          savings: savings,
          percentage_savings: percentageSavings
        };
        
        itemsWithAlternatives.push({
          ...item,
          cheaper_alternative
        });
        
        console.log(`Test item: ${item.name} has alternative: ${cheaper_alternative.item_name} at ${cheaper_alternative.store_name} for $${cheaper_alternative.price} (savings: ${percentageSavings.toFixed(2)}%)`);
      } else {
        itemsWithAlternatives.push(item);
      }
    }
    
    // Create a fake receipt with our test items
    const testReceiptWithAlternatives = {
      store_information: {
        name: "Test Store",
        address: "123 Test St.",
        phone_number: "555-123-4567"
      },
      purchase_details: {
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString()
      },
      items: itemsWithAlternatives.map(item => ({
        name: item.name,
        price: item.price,
        quantity: 1,
        final_price: item.price,
        cheaper_alternative: item.cheaper_alternative
      })),
      financial_summary: {
        subtotal: itemsWithAlternatives.reduce((sum, item) => sum + item.price, 0),
        total_taxes: 0,
        total_amount: itemsWithAlternatives.reduce((sum, item) => sum + item.price, 0),
      }
    };
    
    // Calculate savings
    const totalSavings = itemsWithAlternatives
      .filter(item => item.cheaper_alternative)
      .reduce((sum, item) => sum + (item.cheaper_alternative?.savings || 0), 0);
    
    return NextResponse.json({
      message: `Found cheaper alternatives for ${alternativesCount} out of ${testItems.length} items`,
      items: itemsWithAlternatives,
      receipt: testReceiptWithAlternatives,
      total_savings: totalSavings.toFixed(2)
    });
  } catch (error) {
    console.error("Error in test-find-alternatives:", error);
    return NextResponse.json(
      { error: "Test endpoint failed" },
      { status: 500 }
    );
  }
} 