-- SQL function to find cheaper alternatives
-- This needs to be created in your Supabase SQL editor

CREATE OR REPLACE FUNCTION find_cheaper_alternatives()
RETURNS TABLE (
  standardized_item_name TEXT,
  current_item TEXT,
  current_price NUMERIC,
  current_store TEXT,
  current_date TIMESTAMP WITH TIME ZONE,
  cheaper_item TEXT,
  cheaper_price NUMERIC,
  cheaper_store TEXT,
  cheaper_date TIMESTAMP WITH TIME ZONE,
  price_difference NUMERIC,
  percentage_difference NUMERIC,
  category TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH item_prices AS (
    SELECT 
      ri.standardized_item_name,
      ri.original_item_name,
      ri.item_price::NUMERIC,
      r.store_name,
      r.created_at,
      ri.category
    FROM receipt_items ri
    JOIN receipts r ON ri.receipt_id = r.id
    WHERE ri.standardized_item_name IS NOT NULL
    ORDER BY ri.standardized_item_name, r.created_at
  )

  SELECT 
    p1.standardized_item_name,
    p1.original_item_name AS current_item,
    p1.item_price AS current_price,
    p1.store_name AS current_store,
    p1.created_at AS current_date,
    p2.original_item_name AS cheaper_item,
    p2.item_price AS cheaper_price,
    p2.store_name AS cheaper_store,
    p2.created_at AS cheaper_date,
    (p1.item_price - p2.item_price) AS price_difference,
    ((p1.item_price - p2.item_price) / p2.item_price * 100) AS percentage_difference,
    p1.category
  FROM item_prices p1
  JOIN item_prices p2 ON 
    p1.standardized_item_name = p2.standardized_item_name AND
    -- Either different store or at least 1 day difference for the same store
    ((p1.store_name = p2.store_name AND p1.created_at != p2.created_at) OR
     p1.store_name != p2.store_name) AND
    p1.item_price > p2.item_price
  ORDER BY percentage_difference DESC;
END;
$$ LANGUAGE plpgsql; 