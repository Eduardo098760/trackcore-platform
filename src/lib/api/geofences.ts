import { Geofence, GeofenceType } from '@/types';
import { api } from './client';

// Campos que o Traccar aceita no topo: id, name, description, area, calendarId, attributes
// Campos customizados (type, color, active, clientId) são persistidos em attributes
interface TraccarGeofence {
  id?: number;
  name: string;
  description?: string;
  area: string;
  calendarId?: number;
  attributes: Record<string, unknown>;
}

function toTraccar(g: Partial<Geofence> & { name?: string; area?: string }): TraccarGeofence {
  const { type, color, active, clientId, id, name, description, area, attributes, ...rest } = g as Geofence & Record<string, unknown>;
  return {
    ...(id !== undefined ? { id } : {}),
    name: name ?? '',
    description: description ?? '',
    area: area ?? '',
    attributes: {
      ...(attributes ?? {}),
      ...(type ? { type } : {}),
      ...(color ? { color } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(clientId !== undefined ? { clientId } : {}),
    },
  };
}

function fromTraccar(raw: TraccarGeofence & { id: number; createdAt?: string }): Geofence {
  const attrs = raw.attributes ?? {};
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    area: raw.area,
    calendarId: raw.calendarId,
    type: (attrs.type as GeofenceType) ?? deriveTypeFromArea(raw.area),
    color: (attrs.color as string) ?? '#3b82f6',
    active: attrs.active !== undefined ? Boolean(attrs.active) : true,
    clientId: (attrs.clientId as number) ?? 0,
    attributes: attrs,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

function deriveTypeFromArea(area: string): GeofenceType {
  if (!area) return 'polygon';
  const upper = area.trim().toUpperCase();
  if (upper.startsWith('CIRCLE')) return 'circle';
  return 'polygon';
}

/**
 * Obtém todas as geofences do Traccar
 */
export async function getGeofences(): Promise<Geofence[]> {
  const raw = await api.get<TraccarGeofence[]>('/geofences');
  return raw.map((r) => fromTraccar(r as TraccarGeofence & { id: number }));
}

/**
 * Obtém uma geofence específica por ID
 */
export async function getGeofence(id: number): Promise<Geofence> {
  const raw = await api.get<TraccarGeofence & { id: number }>(`/geofences/${id}`);
  return fromTraccar(raw);
}

/**
 * Cria uma nova geofence no Traccar
 */
export async function createGeofence(geofence: Omit<Geofence, 'id'>): Promise<Geofence> {
  const raw = await api.post<TraccarGeofence & { id: number }>('/geofences', toTraccar(geofence));
  return fromTraccar(raw);
}

/**
 * Atualiza uma geofence existente
 */
export async function updateGeofence(id: number, geofence: Partial<Geofence>): Promise<Geofence> {
  const raw = await api.put<TraccarGeofence & { id: number }>(`/geofences/${id}`, toTraccar({ ...geofence, id }));
  return fromTraccar(raw);
}

/**
 * Deleta uma geofence
 */
export async function deleteGeofence(id: number): Promise<void> {
  return api.delete<void>(`/geofences/${id}`);
}

/**
 * Busca as geofences vinculadas a um dispositivo
 */
export async function getDeviceGeofences(deviceId: number): Promise<Geofence[]> {
  const raw = await api.get<(TraccarGeofence & { id: number })[]>('/geofences', { deviceId });
  return raw.map((r) => fromTraccar(r));
}

/**
 * Vincula uma geofence a um dispositivo via /permissions
 */
export async function assignGeofenceToDevice(deviceId: number, geofenceId: number): Promise<void> {
  await api.post<void>('/permissions', { deviceId, geofenceId });
}

/**
 * Desvincula uma geofence de um dispositivo via /permissions
 */
export async function removeGeofenceFromDevice(deviceId: number, geofenceId: number): Promise<void> {
  await api.delete<void>('/permissions', { deviceId, geofenceId }, true);
}
