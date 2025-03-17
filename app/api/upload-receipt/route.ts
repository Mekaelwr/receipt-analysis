import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to find cheaper alternatives for items
async function findCheaperAlternatives(items: any[], storeName: string) {
  const itemsWithAlternatives = [];
  
  for (const item of items) {
    // Skip items without a name or price
    if (!item.name || !item.price) continue;
    
    // Standardize the item name for better matching
    // This is a simple implementation - you might want to use more sophisticated NLP
    const standardizedName = standardizeItemName(item.name);
    
    // Look for the same item at other stores
    const { data: alternatives, error } = await supabase
      .from('product_prices')
      .select('store_name, price, standardized_item_name')
      .eq('standardized_item_name', standardizedName)
      .neq('store_name', storeName)
      .order('price', { ascending: true })
      .limit(5);
    
    if (error) {
      console.error('Error finding alternatives:', error);
      continue;
    }
    
    // Find the cheapest alternative
    const cheaperAlternatives = alternatives?.filter(alt => alt.price < item.price) || [];
    
    if (cheaperAlternatives.length > 0) {
      // Get the cheapest alternative
      const cheapestAlternative = cheaperAlternatives[0];
      
      itemsWithAlternatives.push({
        ...item,
        cheaper_alternative: {
          store_name: cheapestAlternative.store_name,
          price: cheapestAlternative.price,
          savings: item.price - cheapestAlternative.price
        }
      });
    } else {
      itemsWithAlternatives.push(item);
    }
  }
  
  return itemsWithAlternatives;
}

// Function to standardize item names
function standardizeItemName(itemName: string): string {
  // Convert to lowercase
  let standardized = itemName.toLowerCase();
  
  // Remove common words and characters that don't affect the item identity
  standardized = standardized.replace(/\b(the|a|an|of|with|in|for|by|at|from|to)\b/g, '');
  
  // Remove special characters and extra spaces
  standardized = standardized.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  
  // Check if we have a standardization mapping in the database
  // This is a placeholder - in a real implementation, you would query your database
  
  return standardized;
}

// Function to check if an item name matches a standardized name
async function findStandardizedName(itemName: string): Promise<string | null> {
  // First try to find an exact match in the standardization table
  const { data: exactMatch, error: exactError } = await supabase
    .from('item_standardization')
    .select('standardized_name')
    .eq('original_pattern', itemName.toLowerCase())
    .limit(1);
  
  if (exactError) {
    console.error('Error finding exact match:', exactError);
    return null;
  }
  
  if (exactMatch && exactMatch.length > 0) {
    return exactMatch[0].standardized_name;
  }
  
  // If no exact match, try pattern matching
  const { data: patternMatches, error: patternError } = await supabase
    .from('item_standardization')
    .select('standardized_name, original_pattern');
  
  if (patternError) {
    console.error('Error finding pattern matches:', patternError);
    return null;
  }
  
  if (patternMatches) {
    for (const pattern of patternMatches) {
      // Simple pattern matching - in a real implementation, you might use regex
      if (itemName.toLowerCase().includes(pattern.original_pattern.toLowerCase())) {
        return pattern.standardized_name;
      }
    }
  }
  
  // If no match found, return the standardized version of the original name
  return standardizeItemName(itemName);
}

