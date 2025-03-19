import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create receipt_items table
export const createReceiptItemsTable = async () => {
  await supabase.rpc('exec', {
    query: `
      CREATE TABLE IF NOT EXISTS receipt_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
        original_item_name TEXT NOT NULL,
        detailed_name TEXT,
        standardized_item_name TEXT,
        category TEXT DEFAULT 'Other',
        item_price NUMERIC DEFAULT 0,
        quantity INTEGER DEFAULT 1,
        regular_price NUMERIC,
        final_price NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `
  });
}; 