export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const receiptId = params.id;

    if (!receiptId) {
      return NextResponse.json(
        { error: "Receipt ID is required" },
        { status: 400 }
      );
    }

    // Fetch the receipt data
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("id, store_name, raw_receipt_json, created_at")
      .eq("id", receiptId)
      .single();

    if (receiptError) {
      console.error("Error fetching receipt:", receiptError);
      return NextResponse.json(
        { error: "Failed to fetch receipt" },
        { status: 500 }
      );
    }

    if (!receipt) {
      return NextResponse.json(
        { error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Parse receipt data
    let receiptData;
    try {
      receiptData = typeof receipt.raw_receipt_json === 'string' 
        ? JSON.parse(receipt.raw_receipt_json) 
        : receipt.raw_receipt_json;
    } catch (error) {
      console.error("Error parsing receipt data:", error);
      return NextResponse.json(
        { error: "Invalid receipt data format" },
        { status: 500 }
      );
    }

    // Fetch receipt items with their cheaper alternatives
    const { data: items, error: itemsError } = await supabase
      .from("receipt_items")
      .select(`
        id,
        receipt_id,
        original_item_name,
        item_name,
        item_price,
        quantity,
        standardized_item_name,
        detailed_name,
        cheaper_alternative
      `)
      .eq("receipt_id", receiptId);

    if (itemsError) {
      console.error("Error fetching receipt items:", itemsError);
      return NextResponse.json(
        { error: "Failed to fetch receipt items" },
        { status: 500 }
      );
    }

    // Merge receipt data with items that have cheaper alternatives
    return NextResponse.json({
      id: receipt.id,
      store_name: receipt.store_name,
      created_at: receipt.created_at,
      receipt_data: receiptData,
      items: items
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
} 