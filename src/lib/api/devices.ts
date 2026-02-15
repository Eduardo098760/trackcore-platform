import { Device } from '@/types';
import { api } from './client';

/**
 * Obtém todos os dispositivos do Traccar
 */
export async function getDevices(): Promise<Device[]> {
  return api.get<Device[]>('/devices');
}

/**
 * Obtém um dispositivo específico por ID
 */
export async function getDevice(id: number): Promise<Device> {
  return api.get<Device>(`/devices/${id}`);
}

/**
 * Cria um novo dispositivo no Traccar
 */
export async function createDevice(device: Omit<Device, 'id'>): Promise<Device> {
  return api.post<Device>('/devices', device);
}

/**
 * Atualiza um dispositivo existente
 */
export async function updateDevice(id: number, device: Partial<Device>): Promise<Device> {
  return api.put<Device>(`/devices/${id}`, { ...device, id });
}

/**
 * Deleta um dispositivo
 */
export async function deleteDevice(id: number): Promise<void> {
  return api.delete<void>(`/devices/${id}`);
}
