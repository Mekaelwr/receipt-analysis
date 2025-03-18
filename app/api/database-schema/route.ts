// Create receipt_items table
const createReceiptItemsTable = async () => {
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