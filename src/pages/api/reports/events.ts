import type { NextApiRequest, NextApiResponse } from 'next';

const TRACCAR_URL = process.env.TRACCAR_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

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

    const allEvents = await Promise.all(
      deviceIds.map(async (deviceId) => {
        try {
          // Buscar eventos do Traccar
          const eventsResponse = await fetch(
            `${TRACCAR_URL}/api/reports/events?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
            {
              headers: {
                'Content-Type': 'application/json',
                'Cookie': req.headers.cookie || '',
              },
            }
          );

          if (!eventsResponse.ok) {
            console.error(`Failed to fetch events for device ${deviceId}`);
            return [];
          }

          const events = await eventsResponse.json();
          return events;
        } catch (error) {
          console.error(`Error fetching events for device ${deviceId}:`, error);
          return [];
        }
      })
    );

    // Flatten e retornar todos os eventos
    const flatEvents = allEvents.flat();

    return res.status(200).json(flatEvents);
  } catch (error) {
    console.error('Error generating event report:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
