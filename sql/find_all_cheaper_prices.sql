-- Function to find all cheaper prices for items in a receipt
CREATE OR REPLACE FUNCTION find_all_cheaper_prices(receipt_id_param UUID)
RETURNS TABLE (
    original_item_name TEXT,
    original_price NUMERIC,
    better_price NUMERIC,
    better_store TEXT,
    better_date TIMESTAMP WITH TIME ZONE,
    savings NUMERIC,
    savings_percentage NUMERIC,
    is_temporal BOOLEAN,
    match_quality TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH receipt_items AS (
        -- Get items from the specified receipt
        SELECT 
            ri.id,
            ri.item_name as original_name,
            ri.standardized_item_name,
            ri.detailed_name,
            ri.item_price::numeric as original_price,
            r.store_name as original_store,
            r.created_at as original_date
        FROM receipt_items ri
        JOIN receipts r ON ri.receipt_id = r.id
        WHERE ri.receipt_id = receipt_id_param
        AND ri.item_price > 0  -- Only compare items with valid prices
    ),
    all_prices AS (
        -- Get all prices for comparison
        SELECT 
            ri.standardized_item_name,
            ri.detailed_name,
            ri.item_price::numeric as price,
            r.store_name,
            r.created_at as price_date
        FROM receipt_items ri
        JOIN receipts r ON ri.receipt_id = r.id
        WHERE ri.item_price > 0  -- Only include items with valid prices
        AND ri.receipt_id != receipt_id_param  -- Don't compare with self
        AND r.created_at >= NOW() - INTERVAL '90 days'  -- Only use recent prices
    )
    -- Find cheaper prices with different matching strategies
    SELECT DISTINCT ON (ri.original_name, ap.store_name)  -- Get best price per store
        ri.original_name,
        ri.original_price,
        ap.price as better_price,
        ap.store_name as better_store,
        ap.price_date as better_date,
        (ri.original_price - ap.price) as savings,
        ((ri.original_price - ap.price) / ri.original_price * 100) as savings_percentage,
        CASE 
            WHEN ap.store_name = ri.original_store THEN TRUE
            ELSE FALSE
        END as is_temporal,
        CASE
            WHEN ri.standardized_item_name IS NOT NULL 
                AND ri.standardized_item_name = ap.standardized_item_name 
                THEN 'exact'
            WHEN ri.detailed_name IS NOT NULL 
                AND ri.detailed_name = ap.detailed_name 
                THEN 'detailed'
            ELSE 'no_match'
        END as match_quality
    FROM receipt_items ri
    JOIN all_prices ap ON (
        -- Match on standardized name if available
        (ri.standardized_item_name IS NOT NULL 
         AND ri.standardized_item_name = ap.standardized_item_name)
        OR
        -- Fall back to detailed name match
        (ri.detailed_name IS NOT NULL 
         AND ri.detailed_name = ap.detailed_name)
    )
    WHERE ap.price < ri.original_price  -- Only include actually cheaper prices
    ORDER BY 
        ri.original_name,
        ap.store_name,
        savings_percentage DESC,  -- Get the best savings per store
        ap.price_date DESC;  -- Prefer more recent prices
END;
$$ LANGUAGE plpgsql; 