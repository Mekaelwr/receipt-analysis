/**
 * Service for price comparison functionality
 */

import { createClient } from '@supabase/supabase-js';
import { priceComparisonLogger } from '../utils/logger';

export interface UnifiedPriceComparison {
  item_name: string;
  current_price: number;
  current_store: string;
  current_date: string;
  best_price: number;
  best_store: string;
  best_date: string;
  savings: number;
  savings_percentage: number;
  comparison_type: 'temporal' | 'store' | 'alternative';
  is_alternative: boolean;
}

export interface PriceComparisonResponse {
  total_savings: number;
  comparisons: UnifiedPriceComparison[];
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Fetches price comparisons for items in a receipt using the unified comparison endpoint
 * @param receiptId The ID of the receipt to analyze
 * @param daysLookback Number of days to look back for price comparisons (default: 30)
 * @returns Object containing total savings and array of price comparisons
 */
export async function fetchUnifiedComparisons(
  receiptId: string,
  daysLookback: number = 30
): Promise<PriceComparisonResponse> {
  try {
    console.log(`Fetching unified comparisons for receipt: ${receiptId}`);
    
    const response = await fetch(
      `/api/unified-price-comparison?receipt_id=${receiptId}&days_lookback=${daysLookback}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !Array.isArray(data.comparisons)) {
      console.log('No price comparisons found');
      return { total_savings: 0, comparisons: [] };
    }
    
    console.log(`Found ${data.comparisons.length} price comparisons with total savings: $${data.total_savings}`);
    
    return data;
  } catch (error) {
    console.error('Error in unified comparison service:', error);
    return { total_savings: 0, comparisons: [] };
  }
}

/**
 * Formats a date difference into a human-readable string
 * @param date1 First date
 * @param date2 Second date
 * @returns String like "3 days ago" or "1 month ago"
 */
export function formatDateDifference(date1: string, date2: string): string {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffDays = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  const months = Math.floor(diffDays / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

/**
 * Gets a descriptive string for the price comparison
 * @param comparison The price comparison object
 * @returns String describing where/when the better price was found
 */
export function getComparisonDescription(comparison: UnifiedPriceComparison): string {
  const { comparison_type, best_store, best_date, current_date } = comparison;
  
  switch (comparison_type) {
    case 'temporal':
      return `Better price ${formatDateDifference(best_date, current_date)}`;
    case 'store':
      return `Better price at ${best_store}`;
    case 'alternative':
      return `Similar item at ${best_store}`;
    default:
      return 'Better price found';
  }
}

/**
 * Calculates the total potential savings from all comparisons
 * @param comparisons Array of price comparisons
 * @returns Total amount that could be saved
 */
export function calculateTotalSavings(comparisons: UnifiedPriceComparison[]): number {
  return comparisons.reduce((total: number, comparison: UnifiedPriceComparison) => {
    return total + comparison.savings;
  }, 0);
}

/**
 * Groups comparisons by category
 * @param comparisons Array of price comparisons
 * @returns Object with categories as keys and arrays of comparisons as values
 */
export function groupComparisonsByCategory(
  comparisons: UnifiedPriceComparison[]
): Record<string, UnifiedPriceComparison[]> {
  return comparisons.reduce((groups: Record<string, UnifiedPriceComparison[]>, comparison: UnifiedPriceComparison) => {
    const category = comparison.comparison_type;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(comparison);
    return groups;
  }, {});
}

export interface PriceComparison {
  itemName: string;
  originalPrice: number;
  cheaperPrice: number;
  cheaperStore: string;
  savings: number;
  savingsPercentage: number;
}

export interface TemporalComparison {
  standardized_item_name: string;
  current_price: number;
  lowest_price: number;
  store_name: string;
  price_date: string;
}

export async function fetchReceiptComparisons(receiptId: string): Promise<PriceComparison[]> {
  try {
    const response = await fetch(`/api/price-comparison?receiptId=${receiptId}&type=alternatives`);
    if (!response.ok) {
      throw new Error(`Failed to fetch price comparisons: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in comparison service:', error);
    return [];
  }
}

export async function fetchTemporalComparisons(receiptId: string): Promise<TemporalComparison[]> {
  try {
    console.log('🔍 Fetching temporal comparisons for receipt:', receiptId);
    const response = await fetch(`/api/price-comparison?receiptId=${receiptId}&type=temporal`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch temporal comparisons: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('📦 Temporal comparison data:', data);
    return data;
  } catch (error) {
    console.error('❌ Error in fetchTemporalComparisons:', error);
    return [];
  }
} 