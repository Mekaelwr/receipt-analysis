import { NextResponse } from 'next/server';
import OpenAI from "openai";

// API route configuration
export const runtime = 'edge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Define the receipt JSON structure
interface ReceiptJSON {
  store_information: {
    name: string;
    address: string;
    phone_number: string;
  };
  purchase_details: {
    date: string;
    time: string;
  };
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    regular_price: number;
    discounts: Array<{
      type: string;
      amount: number;
    }>;
    final_price: number;
  }>;
  taxes: Array<{
    category: string;
    rate: string;
    amount: number;
  }>;
  financial_summary: {
    subtotal: number;
    total_discounts: number;
    net_sales: number;
    total_taxes: number;
    total_amount: number;
    change_given: number;
  };
  payment_information: {
    method: string;
  };
  savings_summary: {
    store_savings: number;
    membership_savings: number;
    total_savings: number;
    savings_percentage: string;
  };
  points_summary: {
    earned: number;
    available: number;
    expiring_date: string;
  };
  summary: {
    total_items: number;
  };
  return_policy: {
    return_window_days: number;
    proof_of_purchase_required: boolean;
  };
}

// Function to parse the GPT-4o-mini response into structured JSON
function parseReceiptText(text: string): ReceiptJSON {
  console.log("Parsing receipt text to JSON format");
  console.log("Raw GPT-4o-mini response:", text);
  
  // Initialize the receipt JSON with default values
  const receiptJSON: ReceiptJSON = {
    store_information: {
      name: "",
      address: "",
      phone_number: ""
    },
    purchase_details: {
      date: "",
      time: ""
    },
    items: [],
    taxes: [],
    financial_summary: {
      subtotal: 0,
      total_discounts: 0,
      net_sales: 0,
      total_taxes: 0,
      total_amount: 0,
      change_given: 0
    },
    payment_information: {
      method: ""
    },
    savings_summary: {
      store_savings: 0,
      membership_savings: 0,
      total_savings: 0,
      savings_percentage: "0%"
    },
    points_summary: {
      earned: 0,
      available: 0,
      expiring_date: ""
    },
    summary: {
      total_items: 0
    },
    return_policy: {
      return_window_days: 0,
      proof_of_purchase_required: false
    }
  };

  try {
    // Simple direct extraction approach - extract all lines with key-value pairs
    const lines = text.split('\n');
    let currentSection = '';
    const itemsList: Array<string> = [];
    const taxesList: Array<string> = [];
    
    // First pass - extract simple key-value pairs
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and section headers
      if (!trimmedLine || trimmedLine.startsWith('###') || trimmedLine.startsWith('#')) {
        // Check if this is a section header
        if (trimmedLine.includes('Store Information') || trimmedLine.includes('Store Details')) {
          currentSection = 'store';
        } else if (trimmedLine.includes('Purchase Details') || trimmedLine.includes('Date')) {
          currentSection = 'purchase';
        } else if (trimmedLine.includes('Items') || trimmedLine.includes('Purchased')) {
          currentSection = 'items';
        } else if (trimmedLine.includes('Tax')) {
          currentSection = 'tax';
        } else if (trimmedLine.includes('Financial') || trimmedLine.includes('Summary')) {
          currentSection = 'financial';
        } else if (trimmedLine.includes('Payment')) {
          currentSection = 'payment';
        } else if (trimmedLine.includes('Savings')) {
          currentSection = 'savings';
        } else if (trimmedLine.includes('Points') || trimmedLine.includes('Rewards')) {
          currentSection = 'points';
        } else if (trimmedLine.includes('Return')) {
          currentSection = 'return';
        }
        continue;
      }
      
      // Check for key-value pairs (with or without formatting)
      const keyValueMatch = trimmedLine.match(/(?:\*\*)?([^:]+)(?:\*\*)?:\s+(.*?)(?:\s{2,}|\*\*|$)/);
      if (keyValueMatch) {
        const key = keyValueMatch[1].trim();
        const value = keyValueMatch[2].trim();
        
        // Store information
        if (key === 'Store Name' || key === 'Store') {
          receiptJSON.store_information.name = value;
        } else if (key === 'Address') {
          receiptJSON.store_information.address = value;
        } else if (key === 'Phone Number' || key === 'Phone') {
          receiptJSON.store_information.phone_number = value;
        }
        // Purchase details
        else if (key === 'Purchase Date' || key === 'Date') {
          receiptJSON.purchase_details.date = value;
        } else if (key === 'Time') {
          receiptJSON.purchase_details.time = value;
        }
        // Financial summary
        else if (key === 'Subtotal') {
          const amount = parseFloat(value.replace(/[^0-9.]/g, ''));
          if (!isNaN(amount)) receiptJSON.financial_summary.subtotal = amount;
        } else if (key === 'Total Discounts' || key === 'Discounts') {
          const amount = parseFloat(value.replace(/[^0-9.]/g, ''));
          if (!isNaN(amount)) receiptJSON.financial_summary.total_discounts = amount;
        } else if (key === 'Net Sales') {
          const amount = parseFloat(value.replace(/[^0-9.]/g, ''));
          if (!isNaN(amount)) receiptJSON.financial_summary.net_sales = amount;
        } else if (key === 'Total Taxes' || key === 'Tax Total') {
          const amount = parseFloat(value.replace(/[^0-9.]/g, ''));
          if (!isNaN(amount)) receiptJSON.financial_summary.total_taxes = amount;
        } else if (key === 'Total' || key === 'Total Amount') {
          const amount = parseFloat(value.replace(/[^0-9.]/g, ''));
          if (!isNaN(amount)) receiptJSON.financial_summary.total_amount = amount;
        } else if (key === 'Change' || key === 'Change Given') {
          const amount = parseFloat(value.replace(/[^0-9.]/g, ''));
          if (!isNaN(amount)) receiptJSON.financial_summary.change_given = amount;
        }
        // Payment information
        else if (key === 'Payment Method' || key === 'Method') {
          receiptJSON.payment_information.method = value;
        }
        // Savings information
        else if (key === 'Store Savings') {
          const amount = parseFloat(value.replace(/[^0-9.]/g, ''));
          if (!isNaN(amount)) receiptJSON.savings_summary.store_savings = amount;
        } else if (key === 'Membership Savings') {
          const amount = parseFloat(value.replace(/[^0-9.]/g, ''));
          if (!isNaN(amount)) receiptJSON.savings_summary.membership_savings = amount;
        } else if (key === 'Total Savings') {
          const amount = parseFloat(value.replace(/[^0-9.]/g, ''));
          if (!isNaN(amount)) receiptJSON.savings_summary.total_savings = amount;
        } else if (key === 'Savings Percentage' || key === 'You Saved') {
          receiptJSON.savings_summary.savings_percentage = value.includes('%') ? value : value + '%';
        }
        // Points information
        else if (key === 'Points Earned' || key === 'Earned') {
          const points = parseInt(value.replace(/[^0-9]/g, ''));
          if (!isNaN(points)) receiptJSON.points_summary.earned = points;
        } else if (key === 'Points Available' || key === 'Available') {
          const points = parseInt(value.replace(/[^0-9]/g, ''));
          if (!isNaN(points)) receiptJSON.points_summary.available = points;
        } else if (key === 'Points Expiring' || key === 'Expiring') {
          receiptJSON.points_summary.expiring_date = value;
        }
        // Return policy
        else if (key === 'Return Window' || key.includes('Return within')) {
          const days = parseInt(value.replace(/[^0-9]/g, ''));
          if (!isNaN(days)) receiptJSON.return_policy.return_window_days = days;
        } else if (key === 'Receipt Required' || key === 'Proof of Purchase Required') {
          receiptJSON.return_policy.proof_of_purchase_required = 
            value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
        }
      }
      
      // Collect items for later processing
      if (currentSection === 'items' && !trimmedLine.includes('Purchased Items') && !trimmedLine.includes('Items:')) {
        // Check if line contains a price
        const priceMatch = trimmedLine.match(/\$?([\d,.]+)(?:\s*(?:each|ea|total))?$/);
        if (priceMatch) {
          itemsList.push(trimmedLine);
        }
      }
      
      // Collect taxes for later processing
      if (currentSection === 'tax' && !trimmedLine.includes('Tax Information') && !trimmedLine.includes('Tax:')) {
        // Check if line contains a price
        const priceMatch = trimmedLine.match(/\$?([\d,.]+)$/);
        if (priceMatch) {
          taxesList.push(trimmedLine);
        }
      }
    }
    
    // Process collected items
    for (const itemLine of itemsList) {
      // Try to extract price
      const priceMatch = itemLine.match(/\$?([\d,.]+)(?:\s*(?:each|ea|total))?$/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(/,/g, ''));
        const itemText = itemLine.substring(0, itemLine.indexOf(priceMatch[0])).trim();
        
        // Check for item number prefix (e.g., "1. ")
        const itemNumberMatch = itemText.match(/^(\d+)\.\s+(.+)$/);
        const cleanItemText = itemNumberMatch ? itemNumberMatch[2] : itemText;
        
        // Check for quantity
        const quantityMatch = cleanItemText.match(/^(\d+)\s*x\s*(.+)$/i);
        const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
        const itemName = quantityMatch ? quantityMatch[2].trim() : cleanItemText;
        
        receiptJSON.items.push({
          name: itemName,
          price: price,
          quantity: quantity,
          regular_price: price,
          discounts: [],
          final_price: price * quantity
        });
      }
    }
    
    // Process collected taxes
    for (const taxLine of taxesList) {
      // Try to extract amount
      const amountMatch = taxLine.match(/\$?([\d,.]+)$/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        const taxText = taxLine.substring(0, taxLine.indexOf(amountMatch[0])).trim();
        
        // Try to extract rate
        const rateMatch = taxText.match(/(\d+(?:\.\d+)?)%/);
        const rate = rateMatch ? rateMatch[0] : "0%";
        
        receiptJSON.taxes.push({
          category: taxText,
          rate: rate,
          amount: amount
        });
      }
    }
    
    // Update total items count
    receiptJSON.summary.total_items = receiptJSON.items.length;
    
    // If we still don't have enough data, fall back to the more complex regex approach
    if (receiptJSON.items.length === 0 || 
        (!receiptJSON.store_information.name && !receiptJSON.financial_summary.total_amount)) {
      // ... existing extraction code ...
    }
    
  } catch (error) {
    console.error("Error parsing receipt text:", error);
    console.error("Failed to parse text:", text);
  }
  
  // Log the final parsed JSON for debugging
  console.log("Parsed receipt JSON:", JSON.stringify(receiptJSON, null, 2));
  return receiptJSON;
}

