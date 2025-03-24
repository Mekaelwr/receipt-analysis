# Database Setup Instructions

## Adding the `find_receipt_cheaper_alternatives` Function

To enable the receipt comparison feature, you need to add the SQL function `find_receipt_cheaper_alternatives` to your Supabase database. This function identifies items in a receipt that can be found cheaper elsewhere.

### Steps:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Click "New Query"
4. Copy and paste the contents of `find_receipt_cheaper_alternatives.sql` into the editor
5. Click "Run" to create the function

### Function Parameters:

- `receipt_id` (UUID): The ID of the receipt to analyze

### Function Returns:

The function returns a table with the following columns:

- `standardized_item_name`: The standardized name of the item
- `current_item`: The name of the item in the current receipt
- `current_price`: The price of the item in the current receipt
- `current_store`: The store where the current receipt is from
- `cheaper_item`: The name of the cheaper alternative
- `cheaper_price`: The price of the cheaper alternative
- `cheaper_store`: The store where the cheaper alternative is available
- `price_difference`: The absolute price difference (current_price - cheaper_price)
- `percentage_savings`: The percentage savings ((current_price - cheaper_price) / current_price * 100)
- `receipt_item_id`: The ID of the item in the current receipt

## Testing the Function

After adding the function, you can test it with the following SQL query:

```sql
SELECT * FROM find_receipt_cheaper_alternatives('your-receipt-id-here');
```

Replace `your-receipt-id-here` with a valid receipt ID from your database.

## Function Details

The function works by:

1. Finding all items in the specified receipt
2. Finding all items with the same standardized name in other receipts
3. Comparing prices to identify cheaper alternatives
4. Filtering to only include alternatives that are at least 5% cheaper
5. For each item, returning only the best (cheapest) alternative

This enables the app to show users potential savings on each receipt. 