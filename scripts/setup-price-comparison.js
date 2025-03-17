const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Main function to set up price comparison
async function setupPriceComparison() {
  console.log('Setting up price comparison...');
  
  try {
    // Check if the SQL file exists
    const sqlFilePath = path.join(process.cwd(), 'sql', 'get_items_with_cheaper_alternatives.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      console.error('❌ SQL file not found at:', sqlFilePath);
      console.error('Please make sure the file exists and try again.');
      process.exit(1);
    }
    
    console.log('✅ Found SQL file:', sqlFilePath);
    
    // Read the SQL file content
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('✅ SQL file read successfully');
    
    // Print the SQL content for verification
    console.log('\nSQL Content:');
    console.log('----------------------------------------');
    console.log(sqlContent.substring(0, 500) + '...');
    console.log('----------------------------------------');
    
    // Instructions for manual setup
    console.log('\nTo set up the price comparison function, you need to:');
    console.log('1. Make sure you have PostgreSQL installed and configured');
    console.log('2. Run the following command to create the database function:');
    console.log('   npm run db:setup-price-comparison');
    console.log('\nAlternatively, you can manually run the SQL in your database management tool.');
    
    // Check if we can run psql
    try {
      console.log('\nChecking if psql is available...');
      execSync('psql --version', { stdio: 'pipe' });
      console.log('✅ psql is available. You can run:');
      console.log('   npm run db:setup-price-comparison');
    } catch (err) {
      console.log('❌ psql command not found. You will need to manually run the SQL.');
      console.log('You can copy the SQL from:', sqlFilePath);
    }
    
    console.log('\nAfter setting up the database function:');
    console.log('1. Make sure you have uploaded receipts from at least 2 different stores');
    console.log('2. Run the standardization process to standardize item names');
    console.log('3. Visit the price comparison page to see items with cheaper alternatives');
    
  } catch (error) {
    console.error('Error during setup:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the setup
setupPriceComparison().catch(err => {
  console.error('Unhandled error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}); 