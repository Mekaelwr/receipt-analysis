/**
 * Service for price comparison functionality
 */

import { createClient } from '@supabase/supabase-js';

export interface PriceComparison {
  standardized_item_name: string;
  current_item: string;
  current_price: number;
  current_store: string;
  cheaper_item: string;
  cheaper_price: number;
  cheaper_store: string;
  price_difference: number;
  percentage_savings: number;
  receipt_item_id?: string;
  category?: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Fetches price comparisons for items in a receipt
 * @param receiptId The ID of the receipt to analyze
 * @returns Array of price comparisons for items with cheaper alternatives
 */
export async function fetchReceiptComparisons(receiptId: string): Promise<PriceComparison[]> {
  try {
    console.log(`Fetching comparisons for receipt: ${receiptId}`);
    
    // Call the Supabase RPC function to get comparisons
    const { data, error } = await supabase
      .rpc('find_receipt_cheaper_alternatives', { receipt_id: receiptId });
    
    if (error) {
      console.error('Error fetching comparisons:', error.message, error.details, error.hint);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log('No cheaper alternatives found for receipt');
      return [];
    }
    
    console.log(`Found ${data.length} cheaper alternatives for receipt:`, 
      data.map((item: PriceComparison) => `${item.standardized_item_name}: ${item.current_price} vs ${item.cheaper_price}`));
    
    return data || [];
  } catch (error) {
    console.error('Error in comparison service:', error);
    return [];
  }
}

/**
 * Calculates the total potential savings from all comparisons
 * @param comparisons Array of price comparisons
 * @returns Total amount that could be saved
 */
export function calculateTotalSavings(comparisons: PriceComparison[]): number {
  return comparisons.reduce((total, comparison) => {
    return total + comparison.price_difference;
  }, 0);
}

/**
 * Fetches all items with cheaper alternatives across stores
 * @returns Array of price comparisons for items with cheaper alternatives
 */
export async function fetchAllCheaperAlternatives(): Promise<PriceComparison[]> {
  try {
    const { data, error } = await fetch('/api/cheaper-alternatives')
      .then(res => res.json());
    
    if (error) {
      console.error('Error fetching all cheaper alternatives:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in fetching alternatives:', error);
    return [];
  }
}

/**
 * Groups comparisons by category
 * @param comparisons Array of price comparisons
 * @returns Object with categories as keys and arrays of comparisons as values
 */
export function groupComparisonsByCategory(comparisons: PriceComparison[]): Record<string, PriceComparison[]> {
  return comparisons.reduce((groups, comparison) => {
    const category = comparison.category || 'Uncategorized';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(comparison);
    return groups;
  }, {} as Record<string, PriceComparison[]>);
} 