export async function POST(request: Request) {
  try {
    console.log('Received request to upload receipt');
    
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const receiptData = formData.get('receiptData') as string;
    
    if (!imageFile) {
      console.error('No image file provided');
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }
    
    if (!receiptData) {
      console.error('No receipt data provided');
      return NextResponse.json(
        { error: 'No receipt data provided' },
        { status: 400 }
      );
    }
    
    // Parse the receipt data
    const parsedReceiptData = JSON.parse(receiptData);
    
    // Generate a unique filename
    const timestamp = Date.now();
    const fileExtension = imageFile.name.split('.').pop();
    const fileName = `${timestamp}.${fileExtension}`;
    
    // Upload the image to Supabase Storage
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('receipts')
      .upload(`receipts/${fileName}`, buffer, {
        contentType: imageFile.type,
        upsert: false
      });
    
    if (storageError) {
      console.error('Error uploading image to storage:', storageError);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }
    
    // Get the public URL for the uploaded image
    const { data: { publicUrl } } = supabase
      .storage
      .from('receipts')
      .getPublicUrl(`receipts/${fileName}`);
    
    // Extract receipt information from the parsed data
    const storeInfo = parsedReceiptData.store_information || {};
    const purchaseDetails = parsedReceiptData.purchase_details || {};
    const financialSummary = parsedReceiptData.financial_summary || {};
    
    // Find cheaper alternatives for items
    if (parsedReceiptData.items && parsedReceiptData.items.length > 0 && storeInfo.name) {
      parsedReceiptData.items = await findCheaperAlternatives(
        parsedReceiptData.items, 
        storeInfo.name
      );
    }
    
    // Insert the receipt record into the database
    const { data: receiptRecord, error: dbError } = await supabase
      .from('receipts')
      .insert({
        image_url: publicUrl,
        store_name: storeInfo.name || 'Unknown Store',
        store_location: storeInfo.address || null,
        store_phone_number: storeInfo.phone_number || null,
        subtotal: financialSummary.subtotal || 0,
        taxes: financialSummary.total_taxes || null,
        total_price: financialSummary.total_amount || 0,
        purchase_date: purchaseDetails.date ? new Date(purchaseDetails.date) : new Date(),
        purchase_time: purchaseDetails.time || null,
        total_discounts: financialSummary.total_discounts || 0,
        net_sales: financialSummary.net_sales || null,
        change_given: financialSummary.change_given || 0,
        payment_method: parsedReceiptData.payment_information?.method || null,
        raw_receipt_json: parsedReceiptData
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('Error inserting receipt record:', dbError);
      return NextResponse.json(
        { error: 'Failed to save receipt data' },
        { status: 500 }
      );
    }
    
    // Insert receipt items
    if (parsedReceiptData.items && parsedReceiptData.items.length > 0) {
      const receiptItems = await Promise.all(parsedReceiptData.items.map(async (item: any) => {
        // Try to find a standardized name for this item
        const standardizedName = await findStandardizedName(item.name || '');
        
        return {
          receipt_id: receiptRecord.id,
          original_item_name: item.name || 'Unknown Item',
          standardized_item_name: standardizedName,
          item_price: item.price || 0,
          quantity: item.quantity || 1,
          regular_price: item.regular_price || item.price || 0,
          final_price: item.final_price || (item.price * (item.quantity || 1)) || 0,
          cheaper_alternative: item.cheaper_alternative ? JSON.stringify(item.cheaper_alternative) : null
        };
      }));
      
      const { error: itemsError } = await supabase
        .from('receipt_items')
        .insert(receiptItems);
      
      if (itemsError) {
        console.error('Error inserting receipt items:', itemsError);
        // Continue execution - we've already saved the receipt record
      }
    }
    
    // Insert tax information if available
    if (parsedReceiptData.taxes && parsedReceiptData.taxes.length > 0) {
      const receiptTaxes = parsedReceiptData.taxes.map((tax: any) => ({
        receipt_id: receiptRecord.id,
        category: tax.category || 'Tax',
        rate: tax.rate || null,
        amount: tax.amount || 0
      }));
      
      // Check if receipt_taxes table exists
      const { data: tableExists } = await supabase
        .from('receipt_taxes')
        .select('id')
        .limit(1);
      
      // Only insert if the table exists
      if (tableExists !== null) {
        const { error: taxesError } = await supabase
          .from('receipt_taxes')
          .insert(receiptTaxes);
        
        if (taxesError) {
          console.error('Error inserting receipt taxes:', taxesError);
          // Continue execution - we've already saved the receipt record
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      receipt_id: receiptRecord.id,
      image_url: publicUrl,
      receipt_data: parsedReceiptData // Return the updated receipt data with alternatives
    });
    
  } catch (error) {
    console.error('Error processing receipt upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error processing receipt upload' },
      { status: 500 }
    );
  }
} 