import { Device } from "@/types";
import { api } from "./client";

/**
 * Retorna o userId do usuário impersonado, ou undefined se não estiver em impersonação.
 * Usado para filtrar dados da API Traccar pelo usuário alvo.
 */
function getImpersonatingUserId(): number | undefined {
  try {
    // Acessamos o store fora do React via getState()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require("@/lib/stores/auth");
    const state = useAuthStore.getState();
    if (state.isImpersonating && state.user?.id) return state.user.id;
  } catch {}
  return undefined;
}

/**
 * Normaliza um device vindo do Traccar:
 * Promove campos customizados (plate, year, color, speedLimit) que ficam em
 * `attributes` para o nível raiz do objeto Device, pois o código da plataforma
 * os acessa diretamente como device.plate, device.speedLimit etc.
 */
function normalizeDevice(raw: any): Device {
  const attrs = raw?.attributes || {};
  // speedLimit é sempre salvo em km/h (inteiro) pela plataforma.
  // Aplica Math.round para limpar qualquer valor decimal herdado de versões antigas.
  const rawSpeedLimit = raw.speedLimit || attrs.speedLimit;
  // Usa || (não ??) para string fields: Traccar pode retornar plate:"" no root
  // enquanto o valor real está em attributes.plate — ?? não filtra strings vazias.
  return {
    ...raw,
    plate: raw.plate || attrs.licensePlate || attrs.plate || "",
    year: raw.year || attrs.year,
    color: raw.color || attrs.color,
    speedLimit: rawSpeedLimit ? Math.round(rawSpeedLimit) : undefined,
    clientId: raw.clientId || attrs.clientId,
  } as Device;
}

/**
 * Obtém todos os dispositivos do Traccar
 * Com suporte a filtro por organização
 */
