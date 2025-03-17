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
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    // Check for API key in request headers for security
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.STANDARDIZATION_API_KEY;
    
    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('Starting item standardization process');
    
    // Get all unique item names that don't have a standardized name yet
    const { data: items, error: itemsError } = await supabase
      .from('receipt_items')
      .select('id, original_item_name')
      .is('standardized_item_name', null)
      .order('created_at', { ascending: false })
      .limit(100); // Process in batches to avoid timeouts
    
    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: 500 }
      );
    }
    
    if (!items || items.length === 0) {
      return NextResponse.json({
        message: 'No items to standardize',
        standardized: 0
      });
    }
    
    console.log(`Found ${items.length} items to standardize`);
    
    // Group items in batches of 20 to reduce API calls
    const batchSize = 20;
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    let standardizedCount = 0;
    
    // Process each batch
    for (const batch of batches) {
      const itemNames = batch.map(item => item.original_item_name);
      
      // Use GPT to standardize the item names
      const standardizedNames = await standardizeItemNames(itemNames);
      
      // Update the database with standardized names
      for (let i = 0; i < batch.length; i++) {
        if (standardizedNames[i]) {
          const { error: updateError } = await supabase
            .from('receipt_items')
            .update({ standardized_item_name: standardizedNames[i] })
            .eq('id', batch[i].id);
          
          if (updateError) {
            console.error(`Error updating item ${batch[i].id}:`, updateError);
          } else {
            standardizedCount++;
          }
          
          // Check if we need to add this to the item_standardization table
          await addToStandardizationTable(batch[i].original_item_name, standardizedNames[i]);
        }
      }
    }
    
    return NextResponse.json({
      message: 'Item standardization completed',
      processed: items.length,
      standardized: standardizedCount
    });
    
  } catch (error) {
    console.error('Error in standardization process:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error in standardization process' },
      { status: 500 }
    );
  }
}

// Function to standardize item names using GPT
async function standardizeItemNames(itemNames: string[]): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a product name standardization assistant. Your task is to convert receipt item names into standardized product names.
          
Guidelines:
1. Remove store-specific codes or identifiers
2. Use common, generic product names
3. Keep brand names when relevant
4. Use consistent formatting (lowercase, no special characters)
5. Group similar items (e.g., different flavors of the same product)
6. Be concise but descriptive
7. Return ONLY the standardized name, nothing else

Examples:
- "BNLS CHKN BRST" → "boneless chicken breast"
- "ORG BABY SPINACH" → "organic baby spinach"
- "COCA-COLA 12PK" → "coca cola soda 12 pack"
- "LAYS CHIP REG" → "lays potato chips regular"
- "MILK 2% GAL" → "milk 2 percent gallon"`
        },
        {
          role: "user",
          content: `Standardize the following receipt item names. Return a JSON array with ONLY the standardized names in the same order as the input:
${JSON.stringify(itemNames)}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    
    const content = response.choices[0].message.content;
    if (!content) {
      console.error('No content in GPT response');
      return [];
    }
    
    try {
      const parsedResponse = JSON.parse(content);
      if (Array.isArray(parsedResponse.standardized_names)) {
        return parsedResponse.standardized_names;
      } else {
        console.error('Unexpected response format:', parsedResponse);
        return [];
      }
    } catch (parseError) {
      console.error('Error parsing GPT response:', parseError);
      console.error('Raw response:', content);
      return [];
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return [];
  }
}

// Function to add standardization mapping to the item_standardization table
async function addToStandardizationTable(originalName: string, standardizedName: string) {
  try {
    // Check if this mapping already exists
    const { data: existing, error: checkError } = await supabase
      .from('item_standardization')
      .select('id')
      .eq('original_pattern', originalName.toLowerCase())
      .limit(1);
    
    if (checkError) {
      console.error('Error checking for existing standardization:', checkError);
      return;
    }
    
    // If mapping doesn't exist, add it
    if (!existing || existing.length === 0) {
      const { error: insertError } = await supabase
        .from('item_standardization')
        .insert({
          original_pattern: originalName.toLowerCase(),
          standardized_name: standardizedName,
          category: determineCategory(standardizedName)
        });
      
      if (insertError) {
        console.error('Error inserting standardization mapping:', insertError);
      }
    }
  } catch (error) {
    console.error('Error in addToStandardizationTable:', error);
  }
}

// Function to determine category based on standardized name
function determineCategory(standardizedName: string): string {
  const name = standardizedName.toLowerCase();
  
  // Define category patterns
  const categories: Record<string, string[]> = {
    'Produce': ['fruit', 'vegetable', 'apple', 'banana', 'orange', 'lettuce', 'tomato', 'onion', 'potato', 'carrot', 'broccoli', 'spinach'],
    'Meat': ['beef', 'chicken', 'pork', 'turkey', 'lamb', 'steak', 'ground', 'sausage', 'bacon', 'ham'],
    'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'sour cream', 'ice cream'],
    'Bakery': ['bread', 'bagel', 'muffin', 'cake', 'cookie', 'pastry', 'roll', 'bun'],
    'Beverages': ['water', 'soda', 'juice', 'coffee', 'tea', 'beer', 'wine', 'drink', 'cola', 'sprite', 'pepsi', 'coke'],
    'Snacks': ['chip', 'crisp', 'pretzel', 'popcorn', 'nut', 'cracker', 'candy', 'chocolate', 'snack'],
    'Canned Goods': ['can', 'soup', 'beans', 'tuna', 'corn', 'tomato sauce'],
    'Frozen Foods': ['frozen', 'pizza', 'ice cream', 'freezer'],
    'Household': ['paper', 'towel', 'tissue', 'toilet', 'cleaner', 'detergent', 'soap', 'shampoo', 'toothpaste'],
    'Personal Care': ['shampoo', 'soap', 'toothpaste', 'deodorant', 'lotion', 'razor', 'tissue']
  };
  
  // Check each category
  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        return category;
      }
    }
  }
  
  // Default category
  return 'Other';
}

// For scheduled execution (e.g., via cron job)
export async function GET(request: Request) {
  // Same security check as POST
  const authHeader = request.headers.get('authorization');
  const apiKey = process.env.STANDARDIZATION_API_KEY;
  
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // Reuse the POST handler logic
  return POST(request);
} 