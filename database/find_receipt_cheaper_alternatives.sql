-- Function: find_receipt_cheaper_alternatives
-- Description: Identifies cheaper alternatives for items in a specific receipt
-- Parameters: 
--   receipt_id - UUID of the receipt to analyze
-- Returns: Table of items with cheaper alternatives, including price differences and savings percentages

CREATE OR REPLACE FUNCTION find_receipt_cheaper_alternatives(receipt_id UUID)
RETURNS TABLE(
    standardized_item_name TEXT,
    current_item TEXT,
    current_price NUMERIC,
    current_store TEXT,
    cheaper_item TEXT,
    cheaper_price NUMERIC,
    cheaper_store TEXT,
    price_difference NUMERIC,
    percentage_savings NUMERIC,
    receipt_item_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH CurrentItems AS (
        SELECT 
            ri.id as receipt_item_id,
            ri.standardized_item_name,
            ri.detailed_name as item_name,
            ri.item_price::numeric as price,
            r.store_name,
            r.id as receipt_id
        FROM receipt_items ri
        JOIN receipts r ON ri.receipt_id = r.id
        WHERE ri.receipt_id = find_receipt_cheaper_alternatives.receipt_id
    ),
    OtherItems AS (
        SELECT 
            ri.standardized_item_name,
            ri.detailed_name as item_name,
            ri.item_price::numeric as price,
            r.store_name,
            r.id as receipt_id,
            r.purchase_date
        FROM receipt_items ri
        JOIN receipts r ON ri.receipt_id = r.id
        WHERE ri.receipt_id != find_receipt_cheaper_alternatives.receipt_id
    ),
    CheaperItems AS (
        SELECT 
            c.receipt_item_id,
            c.standardized_item_name,
            c.item_name as current_item,
            c.price as current_price,
            c.store_name as current_store,
            o.item_name as cheaper_item,
            o.price as cheaper_price,
            o.store_name as cheaper_store,
            (c.price - o.price) as price_difference,
            ((c.price - o.price) / c.price * 100) as percentage_savings,
            o.purchase_date,
            ROW_NUMBER() OVER (
                PARTITION BY c.receipt_item_id 
                ORDER BY ((c.price - o.price) / c.price * 100) DESC
            ) as rank
        FROM CurrentItems c
        JOIN OtherItems o ON c.standardized_item_name = o.standardized_item_name
        WHERE o.price < c.price
        AND c.price > 0  -- Keep this to avoid division by zero
    )
    
    SELECT 
        ci.standardized_item_name,
        ci.current_item,
        ci.current_price,
        ci.current_store,
        ci.cheaper_item,
        ci.cheaper_price,
        ci.cheaper_store,
        ci.price_difference,
        ci.percentage_savings,
        ci.receipt_item_id
    FROM CheaperItems ci
    WHERE ci.rank = 1  -- Only get the best alternative per item
    ORDER BY ci.percentage_savings DESC;
END;
$$; 