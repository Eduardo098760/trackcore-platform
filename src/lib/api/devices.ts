import { Device } from '@/types';
import { api } from './client';

/**
 * Obtém todos os dispositivos do Traccar
 * Com suporte a filtro por organização
 */
export async function getDevices(organizationId?: number): Promise<Device[]> {
  try {
    console.log('[getDevices] Iniciando requisição de devices...');
    const devices = await api.get<Device[]>('/devices');
    console.log('[getDevices] Devices recebidos:', devices?.length || 0);
    
    // Se organizationId for fornecido, filtrar
    if (organizationId) {
      const filtered = devices.filter(d => 
        d.attributes?.organizationId === organizationId ||
        d.groupId === organizationId // Pode usar Groups do Traccar
      );
      console.log('[getDevices] Devices filtrados por org:', filtered.length);
      return filtered;
    }
    
    return devices || [];
  } catch (error) {
    console.error('[getDevices] Erro ao buscar devices:', error);
    throw error;
  }
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
