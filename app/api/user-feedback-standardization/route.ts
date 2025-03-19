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

export async function POST(request: Request) {
  try {
    const { 
      original_item_name, 
      current_standardized_name,
      suggested_standardized_name,
      user_id,
      feedback_type  // "correction", "suggestion", "approval"
    } = await request.json();
    
    // Basic validation
    if (!original_item_name) {
      return NextResponse.json(
        { error: 'Original item name is required' },
        { status: 400 }
      );
    }
    
    if (!feedback_type || !['correction', 'suggestion', 'approval'].includes(feedback_type)) {
      return NextResponse.json(
        { error: 'Valid feedback type is required (correction, suggestion, or approval)' },
        { status: 400 }
      );
    }
    
    // Check existing standardization for this item
    const lowerOriginalName = original_item_name.toLowerCase();
    
    const { data: existingPatterns, error: patternError } = await supabase
      .from('item_standardization')
      .select('*')
      .or(`original_pattern.eq.${lowerOriginalName},original_pattern.like.%${lowerOriginalName}%`)
      .order('created_at', { ascending: false });
      
    if (patternError) {
      console.error('Error checking existing patterns:', patternError);
      return NextResponse.json(
        { error: 'Failed to check existing patterns' },
        { status: 500 }
      );
    }
    
    let actionTaken = 'none';
    let newPatterns = [];
    let aiSuggestion = null;
    
    // Case 1: User is approving an existing standardization
    if (feedback_type === 'approval' && current_standardized_name) {
      // No action needed except to record the feedback
      actionTaken = 'approved_existing';
    }
    
    // Case 2: User is suggesting a correction to an existing standardization
    else if (feedback_type === 'correction' && current_standardized_name && suggested_standardized_name) {
      // Use GPT to validate the suggestion
      const validationResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "You are an expert in product standardization. Validate if a user's suggested standardized name is appropriate for a product." 
          },
          { 
            role: "user", 
            content: `Original name: "${original_item_name}"\nCurrent standardized name: "${current_standardized_name}"\nUser suggested name: "${suggested_standardized_name}"\n\nIs the user's suggestion appropriate? Answer only YES or NO and then provide a brief explanation.` 
          }
        ]
      });
      
      const validationText = validationResponse.choices[0].message.content || '';
      const isApproved = validationText.trim().toUpperCase().startsWith('YES');
      
      if (isApproved) {
        // Create new pattern with the suggested name
        const { data: newPattern, error: insertError } = await supabase
          .from('item_standardization')
          .insert({
            original_pattern: lowerOriginalName,
            standardized_name: suggested_standardized_name,
            category: existingPatterns?.[0]?.category || 'Other'
          })
          .select();
          
        if (insertError) {
          console.error('Error inserting new pattern:', insertError);
          return NextResponse.json(
            { error: 'Failed to update standardization' },
            { status: 500 }
          );
        }
        
        newPatterns = newPattern;
        actionTaken = 'updated_standardization';
      } else {
        actionTaken = 'suggestion_rejected';
      }
      
      aiSuggestion = {
        validation: validationText,
        approved: isApproved
      };
    }
    
    // Case 3: User is making a new suggestion for an item without standardization
    else if (feedback_type === 'suggestion' && suggested_standardized_name) {
      // Use GPT to enhance the suggestion
      const enhancementResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "You are an expert in grocery product standardization. Analyze an item name and a user's suggested standardized name to create appropriate standardization patterns." 
          },
          { 
            role: "user", 
            content: `Original item name: "${original_item_name}"\nUser's suggested standardized name: "${suggested_standardized_name}"\n\nDetermine the best product category and create SQL LIKE patterns to match similar items. Also suggest any improvements to the standardized name if needed.` 
          }
        ],
        functions: [{
          name: "createStandardization",
          parameters: {
            type: "object",
            properties: {
              standardized_name: { type: "string" },
              category: { type: "string" },
              patterns: { 
                type: "array", 
                items: { type: "string" }
              },
              explanation: { type: "string" }
            },
            required: ["standardized_name", "category", "patterns"]
          }
        }],
        function_call: { name: "createStandardization" }
      });
      
      let standardizationData;
      if (enhancementResponse.choices[0].message.function_call) {
        standardizationData = JSON.parse(
          enhancementResponse.choices[0].message.function_call.arguments
        );
      } else {
        // Fallback if function calling fails
        standardizationData = {
          standardized_name: suggested_standardized_name,
          category: 'Other',
          patterns: [lowerOriginalName]
        };
      }
      
      // Insert the new patterns
      const patternsToInsert = standardizationData.patterns.map((pattern: string) => ({
        original_pattern: pattern,
        standardized_name: standardizationData.standardized_name,
        category: standardizationData.category
      }));
      
      const { data: insertedPatterns, error: insertError } = await supabase
        .from('item_standardization')
        .insert(patternsToInsert)
        .select();
        
      if (insertError) {
        console.error('Error inserting standardization patterns:', insertError);
        return NextResponse.json(
          { error: 'Failed to create standardization patterns' },
          { status: 500 }
        );
      }
      
      newPatterns = insertedPatterns;
      actionTaken = 'created_new_standardization';
      aiSuggestion = standardizationData;
    }
    
    // Record the user feedback for future analysis
    const { error: feedbackError } = await supabase
      .from('user_standardization_feedback')
      .insert({
        user_id: user_id || null,
        original_item_name,
        current_standardized_name: current_standardized_name || null,
        suggested_standardized_name: suggested_standardized_name || null,
        feedback_type,
        action_taken: actionTaken,
        ai_suggestion: aiSuggestion
      });
      
    if (feedbackError) {
      console.error('Error recording feedback:', feedbackError);
      // Continue anyway as this is just for tracking
    }
    
    return NextResponse.json({
      success: true,
      action_taken: actionTaken,
      new_patterns: newPatterns,
      ai_suggestion: aiSuggestion
    });
    
  } catch (error) {
    console.error('Error processing standardization feedback:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error processing feedback' },
      { status: 500 }
    );
  }
} 