/**
 * Explorer Scan API Route
 *
 * Uses GPT-4o vision to extract contact information from business card images.
 * Returns extracted text data only — LinkedIn discovery is handled by the page
 * via the /api/explorer/discover endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api/auth-guard';

interface ScanRequest {
  images: { base64: string; mimeType: string }[];
}

interface ExtractedData {
  name?: string;
  company?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedInUrl?: string;
  twitterUrl?: string;
  location?: string;
  additionalInfo?: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body: ScanRequest = await request.json();

    if (!body.images || body.images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      );
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Process all images with GPT-4o vision
    const extractedDataList: ExtractedData[] = [];

    for (const image of body.images) {
      try {
        const extracted = await extractFromImageWithGPT(image.base64, image.mimeType, openaiKey);
        if (extracted) {
          extractedDataList.push(extracted);
        }
      } catch (error) {
        console.error('Failed to extract from image:', error);
      }
    }

    if (extractedDataList.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Could not extract any data from the images',
      });
    }

    // Merge extracted data from all images
    const mergedData = mergeExtractedData(extractedDataList);

    return NextResponse.json({
      success: true,
      extractedData: mergedData,
    });

  } catch (error: any) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Extract contact information from an image using GPT-4o vision
 */
async function extractFromImageWithGPT(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<ExtractedData | null> {
  const systemPrompt = `You are an expert at reading business cards and extracting contact information.
Analyze the image and extract ALL visible information.

Return ONLY a valid JSON object with these fields (omit fields that are not visible):
{
  "name": "Full name of the person",
  "company": "Company or organization name",
  "jobTitle": "Job title or position",
  "email": "Email address",
  "phone": "Phone number(s)",
  "website": "Website URL",
  "linkedInUrl": "LinkedIn profile URL if visible",
  "twitterUrl": "Twitter/X handle or URL if visible",
  "location": "Address or location",
  "additionalInfo": "Any other relevant information (certifications, taglines, etc.)"
}

IMPORTANT:
- Extract the EXACT text as shown on the card
- For names, include any titles (Dr., Eng., etc.)
- For URLs, include the full URL if visible
- If a field is not visible or unclear, omit it from the JSON
- Return ONLY the JSON, no explanation`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all contact information from this business card image:',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('GPT-4o vision API error:', response.status, error);
    throw new Error(`GPT-4o API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    return null;
  }

  try {
    // Remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return JSON.parse(cleanedContent);
  } catch (error) {
    console.error('Failed to parse GPT response:', content);
    return null;
  }
}

/**
 * Merge extracted data from multiple images
 */
function mergeExtractedData(dataList: ExtractedData[]): ExtractedData {
  const merged: ExtractedData = {};

  for (const data of dataList) {
    // Use the first non-empty value for each field
    if (data.name && !merged.name) merged.name = data.name;
    if (data.company && !merged.company) merged.company = data.company;
    if (data.jobTitle && !merged.jobTitle) merged.jobTitle = data.jobTitle;
    if (data.email && !merged.email) merged.email = data.email;
    if (data.phone && !merged.phone) merged.phone = data.phone;
    if (data.website && !merged.website) merged.website = data.website;
    if (data.linkedInUrl && !merged.linkedInUrl) merged.linkedInUrl = data.linkedInUrl;
    if (data.twitterUrl && !merged.twitterUrl) merged.twitterUrl = data.twitterUrl;
    if (data.location && !merged.location) merged.location = data.location;

    // Concatenate additional info
    if (data.additionalInfo) {
      merged.additionalInfo = merged.additionalInfo
        ? `${merged.additionalInfo}; ${data.additionalInfo}`
        : data.additionalInfo;
    }
  }

  return merged;
}
