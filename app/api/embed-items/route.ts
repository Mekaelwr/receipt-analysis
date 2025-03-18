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

export async function POST(request: Request) {
  try {
    const { receipt_id, item_name } = await request.json();
    
    // Validate inputs
    if (!receipt_id && !item_name) {
      return NextResponse.json(
        { error: 'Either receipt_id or item_name is required' },
        { status: 400 }
      );
    }
    
    let itemNames: string[] = [];
    
    // If receipt_id is provided, get all items from that receipt
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
      
      itemNames = receipt.raw_receipt_json.items
        .map((item: any) => item.name)
        .filter(Boolean);
        
      if (itemNames.length === 0) {
        return NextResponse.json(
          { error: 'No valid items found in receipt' },
          { status: 400 }
        );
      }
    } 
    // If item_name is provided, just use that single item
    else if (item_name) {
      itemNames = [item_name];
    }
    
    console.log(`Generating embeddings for ${itemNames.length} items`);
    
    // Generate embeddings for each item name
    const embeddings = await Promise.all(
      itemNames.map(async (name) => {
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: name,
          encoding_format: "float"
        });
        
        return {
          original_name: name,
          embedding: response.data[0].embedding
        };
      })
    );
    
    console.log(`Generated ${embeddings.length} embeddings`);
    
    // Get all standardized item names from the database
    const { data: standardItems, error: standardError } = await supabase
      .from('item_standardization')
      .select('standardized_name, category')
      .order('created_at', { ascending: false });
      
    if (standardError) {
      console.error('Error fetching standardized items:', standardError);
      return NextResponse.json(
        { error: 'Failed to fetch standardized items' },
        { status: 500 }
      );
    }
    
    // Get unique standardized names
    const uniqueStandardNames = Array.from(
      new Set(standardItems?.map(i => i.standardized_name) || [])
    );
    
    console.log(`Comparing embeddings against ${uniqueStandardNames.length} standardized names`);
    
    // Generate embeddings for all standardized names
    const standardEmbeddings = await Promise.all(
      uniqueStandardNames.map(async (name) => {
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: name,
          encoding_format: "float"
        });
        
        const category = standardItems?.find(i => i.standardized_name === name)?.category || 'Unknown';
        
        return {
          standard_name: name,
          category,
          embedding: response.data[0].embedding
        };
      })
    );
    
    // Calculate similarity between each item and standardized names
    const matchResults = [];
    
    for (const itemEmbed of embeddings) {
      const itemResults = [];
      
      for (const standardEmbed of standardEmbeddings) {
        // Calculate cosine similarity
        const similarity = calculateCosineSimilarity(
          itemEmbed.embedding,
          standardEmbed.embedding
        );
        
        itemResults.push({
          standard_name: standardEmbed.standard_name,
          category: standardEmbed.category,
          similarity_score: similarity
        });
      }
      
      // Sort by similarity (highest first)
      itemResults.sort((a, b) => b.similarity_score - a.similarity_score);
      
      // Take top 5 matches
      const topMatches = itemResults.slice(0, 5);
      
      matchResults.push({
        original_name: itemEmbed.original_name,
        matches: topMatches,
        best_match: topMatches[0]
      });
    }
    
    // Decide if we should automatically update the standardization table
    const suggestedPatterns = [];
    
    for (const result of matchResults) {
      // Only suggest patterns for high-confidence matches
      if (result.best_match.similarity_score > 0.85) {
        const originalName = result.original_name.toLowerCase();
        const standardName = result.best_match.standard_name;
        const category = result.best_match.category;
        
        // Create patterns based on the original name
        // 1. Exact match
        const exactPattern = originalName;
        
        // 2. Substring match (with wildcards)
        const words = originalName.split(/\s+/);
        const mainWords = words.filter(word => word.length > 2);
        const substringPatterns = mainWords.map(word => `%${word}%`);
        
        suggestedPatterns.push({
          original_name: originalName,
          standardized_name: standardName,
          category,
          patterns: [exactPattern, ...substringPatterns],
          confidence: result.best_match.similarity_score
        });
      }
    }
    
    // Format the response
    return NextResponse.json({
      success: true,
      items_processed: itemNames.length,
      match_results: matchResults,
      suggested_patterns: suggestedPatterns,
      update_required: suggestedPatterns.length > 0
    });
    
  } catch (error) {
    console.error('Error in embedding-based item matching:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error in embedding-based matching' },
      { status: 500 }
    );
  }
}

// Utility function to calculate cosine similarity between two vectors
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }
  
  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);
  
  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }
  
  return dotProduct / (mag1 * mag2);
}

// Optional: Add an endpoint to update standardization based on embeddings
export async function PUT(request: Request) {
  try {
    const { patterns } = await request.json();
    
    if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
      return NextResponse.json(
        { error: 'Valid patterns array is required' },
        { status: 400 }
      );
    }
    
    const patternsToInsert = [];
    
    for (const patternGroup of patterns) {
      for (const pattern of patternGroup.patterns) {
        patternsToInsert.push({
          original_pattern: pattern,
          standardized_name: patternGroup.standardized_name,
          category: patternGroup.category
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
        { error: 'Failed to insert standardization patterns' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      patterns_inserted: insertedPatterns.length
    });
    
  } catch (error) {
    console.error('Error updating standardization patterns:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error updating patterns' },
      { status: 500 }
    );
  }
} 