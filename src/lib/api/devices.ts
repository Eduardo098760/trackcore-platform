import { Device } from '@/types';
import { api } from './client';

/**
 * Normaliza um device vindo do Traccar:
 * Promove campos customizados (plate, year, color, speedLimit) que ficam em
 * `attributes` para o nível raiz do objeto Device, pois o código da plataforma
 * os acessa diretamente como device.plate, device.speedLimit etc.
 */
function normalizeDevice(raw: any): Device {
  const attrs = raw?.attributes || {};
  return {
    ...raw,
    plate:      raw.plate      ?? attrs.plate      ?? '',
    year:       raw.year       ?? attrs.year,
    color:      raw.color      ?? attrs.color,
    speedLimit: raw.speedLimit || attrs.speedLimit,
    clientId:   raw.clientId   ?? attrs.clientId,
  } as Device;
}

/**
 * Obtém todos os dispositivos do Traccar
 * Com suporte a filtro por organização
 */
export async function getDevices(organizationId?: number): Promise<Device[]> {
  try {
    console.log('[getDevices] Iniciando requisição de devices...');
    const devices = await api.get<any[]>('/devices');
    console.log('[getDevices] Devices recebidos:', devices?.length || 0);

    const normalized = (devices || []).map(normalizeDevice);

    // Se organizationId for fornecido, filtrar
    if (organizationId) {
      const filtered = normalized.filter(d =>
        d.attributes?.organizationId === organizationId ||
        (d as any).groupId === organizationId
      );
      console.log('[getDevices] Devices filtrados por org:', filtered.length);
      return filtered;
    }

    return normalized;
  } catch (error) {
    console.error('[getDevices] Erro ao buscar devices:', error);
    throw error;
  }
}

/**
 * Obtém um dispositivo específico por ID
 */
export async function getDevice(id: number): Promise<Device> {
  const raw = await api.get<any>(`/devices/${id}`);
  return normalizeDevice(raw);
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
 * Atualiza um dispositivo existente.
 *
 * O Traccar aceita APENAS estes campos no nível raiz do Device:
 *   id, name, uniqueId, groupId, calendarId, phone, model, contact,
 *   category, disabled, expirationTime, attributes, status, lastUpdate, positionId
 *
 * Campos customizados da plataforma (plate, year, color, speedLimit, etc.)
 * devem ser salvos dentro de `attributes` para não causar 400 Bad Request.
 */
export async function updateDevice(id: number, device: Partial<Device> & Record<string, any>): Promise<Device> {
  // 1. Buscar device atual para preservar attributes existentes
  let currentAttributes: Record<string, any> = {};
  try {
    const current = await api.get<any>(`/devices/${id}`);
    currentAttributes = current?.attributes || {};
  } catch { /* se falhar, segue com objeto vazio */ }

  // 2. Separar campos aceitos pelo Traccar no nível raiz dos campos customizados
  const {
    // campos aceitos no nível raiz:
    name, uniqueId, groupId, calendarId, phone, model, contact,
    category, disabled, status, lastUpdate, positionId,
    // campos customizados → vão para attributes:
    plate, year, color, speedLimit,
    // expiryDate do form → expirationTime do Traccar
    expiryDate,
    // ignorar campos internos da plataforma:
    clientId: _clientId, geofenceIds: _geofenceIds,
    // attributes extras vindos do device
    attributes: incomingAttributes,
    // resto ignorado
    ...rest
  } = device as any;

  // 3. Montar attributes mesclando: atual → customizados → extras
  const mergedAttributes: Record<string, any> = {
    ...currentAttributes,
    ...(incomingAttributes || {}),
    // campos customizados da plataforma
    ...(plate        !== undefined ? { plate }      : {}),
    ...(year         !== undefined ? { year }       : {}),
    ...(color        !== undefined ? { color }      : {}),
    ...(speedLimit   !== undefined ? { speedLimit } : {}),
  };

  // 4. Montar payload final — somente campos reconhecidos pelo Traccar
  const payload: Record<string, any> = {
    id,
    groupId: groupId ?? 0,
    attributes: mergedAttributes,
  };

  if (name        !== undefined) payload.name        = name;
  if (uniqueId    !== undefined) payload.uniqueId    = uniqueId;
  if (phone       !== undefined) payload.phone       = phone;
  if (model       !== undefined) payload.model       = model;
  if (contact     !== undefined) payload.contact     = contact;
  if (category    !== undefined) payload.category    = category;
  if (disabled    !== undefined) payload.disabled    = disabled;
  if (calendarId  !== undefined) payload.calendarId  = calendarId;
  if (status      !== undefined) payload.status      = status;
  if (lastUpdate  !== undefined) payload.lastUpdate  = lastUpdate;
  if (positionId  !== undefined) payload.positionId  = positionId;
  // expiryDate do form → expirationTime aceito pelo Traccar
  if (expiryDate) payload.expirationTime = new Date(expiryDate).toISOString();

  console.log('[updateDevice] Payload Traccar:', JSON.stringify(payload, null, 2));
  const raw = await api.put<any>(`/devices/${id}`, payload);
  return normalizeDevice(raw);
}

/**
 * Deleta um dispositivo
 */
export async function deleteDevice(id: number): Promise<void> {
  return api.delete<void>(`/devices/${id}`);
}
