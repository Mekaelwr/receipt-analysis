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
    console.log('Clearing database of all receipts and receipt items...');
    
    // First delete all receipt items (child records with foreign key constraint)
    const { error: itemsError } = await supabase
      .from('receipt_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (itemsError) {
      console.error('Error deleting receipt items:', itemsError);
      return NextResponse.json(
        { error: 'Failed to delete receipt items', details: itemsError.message },
        { status: 500 }
      );
    }
    
    console.log('Successfully deleted all receipt items');
    
    // Then delete all receipts
    const { error: receiptsError } = await supabase
      .from('receipts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (receiptsError) {
      console.error('Error deleting receipts:', receiptsError);
      return NextResponse.json(
        { error: 'Failed to delete receipts', details: receiptsError.message },
        { status: 500 }
      );
    }
    
    console.log('Successfully deleted all receipts');
    
    // Optional: Delete any uploaded receipt images from storage
    // We need to list files first, then delete them
    const { data: fileList, error: listError } = await supabase.storage
      .from('receipts')
      .list('receipts');

    if (listError) {
      console.log('Note: Could not list files in storage bucket:', listError);
    } else if (fileList && fileList.length > 0) {
      // Delete all files in the receipts folder
      const filesToRemove = fileList.map(file => `receipts/${file.name}`);
      
      const { error: removeError } = await supabase.storage
        .from('receipts')
        .remove(filesToRemove);
      
      if (removeError) {
        console.log('Note: Could not remove files from storage bucket:', removeError);
      } else {
        console.log(`Successfully cleared ${filesToRemove.length} receipt images from storage`);
      }
    } else {
      console.log('No receipt images found in storage to clear');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Successfully cleared all receipts and receipt items from the database'
    });
    
  } catch (error) {
    console.error('Error clearing database:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear database' },
      { status: 500 }
    );
  }
} 