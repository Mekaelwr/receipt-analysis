import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    console.log("Fetching cheaper alternatives...");
    
    // SQL query to find items that have cheaper alternatives at different stores or times
    const { data, error } = await supabase.rpc('find_cheaper_alternatives');
    
    if (error) {
      console.error("Error fetching cheaper alternatives:", error);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} items with cheaper alternatives`);
    
    // Format the data for the frontend
    const formattedData = data.map((item: any) => {
      return {
        item_name: item.standardized_item_name || '',
        current_item: item.current_item,
        current_price: parseFloat(item.current_price),
        current_store: item.current_store,
        cheaper_item: item.cheaper_item,
        cheaper_price: parseFloat(item.cheaper_price),
        cheaper_store: item.cheaper_store,
        price_difference: parseFloat(item.price_difference),
        percentage_difference: parseFloat(item.percentage_difference),
        category: item.category || 'Other'
      };
    });
    
    // Sort by percentage difference (highest first)
    formattedData.sort((a: any, b: any) => b.percentage_difference - a.percentage_difference);
    
    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error in cheaper alternatives API:', error);
    
    // Return an empty array instead of an error object to prevent client-side format errors
    return NextResponse.json([]);
  }
} 