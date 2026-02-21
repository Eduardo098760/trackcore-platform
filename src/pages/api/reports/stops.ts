import type { NextApiRequest, NextApiResponse } from 'next';
import { reverseGeocode } from '@/lib/geocoding';

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
            console.error(`[Stops API] Erro ao buscar device ${deviceId}: ${deviceResponse.status}`);
            return null;
          }

          const device = await deviceResponse.json();

          // Buscar stops via proxy
          const stopsResponse = await fetch(
            `${baseUrl}/api/traccar/reports/stops?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
            {
              headers: {
                'Accept': 'application/json',
                'Cookie': req.headers.cookie || '',
              },
            }
          );

          if (!stopsResponse.ok) {
            console.error(`[Stops API] Erro ao buscar stops para device ${deviceId}: ${stopsResponse.status}`);
            return null;
          }

          let stops: any[] = [];
          try {
            stops = await stopsResponse.json();
            if (!Array.isArray(stops)) stops = [];
          } catch (e: any) {
            console.error('[Stops API] Erro ao parsear JSON:', e?.message || e);
            stops = [];
          }

          const totalDuration = stops.reduce((sum: number, stop: any) => sum + (stop.duration || 0), 0);

          const formattedStops = await Promise.all(
            stops.map(async (stop: any, index: number) => {
              let address = stop.address && stop.address.trim() ? stop.address : null;
              if (!address) {
                const lat = parseFloat(stop.lat ?? stop.latitude ?? 0);
                const lon = parseFloat(stop.lon ?? stop.longitude ?? 0);
                if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
                  try { address = await reverseGeocode(lat, lon); } catch { address = `${lat.toFixed(5)}, ${lon.toFixed(5)}`; }
                } else {
                  address = 'Endereço não disponível';
                }
              }
              return {
                id: `${deviceId}-${index}`,
                deviceId,
                startTime: stop.startTime,
                endTime: stop.endTime,
                address,
                latitude: stop.lat ?? stop.latitude ?? null,
                longitude: stop.lon ?? stop.longitude ?? null,
                duration: Math.floor((stop.duration || 0) / 1000),
                engineHours: stop.engineHours || 0,
              };
            })
          );

          return {
            deviceId,
            deviceName: device.name,
            stops: formattedStops,
            totalStops: formattedStops.length,
            totalDuration: Math.floor(totalDuration / 1000), // ms → segundos
          };
        } catch (error: any) {
          console.error(`[Stops API] Erro processando device ${deviceId}:`, error.message);
          return null;
        }
      })
    );

    const validReports = reports.filter((r) => r !== null);
    return res.status(200).json(validReports);
  } catch (error) {
    console.error('[Stops API] Erro fatal:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
