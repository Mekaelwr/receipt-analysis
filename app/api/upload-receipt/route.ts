import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

// Configure for edge runtime
export const runtime = 'edge';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface ReceiptItem {
  name?: string;
  price?: number;
  quantity?: number;
  [key: string]: unknown;
}

interface ReceiptAlternative {
  id: string;
  standardized_item_name: string;
  detailed_name: string;
  item_price: number;
  receipts: {
    id: string;
    store_name: string;
  };
}

// Modify file handling to use ArrayBuffer
async function processReceiptImage(imageFile: File): Promise<string> {
  const receipt_id = uuidv4();
  const arrayBuffer = await imageFile.arrayBuffer();
  
  // Store image in the receipts bucket
  const { data, error } = await supabase
    .storage
    .from('receipts')  // Changed from 'public' to 'receipts'
    .upload(`${receipt_id}.jpg`, arrayBuffer, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true  // Added upsert option
    });

  if (error) {
    console.error('Storage error details:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  return receipt_id;
}

// Modify the POST handler to handle FormData directly
export async function POST(request: Request) {
  try {
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

    let receipt_id;
    try {
      receipt_id = await processReceiptImage(imageFile);
    } catch (uploadError) {
      console.error('Error uploading image:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image to storage' },
        { status: 500 }
      );
    }

    console.log('Received request to upload receipt');
    
    // If receiptData is not provided, we'll analyze the image with OpenAI
    let parsedReceiptData;
    if (!receiptData) {
      console.log('No receipt data provided, analyzing image with AI...');
      
      // Convert image to base64 for OpenAI
      const arrayBuffer = await imageFile.arrayBuffer();
      const base64Image = btoa(
        new Uint8Array(arrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      const mimeType = imageFile.type;
      
      // Simple initial prompt to extract basic receipt information
      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          { 
            role: "system", 
            content: "You are a receipt processing assistant. Extract information from receipt images into JSON format."
          },
          { 
            role: "user", 
            content: [
              { 
                type: "text", 
                text: "Can you look at this receipt and fill out the JSON format with store information, date, items, and prices?"
              },
              { 
                type: "image_url", 
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const aiResponseText = response.choices[0].message.content;
      if (!aiResponseText) {
        console.error('Failed to get receipt data from image analysis');
        return NextResponse.json(
          { error: 'Failed to analyze receipt image' },
          { status: 500 }
        );
      }
      
      try {
        parsedReceiptData = JSON.parse(aiResponseText);
        console.log('Successfully extracted receipt data from image');
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        return NextResponse.json(
          { error: 'Failed to parse AI response' },
          { status: 500 }
        );
      }
    } else {
      // Parse the provided receipt data
      parsedReceiptData = JSON.parse(receiptData);
      console.log('Using provided receipt data');
    }
    
    // Generate a unique filename
    const timestamp = Date.now();
    const fileExtension = imageFile.name.split('.').pop();
    const fileName = `${timestamp}.${fileExtension}`;
    
    // Upload the image to Supabase Storage
    const arrayBuffer = await imageFile.arrayBuffer();
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('receipts')  // Changed from 'public' to 'receipts'
      .upload(`receipts/${fileName}`, arrayBuffer, {
        contentType: imageFile.type,
        upsert: true
      });
    
    if (storageError) {
      console.error('Error uploading image to storage:', storageError);
      return NextResponse.json(
        { error: `Failed to upload image: ${storageError.message}` },
        { status: 500 }
      );
    }
    
    // Get the public URL for the uploaded image
    const { data: { publicUrl } } = supabase
      .storage
      .from('receipts')  // Changed from 'public' to 'receipts'
      .getPublicUrl(`receipts/${fileName}`);
    
    // Extract receipt information from the parsed data
    const storeInfo = parsedReceiptData.store_information || {};
    const purchaseDetails = parsedReceiptData.purchase_details || {};
    const financialSummary = parsedReceiptData.financial_summary || {};
    
    // Apply post-processing to standardize items
    if (parsedReceiptData.items && parsedReceiptData.items.length > 0) {
      console.log(`Post-processing ${parsedReceiptData.items.length} items...`);
      parsedReceiptData.items = await standardizeItems(parsedReceiptData.items);
      
      // Find cheaper alternatives if standardization was successful
      if (parsedReceiptData.items && parsedReceiptData.items.length > 0 && storeInfo.name) {
        console.log(`Looking for cheaper alternatives for ${parsedReceiptData.items.length} items from ${storeInfo.name}`);
        
        parsedReceiptData.items = await findCheaperAlternatives(
          parsedReceiptData.items, 
          storeInfo.name
        );
        
        // Track how many items have cheaper alternatives
        const itemsWithCheaperAlternatives = parsedReceiptData.items.filter((item: any) => item.cheaper_alternative).length;
        console.log(`Found cheaper alternatives for ${itemsWithCheaperAlternatives} out of ${parsedReceiptData.items.length} items`);
      }
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
      console.log(`Processing ${parsedReceiptData.items.length} receipt items for insertion`);
      
      const receiptItems = [];
      
      for (const item of parsedReceiptData.items) {
        receiptItems.push({
          receipt_id: receiptRecord.id,
          original_item_name: item.name || '',
          detailed_name: item.detailed_name || item.name || '',
          standardized_item_name: item.standardized_name || '',
          category: item.category || 'Other',
          quantity: item.quantity || 1,
          item_price: parseFloat(item.price) || 0,
          final_price: parseFloat(item.price) || 0,
          regular_price: parseFloat(item.regular_price) || null
        });
      }
      
      // Store patterns for matching
      const allPatterns = [];
      for (const item of parsedReceiptData.items) {
        if (item.standardized_name) {
          // Add basic patterns for all standardized items
          allPatterns.push({
            original_pattern: `%${item.name}%`,
            standardized_name: item.standardized_name,
            category: item.category || 'Other'
          });
          
          // If there are AI-generated patterns, add those too
          if (item.patterns && Array.isArray(item.patterns)) {
            for (const pattern of item.patterns) {
              allPatterns.push({
                original_pattern: pattern,
                standardized_name: item.standardized_name,
                category: item.category || 'Other'
              });
            }
          }
        }
      }
      
      // First try to insert with detailed_name
      const { error: itemsError } = await supabase
        .from('receipt_items')
        .insert(receiptItems);
      
      if (itemsError) {
        console.error('Error inserting receipt items with detailed_name:', itemsError);
        
        // If the error is about the column not existing, try again without detailed_name
        if (itemsError.message && itemsError.message.includes('detailed_name')) {
          console.log('Retrying without detailed_name column');
          
          // Remove the detailed_name field from each item
          const itemsWithoutDetailed = receiptItems.map(item => {
            const { detailed_name, ...rest } = item;
            return rest;
          });
          
          const { error: retryError } = await supabase
            .from('receipt_items')
            .insert(itemsWithoutDetailed);
          
          if (retryError) {
            console.error('Error inserting receipt items without detailed_name:', retryError);
          } else {
            console.log(`Successfully inserted ${itemsWithoutDetailed.length} receipt items (without detailed_name)`);
          }
        }
      } else {
        console.log(`Successfully inserted ${receiptItems.length} receipt items (with detailed_name)`);
      }
      
      // Only insert patterns if we have them and they aren't duplicates
      if (allPatterns.length > 0) {
        console.log(`Attempting to insert ${allPatterns.length} standardization patterns`);
        
        const { error: patternsError } = await supabase
          .from('item_standardization')
          .upsert(allPatterns, { 
            onConflict: 'original_pattern',
            ignoreDuplicates: true
          });
        
        if (patternsError) {
          console.error('Error inserting standardization patterns:', patternsError);
          console.error('First few patterns:', JSON.stringify(allPatterns.slice(0, 3)));
        } else {
          console.log(`Successfully inserted ${allPatterns.length} standardization patterns`);
        }
      }
    }
    
    // Add detailed logs to debug alternatives
    if (parsedReceiptData.items && parsedReceiptData.items.length > 0) {
      const itemsWithAlts = parsedReceiptData.items.filter((item: any) => item.cheaper_alternative).length;
      console.log(`FINAL CHECK: Found ${itemsWithAlts} items with alternatives out of ${parsedReceiptData.items.length}`);
      
      if (itemsWithAlts > 0) {
        parsedReceiptData.items.forEach((item: any) => {
          if (item.cheaper_alternative) {
            console.log(`Item ${item.name} has alternative: ${item.cheaper_alternative.item_name} at ${item.cheaper_alternative.store_name} for $${item.cheaper_alternative.price} (savings: ${item.cheaper_alternative.percentage_savings}%)`);
          }
        });
      }
    }
    
    // Define the type for receipt items 
    type ReceiptItemWithId = {
      receipt_id: string;
      original_item_name: string;
      standardized_item_name?: string;
      item_price?: number | string;
      [key: string]: any;
    };
    
    // Get the inserted receipt items with their IDs
    const { data: receiptItems, error: getItemsError } = await supabase
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', receiptRecord.id);
      
    if (getItemsError) {
      console.error('Error retrieving inserted receipt items:', getItemsError);
    } else {
      console.log(`Retrieved ${receiptItems?.length || 0} receipt items for forming response`);
    }
    
    // IMPORTANT: Verify alternatives are correctly structured in the response
    const itemsWithAlternativesForResponse = (receiptItems || [])
      .filter((item: ReceiptItemWithId) => item.receipt_id && item.standardized_item_name)
      .map((item: ReceiptItemWithId, index: number) => {
        // Find the original item from parsed data
        const originalItem = parsedReceiptData.items && parsedReceiptData.items[index];
        
        // Check if this item has an alternative
        const hasAlternative = originalItem && originalItem.cheaper_alternative;
        
        if (hasAlternative) {
          console.log(`⭐ API RESPONSE: Item ${originalItem.name} WILL INCLUDE alternative: ${originalItem.cheaper_alternative.item_name}`);
        }
        
        return {
          receipt_id: item.receipt_id,
          name: item.original_item_name || '',
          original_item_name: item.original_item_name || '',
          price: parseFloat(item.item_price?.toString() || '0'),
          standardized_name: item.standardized_item_name || '',
          cheaper_alternative: hasAlternative ? {
            store_name: originalItem.cheaper_alternative.store_name || 'Unknown',
            price: typeof originalItem.cheaper_alternative.price === 'string' ?
              parseFloat(originalItem.cheaper_alternative.price) :
              Number(originalItem.cheaper_alternative.price) || 0,
            item_name: originalItem.cheaper_alternative.item_name || '',
            savings: typeof originalItem.cheaper_alternative.savings === 'string' ?
              parseFloat(originalItem.cheaper_alternative.savings) :
              Number(originalItem.cheaper_alternative.savings) || 0,
            percentage_savings: typeof originalItem.cheaper_alternative.percentage_savings === 'string' ?
              parseFloat(originalItem.cheaper_alternative.percentage_savings) :
              Number(originalItem.cheaper_alternative.percentage_savings) || 0
          } : undefined
        };
      });
    
    // Log the final response items with alternatives
    const finalResponseAlternatives = itemsWithAlternativesForResponse.filter(item => item.cheaper_alternative);
    console.log(`🚀 RESPONSE: Sending ${finalResponseAlternatives.length} items with alternatives`);
    finalResponseAlternatives.forEach(item => {
      console.log(`📦 ${item.name} → ${item.cheaper_alternative?.item_name} at $${item.cheaper_alternative?.price} (${item.cheaper_alternative?.percentage_savings}% savings)`);
    });
    
    // Format and send the response
    console.log(`🚀 RESPONSE: Sending ${itemsWithAlternativesForResponse.length} items with alternatives`);
    
    return NextResponse.json({
      success: true,
      receipt_id: receiptRecord.id,
      receipt_url: publicUrl,
      items_count: parsedReceiptData.items?.length || 0,
      items: itemsWithAlternativesForResponse, // Use our explicitly formatted items
      items_with_alternatives: finalResponseAlternatives.length
    });
    
  } catch (error) {
    console.error('Error processing receipt upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process receipt' },
      { status: 500 }
    );
  }
}

// Helper function to create partial match conditions for PostgREST
function createPartialMatchQuery(standardizedName: string): string {
  const words = standardizedName.split(' ').filter(word => word.length > 2);  // ignore small words
  if (words.length <= 1) {
    return `standardized_item_name.eq.${standardizedName}`;  // exact match for single words
  }
  
  // Create conditions that require matching at least 2 words
  return words.map(word => 
    `standardized_item_name.ilike.*${word}*`
  ).join(',');
}

// Function to find cheaper alternatives for items
async function findCheaperAlternatives(items: ReceiptItem[], storeName: string) {
  const itemsWithAlternatives = [];
  let alternativesCount = 0;
  
  console.log(`Searching for cheaper alternatives for ${items.length} items from ${storeName}`);
  
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
      // First approach: Use receipt_items table with partial matching
      const partialMatchQuery = createPartialMatchQuery(standardizedName);
      const { data: alternativesFromReceipts, error: receiptsError } = await supabase
        .from('receipt_items')
        .select(`
          id,
          standardized_item_name,
          detailed_name,
          item_price,
          receipts!inner(
            id,
            store_name
          )
        `)
        .or(partialMatchQuery)
        .lt('item_price', item.price ? parseFloat(item.price.toString()) : 0);

      // Filter out items from the wrong store and sort by price
      const filteredAlternativesFromReceipts = (alternativesFromReceipts as ReceiptAlternative[] | null)
        ?.filter(alt => alt.receipts && alt.receipts.store_name !== storeName)
        .sort((a, b) => parseFloat(a.item_price.toString()) - parseFloat(b.item_price.toString()))
        .slice(0, 5) || [];
      
      if (receiptsError) {
        console.error('Error finding alternatives from receipts:', receiptsError);
      }
      
      console.log(`Found ${filteredAlternativesFromReceipts.length} alternatives from receipts for ${item.name}`);
      
      // Second approach: Try the product_prices table as a fallback with exact matching
      const { data: alternativesFromPrices, error: pricesError } = await supabase
        .from('product_prices')
        .select('store_name, price, standardized_item_name')
        .eq('standardized_item_name', standardizedName)
        .neq('store_name', storeName)
        .lt('price', item.price ? parseFloat(item.price.toString()) : 0)
        .order('price', { ascending: true })
        .limit(5);
      
      // Remove the keyword matching approach since we want exact matches only
      const keywordAlternativesFromPrices: Array<{
        store_name: string;
        price: number;
        standardized_item_name: string;
      }> = [];
      
      if (pricesError) {
        console.error('Error finding alternatives from product_prices:', pricesError);
      }
      
      console.log(`Found ${alternativesFromPrices?.length || 0} direct alternatives from prices for ${item.name}`);
      
      // Prioritize alternatives from receipts, then fall back to product_prices
      const cheaperAlternatives = [];
      
      if (filteredAlternativesFromReceipts.length > 0) {
        // Format alternatives from receipts to match our expected structure
        cheaperAlternatives.push(...filteredAlternativesFromReceipts.map(alt => ({
          store_name: alt.receipts.store_name || 'Unknown',
          price: alt.item_price,
          item_name: alt.detailed_name || alt.standardized_item_name
        })));
      } else if (alternativesFromPrices && alternativesFromPrices.length > 0) {
        // Format alternatives from product_prices
        cheaperAlternatives.push(...alternativesFromPrices.map(alt => ({
          store_name: extractStoreName(alt.store_name),
          price: alt.price,
          item_name: alt.standardized_item_name
        })));
      } else if (keywordAlternativesFromPrices && keywordAlternativesFromPrices.length > 0) {
        // Format keyword-based alternatives
        cheaperAlternatives.push(...keywordAlternativesFromPrices.map(alt => ({
          store_name: extractStoreName(alt.store_name),
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
        
        console.log(`Found cheaper alternative for ${item.name}: ${cheapestAlternative.item_name} at ${cheapestAlternative.store_name} for $${alternativePrice} (savings: ${percentageSavings.toFixed(2)}%)`);
        
        itemsWithAlternatives.push({
          ...item,
          cheaper_alternative: {
            store_name: cheapestAlternative.store_name || "Unknown",
            price: alternativePrice,
            item_name: cheapestAlternative.item_name || "Alternative product",
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
  return itemsWithAlternatives;
}

// Function to standardize items using two-stage AI process
async function standardizeItems(items: ReceiptItem[]) {
  if (!items || items.length === 0) return [];
  
  try {
    const itemNames = items.map(item => item.name).filter(Boolean);
    if (itemNames.length === 0) return items;
    
    console.log(`Standardizing ${itemNames.length} items using AI two-stage process`);
    
    // First Stage: Detailed Item Standardization
    const detailedItems = await generateDetailedItemNames(itemNames);
    if (!detailedItems) {
      console.error('Failed to generate detailed item names');
      return items;
    }
    
    // Second Stage: Generic Standardization
    const standardizedItems = await generateGenericItemNames(detailedItems);
    if (!standardizedItems) {
      console.error('Failed to generate generic standardized names');
      return items;
    }
    
    // Map the standardized information back to the original items
    return items.map(item => {
      const standardized = standardizedItems.find(
        (stdItem: { originalName: string }) => stdItem.originalName.toLowerCase() === (item.name || '').toLowerCase()
      );
      
      if (standardized) {
        return {
          ...item,
          detailed_name: standardized.detailedName,
          standardized_name: standardized.genericName,
          category: standardized.category,
          patterns: standardized.patterns
        };
      }
      
      return item;
    });
    
  } catch (error) {
    console.error('Error in standardizeItems:', error);
    return items;
  }
}

// Define interfaces for our standardization data
interface DetailedItem {
  originalName: string;
  detailedName: string;
  category: string;
}

interface GenericItem extends DetailedItem {
  genericName: string;
  patterns: string[];
}

/**
 * First stage: Generate detailed item names with specific information
 */
async function generateDetailedItemNames(items: string[]): Promise<DetailedItem[] | null> {
  try {
    // Get existing standardized names for reference
    const { data: existingStandards } = await supabase
      .from('item_standardization')
      .select('standardized_name, category')
      .order('created_at', { ascending: false });
    
    const existingCategories = [...new Set(existingStandards?.map(s => s.category) || [])];
    
    // System prompt for detailed stage
    const systemPrompt = `
      You are an expert in grocery item standardization. Your task is to analyze product names from receipts and:
      1. Create a detailed standardized name for each item that clearly identifies what it is
      2. Determine the appropriate product category
      
      Existing categories in the system: ${existingCategories.join(', ') || 'Beverages, Dairy, Produce, Meat, Bakery, Snacks, Frozen, Canned, Dry Goods, Household, Personal Care, Other'}
      
      For each item, provide:
      - originalName: The original name from the receipt
      - detailedName: A descriptive name including brand and relevant details that help identify the product
      - category: The product category
      
      Be especially careful with abbreviations like:
      - OJ = Orange Juice
      - TRPNCA = Tropicana
      - NFC = Not From Concentrate
    `;
    
    // Call OpenAI API with function calling
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Standardize these grocery items: ${items.join(', ')}` }
      ],
      tools: [{
        type: "function",
        function: {
          name: "standardizeDetailedItems",
          description: "Standardize grocery item names with detailed information",
          parameters: {
            type: "object",
            properties: {
              detailedItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    originalName: { 
                      type: "string",
                      description: "The original name from the receipt" 
                    },
                    detailedName: { 
                      type: "string",
                      description: "A descriptive standardized name including brand and details" 
                    },
                    category: { 
                      type: "string",
                      description: "Product category (Beverages, Dairy, Produce, etc.)" 
                    }
                  },
                  required: ["originalName", "detailedName", "category"]
                }
              }
            },
            required: ["detailedItems"]
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "standardizeDetailedItems" } }
    });
    
    const toolCall = response.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      console.error('Failed to get detailed standardization data from AI');
      return null;
    }
    
    const standardizationData = JSON.parse(toolCall.function.arguments);
    return standardizationData.detailedItems;
    
  } catch (error) {
    console.error('Error generating detailed item names:', error);
    return null;
  }
}

/**
 * Second stage: Generate generic standardized item names for price comparison
 */
async function generateGenericItemNames(detailedItems: DetailedItem[]): Promise<GenericItem[] | null> {
  try {
    // System prompt for generic standardization
    const systemPrompt = `
      You are an expert in grocery item standardization. Your task is to create generic, standardized names for grocery items to enable price comparison across different stores.
      
      For each detailed item, you need to:
      1. Create a generic standardized name that removes brand names and unnecessary details
      2. Generate SQL LIKE patterns that would match similar items
      
      Make the item names as generic as possible while keeping them identifiable. Use simple and consistent phrasing. Do not include brand names or unnecessary details.
      
      For example:
      - "Tropicana Pure Premium Orange Juice No Pulp" → "Orange Juice"
      - "Organic Valley 2% Milk" → "Milk"
      - "Heinz Tomato Ketchup" → "Ketchup"
      
      For each item, provide:
      - originalName: The original receipt item name
      - detailedName: The detailed standardized name from the first stage
      - genericName: A simple, generic name for price comparison
      - category: The product category
      - patterns: Array of SQL LIKE patterns that would match similar items (use % as wildcard)
    `;
    
    // Format the detailed items as input
    const detailedItemsText = detailedItems.map(item => 
      `${item.originalName} → ${item.detailedName} (${item.category})`
    ).join('\n');
    
    // Call OpenAI API with function calling
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Create generic standardized names for these detailed items:\n${detailedItemsText}` }
      ],
      tools: [{
        type: "function",
        function: {
          name: "standardizeGenericItems",
          description: "Create generic standardized names for price comparison",
          parameters: {
            type: "object",
            properties: {
              standardizedItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    originalName: { 
                      type: "string",
                      description: "The original name from the receipt" 
                    },
                    detailedName: {
                      type: "string",
                      description: "The detailed standardized name from the first stage"
                    },
                    genericName: { 
                      type: "string",
                      description: "A simple, generic name without brand or unnecessary details" 
                    },
                    category: { 
                      type: "string",
                      description: "Product category (Beverages, Dairy, Produce, etc.)" 
                    },
                    patterns: { 
                      type: "array",
                      items: { type: "string" },
                      description: "SQL LIKE patterns that would match similar items" 
                    }
                  },
                  required: ["originalName", "detailedName", "genericName", "category", "patterns"]
                }
              }
            },
            required: ["standardizedItems"]
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "standardizeGenericItems" } }
    });
    
    const toolCall = response.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      console.error('Failed to get generic standardization data from AI');
      return null;
    }
    
    const standardizationData = JSON.parse(toolCall.function.arguments);
    return standardizationData.standardizedItems;
    
  } catch (error) {
    console.error('Error generating generic item names:', error);
    return null;
  }
}

// Helper function to extract store name
function extractStoreName(name: string): string {
  if (name.includes('365 by Whole Foods')) {
    return 'Whole Foods';
  }
  return name;
} 