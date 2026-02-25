import type { NextApiRequest, NextApiResponse } from 'next';

const CHUNK_HOURS = 12; // Cada requisição ao Traccar cobre no máximo 12h
const CHUNK_TIMEOUT_MS = 30_000; // 30s por chunk

async function fetchChunk(
  baseUrl: string,
  deviceId: string,
  fromIso: string,
  toIso: string,
  cookie: string,
): Promise<any[]> {
  const params = new URLSearchParams({ deviceId, from: fromIso, to: toIso });
  const url = `${baseUrl}/api/traccar/reports/route?${params}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHUNK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json', Cookie: cookie },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { deviceId, from, to } = req.body;
  if (!deviceId || !from || !to) {
    return res.status(400).json({ message: 'deviceId, from and to are required' });
  }

  const fromMs = typeof from === 'number' ? from : Date.parse(String(from));
  const toMs   = typeof to   === 'number' ? to   : Date.parse(String(to));

  if (isNaN(fromMs) || isNaN(toMs)) {
    return res.status(400).json({ message: 'Datas inválidas' });
  }

  const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  const cookie  = req.headers.cookie || '';
  const devId   = String(deviceId);

  // Divide o período em chunks de CHUNK_HOURS horas
  const chunkMs = CHUNK_HOURS * 60 * 60 * 1000;
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = fromMs;
  while (cursor < toMs) {
    const end = Math.min(cursor + chunkMs, toMs);
    chunks.push({ from: new Date(cursor).toISOString(), to: new Date(end).toISOString() });
    cursor = end;
  }

  console.log(`[positions API] deviceId=${devId} | ${chunks.length} chunk(s) de ${CHUNK_HOURS}h`);

  // Busca todos os chunks em paralelo (máx 4 simultâneos)
  const CONCURRENCY = 4;
  const allPositions: any[] = [];

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(c => fetchChunk(baseUrl, devId, c.from, c.to, cookie))
    );
    results.forEach(r => allPositions.push(...r));
  }

  // Deduplica por id e ordena por fixTime
  const seen = new Set<number>();
  const unique = allPositions.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  unique.sort((a, b) => {
    const ta = new Date(a.fixTime || a.serverTime).getTime();
    const tb = new Date(b.fixTime || b.serverTime).getTime();
    return ta - tb;
  });

  console.log(`[positions API] Total: ${unique.length} posições`);
  return res.status(200).json(unique);
}
