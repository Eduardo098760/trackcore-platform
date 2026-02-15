import type { NextApiRequest, NextApiResponse } from 'next';

const TRACCAR_URL = process.env.TRACCAR_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

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

    const results: Array<{ url: string; status?: number; statusText?: string; body?: string; error?: string }> = [];

    for (const useApi of candidates) {
      const targetUrl = makeUrl(useApi);
      try {
        const upstream = await fetch(targetUrl, { method: req.method });
        const text = await upstream.text();
        results.push({ url: targetUrl, status: upstream.status, statusText: upstream.statusText, body: text.slice(0, 2000) });
        if (upstream.status < 400) {
          return res.status(200).json({ ok: true, tried: results });
        }
      } catch (err: any) {
        results.push({ url: targetUrl, error: err?.message || String(err) });
      }
    }

    return res.status(502).json({ ok: false, tried: results });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'debug error' });
  }
}
