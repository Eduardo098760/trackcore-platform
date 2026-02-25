import { Geofence, GeofenceType } from '@/types';
import { api } from './client';

function getImpersonatingUserId(): number | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require('@/lib/stores/auth');
    const state = useAuthStore.getState();
    if (state.isImpersonating && state.user?.id) return state.user.id;
  } catch {}
  return undefined;
}

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
  const { type, color, active, clientId, id, name, description, area, attributes, assignToAll, linkedDeviceIds, ...rest } = g as Geofence & Record<string, unknown>;
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
      ...(assignToAll !== undefined ? { assignToAll } : {}),
      ...(linkedDeviceIds !== undefined ? { linkedDeviceIds } : {}),
    },
  };
}

function fromTraccar(raw: TraccarGeofence & { id: number; createdAt?: string }): Geofence {
  const attrs = raw.attributes ?? {};
  // Fallback: alguns registros antigos podem ter a área em attributes.area ou attributes.wkt
  const area = raw.area || (attrs.area as string) || (attrs.wkt as string) || '';
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    area,
    calendarId: raw.calendarId,
    type: (attrs.type as GeofenceType) ?? deriveTypeFromArea(area),
    color: (attrs.color as string) ?? '#3b82f6',
    active: attrs.active !== undefined ? Boolean(attrs.active) : true,
    clientId: (attrs.clientId as number) ?? 0,
    attributes: attrs,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    assignToAll: attrs.assignToAll !== undefined ? Boolean(attrs.assignToAll) : undefined,
    linkedDeviceIds: Array.isArray(attrs.linkedDeviceIds) ? (attrs.linkedDeviceIds as number[]) : undefined,
  };
}

function deriveTypeFromArea(area: string): GeofenceType {
  if (!area) return 'polygon';
  const upper = area.trim().toUpperCase();
  if (upper.startsWith('CIRCLE')) return 'circle';
  return 'polygon';
}

/**
 * Obtém as geofences do usuário atual (sessão Traccar).
 * Quando em impersonação, filtra pelo userId do usuário alvo.
 */
export async function getGeofences(): Promise<Geofence[]> {
  const impersonatingUserId = getImpersonatingUserId();
  const params = impersonatingUserId ? { userId: impersonatingUserId } : undefined;
  if (impersonatingUserId) {
    console.log('[getGeofences] Impersonação ativa — filtrando por userId:', impersonatingUserId);
  }
  const raw = await api.get<TraccarGeofence[]>('/geofences', params);
  return raw.map((r) => fromTraccar(r as TraccarGeofence & { id: number }));
}

/**
 * Retorna os dispositivos vinculados a uma geofence específica.
 * Traccar: GET /api/devices?geofenceId={id}
 */
export async function getDevicesForGeofence(geofenceId: number): Promise<number[]> {
  const raw = await api.get<{ id: number }[]>('/devices', { geofenceId });
  return raw.map((d) => d.id);
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
