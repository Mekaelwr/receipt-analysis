import React from 'react';
import { createClient } from '@supabase/supabase-js';
import ReceiptDetail from '../components/ReceiptDetail';

interface ReceiptItem {
  id: string;
  original_item_name: string;
  detailed_name?: string;
  item_price: string;
  standardized_item_name?: string;
  category?: string;
  item_name?: string;
}

interface Receipt {
  id: string;
  store_name: string;
  purchase_date: string;
  total_amount: string;
  receipt_items: ReceiptItem[];
}

// Get all receipts with their items
async function getReceipts() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: receipts, error } = await supabase
    .from('receipts')
    .select(`
      id,
      store_name,
      purchase_date,
      total_price,
      receipt_items(
        id,
        original_item_name,
        detailed_name,
        item_price,
        standardized_item_name,
        category
      )
    `)
    .order('purchase_date', { ascending: false });

  if (error) {
    console.error('Error fetching receipts:', error);
    return [];
  }

  // Transform the data to match the expected format
  return receipts.map(receipt => {
    // Make a copy of the receipt items with original_item_name as item_name if needed
    const transformedItems = receipt.receipt_items.map(item => {
      return {
        id: item.id,
        item_name: item.detailed_name || item.original_item_name,
        item_price: item.item_price,
        standardized_item_name: item.standardized_item_name,
        category: item.category
      };
    });

    return {
      id: receipt.id,
      store_name: receipt.store_name,
      purchase_date: receipt.purchase_date,
      total_amount: receipt.total_price,
      receipt_items: transformedItems
    };
  });
}

export default async function ReceiptsPage({ 
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const receipts = await getReceipts();
  // Always show debug info regardless of query param
  const debug = true;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">My Receipts</h1>
      
      {receipts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No receipts found. Upload your first receipt to get started.</p>
        </div>
      ) : (
        <>
          {debug && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <h3 className="font-medium">Debug Mode</h3>
              <p className="text-sm text-gray-600">Receipt IDs:</p>
              <ul className="list-disc pl-5 text-xs">
                {receipts.map(receipt => (
                  <li key={receipt.id}>
                    <span className="font-mono">{receipt.id}</span> - {receipt.store_name} ({receipt.receipt_items.length} items)
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="receipt-card-container">
                <ReceiptDetail receipt={receipt} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
} 