import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

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

// Main API handler
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
    
    // If receiptData is not provided, we'll analyze the image with OpenAI
    let parsedReceiptData;
    if (!receiptData) {
      console.log('No receipt data provided, analyzing image with AI...');
      
      // Convert image to base64 for OpenAI
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64Image = buffer.toString('base64');
      const mimeType = imageFile.type;
      
      // Simple initial prompt to extract basic receipt information
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
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
    
    return NextResponse.json({
      success: true,
      receipt_id: receiptRecord.id,
      receipt_url: publicUrl,
      items_count: parsedReceiptData.items?.length || 0,
      items_with_alternatives: parsedReceiptData.items?.filter((item: any) => item.cheaper_alternative).length || 0
    });
    
  } catch (error) {
    console.error('Error processing receipt upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process receipt' },
      { status: 500 }
    );
  }
}

// Function to find cheaper alternatives for items
async function findCheaperAlternatives(items: ReceiptItem[], storeName: string) {
  const itemsWithAlternatives = [];
  
  for (const item of items) {
    // Skip items without a name or price
    if (!item.name || !item.price) continue;
    
    // Get the standardized name (which should be set by the standardizeItems function)
    const standardizedName = item.standardized_name || '';
    
    if (!standardizedName) {
      itemsWithAlternatives.push(item);
      continue;
    }
    
    // Look for the same item at other stores
    const { data: alternatives, error } = await supabase
      .from('product_prices')
      .select('store_name, price, standardized_item_name')
      .ilike('standardized_item_name', standardizedName)
      .neq('store_name', storeName)
      .order('price', { ascending: true })
      .limit(5);
    
    if (error) {
      console.error('Error finding alternatives:', error);
      itemsWithAlternatives.push(item);
      continue;
    }
    
    // Find the cheapest alternative
    const cheaperAlternatives = alternatives?.filter(alt => 
      parseFloat(alt.price) < parseFloat(item.price)
    ) || [];
    
    if (cheaperAlternatives.length > 0) {
      // Get the cheapest alternative
      const cheapestAlternative = cheaperAlternatives[0];
      
      itemsWithAlternatives.push({
        ...item,
        cheaper_alternative: {
          store_name: cheapestAlternative.store_name,
          price: cheapestAlternative.price,
          savings: parseFloat(item.price) - parseFloat(cheapestAlternative.price)
        }
      });
    } else {
      itemsWithAlternatives.push(item);
    }
  }
  
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