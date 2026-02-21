import type { NextApiRequest, NextApiResponse } from 'next';
import {
  addAuditLog,
  getAuditLogs,
  getUniqueActions,
  getUniqueResources,
  getAuditStats,
} from '@/lib/server/audit-store';

/**
 * GET  /api/audit  — lista com filtros e paginação
 * POST /api/audit  — adiciona nova entrada
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const {
      action,
      resource,
      search,
      from,
      to,
      page,
      pageSize,
      meta,
    } = req.query as Record<string, string>;

    // Enriquecer com eventos recentes do Traccar (best-effort)
    if (req.query.syncTraccar === '1') {
      await syncTraccarEvents(req);
    }

    if (meta === '1') {
      return res.status(200).json({
        actions: getUniqueActions(),
        resources: getUniqueResources(),
        stats: getAuditStats(),
      });
    }

    const result = getAuditLogs({
      action,
      resource,
      search,
      from,
      to,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? Math.min(parseInt(pageSize), 100) : 25,
    });

    return res.status(200).json(result);
  }

  if (req.method === 'POST') {
    const { userId, userName, action, resource, resourceId, details, ipAddress, userAgent } = req.body;

    if (!action || !resource) {
      return res.status(400).json({ message: 'action e resource são obrigatórios' });
    }

    const log = addAuditLog({
      userId: userId ?? 0,
      userName: userName ?? 'Sistema',
      action,
      resource,
      resourceId,
      details: details ?? '',
      ipAddress: ipAddress ?? req.headers['x-forwarded-for']?.toString() ?? req.socket.remoteAddress ?? '0.0.0.0',
      userAgent: userAgent ?? req.headers['user-agent'] ?? '',
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json(log);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

// ── Sincronização com eventos do Traccar ────────────────────────────────────
const EVENT_TYPE_LABELS: Record<string, { action: string; resource: string }> = {
  deviceOnline:       { action: 'CONNECT',     resource: 'device' },
  deviceOffline:      { action: 'DISCONNECT',  resource: 'device' },
  deviceMoving:       { action: 'MOVING',      resource: 'device' },
  deviceStopped:      { action: 'STOPPED',     resource: 'device' },
  deviceOverspeed:    { action: 'OVERSPEED',   resource: 'device' },
  ignitionOn:         { action: 'IGNITION_ON', resource: 'device' },
  ignitionOff:        { action: 'IGNITION_OFF','resource': 'device' },
  geofenceEnter:      { action: 'ENTER',       resource: 'geofence' },
  geofenceExit:       { action: 'EXIT',        resource: 'geofence' },
  alarm:              { action: 'ALARM',       resource: 'device' },
  driverChanged:      { action: 'UPDATE',      resource: 'driver' },
  deviceFuelDrop:     { action: 'FUEL_DROP',   resource: 'device' },
};

let lastTraccarSync = 0;

async function syncTraccarEvents(req: NextApiRequest) {
  // Throttle: no máximo 1 sync a cada 30 segundos
  const now = Date.now();
  if (now - lastTraccarSync < 30_000) return;
  lastTraccarSync = now;

  try {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;

    // Buscar eventos das últimas 24h
    const from = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(now).toISOString();

    const resp = await fetch(
      `${baseUrl}/api/traccar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&type=allEvents`,
      {
        headers: {
          'Accept': 'application/json',
          'Cookie': req.headers.cookie || '',
        },
      }
    );

    if (!resp.ok) return;

    const events: any[] = await resp.json().catch(() => []);
    if (!Array.isArray(events)) return;

    // Buscar lista de devices para resolver nomes
    const devResp = await fetch(`${baseUrl}/api/traccar/devices`, {
      headers: { 'Accept': 'application/json', 'Cookie': req.headers.cookie || '' },
    });
    const devices: any[] = devResp.ok ? await devResp.json().catch(() => []) : [];
    const deviceMap = new Map<number, string>(devices.map((d: any) => [d.id, d.name]));

    for (const ev of events.slice(0, 200)) {
      const map = EVENT_TYPE_LABELS[ev.type] ?? { action: ev.type?.toUpperCase() ?? 'EVENT', resource: 'device' };
      const devName = deviceMap.get(ev.deviceId) ?? `Device #${ev.deviceId}`;
      addAuditLog({
        userId: 0,
        userName: 'Traccar',
        action: map.action,
        resource: map.resource,
        resourceId: ev.deviceId,
        details: `[${devName}] ${ev.type}${ev.geofenceId ? ` (cerca #${ev.geofenceId})` : ''}`,
        ipAddress: 'traccar',
        userAgent: 'Traccar Server',
        timestamp: ev.serverTime ?? ev.deviceTime ?? new Date().toISOString(),
      });
    }
  } catch {
    // silent — não quebrar se Traccar não tiver eventos
  }
}