export async function POST(request: Request) {
  try {
    console.log('Received request to analyze receipt');
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      console.error('No image file provided');
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.error('File too large:', file.size);
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    console.log('Processing file:', file.name, file.type, file.size);

    // Convert the file to base64 directly without preprocessing
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    console.log('Sending request to OpenAI API');
    
    try {
      // Analyze the image using GPT-4o-mini
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this receipt image and extract the information into the following JSON structure:

{
  "store_information": {
    "name": "Store name",
    "address": "Store address",
    "phone_number": "Store phone number"
  },
  "purchase_details": {
    "date": "Purchase date",
    "time": "Purchase time"
  },
  "items": [
    {
      "name": "Item name",
      "price": 0.00,
      "quantity": 1,
      "regular_price": 0.00,
      "discounts": [
        {
          "type": "Discount type",
          "amount": 0.00
        }
      ],
      "final_price": 0.00
    }
  ],
  "taxes": [
    {
      "category": "Tax category",
      "rate": "Tax rate (e.g., '7%')",
      "amount": 0.00
    }
  ],
  "financial_summary": {
    "subtotal": 0.00,
    "total_discounts": 0.00,
    "net_sales": 0.00,
    "total_taxes": 0.00,
    "total_amount": 0.00,
    "change_given": 0.00
  },
  "payment_information": {
    "method": "Payment method"
  },
  "savings_summary": {
    "store_savings": 0.00,
    "membership_savings": 0.00,
    "total_savings": 0.00,
    "savings_percentage": "0%"
  },
  "points_summary": {
    "earned": 0,
    "available": 0,
    "expiring_date": "Expiration date"
  },
  "summary": {
    "total_items": 0
  },
  "return_policy": {
    "return_window_days": 0,
    "proof_of_purchase_required": false
  }
}

Important instructions:
1. Return ONLY the JSON structure with the extracted data, nothing else.
2. Use null for any fields where information is not available in the receipt.
3. For numerical values, use numbers without currency symbols or commas (e.g., 10.99 not $10.99).
4. For percentages, include the % symbol (e.g., "7%").
5. For arrays (items, taxes, discounts), include only the elements that are present in the receipt.
6. If you can't read part of the receipt clearly, make your best guess and include it.
7. Calculate the total_items count based on the number of items extracted.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 2048,
        temperature: 0.5,
        response_format: { type: "json_object" }
      });

      console.log('Received response from OpenAI');
      
      const messageContent = response.choices[0].message.content;
      if (!messageContent) {
        console.error('No response content from OpenAI');
        throw new Error('No response content from OpenAI');
      }

      console.log('Raw response from GPT-4o-mini:');
      console.log('-----------------------------------');
      console.log(messageContent);
      console.log('-----------------------------------');
      
      try {
        // Parse the JSON response
        const parsedReceipt = JSON.parse(messageContent);
        
        // Return both the raw text and structured JSON
        console.log('Sending response with analysis and parsed JSON');
        return NextResponse.json({
          analysis: messageContent,
          receipt_json: parsedReceipt
        });
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        
        // Fallback to the text parsing approach
        const parsedReceipt = parseReceiptText(messageContent);
        
        return NextResponse.json({
          analysis: messageContent,
          receipt_json: parsedReceipt,
          parse_error: parseError instanceof Error ? parseError.message : 'Error parsing JSON response'
        });
      }
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      return NextResponse.json(
        { error: openaiError instanceof Error ? openaiError.message : 'Error calling OpenAI API' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error processing receipt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error processing receipt' },
      { status: 500 }
    );
  }
} 