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

    const allEvents = await Promise.all(
      deviceIds.map(async (deviceId) => {
        try {
          // Buscar eventos via proxy (preserva sessão multi-tenant)
          const eventsResponse = await fetch(
            `${baseUrl}/api/traccar/reports/events?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
            {
              headers: {
                'Accept': 'application/json',
                'Cookie': req.headers.cookie || '',
              },
            }
          );

          if (!eventsResponse.ok) {
            console.error(`[Events API] Failed to fetch events for device ${deviceId}: ${eventsResponse.status}`);
            return [];
          }

          const events = await eventsResponse.json();
          return Array.isArray(events) ? events : [];
        } catch (error) {
          console.error(`[Events API] Error fetching events for device ${deviceId}:`, error);
          return [];
        }
      })
    );

    // Flatten e retornar todos os eventos
    const flatEvents = allEvents.flat();

    return res.status(200).json(flatEvents);
  } catch (error) {
    console.error('[Events API] Error generating event report:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
