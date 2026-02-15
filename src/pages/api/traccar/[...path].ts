import type { NextApiRequest, NextApiResponse } from 'next';

const TRACCAR_URL = process.env.TRACCAR_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

/**
 * Simple in-memory cookie jar for tracking Traccar sessions per request context
 * In production, consider using http.CookieJar or the `tough-cookie` library
 */
const cookieJars: Map<string, string> = new Map();

function getCookieKey(req: NextApiRequest): string {
  // Use request context (e.g., user IP or session ID) as key
  // For now, use a simple approach: client IP
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                   req.socket?.remoteAddress || 
                   'unknown';
  return clientIp;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { path = [] } = req.query as { path?: string | string[] };
    const forwardPath = Array.isArray(path) ? path.join('/') : String(path || '');

    // Decide whether to prepend `api/` when forwarding.
    // Some Traccar installs expose endpoints under the base URL; the proxy will
    // try both variants (with and without `api/`) and return the first successful
    // response. Set TRACCAR_ADD_API=false to try the variant without `api/` first.
    const addApiPrefer = process.env.TRACCAR_ADD_API !== 'false';

    const base = TRACCAR_URL.replace(/\/$/, '');
    const query = req.url?.split('?')[1];

    const makeUrl = (useApi: boolean) => {
      const targetPath = useApi ? (forwardPath.startsWith('api') ? forwardPath : `api/${forwardPath}`) : forwardPath;
      return query ? `${base}/${targetPath}?${query}` : `${base}/${targetPath}`;
    };

    const candidates = addApiPrefer ? [true, false] : [false, true];

    const headers: Record<string, string> = {};
    
    // Forward incoming cookies from browser
    if (req.headers.cookie) {
      headers['cookie'] = String(req.headers.cookie);
    }
    
    // Also include cookies from our cookie jar (for cross-request persistence)
    const cookieKey = getCookieKey(req);
    if (cookieJars.has(cookieKey)) {
      const jarCookies = cookieJars.get(cookieKey)!;
      headers['cookie'] = headers['cookie'] ? `${headers['cookie']}; ${jarCookies}` : jarCookies;
    }
    
    if (req.headers['content-type']) headers['content-type'] = String(req.headers['content-type']);

    const fetchOptionsBase: RequestInit = {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes((req.method || '').toUpperCase()) ? undefined : JSON.stringify(req.body),
    };

    let lastError: any = null;

    for (const useApi of candidates) {
      const targetUrl = makeUrl(useApi);
      try {
        console.log('[traccar-proxy] forwarding ->', targetUrl, 'method=', req.method);
        const upstream = await fetch(targetUrl, fetchOptionsBase);
        const contentType = upstream.headers.get('content-type') || 'application/json';
        const text = await upstream.text();

        if (upstream.status >= 400) {
          console.warn('[traccar-proxy] upstream error', upstream.status, upstream.statusText, 'for', targetUrl);
          console.warn('[traccar-proxy] response body (truncated):', text.slice(0, 2000));
          // try next candidate
          lastError = { status: upstream.status, statusText: upstream.statusText, body: text };
          continue;
        }

        // Forward relevant headers
        res.status(upstream.status);
        res.setHeader('content-type', contentType);
        
        // ⚠️ IMPORTANT: Forward ALL set-cookie headers to preserve session
        const setCookieHeaders = upstream.headers.getSetCookie?.() || [];
        if (setCookieHeaders.length > 0) {
          console.log('[traccar-proxy] forwarding', setCookieHeaders.length, 'set-cookie header(s)');
          res.setHeader('set-cookie', setCookieHeaders);
          
          // ALSO store cookies in our jar for cross-request persistence
          const cookieKey = getCookieKey(req);
          cookieJars.set(cookieKey, setCookieHeaders.join('; '));
          console.log('[traccar-proxy] stored cookies in jar for', cookieKey);
        }

        return res.send(text);
      } catch (err: any) {
        console.error('[traccar-proxy] fetch error for', targetUrl, err?.message || err);
        lastError = err;
        // try next candidate
      }
    }

    // If we reach here, all candidates failed
    console.error('[traccar-proxy] all forwarding attempts failed', lastError);
    if (lastError && lastError.status) {
      res.status(lastError.status).json({ error: lastError.statusText || 'Upstream error', details: lastError.body });
    } else {
      res.status(502).json({ error: 'Bad Gateway', details: lastError?.message || String(lastError) });
    }
  } catch (error: any) {
    console.error('Proxy error to Traccar:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Proxy error' });
  }
}
