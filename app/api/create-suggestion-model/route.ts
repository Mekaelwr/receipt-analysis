import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

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
    
    // Step 3: Save to a JSONL file
    console.log("Step 3: Saving to JSONL file");
    
    const tempDir = path.join(process.cwd(), 'tmp');
    
    // Ensure the directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, 'standardization_training.jsonl');
    const fileContent = trainingExamples.map(example => JSON.stringify(example)).join('\n');
    
    fs.writeFileSync(filePath, fileContent);
    
    console.log(`Saved training file to ${filePath}`);
    
    // Step 4: Upload to OpenAI
    console.log("Step 4: Uploading training file to OpenAI");
    
    const file = await openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: "fine-tune"
    });
    
    console.log(`Uploaded file with ID: ${file.id}`);
    
    // Step 5: Create a fine-tuning job
    console.log("Step 5: Creating fine-tuning job");
    
    const fineTuningJob = await openai.fineTuning.jobs.create({
      training_file: file.id,
      model: "gpt-3.5-turbo",
      suffix: "standardization-assistant"
    });
    
    console.log(`Created fine-tuning job with ID: ${fineTuningJob.id}`);
    
    // Store the job information in our database for tracking
    const { error: jobTrackingError } = await supabase
      .from('ai_model_training_jobs')
      .insert({
        job_id: fineTuningJob.id,
        file_id: file.id,
        status: fineTuningJob.status,
        model_name: fineTuningJob.fine_tuned_model || null,
        training_examples_count: trainingExamples.length,
        created_at: new Date().toISOString()
      });
      
    if (jobTrackingError) {
      console.error('Error tracking job:', jobTrackingError);
      // Continue anyway as this is just for tracking
    }
    
    // Clean up the temp file
    fs.unlinkSync(filePath);
    
    return NextResponse.json({
      success: true,
      job_id: fineTuningJob.id,
      status: fineTuningJob.status,
      training_examples: trainingExamples.length,
      message: "Fine-tuning job created successfully. It may take several hours to complete."
    });
    
  } catch (error) {
    console.error('Error creating fine-tuning job:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error creating fine-tuning job' },
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
    
    // For each job that's not completed, check its status
    const updatedJobs = [];
    
    for (const job of jobs || []) {
      if (job.status !== 'succeeded' && job.status !== 'failed') {
        try {
          const updatedJob = await openai.fineTuning.jobs.retrieve(job.job_id);
          
          // Update the job in our database
          const { error: updateError } = await supabase
            .from('ai_model_training_jobs')
            .update({
              status: updatedJob.status,
              model_name: updatedJob.fine_tuned_model || job.model_name,
              updated_at: new Date().toISOString()
            })
            .eq('job_id', job.job_id);
            
          if (updateError) {
            console.error(`Error updating job ${job.job_id}:`, updateError);
          }
          
          updatedJobs.push({
            ...job,
            status: updatedJob.status,
            model_name: updatedJob.fine_tuned_model || job.model_name
          });
        } catch (error) {
          console.error(`Error checking job ${job.job_id}:`, error);
          updatedJobs.push(job);
        }
      } else {
        updatedJobs.push(job);
      }
    }
    
    return NextResponse.json({
      success: true,
      jobs: updatedJobs
    });
    
  } catch (error) {
    console.error('Error checking fine-tuning jobs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error checking fine-tuning jobs' },
      { status: 500 }
    );
  }
} 