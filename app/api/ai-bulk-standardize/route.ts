import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'edge';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Type for item frequency analysis
interface ItemFrequency {
  name: string;
  count: number;
  stores: string[];
}

interface ReceiptItem {
  name: string;
  [key: string]: unknown;
}

export async function GET() {
  try {
    // Step 1: Extract all unique item names from receipts
    console.log("Starting bulk standardization process");
    console.log("Step 1: Extracting unique item names from receipts");
    
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, store_name, raw_receipt_json');
    
    if (receiptsError) {
      console.error('Error fetching receipts:', receiptsError);
      return NextResponse.json(
        { error: 'Failed to fetch receipts' },
        { status: 500 }
      );
    }
    
    // Analyze item frequency across different stores
    const itemFrequencyMap = new Map<string, ItemFrequency>();
    
    // Process each receipt
    receipts.forEach(receipt => {
      const storeName = receipt.store_name;
      const items = receipt.raw_receipt_json.items || [];
      
      items.forEach((item: ReceiptItem) => {
        const itemName = item.name;
        if (!itemName) return;
        
        // Update frequency map
        if (itemFrequencyMap.has(itemName)) {
          const existing = itemFrequencyMap.get(itemName)!;
          existing.count += 1;
          if (!existing.stores.includes(storeName)) {
            existing.stores.push(storeName);
          }
        } else {
          itemFrequencyMap.set(itemName, {
            name: itemName,
            count: 1,
            stores: [storeName]
          });
        }
      });
    });
    
    // Convert to array and sort by frequency
    const itemsByFrequency = Array.from(itemFrequencyMap.values())
      .sort((a, b) => b.count - a.count);
    
    console.log(`Found ${itemsByFrequency.length} unique item names across all receipts`);
    
    // Get items that appear in multiple stores (these are good candidates for standardization)
    const crossStoreItems = itemsByFrequency
      .filter(item => item.stores.length > 1)
      .slice(0, 100); // Take top 100 to avoid overwhelming the AI
    
    // Get items that only appear in specific stores
    const singleStoreItems = itemsByFrequency
      .filter(item => item.stores.length === 1)
      .slice(0, 100); // Take top 100 to avoid overwhelming the AI
    
    // Combine the lists, prioritizing cross-store items
    const itemsToAnalyze = [...crossStoreItems, ...singleStoreItems].slice(0, 100);
    
    console.log(`Selected ${itemsToAnalyze.length} items for AI standardization`);
    
    // Step 2: Group similar items using AI
    console.log("Step 2: Grouping similar items using AI");
    
    // Get existing standardized names for reference
    const { data: existingStandards } = await supabase
      .from('item_standardization')
      .select('standardized_name, category')
      .order('created_at', { ascending: false });
    
    const existingStandardNames = [...new Set(existingStandards?.map(s => s.standardized_name) || [])];
    const existingCategories = [...new Set(existingStandards?.map(s => s.category) || [])];
    
    // Format the prompt for the AI
    const systemPrompt = `
      You are an expert in grocery item standardization. Your task is to analyze product names from receipts 
      and group similar items together to create standardized names.
      
      For each group of similar items:
      1. Create a standardized name that would be consistent across different stores
      2. Determine the appropriate product category
      3. Generate SQL LIKE patterns that would match similar items
      
      Some items will be completely unique and should have their own standardized name.
      Others might be the same product with different naming conventions across stores.
      
      Existing standardized names in the system: ${existingStandardNames.join(', ')}
      Existing categories in the system: ${existingCategories.join(', ')}
      
      Pay special attention to:
      - Store-specific abbreviations (e.g., TRPNCA = Tropicana)
      - Common product abbreviations (e.g., OJ = Orange Juice)
      - Size/weight specifications that don't affect the product identity
      
      The following items appear across different stores:
      ${crossStoreItems.map(item => `"${item.name}" (seen ${item.count} times across ${item.stores.length} stores: ${item.stores.join(', ')})`).join('\n')}
      
      The following items appear only in specific stores:
      ${singleStoreItems.map(item => `"${item.name}" (seen ${item.count} times, only at ${item.stores[0]})`).join('\n')}
    `;
    
    // Call OpenAI API with function calling
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Group these items into standardized categories and generate matching patterns." }
      ],
      tools: [{
        type: "function",
        function: {
          name: "standardizeItemGroups",
          description: "Group similar items and provide standardized names",
          parameters: {
            type: "object",
            properties: {
              itemGroups: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    standardizedName: { 
                      type: "string",
                      description: "The standardized name for this group of items" 
                    },
                    category: { 
                      type: "string",
                      description: "Product category (Beverages, Dairy, Produce, etc.)" 
                    },
                    originalItems: { 
                      type: "array",
                      items: { type: "string" },
                      description: "List of original item names that belong to this group" 
                    },
                    patterns: { 
                      type: "array",
                      items: { type: "string" },
                      description: "SQL LIKE patterns that would match similar items" 
                    },
                    explanation: {
                      type: "string",
                      description: "Brief explanation of why these items were grouped together"
                    }
                  },
                  required: ["standardizedName", "category", "originalItems", "patterns"]
                }
              }
            },
            required: ["itemGroups"]
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "standardizeItemGroups" } }
    });
    
    const toolCall = response.choices[0].message.tool_calls?.[0];
    
    if (!toolCall) {
      return NextResponse.json(
        { error: 'Failed to get standardization data from AI' },
        { status: 500 }
      );
    }
    
    const standardizationData = JSON.parse(toolCall.function.arguments);
    const { itemGroups } = standardizationData;
    
    console.log(`AI grouped items into ${itemGroups.length} standardized categories`);
    
    // Step 3: Generate standardization entries
    console.log("Step 3: Generating standardization entries");
    
    const patternsToInsert = [];
    
    for (const group of itemGroups) {
      for (const pattern of group.patterns) {
        patternsToInsert.push({
          original_pattern: pattern,
          standardized_name: group.standardizedName,
          category: group.category
        });
      }
    }
    
    console.log(`Generated ${patternsToInsert.length} standardization patterns`);
    
    // Return the results as preview (without inserting)
    return NextResponse.json({
      success: true,
      total_items_analyzed: itemsToAnalyze.length,
      groups_created: itemGroups.length,
      patterns_generated: patternsToInsert.length,
      item_groups: itemGroups,
      insertion_required: false,
      message: "This is a preview of standardization. Use POST method with the same endpoint to insert patterns."
    });
    
  } catch (error) {
    console.error('Error in bulk AI standardization:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error in bulk AI standardization' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Run the same analysis as GET, but actually insert at the end
    // First, perform the analysis
    const analysisResponse = await GET();
    const analysisData = await analysisResponse.json();
    
    if (!analysisData.success) {
      return NextResponse.json(
        { error: 'Analysis step failed', details: analysisData.error },
        { status: 500 }
      );
    }
    
    // Prepare patterns for insertion
    const patternsToInsert = [];
    
    for (const group of analysisData.item_groups) {
      for (const pattern of group.patterns) {
        patternsToInsert.push({
          original_pattern: pattern,
          standardized_name: group.standardizedName,
          category: group.category
        });
      }
    }
    
    // Insert the patterns into the database
    const { data: insertedPatterns, error: insertError } = await supabase
      .from('item_standardization')
      .insert(patternsToInsert)
      .select();
    
    if (insertError) {
      console.error('Error inserting standardization patterns:', insertError);
      return NextResponse.json(
        { 
          error: 'Failed to insert standardization patterns',
          details: insertError.message,
          preview: analysisData.item_groups
        },
        { status: 500 }
      );
    }
    
    console.log(`Successfully inserted ${insertedPatterns.length} standardization patterns`);
    
    return NextResponse.json({
      success: true,
      total_items_analyzed: analysisData.total_items_analyzed,
      groups_created: analysisData.groups_created,
      patterns_generated: patternsToInsert.length,
      patterns_inserted: insertedPatterns.length,
      item_groups: analysisData.item_groups
    });
    
  } catch (error) {
    console.error('Error in bulk AI standardization with insertion:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error in bulk AI standardization with insertion' },
      { status: 500 }
    );
  }
} 