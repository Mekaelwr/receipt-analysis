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

// This API requires admin privileges to run
export async function POST(request: Request) {
  try {
    const { admin_key } = await request.json();
    
    // Simple security check - in a real app you'd use proper authentication
    if (admin_key !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }
    
    // Step 1: Gather training data from our database
    console.log("Step 1: Gathering training data");
    
    // Get all standardized items
    const { data: standardizedItems, error: standardizedError } = await supabase
      .from('item_standardization')
      .select('original_pattern, standardized_name, category');
      
    if (standardizedError) {
      console.error('Error fetching standardized items:', standardizedError);
      return NextResponse.json(
        { error: 'Failed to fetch standardized items' },
        { status: 500 }
      );
    }
    
    // Get all receipt items for additional training examples
    const { data: receiptItems, error: receiptItemsError } = await supabase
      .from('receipt_items')
      .select('original_item_name, standardized_item_name, category')
      .not('standardized_item_name', 'is', null)
      .limit(1000);
      
    if (receiptItemsError) {
      console.error('Error fetching receipt items:', receiptItemsError);
      return NextResponse.json(
        { error: 'Failed to fetch receipt items' },
        { status: 500 }
      );
    }
    
    // Get user feedback for additional training examples
    const { data: userFeedback, error: feedbackError } = await supabase
      .from('user_standardization_feedback')
      .select('*')
      .eq('action_taken', 'updated_standardization')
      .or('action_taken.eq.created_new_standardization,action_taken.eq.approved_existing');
      
    if (feedbackError) {
      console.error('Error fetching user feedback:', feedbackError);
      return NextResponse.json(
        { error: 'Failed to fetch user feedback' },
        { status: 500 }
      );
    }
    
    console.log(`Retrieved ${standardizedItems.length} standardized patterns, ${receiptItems.length} receipt items, and ${userFeedback?.length || 0} user feedback entries`);
    
    // Step 2: Format data for fine-tuning
    console.log("Step 2: Formatting data for fine-tuning");
    
    const trainingExamples = [];
    
    // Add examples from standardized items
    for (const item of standardizedItems) {
      // Remove wildcards for training examples
      const cleanedPattern = item.original_pattern.replace(/%/g, '');
      
      trainingExamples.push({
        messages: [
          {
            role: "system",
            content: "You are a product standardization assistant. Your job is to convert raw item names from receipts into standardized names and categories."
          },
          {
            role: "user",
            content: `Standardize this item name: "${cleanedPattern}"`
          },
          {
            role: "assistant",
            content: JSON.stringify({
              standardized_name: item.standardized_name,
              category: item.category
            })
          }
        ]
      });
    }
    
    // Add examples from receipt items
    for (const item of receiptItems) {
      if (item.original_item_name && item.standardized_item_name) {
        trainingExamples.push({
          messages: [
            {
              role: "system",
              content: "You are a product standardization assistant. Your job is to convert raw item names from receipts into standardized names and categories."
            },
            {
              role: "user",
              content: `Standardize this item name: "${item.original_item_name}"`
            },
            {
              role: "assistant",
              content: JSON.stringify({
                standardized_name: item.standardized_item_name,
                category: item.category || "Other"
              })
            }
          ]
        });
      }
    }
    
    // Add examples from user feedback
    for (const feedback of userFeedback || []) {
      if (feedback.original_item_name && feedback.suggested_standardized_name) {
        trainingExamples.push({
          messages: [
            {
              role: "system",
              content: "You are a product standardization assistant. Your job is to convert raw item names from receipts into standardized names and categories."
            },
            {
              role: "user",
              content: `Standardize this item name: "${feedback.original_item_name}"`
            },
            {
              role: "assistant",
              content: JSON.stringify({
                standardized_name: feedback.suggested_standardized_name,
                category: "Other" // We may not have category info from feedback
              })
            }
          ]
        });
      }
    }
    
    console.log(`Created ${trainingExamples.length} training examples`);
    
    // Make sure we have enough examples
    if (trainingExamples.length < 10) {
      return NextResponse.json(
        { error: 'Not enough training examples. Need at least 10.' },
        { status: 400 }
      );
    }
    
    // In Edge Runtime we can't use the file system, so we'll store the formatted data in Supabase
    // Store the training data in Supabase
    const { error: trainingDataError } = await supabase
      .from('training_data_storage')
      .insert({
        data: trainingExamples,
        data_type: 'standardization_training',
        created_at: new Date().toISOString()
      });
      
    if (trainingDataError) {
      console.error('Error storing training data:', trainingDataError);
      return NextResponse.json(
        { error: 'Failed to store training data' },
        { status: 500 }
      );
    }
    
    // Instead of using local files, we need to handle the case differently in Edge Runtime
    return NextResponse.json({
      success: true,
      training_examples: trainingExamples.length,
      message: "Training data prepared and stored. Due to Edge Runtime constraints, the actual model creation needs to be done via a separate backend service or scheduled job.",
      next_steps: "The training data has been stored in the 'training_data_storage' table. Use a separate Node.js service or scheduled job to create the OpenAI fine-tuning job using this data."
    });
    
  } catch (error) {
    console.error('Error preparing training data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error preparing training data' },
      { status: 500 }
    );
  }
}

// API to check the status of fine-tuning jobs
export async function GET() {
  try {
    // Get all jobs from our database
    const { data: jobs, error: jobsError } = await supabase
      .from('ai_model_training_jobs')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      );
    }
    
    // In Edge Runtime, we can check the status of jobs but can't perform file operations
    return NextResponse.json({
      success: true,
      jobs: jobs || [],
      message: "In Edge Runtime, detailed job status updates need to be performed by a separate service."
    });
    
  } catch (error) {
    console.error('Error checking fine-tuning jobs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error checking fine-tuning jobs' },
      { status: 500 }
    );
  }
} 