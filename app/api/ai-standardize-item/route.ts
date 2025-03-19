import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface ReceiptItem {
  name: string;
  [key: string]: unknown;
}

interface DetailedItem {
  originalName: string;
  detailedName: string;
  category: string;
  [key: string]: unknown;
}

export async function POST(request: Request) {
  try {
    const { receipt_id, itemNames } = await request.json();
    
    let items: string[] = [];
    
    // If receipt_id is provided, fetch items from that receipt
    if (receipt_id) {
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .select('raw_receipt_json')
        .eq('id', receipt_id)
        .single();
      
      if (receiptError || !receipt) {
        return NextResponse.json(
          { error: 'Receipt not found' },
          { status: 404 }
        );
      }
      
      items = receipt.raw_receipt_json.items.map((item: ReceiptItem) => item.name);
    } 
    // Otherwise use provided item names
    else if (itemNames && Array.isArray(itemNames)) {
      items = itemNames;
    } else {
      return NextResponse.json(
        { error: 'Either receipt_id or itemNames array must be provided' },
        { status: 400 }
      );
    }
    
    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No items found to standardize' },
        { status: 400 }
      );
    }
    
    console.log(`Standardizing ${items.length} items using AI`);
    
    // First Stage: Detailed Item Standardization
    const detailedItems = await generateDetailedItemNames(items);
    if (!detailedItems) {
      return NextResponse.json(
        { error: 'Failed to generate detailed item names' },
        { status: 500 }
      );
    }
    
    // Second Stage: Generic Standardization
    const standardizedItems = await generateGenericItemNames(detailedItems);
    if (!standardizedItems) {
      return NextResponse.json(
        { error: 'Failed to generate generic standardized names' },
        { status: 500 }
      );
    }
    
    console.log(`Generated standardizations for ${standardizedItems.length} items`);
    
    // Prepare for database insertion
    const patternsToInsert = [];
    
    for (const item of standardizedItems) {
      for (const pattern of item.patterns) {
        patternsToInsert.push({
          original_pattern: pattern,
          standardized_name: item.genericName,
          category: item.category
        });
      }
    }
    
    let insertionResult = null;
    
    // Only actually insert if we have items and this isn't just a preview
    if (patternsToInsert.length > 0 && request.headers.get('x-insert-patterns') === 'true') {
      const { data, error } = await supabase
        .from('item_standardization')
        .insert(patternsToInsert)
        .select();
        
      if (error) {
        console.error('Error inserting standardization patterns:', error);
        return NextResponse.json(
          { 
            error: 'Failed to insert standardization patterns',
            details: error.message,
            preview: standardizedItems
          },
          { status: 500 }
        );
      }
      
      insertionResult = data;
    }
    
    return NextResponse.json({
      success: true,
      items_standardized: standardizedItems.length,
      patterns_generated: patternsToInsert.length,
      patterns_inserted: insertionResult ? insertionResult.length : 0,
      standardized_items: standardizedItems.map(item => ({
        originalName: item.originalName,
        detailedName: item.detailedName, // For user display
        genericName: item.genericName,   // For price comparison
        category: item.category,
        patterns: item.patterns
      })),
      insertion_mode: request.headers.get('x-insert-patterns') === 'true' ? 'inserted' : 'preview'
    });
    
  } catch (error) {
    console.error('Error in AI standardization:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error in AI standardization' },
      { status: 500 }
    );
  }
}

/**
 * First stage: Generate detailed item names with specific information
 */
async function generateDetailedItemNames(items: string[]) {
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
async function generateGenericItemNames(detailedItems: DetailedItem[]) {
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
      - genericName: A simple, generic name without brand or unnecessary details
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