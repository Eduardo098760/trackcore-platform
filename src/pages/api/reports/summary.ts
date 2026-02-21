import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { deviceIds, from, to } = req.body;

    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ message: 'deviceIds is required' });
    }

    if (!from || !to) {
      return res.status(400).json({ message: 'from and to dates are required' });
    }

    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;

    const reports = await Promise.all(
      deviceIds.map(async (deviceId) => {
        try {
          // Buscar device via proxy (preserva sessão/cookie)
          const deviceResponse = await fetch(
            `${baseUrl}/api/traccar/devices/${deviceId}`,
            {
              headers: {
                'Accept': 'application/json',
                'Cookie': req.headers.cookie || '',
              },
            }
          );

          if (!deviceResponse.ok) {
            console.error(`[Summary API] Erro ao buscar device ${deviceId}: ${deviceResponse.status}`);
            return null;
          }

          const device = await deviceResponse.json();

          // Buscar summary via proxy
          const summaryResponse = await fetch(
            `${baseUrl}/api/traccar/reports/summary?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
            {
              headers: {
                'Accept': 'application/json',
                'Cookie': req.headers.cookie || '',
              },
            }
          );

          if (!summaryResponse.ok) {
            console.error(`[Summary API] Erro ao buscar summary para device ${deviceId}: ${summaryResponse.status}`);
            return null;
          }

          let summaries: any[] = [];
          try {
            summaries = await summaryResponse.json();
            if (!Array.isArray(summaries)) summaries = [];
          } catch (e: any) {
            console.error('[Summary API] Erro ao parsear JSON:', e?.message || e);
            summaries = [];
          }

          const summary = summaries[0] || {};

          return {
            deviceId,
            deviceName: device.name,
            distance: summary.distance || 0,
            averageSpeed: summary.averageSpeed || 0,
            maxSpeed: summary.maxSpeed || 0,
            engineHours: summary.engineHours || 0,
            spentFuel: summary.spentFuel || 0,
          };
        } catch (error: any) {
          console.error(`[Summary API] Erro processando device ${deviceId}:`, error.message);
          return null;
        }
      })
    );

    const validReports = reports.filter((r) => r !== null);
    return res.status(200).json(validReports);
  } catch (error) {
    console.error('[Summary API] Erro fatal:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
