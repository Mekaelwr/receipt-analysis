import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';

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

    // Convert the file to base64
    const bytes = await file.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString('base64');

    console.log('Sending request to OpenAI Vision API');
    
    // Analyze the image using GPT-4 Vision
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this receipt and return a valid JSON object. The response should start with { and end with }. Include only these fields: storeName (string), date (string), items (array of objects with name and price), subtotal (number), tax (number), total (number). Example format: {\"storeName\":\"Store Name\",\"date\":\"2024-03-04\",\"items\":[{\"name\":\"Item 1\",\"price\":10.99}],\"subtotal\":10.99,\"tax\":0.88,\"total\":11.87}. Do not include any other text, formatting, or explanation."
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
      max_tokens: 500
    });

    console.log('Received response from OpenAI');

    const messageContent = response.choices[0].message.content;
    if (!messageContent) {
      console.error('No response content from OpenAI');
      throw new Error('No response content from OpenAI');
    }

    console.log('Raw response:', messageContent);

    // Clean the response to remove any markdown formatting and extra whitespace
    const cleanContent = messageContent
      .replace(/```json\s*|\s*```/g, '') // Remove markdown code blocks
      .replace(/^\s+|\s+$/g, '') // Trim whitespace
      .replace(/^[^{]*({.*})[^}]*$/, '$1'); // Extract only the JSON object

    console.log('Cleaned content:', cleanContent);

    try {
      const analyzedData = JSON.parse(cleanContent);
      console.log('Successfully parsed receipt data:', analyzedData);
      return NextResponse.json(analyzedData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed to parse content:', cleanContent);
      throw new Error('Failed to parse receipt data as JSON');
    }

  } catch (error) {
    console.error('Error processing receipt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error processing receipt' },
      { status: 500 }
    );
  }
} 