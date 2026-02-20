import { Device } from '@/types';
import { api } from './client';

/**
 * Obtém todos os dispositivos do Traccar
 * Com suporte a filtro por organização
 */
export async function getDevices(organizationId?: number): Promise<Device[]> {
  const devices = await api.get<Device[]>('/devices');
  
  // Se organizationId for fornecido, filtrar
  if (organizationId) {
    return devices.filter(d => 
      d.attributes?.organizationId === organizationId ||
      d.groupId === organizationId // Pode usar Groups do Traccar
    );
  }
  
  return devices;
}

/**
 * Obtém um dispositivo específico por ID
 */
export async function getDevice(id: number): Promise<Device> {
  return api.get<Device>(`/devices/${id}`);
}

/**
 * Cria um novo dispositivo no Traccar
 * Adiciona organizationId aos attributes
 */
export async function createDevice(
  device: Omit<Device, 'id'>, 
  organizationId?: number
): Promise<Device> {
  const deviceData = {
    ...device,
    attributes: {
      ...device.attributes,
      ...(organizationId && { organizationId })
    }
  };
  
  return api.post<Device>('/devices', deviceData);
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