export async function getDevices(organizationId?: number): Promise<Device[]> {
  try {
    // Se estiver em modo de impersonação, busca apenas os devices do usuário alvo
    const impersonatingUserId = getImpersonatingUserId();
    const params: Record<string, any> = {};
    if (impersonatingUserId) {
      params.userId = impersonatingUserId;
      console.log(
        "[getDevices] Impersonação ativa — filtrando por userId:",
        impersonatingUserId,
      );
    }

    console.log("[getDevices] Iniciando requisição de devices...");
    const devices = await api.get<any[]>(
      "/devices",
      Object.keys(params).length ? params : undefined,
    );
    console.log("[getDevices] Devices recebidos:", devices?.length || 0);

    const normalized = (devices || []).map(normalizeDevice);

    // Se organizationId for fornecido (e não em impersonação), filtrar por org
    if (organizationId && !impersonatingUserId) {
      const filtered = normalized.filter(
        (d) =>
          d.clientId === organizationId ||
          (d as any).groupId === organizationId,
      );
      console.log("[getDevices] Devices filtrados por org:", filtered.length);
      return filtered;
    }

    return normalized;
  } catch (error) {
    console.error("[getDevices] Erro ao buscar devices:", error);
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
 * Aplica a mesma separação de campos que updateDevice:
 * campos customizados (plate, color, year, speedLimit) vão para attributes,
 * pois o Traccar rejeita campos desconhecidos no nível raiz com 400.
 */
export async function createDevice(
  device: Omit<Device, "id">,
  organizationId?: number,
): Promise<Device> {
  const {
    // campos aceitos no nível raiz:
    name,
    uniqueId,
    groupId,
    calendarId,
    phone,
    model,
    contact,
    category,
    disabled,
    status,
    lastUpdate,
    positionId,
    // campos customizados → vão para attributes:
    plate,
    year,
    color,
    speedLimit,
    // expiryDate do form → expirationTime do Traccar
    expiryDate,
    // ignorar campos internos da plataforma:
    clientId: _clientId,
    geofenceIds: _geofenceIds,
    attributes: incomingAttributes,
  } = device as any;

  const mergedAttributes: Record<string, any> = {
    ...(incomingAttributes || {}),
    ...(organizationId !== undefined ? { organizationId } : {}),
    ...(plate !== undefined ? { plate, licensePlate: plate } : {}),
    ...(year !== undefined ? { year } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(speedLimit !== undefined ? { speedLimit } : {}),
  };

  const payload: Record<string, any> = {
    groupId: groupId ?? 0,
    attributes: mergedAttributes,
  };

  if (name !== undefined) payload.name = name;
  if (uniqueId !== undefined) payload.uniqueId = uniqueId;
  if (phone !== undefined) payload.phone = phone;
  if (model !== undefined) payload.model = model;
  if (contact !== undefined) payload.contact = contact;
  if (category !== undefined) payload.category = category;
  if (disabled !== undefined) payload.disabled = disabled;
  if (calendarId !== undefined) payload.calendarId = calendarId;
  if (status !== undefined) payload.status = status;
  if (positionId !== undefined) payload.positionId = positionId;
  if (expiryDate) payload.expirationTime = new Date(expiryDate).toISOString();

  console.log(
    "[createDevice] Payload Traccar:",
    JSON.stringify(payload, null, 2),
  );
  const raw = await api.post<any>("/devices", payload);
  return normalizeDevice(raw);
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
export async function updateDevice(
  id: number,
  device: Partial<Device> & Record<string, any>,
): Promise<Device> {
  // 1. Buscar device atual para preservar attributes existentes
  let currentAttributes: Record<string, any> = {};
  try {
    const current = await api.get<any>(`/devices/${id}`);
    currentAttributes = current?.attributes || {};
  } catch {
    /* se falhar, segue com objeto vazio */
  }

  // 2. Separar campos aceitos pelo Traccar no nível raiz dos campos customizados
  const {
    // campos aceitos no nível raiz:
    name,
    uniqueId,
    groupId,
    calendarId,
    phone,
    model,
    contact,
    category,
    disabled,
    status,
    lastUpdate,
    positionId,
    // campos customizados → vão para attributes:
    plate,
    year,
    color,
    speedLimit,
    // expiryDate do form → expirationTime do Traccar
    expiryDate,
    // ignorar campos internos da plataforma:
    clientId: _clientId,
    geofenceIds: _geofenceIds,
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
    ...(plate !== undefined ? { plate, licensePlate: plate } : {}),
    ...(year !== undefined ? { year } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(speedLimit !== undefined ? { speedLimit } : {}),
  };

  // 4. Montar payload final — somente campos reconhecidos pelo Traccar
  const payload: Record<string, any> = {
    id,
    groupId: groupId ?? 0,
    attributes: mergedAttributes,
  };

  if (name !== undefined) payload.name = name;
  if (uniqueId !== undefined) payload.uniqueId = uniqueId;
  if (phone !== undefined) payload.phone = phone;
  if (model !== undefined) payload.model = model;
  if (contact !== undefined) payload.contact = contact;
  if (category !== undefined) payload.category = category;
  if (disabled !== undefined) payload.disabled = disabled;
  if (calendarId !== undefined) payload.calendarId = calendarId;
  if (status !== undefined) payload.status = status;
  if (lastUpdate !== undefined) payload.lastUpdate = lastUpdate;
  if (positionId !== undefined) payload.positionId = positionId;
  // expiryDate do form → expirationTime aceito pelo Traccar
  if (expiryDate) payload.expirationTime = new Date(expiryDate).toISOString();

  console.log(
    "[updateDevice] Payload Traccar:",
    JSON.stringify(payload, null, 2),
  );
  const raw = await api.put<any>(`/devices/${id}`, payload);
  return normalizeDevice(raw);
}

/**
 * Deleta um dispositivo
 */
export async function deleteDevice(id: number): Promise<void> {
  return api.delete<void>(`/devices/${id}`);
}

/**
 * Atualiza os acumuladores do dispositivo (hodômetro e horas de motor).
 * totalDistanceKm: valor em km — convertido para metros internamente.
 * currentHours: horas de motor atuais (em segundos no Traccar) — preserva valor existente.
 */
export async function updateAccumulators(
  deviceId: number,
  totalDistanceKm: number,
  currentHours = 0,
): Promise<void> {
  await api.put<void>(`/devices/${deviceId}/accumulators`, {
    totalDistance: Math.round(totalDistanceKm * 1000),
    hours: currentHours,
  });
}
