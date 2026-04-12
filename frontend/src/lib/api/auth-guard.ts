/**
 * API Route Authentication Guard
 *
 * Verifies JWT tokens on Next.js API routes to prevent unauthenticated access
 * to server-side API keys (OpenAI, ScrapIn, etc.).
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/**
 * Verify the request has a valid JWT token by checking with the backend.
 * Returns the user ID if valid, or a 401 NextResponse if not.
 */
export async function verifyApiAuth(
  request: NextRequest
): Promise<{ userId: string } | NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    // Verify token by calling backend /auth/me
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const data = await response.json();
    return { userId: data.data?.id || data.data?.userId };
  } catch {
    return NextResponse.json(
      { error: 'Authentication service unavailable' },
      { status: 503 }
    );
  }
}
