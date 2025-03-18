import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase credentials in environment variables.');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPriceComparisonSetup() {
  console.log('Checking price comparison setup...');
  
  try {
    // 1. Check if the database function exists
    console.log('Checking if database function exists...');
    
    // Use try-catch instead of .catch() for proper error handling
    let functionExists = false;
    let functionCheckError = null;
    
    try {
      const result = await supabase.rpc(
        'get_items_with_cheaper_alternatives',
        {},
        { count: 'exact', head: true }
      );
      functionExists = !result.error;
    } catch (err) {
      functionCheckError = err;
    }
    
    if (!functionExists || functionCheckError) {
      console.log('❌ Database function not found or not accessible.');
      if (functionCheckError) {
        console.log('Error details:', functionCheckError instanceof Error ? functionCheckError.message : String(functionCheckError));
      }
      
      // Try to create the function
      console.log('\nAttempting to create the database function...');
      
      // Read the SQL file
      const sqlFilePath = path.join(process.cwd(), 'sql', 'get_items_with_cheaper_alternatives.sql');
      
      if (!fs.existsSync(sqlFilePath)) {
        console.error('❌ SQL file not found at:', sqlFilePath);
        console.error('Please make sure the file exists and try again.');
        process.exit(1);
      }
      
      const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
      
      // Execute the SQL directly using Supabase's REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_items_with_cheaper_alternatives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({})
      });
      
      if (response.ok) {
        console.log('✅ Database function created successfully!');
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to create database function.');
        console.error('Error:', errorText);
        console.log('\nPlease run the following command to set up the database function:');
        console.log('npm run db:setup-price-comparison');
      }
    } else {
      console.log('✅ Database function exists and is accessible.');
    }
    
    // 2. Check if there are standardized items
    console.log('\nChecking for standardized items...');
    const { data: standardizedItems, error: itemsError } = await supabase
      .from('receipt_items')
      .select('id')
      .not('standardized_item_name', 'is', null)
      .limit(1);
    
    if (itemsError) {
      console.error('❌ Error checking standardized items:', itemsError.message);
    } else if (!standardizedItems || standardizedItems.length === 0) {
      console.log('❌ No standardized items found.');
      console.log('You need to upload receipts and run the standardization process.');
      console.log('Run: npx ts-node scripts/run-standardization.ts');
    } else {
      console.log('✅ Standardized items found in the database.');
    }
    
    // 3. Check if there are price comparison records
    console.log('\nChecking for price comparison records...');
    const { data: priceComparisons, error: comparisonsError } = await supabase
      .from('item_price_comparison')
      .select('standardized_item_name')
      .limit(1);
    
    if (comparisonsError) {
      console.error('❌ Error checking price comparison records:', comparisonsError.message);
    } else if (!priceComparisons || priceComparisons.length === 0) {
      console.log('❌ No price comparison records found.');
      console.log('This could be because:');
      console.log('- You need to upload receipts from multiple stores');
      console.log('- The standardization process hasn\'t been run');
      console.log('Run: npx ts-node scripts/run-standardization.ts');
    } else {
      console.log('✅ Price comparison records found in the database.');
    }
    
    // 4. Check if there are receipts from multiple stores
    console.log('\nChecking for receipts from multiple stores...');
    const { data: stores, error: storesError } = await supabase
      .from('receipts')
      .select('store_name')
      .not('store_name', 'is', null);
    
    if (storesError) {
      console.error('❌ Error checking stores:', storesError.message);
    } else {
      const uniqueStores = new Set(stores.map(s => s.store_name));
      console.log(`Found ${uniqueStores.size} unique stores: ${Array.from(uniqueStores).join(', ')}`);
      
      if (uniqueStores.size < 2) {
        console.log('❌ You need receipts from at least 2 different stores for price comparison.');
        console.log('Upload more receipts from different stores.');
      } else {
        console.log('✅ Multiple stores found in the database.');
      }
    }
    
    console.log('\nSetup check complete!');
    
  } catch (error) {
    console.error('Error during setup check:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the check
checkPriceComparisonSetup().catch(err => {
  console.error('Unhandled error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}); 