import type { NextApiRequest, NextApiResponse } from 'next';
import { reverseGeocode } from '@/lib/geocoding';

// Usar o proxy interno que já funciona para devices
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Trips Proxy] ===== REQUISIÇÃO RECEBIDA =====');
  
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
    const fromIso = typeof from === 'string' ? from : (fromMs ? new Date(fromMs).toISOString() : null);
    const toIso = typeof to === 'string' ? to : (toMs ? new Date(toMs).toISOString() : null);

    console.log('[Trips Proxy] fromMs:', fromMs, 'toMs:', toMs, 'fromIso:', fromIso, 'toIso:', toIso);

    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ message: 'deviceIds is required' });
    }

    if (!fromMs || !toMs) {
      return res.status(400).json({ message: 'from and to dates are required and must be valid dates' });
    }

    const reports = await Promise.all(
      deviceIds.map(async (deviceId) => {
        try {
          // Usar o endpoint interno do Next.js que já funciona
          const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
          
          // Buscar device usando o proxy
          const deviceUrl = `${baseUrl}/api/traccar/devices/${deviceId}`;
          console.log(`[Trips Proxy] Buscando device: ${deviceUrl}`);
          
          const deviceResponse = await fetch(deviceUrl, {
            headers: {
              'Cookie': req.headers.cookie || '',
              'Accept': 'application/json',
            },
          });

          if (!deviceResponse.ok) {
            console.error(`[Trips Proxy] Erro ao buscar device ${deviceId}: ${deviceResponse.status}`);
            return null;
          }

          const device = await deviceResponse.json();
          console.log(`[Trips Proxy] Device encontrado: ${device.name}`);

          // Buscar trips usando o proxy. Usar endpoint `combined` que retorna JSON na UI do Traccar
          const useFrom = fromIso || fromMs;
          const useTo = toIso || toMs;
          const tripsUrl = `${baseUrl}/api/traccar/reports/trips?deviceId=${deviceId}&from=${encodeURIComponent(useFrom)}&to=${encodeURIComponent(useTo)}`;
          console.log(`[Trips Proxy] Buscando trips: ${tripsUrl}`);
          
          const tripsResponse = await fetch(tripsUrl, {
            headers: {
              'Cookie': req.headers.cookie || '',
              'Accept': 'application/json',
            },
          });

          if (!tripsResponse.ok) {
            console.error(`[Trips Proxy] Erro ao buscar trips ${deviceId}: ${tripsResponse.status}`);
            const errorText = await tripsResponse.text();
            console.error(`[Trips Proxy] Erro: ${errorText}`);
            return null;
          }

          let raw: any = null;
          try {
            raw = await tripsResponse.json();
          } catch (e: any) {
            console.error('[Trips Proxy] Falha ao parsear JSON de trips:', e?.message || e);
            raw = null;
          }

          // Heurística para normalizar diferentes formatos de resposta do Traccar
          const normalizeTrips = (input: any): any[] => {
            if (!input) return [];
            if (Array.isArray(input)) return input;
            if (typeof input === 'object') {
              // formatos comuns: { rows: [...] } | { data: [...] } | { trips: [...] } | { devices: { id: { rows: [...] } } }
              const candidates = input.trips || input.rows || input.data || input.items || input.report || input.events;
              if (Array.isArray(candidates)) return candidates;
              // devices keyed by id
              if (input.devices && typeof input.devices === 'object') {
                const devKey = Object.keys(input.devices)[0];
                const dev = input.devices[devKey];
                if (dev) return normalizeTrips(dev.trips || dev.rows || dev.data);
              }
              // sometimes payload is { "0": [...] }
              const numericKey = Object.keys(input).find(k => /^\d+$/.test(k));
              if (numericKey && Array.isArray(input[numericKey])) return input[numericKey];
            }
            return [];
          };

          let trips = normalizeTrips(raw);
          console.log(`[Trips Proxy] Trips encontradas (normalizadas): ${trips.length}`);

          // Calcular estatísticas
          const totalDistance = trips.reduce((sum: number, trip: any) => sum + (trip.distance || 0), 0);
          const totalDuration = trips.reduce((sum: number, trip: any) => sum + (trip.duration || 0), 0);
          const averageSpeed = totalDistance > 0 && totalDuration > 0 
            ? (totalDistance / 1000) / (totalDuration / 3600000) 
            : 0;

          console.log(`[Trips Proxy] Exemplo de trip raw (1a):`, JSON.stringify(trips[0] ?? null));

          // Geocodificar endereços em lote quando Traccar não os fornecer
          const geocodeAddr = async (lat: any, lon: any, fallback: any): Promise<string> => {
            if (fallback && typeof fallback === 'string' && fallback.trim()) return fallback;
            const latN = parseFloat(lat);
            const lonN = parseFloat(lon);
            if (!isNaN(latN) && !isNaN(lonN) && (latN !== 0 || lonN !== 0)) {
              try {
                return await reverseGeocode(latN, lonN);
              } catch {
                return `${latN.toFixed(5)}, ${lonN.toFixed(5)}`;
              }
            }
            return 'Endereço não disponível';
          };

          // Formatar trips (geocoding em paralelo, com throttle implícito do cache)
          const formattedTrips = await Promise.all(
            trips.map(async (trip: any, index: number) => {
              const [startAddress, endAddress] = await Promise.all([
                geocodeAddr(
                  trip.startLat ?? trip.startLatitude ?? trip.lat,
                  trip.startLon ?? trip.startLongitude ?? trip.lon,
                  trip.startAddress
                ),
                geocodeAddr(
                  trip.endLat ?? trip.endLatitude,
                  trip.endLon ?? trip.endLongitude,
                  trip.endAddress
                ),
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
            totalDuration: Math.floor(totalDuration / 1000),
            averageSpeed: averageSpeed,
          };
        } catch (error: any) {
          console.error(`[Trips Proxy] Erro processando device ${deviceId}:`, error.message);
          return null;
        }
      })
    );

    const validReports = reports.filter((report) => report !== null);
    console.log(`[Trips Proxy] Relatórios gerados: ${validReports.length}`);

    return res.status(200).json(validReports);
  } catch (error: any) {
    console.error('[Trips Proxy] Erro fatal:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}
