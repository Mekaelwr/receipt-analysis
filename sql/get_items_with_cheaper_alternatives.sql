-- Function to get items with cheaper alternatives
CREATE OR REPLACE FUNCTION get_items_with_cheaper_alternatives()
RETURNS TABLE (
  item_name TEXT,
  your_store TEXT,
  your_price NUMERIC,
  cheapest_store TEXT,
  cheapest_price NUMERIC,
  price_difference NUMERIC,
  percentage_savings NUMERIC,
  category TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_items AS (
    -- Get the user's purchased items with their prices and stores
    SELECT 
      ri.standardized_item_name,
      r.store_name,
      ri.final_price / NULLIF(ri.quantity, 0) AS unit_price,
      ri.category
    FROM receipt_items ri
    JOIN receipts r ON ri.receipt_id = r.id
    WHERE ri.standardized_item_name IS NOT NULL
  ),
  cheapest_prices AS (
    -- Find the cheapest price for each standardized item across all stores
    SELECT
      standardized_item_name,
      store_name,
      min_price
    FROM item_price_comparison
    WHERE min_price > 0
  ),
  user_item_with_cheapest AS (
    -- Join user items with cheapest prices
    SELECT
      ui.standardized_item_name,
      ui.store_name AS your_store,
      ui.unit_price AS your_price,
      cp.store_name AS cheapest_store,
      cp.min_price AS cheapest_price,
      ui.category
    FROM user_items ui
    JOIN cheapest_prices cp ON ui.standardized_item_name = cp.standardized_item_name
    WHERE ui.unit_price > cp.min_price
      AND ui.store_name != cp.store_name
  )
  -- Calculate savings and return results
  SELECT DISTINCT ON (standardized_item_name)
    standardized_item_name AS item_name,
    your_store,
    your_price,
    cheapest_store,
    cheapest_price,
    (your_price - cheapest_price) AS price_difference,
    ((your_price - cheapest_price) / your_price * 100) AS percentage_savings,
    category
  FROM user_item_with_cheapest
  ORDER BY standardized_item_name, percentage_savings DESC;
END;
$$ LANGUAGE plpgsql; 