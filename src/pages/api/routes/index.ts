import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllPlannedRoutes, createPlannedRoute } from '@/lib/server/planned-routes-store';
import type { PlannedRoute } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const routes = getAllPlannedRoutes();
    return res.status(200).json(routes);
  }

  if (req.method === 'POST') {
    const body = req.body as { name: string; deviceId: number; waypoints: { lat: number; lng: number; label?: string }[] };
    if (!body.name || body.deviceId == null || !Array.isArray(body.waypoints) || body.waypoints.length < 2) {
      return res.status(400).json({ error: 'Nome, deviceId e pelo menos 2 waypoints são obrigatórios.' });
    }
    const route = createPlannedRoute({
      name: body.name,
      deviceId: Number(body.deviceId),
      waypoints: body.waypoints,
    });
    return res.status(201).json(route);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
