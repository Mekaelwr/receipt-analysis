import { NextRequest, NextResponse } from "next/server";

// Create a sample receipt with cheaper alternatives
const sampleReceiptWithAlternatives = {
  store_information: {
    name: "Jewel Osco",
    address: "123 Main St, Chicago IL",
    phone_number: "555-123-4567"
  },
  purchase_details: {
    date: "2023-04-15",
    time: "11:29 AM"
  },
  items: [
    {
      name: "KIND Snack Bar",
      price: 4.49,
      quantity: 1,
      final_price: 4.49,
      detailed_name: "KIND Protein Snack Bar",
      standardized_name: "Snack Bar",
      cheaper_alternative: {
        store_name: "ALDI",
        price: 2.99,
        item_name: "KIND Bar Assorted",
        savings: 1.50,
        percentage_savings: 33.41
      }
    },
    {
      name: "Simply Orange Juice, No Pulp (52 oz)",
      price: 4.99,
      quantity: 1,
      final_price: 4.99,
      detailed_name: "Simply Orange 100% Juice No Pulp",
      standardized_name: "Orange Juice",
      cheaper_alternative: {
        store_name: "ALDI",
        price: 3.69,
        item_name: "Not From Concentrate Orange Juice No Pulp",
        savings: 1.30,
        percentage_savings: 26.05
      }
    },
    {
      name: "Signature Select Honey Mustard",
      price: 3.29,
      quantity: 1,
      final_price: 3.29,
      detailed_name: "Signature Select Honey Mustard Dressing",
      standardized_name: "Honey Mustard",
      cheaper_alternative: {
        store_name: "Whole Foods Market",
        price: 2.49,
        item_name: "365 by Whole Foods Organic Honey Mustard",
        savings: 0.80,
        percentage_savings: 24.32
      }
    },
    {
      name: "PREM BERR 222 NW",
      price: 10.99,
      quantity: 1,
      final_price: 10.99,
      detailed_name: "Premium Mixed Berries",
      standardized_name: "Mixed Berries",
      cheaper_alternative: {
        store_name: "Unknown",
        price: 4.99,
        item_name: "Driscoll's Mixed Berries",
        savings: 6.00,
        percentage_savings: 54.60
      }
    },
    {
      name: "Bananas",
      price: 1.99,
      quantity: 1,
      final_price: 1.99,
      detailed_name: "Organic Bananas",
      standardized_name: "Bananas"
    }
  ],
  financial_summary: {
    subtotal: 25.75,
    total_taxes: 2.58,
    total_amount: 28.33
  }
};

export async function GET(request: NextRequest) {
  try {
    // Create a mock database-style response with separated items 
    const items = sampleReceiptWithAlternatives.items.map((item, index) => ({
      id: index + 1,
      receipt_id: "test-receipt-id",
      item_name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
      standardized_name: item.standardized_name || null,
      detailed_name: item.detailed_name || null,
      cheaper_alternative: item.cheaper_alternative || null
    }));
    
    // Calculate how many items have cheaper alternatives
    const itemsWithAlternatives = items.filter(
      item => item.cheaper_alternative
    );
    
    // Calculate total potential savings
    const totalSavings = itemsWithAlternatives.reduce(
      (sum, item) => sum + (item.cheaper_alternative?.savings || 0),
      0
    );
    
    return NextResponse.json({
      success: true,
      receipt_id: "test-receipt-id",
      receipt_json: sampleReceiptWithAlternatives,
      analysis: JSON.stringify(sampleReceiptWithAlternatives, null, 2),
      items: items,
      items_with_alternatives: itemsWithAlternatives.length,
      total_items: items.length,
      total_savings: totalSavings.toFixed(2),
      debug_note: "Use this test endpoint to view how cheaper alternatives are displayed in the receipt"
    });
  } catch (error) {
    console.error("Error in test endpoint:", error);
    return NextResponse.json(
      { error: "Test endpoint failed" },
      { status: 500 }
    );
  }
} 