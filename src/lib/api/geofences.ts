import { Geofence } from '@/types';
import { api } from './client';

/**
 * Obtém todas as geofences do Traccar
 */
export async function getGeofences(): Promise<Geofence[]> {
  return api.get<Geofence[]>('/geofences');
}

/**
 * Obtém uma geofence específica por ID
 */
export async function getGeofence(id: number): Promise<Geofence> {
  return api.get<Geofence>(`/geofences/${id}`);
}

/**
 * Cria uma nova geofence no Traccar
 */
export async function createGeofence(geofence: Omit<Geofence, 'id'>): Promise<Geofence> {
  return api.post<Geofence>('/geofences', geofence);
}

/**
 * Atualiza uma geofence existente
 */
export async function updateGeofence(id: number, geofence: Partial<Geofence>): Promise<Geofence> {
  return api.put<Geofence>(`/geofences/${id}`, { ...geofence, id });
}

/**
 * Deleta uma geofence
 */
export async function deleteGeofence(id: number): Promise<void> {
  return api.delete<void>(`/geofences/${id}`);
}
