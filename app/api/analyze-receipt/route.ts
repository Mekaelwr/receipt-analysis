import { NextResponse } from 'next/server';
import OpenAI from "openai";

// API route configuration
export const runtime = 'edge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

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
    
    // Analyze the image using GPT-4o-mini
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this receipt image in detail. I need you to extract:

1. Store name
2. Store address (if available)
3. Store phone number (if available)
4. Purchase date and time
5. All purchased items with their names and prices
6. Any tax information
7. Subtotal amount
8. Total amount

Please format your response in a clear, readable way with section headers. Be as detailed and accurate as possible. Include every item you can see on the receipt.`
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
      temperature: 0.7,
    });

    console.log('Received response from OpenAI');
    
    const messageContent = response.choices[0].message.content;
    if (!messageContent) {
      console.error('No response content from OpenAI');
      throw new Error('No response content from OpenAI');
    }

    console.log('Raw response:', messageContent);
    
    // Return just the raw text
    return NextResponse.json({
      analysis: messageContent
    });

  } catch (error) {
    console.error('Error processing receipt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error processing receipt' },
      { status: 500 }
    );
  }
} 