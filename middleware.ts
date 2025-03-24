import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Enhanced security against CVE-2025-29927
  // Check both lowercase and original case header names for maximum protection
  if (
    request.headers.has('x-middleware-subrequest') || 
    request.headers.has('X-Middleware-Subrequest')
  ) {
    console.log('Blocked request with x-middleware-subrequest header');
    return NextResponse.json(
      { error: 'Unauthorized request' },
      { status: 401 }
    );
  }
  
  return await updateSession(request)
}

// Update matcher to specifically include API routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/api/:path*',
  ],
} 