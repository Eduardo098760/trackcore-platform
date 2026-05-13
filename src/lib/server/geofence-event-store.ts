import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import type { Event } from '@/types';

export interface GeofenceEventQuery {
  from?: string;
  to?: string;
  deviceIds?: number[];
}

export interface StoredGeofenceEvent extends Event {
  sourceKey: string;
  tenantKey: string;
}

const DATA_DIR = path.join(process.cwd(), 'data', 'geofence-events');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function sanitizeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'default';
}

function getFilePath(tenantKey: string) {
  ensureDir();
  return path.join(DATA_DIR, `${sanitizeKey(tenantKey)}.json`);
}

function readEvents(tenantKey: string): StoredGeofenceEvent[] {
  try {
    const filePath = getFilePath(tenantKey);
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(tenantKey: string, events: StoredGeofenceEvent[]) {
  const filePath = getFilePath(tenantKey);
  fs.writeFileSync(filePath, JSON.stringify(events, null, 2), 'utf8');
}

function stableNumericId(sourceKey: string) {
  const hash = crypto.createHash('sha1').update(sourceKey).digest('hex');
  return -Math.abs(parseInt(hash.slice(0, 8), 16) || Date.now());
}

function toTimestamp(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function buildSourceKey(event: Partial<Event> & { sourceKey?: string }) {
  if (event.sourceKey) return event.sourceKey;
  const attributes = event.attributes ?? {};
  const geofenceId = attributes.geofenceId ?? attributes.geofence;
  const eventTime = (event as Partial<{ eventTime: string }>).eventTime;
  return [
    'geofence',
    event.id ?? 'unknown',
    event.deviceId ?? 'unknown',
    event.type ?? 'unknown',
    event.serverTime ?? eventTime ?? 'unknown',
    geofenceId ?? 'none',
  ].join(':');
}

function normalizeEvent(event: Partial<Event> & { sourceKey?: string }, tenantKey: string): StoredGeofenceEvent | null {
  if (!event || (event.type !== 'geofenceEnter' && event.type !== 'geofenceExit')) {
    return null;
  }

  const sourceKey = buildSourceKey(event);
  const numericId = typeof event.id === 'number' ? event.id : Number(event.id);

  return {
    id: Number.isFinite(numericId) ? numericId : stableNumericId(sourceKey),
    type: event.type,
    deviceId: event.deviceId ?? 0,
    positionId: event.positionId,
    serverTime: event.serverTime ?? (event as Partial<{ eventTime: string }>).eventTime ?? new Date().toISOString(),
    address: event.address,
    attributes: {
      ...(event.attributes ?? {}),
      source: 'geofence-store',
      sourceKey,
      tenantKey,
    },
    resolved: event.resolved ?? false,
    sourceKey,
    tenantKey,
  };
}

export function addGeofenceEvents(tenantKey: string, events: Array<Partial<Event> & { sourceKey?: string }>) {
  const normalizedEvents = events
    .map((event) => normalizeEvent(event, tenantKey))
    .filter((event): event is StoredGeofenceEvent => Boolean(event));

  if (normalizedEvents.length === 0) return [];

  const existing = readEvents(tenantKey);
  const merged = new Map<string, StoredGeofenceEvent>();

  for (const event of existing) {
    merged.set(event.sourceKey, event);
  }

  for (const event of normalizedEvents) {
    merged.set(event.sourceKey, event);
  }

  const result = Array.from(merged.values())
    .sort((left, right) => toTimestamp(left.serverTime) - toTimestamp(right.serverTime))
    .slice(-5000);

  writeEvents(tenantKey, result);
  return normalizedEvents;
}

export function listGeofenceEvents(tenantKey: string, query: GeofenceEventQuery = {}) {
  const events = readEvents(tenantKey);
  const fromTime = query.from ? toTimestamp(query.from) : 0;
  const toTime = query.to ? toTimestamp(query.to) : Number.POSITIVE_INFINITY;
  const deviceIdSet = query.deviceIds && query.deviceIds.length > 0 ? new Set(query.deviceIds) : null;

  return events.filter((event) => {
    const timestamp = toTimestamp(event.serverTime);
    if (fromTime > 0 && timestamp < fromTime) return false;
    if (Number.isFinite(toTime) && timestamp > toTime) return false;
    if (deviceIdSet && !deviceIdSet.has(event.deviceId)) return false;
    return true;
  });
}
