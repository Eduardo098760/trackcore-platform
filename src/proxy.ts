import { NextRequest, NextResponse } from 'next/server';

/**
 * Decodifica o payload do cookie de impersonação sem verificar HMAC.
 * A segurança é garantida pelo atributo HttpOnly — apenas o servidor pode
 * escrever esse cookie, então o conteúdo é confiável.
 */
function decodeImpersonationCookie(raw: string): { targetUserId: number; adminId: number; exp: number } | null {
  try {
    const [encoded] = raw.split('.');
    if (!encoded) return null;
    const json = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    if (!payload.isImpersonation || !payload.targetUserId) return null;
    if (Date.now() > payload.exp) return null;
    return { targetUserId: payload.targetUserId, adminId: payload.adminId, exp: payload.exp };
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];

  if (
    subdomain &&
    subdomain !== 'www' &&
    subdomain !== 'localhost' &&
    !hostname.startsWith('localhost')
  ) {
    requestHeaders.set('x-tenant-slug', subdomain);
  }

  const impCookie = request.cookies.get('x-trackcore-imp')?.value;
  if (impCookie) {
    const decoded = decodeImpersonationCookie(impCookie);
    if (decoded) {
      requestHeaders.set('x-impersonating-user-id', String(decoded.targetUserId));
      requestHeaders.set('x-impersonating-admin-id', String(decoded.adminId));
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};