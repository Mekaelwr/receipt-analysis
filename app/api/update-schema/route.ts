import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    console.log('Updating database schema to add detailed_name column to receipt_items...');
    
    // Check if detailed_name column already exists
    const { data: columns, error: columnsError } = await supabase.rpc('exec', {
      query: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'receipt_items' AND column_name = 'detailed_name';
      `
    });

    if (columnsError) {
      console.error('Error checking for detailed_name column:', columnsError);
      return NextResponse.json(
        { error: 'Failed to check for detailed_name column existence' },
        { status: 500 }
      );
    }

    // If column doesn't exist, add it
    if (!columns || columns.length === 0) {
      const { error: alterError } = await supabase.rpc('exec', {
        query: `
          ALTER TABLE receipt_items
          ADD COLUMN detailed_name TEXT;
        `
      });

      if (alterError) {
        console.error('Error adding detailed_name column:', alterError);
        return NextResponse.json(
          { error: 'Failed to add detailed_name column' },
          { status: 500 }
        );
      }

      console.log('Successfully added detailed_name column to receipt_items');
      return NextResponse.json({
        success: true,
        message: 'Added detailed_name column to receipt_items table'
      });
    } else {
      console.log('detailed_name column already exists in receipt_items table');
      return NextResponse.json({
        success: true,
        message: 'detailed_name column already exists in receipt_items table'
      });
    }
  } catch (error) {
    console.error('Error updating schema:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update database schema' },
      { status: 500 }
    );
  }
} 