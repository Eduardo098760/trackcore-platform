import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * POST /api/reports/[reportType]/excel
 * Proxies to Traccar's native Excel export (Accept: application/vnd.ms-excel).
 * Supports reportType: trips | stops | events | summary
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { reportType } = req.query as { reportType: string };
  const { deviceIds, from, to } = req.body;

  if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return res.status(400).json({ message: 'deviceIds is required' });
  }
  if (!from || !to) {
    return res.status(400).json({ message: 'from and to dates are required' });
  }

  const traccarType = reportType === 'trips' ? 'trips' : reportType;

  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || 'localhost:3000';
  const baseUrl = `${proto}://${host}`;

  // Montar query string com múltiplos deviceId
  const deviceParams = deviceIds.map((id: number) => `deviceId=${id}`).join('&');
  const traccarUrl = `${baseUrl}/api/traccar/reports/${traccarType}?${deviceParams}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  try {
    const upstream = await fetch(traccarUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.ms-excel',
        'Cookie': req.headers.cookie || '',
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      console.error(`[Excel Export] Traccar error ${upstream.status}:`, text);
      return res.status(upstream.status).json({ message: 'Failed to export Excel from Traccar', detail: text });
    }

    const contentType = upstream.headers.get('content-type') || 'application/vnd.ms-excel';
    const buffer = await upstream.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="relatorio-${traccarType}-${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('[Excel Export] Erro fatal:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
