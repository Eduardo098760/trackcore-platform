import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getPlannedRouteById,
  updatePlannedRoute,
  deletePlannedRoute,
} from '@/lib/server/planned-routes-store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'ID é obrigatório' });

  if (req.method === 'GET') {
    const route = getPlannedRouteById(id);
    if (!route) return res.status(404).json({ error: 'Rota não encontrada' });
    return res.status(200).json(route);
  }

  if (req.method === 'PUT') {
    const body = req.body as { name?: string; deviceId?: number; waypoints?: { lat: number; lng: number; label?: string }[] };
    const updated = updatePlannedRoute(id, body);
    if (!updated) return res.status(404).json({ error: 'Rota não encontrada' });
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    const ok = deletePlannedRoute(id);
    if (!ok) return res.status(404).json({ error: 'Rota não encontrada' });
    return res.status(204).end();
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
