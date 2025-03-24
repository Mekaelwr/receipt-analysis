-- Function to find cheaper alternatives for items in a specific receipt
CREATE OR REPLACE FUNCTION find_receipt_cheaper_alternatives(receipt_id_param UUID)
RETURNS TABLE (
  standardized_item_name TEXT,
  current_item TEXT,
  current_price NUMERIC,
  current_store TEXT,
  cheaper_item TEXT,
  cheaper_price NUMERIC,
  cheaper_store TEXT,
  price_difference NUMERIC,
  percentage_difference NUMERIC,
  category TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH receipt_items AS (
    -- Get all items from the specified receipt
    SELECT 
      ri.id,
      ri.item_name,
      ri.item_price::NUMERIC,
      ri.standardized_item_name,
      ri.category,
      r.store_name AS store,
      r.purchase_date AS date
    FROM receipt_items ri
    JOIN receipts r ON ri.receipt_id = r.id
    WHERE ri.receipt_id = receipt_id_param
  ),
  all_items AS (
    -- Get all items from other receipts for comparison
    SELECT 
      ri.item_name,
      ri.item_price::NUMERIC as price,
      ri.standardized_item_name,
      ri.category,
      r.store_name AS store,
      r.id AS receipt_id,
      r.purchase_date
    FROM receipt_items ri
    JOIN receipts r ON ri.receipt_id = r.id
    WHERE ri.standardized_item_name IS NOT NULL
  )
  -- Find cheaper alternatives for receipt items
  SELECT 
    ritem.standardized_item_name,
    ritem.item_name AS current_item,
    ritem.item_price AS current_price,
    ritem.store AS current_store,
    ai.item_name AS cheaper_item,
    ai.price AS cheaper_price,
    ai.store AS cheaper_store,
    (ritem.item_price - ai.price) AS price_difference,
    ((ritem.item_price - ai.price) / ritem.item_price * 100) AS percentage_difference,
    COALESCE(ritem.category, 'Uncategorized') AS category
  FROM receipt_items ritem
  INNER JOIN all_items ai ON ai.standardized_item_name = ritem.standardized_item_name
  WHERE 
    -- Only include items where the cheaper alternative is from a different store
    ai.store != ritem.store AND
    -- Only show items where there is a cheaper price (at least 5% cheaper to avoid rounding errors)
    ai.price < ritem.item_price AND
    ((ritem.item_price - ai.price) / ritem.item_price * 100) >= 5
  ORDER BY percentage_difference DESC;
END;
$$ LANGUAGE plpgsql; 