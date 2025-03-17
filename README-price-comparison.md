# Price Comparison Feature

This feature allows users to see which items they've purchased that have cheaper alternatives at other stores. It helps users save money by identifying opportunities to purchase the same items at lower prices.

## How It Works

1. The system analyzes your receipt items and standardizes their names for comparison
2. It compares your purchased items with prices from other stores
3. It identifies items where you could have saved money by shopping elsewhere
4. It displays these items in a table, sorted by potential savings

## Setup Instructions

### Database Setup

To enable the price comparison feature, you need to set up the database function:

```bash
# Run the SQL script to create the database function
npm run db:setup-price-comparison
```

Alternatively, you can manually run the SQL in the `sql/get_items_with_cheaper_alternatives.sql` file in your database.

### Accessing the Feature

Once set up, you can access the price comparison feature in two ways:

1. **Through the UI**: Click on the "Price Comparison" link in the navigation bar
2. **Direct URL**: Navigate to `/price-comparison` in your browser

## Features

The price comparison page includes:

- **View Toggle**: Switch between viewing items with cheaper alternatives and all uploaded items
- **Summary Cards**: Shows the number of items with cheaper alternatives, total potential savings, and average savings per item
- **Category Filters**: Filter items by category (Produce, Meat, Dairy, etc.)
- **Sortable Table**: View all items with cheaper alternatives, sorted by percentage savings
- **Store Information**: See which stores offer the best prices for each item

### View All Uploaded Items

The page now includes a toggle to switch to viewing all uploaded items:

- **All Items View**: Shows all items you've uploaded across all receipts
- **Summary Statistics**: Displays total items, unique products, and number of stores visited
- **Category Filtering**: Filter items by category, just like in the comparison view
- **Price Sorting**: Items are sorted by price (lowest first) to help identify good deals

## How to Use the Results

- **Plan Future Shopping**: Use the information to plan where to buy specific items
- **Maximize Savings**: Focus on items with the highest percentage savings
- **Compare Stores**: Identify which stores consistently offer better prices for certain categories
- **Track Purchases**: Use the all items view to see your complete purchase history

## Technical Details

The price comparison feature works by:

1. Standardizing item names using GPT-4o-mini to ensure accurate comparisons
2. Storing price information from receipts in the `item_price_comparison` table
3. Comparing your purchased items with the lowest prices found across all stores
4. Calculating potential savings and presenting them in an easy-to-understand format

## Troubleshooting

If you don't see any items with cheaper alternatives:

- Make sure you have uploaded receipts from multiple stores
- Check that item names have been standardized (run the standardization script)
- Verify that the database function has been properly installed 