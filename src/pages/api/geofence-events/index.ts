import type { NextApiRequest, NextApiResponse } from 'next';

import { addGeofenceEvents, listGeofenceEvents } from '@/lib/server/geofence-event-store';
import { resolveTraccarBase } from '@/lib/server/traccar-server';

function resolveTenantKey(req: NextApiRequest, body?: { tenantKey?: string; traccarBase?: string }) {
  return body?.tenantKey || body?.traccarBase || resolveTraccarBase(req);
}

function parseDeviceIds(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));
  }

  return [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const tenantKey = resolveTenantKey(req, req.method === 'POST' ? req.body : undefined);

  if (req.method === 'GET') {
    const deviceIds = parseDeviceIds(req.query.deviceIds);
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;

    return res.status(200).json(listGeofenceEvents(tenantKey, { from, to, deviceIds }));
  }

  if (req.method === 'POST') {
    const payload = Array.isArray(req.body?.events) ? req.body.events : [req.body];
    const stored = addGeofenceEvents(tenantKey, payload);
    return res.status(201).json({ stored: stored.length });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
