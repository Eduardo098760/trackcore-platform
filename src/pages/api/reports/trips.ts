import type { NextApiRequest, NextApiResponse } from 'next';
import { reverseGeocode } from '@/lib/geocoding';

const TRACCAR_URL = process.env.TRACCAR_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Trips API] ===== NOVA REQUISIÇÃO =====');
  console.log('[Trips API] Method:', req.method);
  console.log('[Trips API] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[Trips API] Body:', JSON.stringify(req.body, null, 2));
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { deviceIds, from, to } = req.body;

    // Converter `from` e `to` para timestamps (ms) se vierem como ISO strings
    const parseTime = (v: any) => {
      if (!v) return null;
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const asNum = Number(v);
        if (!Number.isNaN(asNum)) return asNum;
        const parsed = Date.parse(v);
        return Number.isNaN(parsed) ? null : parsed;
      }
      return null;
    };

    const fromMs = parseTime(from);
    const toMs = parseTime(to);

    console.log('[Trips API] fromMs:', fromMs, 'toMs:', toMs);

    console.log('[Trips API] Requisição recebida:', { deviceIds, from, to });
    console.log('[Trips API] TRACCAR_URL:', TRACCAR_URL);
    console.log('[Trips API] Cookie:', req.headers.cookie || 'NENHUM COOKIE');

    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      console.error('[Trips API] deviceIds inválido');
      return res.status(400).json({ message: 'deviceIds is required' });
    }

    if (!fromMs || !toMs) {
      console.error('[Trips API] Datas inválidas');
      return res.status(400).json({ message: 'from and to dates are required and must be valid' });
    }

    const reports = await Promise.all(
      deviceIds.map(async (deviceId) => {
        try {
          // Buscar informações do dispositivo
          console.log(`[Trips API] Buscando device ${deviceId}...`);
          // Preferir o proxy interno para preservar cookies/sessão
          const proto = req.headers['x-forwarded-proto'] || 'http';
          const host = req.headers.host || 'localhost:3000';
          const proxyBase = `${proto}://${host}/api/traccar`;
          const deviceUrl = `${proxyBase}/devices/${deviceId}`;
          console.log(`[Trips API] Device URL: ${deviceUrl}`);

          const deviceResponse = await fetch(deviceUrl, {
            headers: {
              'Content-Type': 'application/json',
              'Cookie': req.headers.cookie || '',
              'Accept': 'application/json',
            },
          });

          console.log(`[Trips API] Device response status: ${deviceResponse.status}`);

          if (!deviceResponse.ok) {
            const errorText = await deviceResponse.text();
            console.error(`[Trips API] Failed to fetch device ${deviceId}: ${errorText}`);
            return null;
          }

          const device = await deviceResponse.json();
          console.log(`[Trips API] Device encontrado: ${device.name}`);

          // Buscar trips do Traccar via proxy — usar `combined` que a UI usa e retorna JSON
          const fromIso = typeof from === 'string' ? from : (fromMs ? new Date(fromMs).toISOString() : null);
          const toIso = typeof to === 'string' ? to : (toMs ? new Date(toMs).toISOString() : null);
          const useFrom = fromIso || fromMs;
          const useTo = toIso || toMs;
          const tripsUrl = `${proxyBase}/reports/trips?deviceId=${deviceId}&from=${encodeURIComponent(useFrom)}&to=${encodeURIComponent(useTo)}`;
          console.log(`[Trips API] Trips URL: ${tripsUrl}`);

          const tripsResponse = await fetch(tripsUrl, {
            headers: {
              'Content-Type': 'application/json',
              'Cookie': req.headers.cookie || '',
              'Accept': 'application/json',
            },
          });

          console.log(`[Trips API] Trips response status: ${tripsResponse.status}`);

          if (!tripsResponse.ok) {
            const errorText = await tripsResponse.text();
            console.error(`[Trips API] Failed to fetch trips for device ${deviceId}: ${errorText}`);
            return null;
          }

          let raw: any = null;
          try {
            raw = await tripsResponse.json();
          } catch (e: any) {
            console.error('[Trips API] Erro parseando JSON:', e?.message || e);
            raw = null;
          }

          const normalizeTrips = (input: any): any[] => {
            if (!input) return [];
            if (Array.isArray(input)) return input;
            if (typeof input === 'object') {
              const candidates = input.trips || input.rows || input.data || input.items || input.report || input.events;
              if (Array.isArray(candidates)) return candidates;
              if (input.devices && typeof input.devices === 'object') {
                const devKey = Object.keys(input.devices)[0];
                const dev = input.devices[devKey];
                if (dev) return normalizeTrips(dev.trips || dev.rows || dev.data);
              }
              const numericKey = Object.keys(input).find(k => /^\d+$/.test(k));
              if (numericKey && Array.isArray(input[numericKey])) return input[numericKey];
            }
            return [];
          };

          const trips = normalizeTrips(raw || []);
          console.log(`[Trips API] Trips retornados para device ${deviceId} (normalizadas):`, trips.length);

          // Calcular estatísticas
          const totalDistance = trips.reduce((sum: number, trip: any) => sum + (trip.distance || 0), 0);
          const totalDuration = trips.reduce((sum: number, trip: any) => sum + (trip.duration || 0), 0);
          const averageSpeed = totalDistance > 0 && totalDuration > 0 
            ? (totalDistance / 1000) / (totalDuration / 3600000) 
            : 0;

          const geocodeAddr = async (lat: any, lon: any, fallback: any): Promise<string> => {
            if (fallback && typeof fallback === 'string' && fallback.trim()) return fallback;
            const latN = parseFloat(lat);
            const lonN = parseFloat(lon);
            if (!isNaN(latN) && !isNaN(lonN) && (latN !== 0 || lonN !== 0)) {
              try { return await reverseGeocode(latN, lonN); } catch { return `${latN.toFixed(5)}, ${lonN.toFixed(5)}`; }
            }
            return 'Endereço não disponível';
          };

          // Formatar trips
          const formattedTrips = await Promise.all(
            trips.map(async (trip: any, index: number) => {
              const [startAddress, endAddress] = await Promise.all([
                geocodeAddr(trip.startLat ?? trip.startLatitude, trip.startLon ?? trip.startLongitude, trip.startAddress),
                geocodeAddr(trip.endLat ?? trip.endLatitude, trip.endLon ?? trip.endLongitude, trip.endAddress),
              ]);
              return {
                id: `${deviceId}-${index}`,
                deviceId,
                startTime: trip.startTime,
                endTime: trip.endTime,
                startAddress,
                endAddress,
                distance: trip.distance || 0,
                duration: Math.floor((trip.duration || 0) / 1000),
                maxSpeed: trip.maxSpeed || 0,
                averageSpeed: trip.averageSpeed || 0,
                startOdometer: trip.startOdometer || 0,
                endOdometer: trip.endOdometer || 0,
              };
            })
          );

          return {
            deviceId: deviceId,
            deviceName: device.name,
            trips: formattedTrips,
            totalDistance: totalDistance,
            totalDuration: Math.floor(totalDuration / 1000), // converter para segundos
            averageSpeed: averageSpeed,
          };
        } catch (error) {
          console.error(`Error processing device ${deviceId}:`, error);
          return null;
        }
      })
    );

    // Filtrar resultados nulos
    const validReports = reports.filter((report) => report !== null);

    console.log('[Trips API] Relatórios gerados:', validReports.length);
    console.log('[Trips API] Dados:', JSON.stringify(validReports, null, 2));

    return res.status(200).json(validReports);
  } catch (error: any) {
    console.error('[Trips API] ===== ERRO FATAL =====');
    console.error('[Trips API] Error:', error);
    console.error('[Trips API] Error message:', error.message);
    console.error('[Trips API] Error stack:', error.stack);
    console.error('[Trips API] ========================');
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}
