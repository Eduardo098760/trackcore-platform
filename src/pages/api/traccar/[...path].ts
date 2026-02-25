import type { NextApiRequest, NextApiResponse } from 'next';
import type { IncomingMessage } from 'http';

const TRACCAR_URL = process.env.TRACCAR_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

/**
 * Desabilita o body parser do Next.js para este proxy.
 * Assim o body raw é repassado diretamente ao Traccar sem nenhuma transformação.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Lê o body cru da request como Buffer.
 */
function getRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Simple in-memory cookie jar for tracking Traccar sessions per request context
 * In production, consider using http.CookieJar or the `tough-cookie` library
 */
const cookieJars: Map<string, string> = new Map();

function getCookieKey(req: NextApiRequest): string {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                   req.socket?.remoteAddress || 
                   'unknown';
  return clientIp;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { path = [] } = req.query as { path?: string | string[] };
    const forwardPath = Array.isArray(path) ? path.join('/') : String(path || '');

    const addApiPrefer = process.env.TRACCAR_ADD_API !== 'false';
    const base = TRACCAR_URL.replace(/\/$/, '');
    const query = req.url?.split('?')[1];

    const makeUrl = (useApi: boolean) => {
      const targetPath = useApi ? (forwardPath.startsWith('api') ? forwardPath : `api/${forwardPath}`) : forwardPath;
      return query ? `${base}/${targetPath}?${query}` : `${base}/${targetPath}`;
    };

    const candidates = addApiPrefer ? [true, false] : [false, true];

    // Lê o body cru UMA vez (stream só pode ser lido uma vez)
    const isBodyMethod = !['GET', 'HEAD'].includes((req.method || '').toUpperCase());
    const rawBody = isBodyMethod ? await getRawBody(req) : undefined;

    const headers: Record<string, string> = {};

    // Repassa cookies do browser
    if (req.headers.cookie) {
      headers['cookie'] = String(req.headers.cookie);
    }

    // Também inclui cookies do jar interno
    const cookieKey = getCookieKey(req);
    if (cookieJars.has(cookieKey)) {
      const jarCookies = cookieJars.get(cookieKey)!;
      headers['cookie'] = headers['cookie'] ? `${headers['cookie']}; ${jarCookies}` : jarCookies;
    }

    // Repassa content-type e content-length originais
    if (req.headers['content-type']) headers['content-type'] = String(req.headers['content-type']);
    if (rawBody && rawBody.length > 0) headers['content-length'] = String(rawBody.length);

    const fetchOptionsBase: RequestInit = {
      method: req.method,
      headers,
      body: rawBody && rawBody.length > 0 ? rawBody : undefined,
    };

    let lastError: any = null;

    for (const useApi of candidates) {
      const targetUrl = makeUrl(useApi);
      try {
        console.log('[traccar-proxy] ->', req.method, targetUrl, rawBody ? `body=${rawBody.length}b` : '');
        const upstream = await fetch(targetUrl, fetchOptionsBase);
        const contentType = upstream.headers.get('content-type') || 'application/json';
        const text = await upstream.text();

        if (upstream.status >= 400) {
          console.warn('[traccar-proxy] upstream error', upstream.status, 'for', targetUrl);
          console.warn('[traccar-proxy] body:', text.slice(0, 500));
          lastError = { status: upstream.status, statusText: upstream.statusText, body: text };
          continue;
        }

        res.status(upstream.status);
        res.setHeader('content-type', contentType);

        // Repassa todos os set-cookie para preservar a sessão
        const setCookieHeaders = upstream.headers.getSetCookie?.() || [];
        if (setCookieHeaders.length > 0) {
          console.log('[traccar-proxy] forwarding', setCookieHeaders.length, 'set-cookie(s)');
          res.setHeader('set-cookie', setCookieHeaders);
          cookieJars.set(cookieKey, setCookieHeaders.join('; '));
        }

        return res.send(text);
      } catch (err: any) {
        console.error('[traccar-proxy] fetch error for', targetUrl, err?.message || err);
        lastError = err;
      }
    }

    console.error('[traccar-proxy] all attempts failed', lastError);
    if (lastError?.status) {
      res.status(lastError.status).json({ error: lastError.statusText || 'Upstream error', details: lastError.body });
    } else {
      res.status(502).json({ error: 'Bad Gateway', details: lastError?.message || String(lastError) });
    }
  } catch (error: any) {
    console.error('[traccar-proxy] handler error:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Proxy error' });
  }
}
