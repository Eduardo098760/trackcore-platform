import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.url;

  // Detectar tenant pelo subdomínio
  const subdomain = hostname.split('.')[0];
  
  // Se for subdomínio válido (não www, não localhost), adicionar header
  if (subdomain && 
      subdomain !== 'www' && 
      subdomain !== 'localhost' && 
      !hostname.startsWith('localhost')) {
    
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-slug', subdomain);
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
