import {
  Device,
  Position,
  Event,
  Command,
  TraccarCommand,
  Client,
  User,
  DashboardStats,
  DeviceStatistics,
} from "@/types";
import { api } from "./client";
import { getDevices as getDevicesFromDevices, getDevice } from "./devices";
import { deriveDeviceStatus } from "@/lib/utils";

/**
 * Retorna o userId do usuário impersonado, ou undefined se não estiver em impersonação.
 */
function getImpersonatingUserId(): number | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require("@/lib/stores/auth");
    const state = useAuthStore.getState();
    if (state.isImpersonating && state.user?.id) return state.user.id;
  } catch {}
  return undefined;
}

/**
 * Transformação entre modelo interno (com role) e modelo Traccar (com administrator)
 */
function mapUserToTraccar(user: Partial<User>): any {
  const {
    role,
    createdAt,
    updatedAt,
    avatar,
    clientId,
    organizationId,
    lastLogin,
    ...traccarUser
  } = user as any;

  if (role) {
    // Mapear role para campos nativos do Traccar
    traccarUser.administrator = role === "admin";
    traccarUser.readonly = role === "readonly";
    traccarUser.deviceReadonly = role === "deviceReadonly";
    // Manager: só define userLimit padrão se ainda não foi especificado
    if (
      role === "manager" &&
      (traccarUser.userLimit == null || traccarUser.userLimit === 0)
    ) {
      traccarUser.userLimit = -1; // ilimitado por padrão
    }
    // user: garante que não é gerente, mas só se não veio um valor explícito
    if (role === "user" && traccarUser.userLimit == null) {
      traccarUser.userLimit = 0;
    }
    // deviceLimit padrão: ilimitado se não informado
    if (traccarUser.deviceLimit == null) {
      traccarUser.deviceLimit = -1;
    }
    // Persistir role nos attributes para retrocompatibilidade e leitura rápida
    traccarUser.attributes = { ...(traccarUser.attributes ?? {}), role };
  }

  return traccarUser;
}

function mapTraccarToUser(traccarUser: any): User {
  // Extrair lastLogin: prioridade attributes.lastLogin > campo login do Traccar
  // Ignorar valor "false" que é lixo em alguns usuários
  const rawLogin = traccarUser.login && traccarUser.login !== "false" ? traccarUser.login : null;
  const lastLogin = traccarUser.attributes?.lastLogin || rawLogin || null;

  // 1. administrator: true → admin
  if (traccarUser.administrator) {
    return {
      ...traccarUser,
      role: "admin",
      lastLogin,
      createdAt: traccarUser.createdAt || new Date().toISOString(),
      updatedAt: traccarUser.updatedAt || new Date().toISOString(),
    } as User;
  }

  // 2 & 3. Role salva em attributes
  const savedRole = traccarUser.attributes?.role as string | undefined;
  const newRoles = ["admin", "manager", "user", "readonly", "deviceReadonly"];
  const oldToNew: Record<string, string> = {
    superadmin: "admin",
    operator: "user",
    client: "readonly",
  };
  let role: string = "user";
  if (savedRole) {
    role = newRoles.includes(savedRole)
      ? savedRole
      : (oldToNew[savedRole] ?? "user");
  } else if (traccarUser.readonly) {
    role = "readonly";
  } else if (traccarUser.deviceReadonly) {
    role = "deviceReadonly";
  } else if (traccarUser.userLimit != null && traccarUser.userLimit !== 0) {
    role = "manager";
  }

  return {
    ...traccarUser,
    role,
    lastLogin,
    createdAt: traccarUser.createdAt || new Date().toISOString(),
    updatedAt: traccarUser.updatedAt || new Date().toISOString(),
  } as User;
}

// Devices API (usando Traccar)
// Usa a versão de devices.ts que normaliza os campos customizados
// (plate, year, color, speedLimit) de attributes para o nível raiz.
export async function getDevices(): Promise<Device[]> {
  return getDevicesFromDevices();
}

export async function getDeviceById(id: number): Promise<Device> {
  return getDevice(id);
}

// Positions API (usando Traccar)
// Traccar retorna speed em knots — normalizamos para km/h aqui
function normalizePositionSpeed<T extends { speed: number }>(pos: T): T {
  return { ...pos, speed: pos.speed * 1.852 };
}

export async function getPositions(params?: {
  deviceId?: number;
  from?: string;
  to?: string;
}): Promise<Position[]> {
  const positions = await api.get<Position[]>("/positions", params);
  return positions.map(normalizePositionSpeed);
}

export async function getPositionByDevice(deviceId: number): Promise<Position> {
  const positions = await api.get<Position[]>("/positions", { deviceId });
  if (!positions || positions.length === 0) {
    throw new Error("Position not found");
  }
  return normalizePositionSpeed(positions[0]);
}

// Busca uma posição histórica específica pelo seu ID (útil para eventos com positionId)
export async function getPositionById(id: number): Promise<Position | null> {
  try {
    const positions = await api.get<Position[]>("/positions", { id });
    const pos = positions?.[0] ?? null;
    return pos ? normalizePositionSpeed(pos) : null;
  } catch {
    return null;
  }
}

// Events API (usando Traccar - Reports endpoint)
// O Traccar exige deviceId(s) ou groupId para reports/events
// Para obter todos os eventos, buscamos de todos os dispositivos
export async function getEvents(params?: {
  deviceId?: number;
  deviceIds?: number[];
  from?: string;
  to?: string;
  type?: string;
}): Promise<Event[]> {
  try {
    const requestParams: Record<string, unknown> = {};
    if (params?.from) requestParams.from = params.from;
    if (params?.to) requestParams.to = params.to;
    if (params?.type) requestParams.type = params.type;

    // Se tem deviceIds ou deviceId específico, usar
    if (params?.deviceIds?.length) {
      requestParams.deviceId = params.deviceIds;
    } else if (params?.deviceId != null) {
      requestParams.deviceId = params.deviceId;
    } else {
      // Buscar devices do usuário correto (impersonado ou admin)
      const impersonatingUserId = getImpersonatingUserId();
      const devicesParams = impersonatingUserId
        ? { userId: impersonatingUserId }
        : undefined;
      const devices = await api.get<Device[]>("/devices", devicesParams);
      if (devices.length === 0) return [];
      requestParams.deviceId = devices.map((d) => d.id);
    }

    const events = await api.get<Event[]>("/reports/events", requestParams);

    // Enriquecer eventos com nome do dispositivo (usando mesmo filtro de userId se impersonando)
    const impUid = getImpersonatingUserId();
    const allDevices = await api.get<Device[]>(
      "/devices",
      impUid ? { userId: impUid } : undefined,
    );
    const deviceMap = new Map(allDevices.map((d) => [d.id, d]));

    return events.map((event) => ({
      ...event,
      attributes: {
        ...event.attributes,
        deviceName:
          deviceMap.get(event.deviceId)?.name ||
          `Dispositivo #${event.deviceId}`,
      },
    }));
  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    return [];
  }
}

export async function markEventAsResolved(eventId: number): Promise<Event> {
  // Traccar não tem endpoint específico para resolver eventos
  // Você pode adicionar um atributo customizado
  return api.put<Event>(`/events/${eventId}`, {
    attributes: { resolved: true },
  });
}

// Commands API (usando Traccar)
// Payload segue exatamente o formato nativo: { id:0, deviceId, type, attributes }
export async function sendCommand(
  deviceId: number,
  type: string,
  attributes?: Record<string, any>,
  textChannel?: boolean,
): Promise<TraccarCommand> {
  const command: Record<string, any> = {
    id: 0,
    deviceId,
    type,
    attributes: attributes || {},
  };
  if (textChannel) command.textChannel = true;

  return api.post<TraccarCommand>("/commands/send", command);
}

/** Retorna templates de comandos salvos no Traccar */
export async function getSavedCommands(deviceId?: number): Promise<TraccarCommand[]> {
  return api.get<TraccarCommand[]>("/commands", deviceId ? { deviceId } : undefined);
}

// Clients API (Traccar não tem "clients", mas podemos usar Groups)
export async function getClients(): Promise<Client[]> {
  // Quando em impersonação, filtra pelos grupos do usuário alvo (não do admin)
  // evitando que dados do admin apareçam na conta do cliente.
  const impersonatingUserId = getImpersonatingUserId();
  const params: Record<string, any> = {};
  if (impersonatingUserId) {
    params.userId = impersonatingUserId;
    console.log(
      "[getClients] Impersonação ativa — filtrando por userId:",
      impersonatingUserId,
    );
  }

  const groups = await api.get<any[]>(
    "/groups",
    Object.keys(params).length ? params : undefined,
  );
  return (groups || []).map((g) => ({
    id: g.id,
    name: g.name,
    document: g.attributes?.document || "",
    email: g.attributes?.email || "",
    phone: g.attributes?.phone || "",
    address: g.attributes?.address || "",
    plan: g.attributes?.plan || "basic",
    status: g.attributes?.status || "active",
    createdAt: g.attributes?.createdAt || new Date().toISOString(),
    devicesCount: g.attributes?.devicesCount || 0,
  }));
}

export async function getClientById(id: number): Promise<Client> {
  const group = await api.get<any>(`/groups/${id}`);
  return {
    id: group.id,
    name: group.name,
    email: group.attributes?.email || "",
    phone: group.attributes?.phone || "",
    address: group.attributes?.address || "",
    document: group.attributes?.document || "",
    plan: group.attributes?.plan || "basic",
    status: group.attributes?.status || "active",
    createdAt: group.attributes?.createdAt || new Date().toISOString(),
    devicesCount: 0,
  };
}

export async function createClient(
  data: Omit<Client, "id" | "createdAt" | "devicesCount">,
): Promise<Client> {
  const group = await api.post<any>("/groups", {
    name: data.name,
    attributes: {
      document: data.document || "",
      email: data.email || "",
      phone: data.phone || "",
      address: data.address || "",
      plan: data.plan || "basic",
      status: data.status || "active",
      createdAt: new Date().toISOString(),
    },
  });
  return {
    ...data,
    id: group.id,
    createdAt: group.attributes?.createdAt || new Date().toISOString(),
    devicesCount: 0,
  };
}

export async function updateClient(
  id: number,
  data: Partial<Client>,
): Promise<Client> {
  // Busca atributos atuais para não sobrescrever campos não enviados
  let currentAttributes: Record<string, any> = {};
  try {
    const current = await api.get<any>(`/groups/${id}`);
    currentAttributes = current?.attributes || {};
  } catch {
    /* segue com objeto vazio */
  }

  const group = await api.put<any>(`/groups/${id}`, {
    id,
    name: data.name,
    attributes: {
      ...currentAttributes,
      ...(data.document !== undefined ? { document: data.document } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.plan !== undefined ? { plan: data.plan } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
  return {
    ...(data as Client),
    id: group.id,
  };
}

export async function deleteClient(id: number): Promise<void> {
  await api.delete<void>(`/groups/${id}`);
}

// Users API (usando Traccar)
export async function getUsers(ownerUserId?: number): Promise<User[]> {
  // Quando em impersonação, filtra apenas os usuários gerenciados pelo usuário alvo
  // evitando que usuários do admin apareçam na conta do cliente impersonado.
  const impersonatingUserId = getImpersonatingUserId();

  let params: Record<string, any> | undefined;
  if (impersonatingUserId) {
    params = { userId: impersonatingUserId };
    console.log(
      "[getUsers] Impersonação ativa — filtrando por userId:",
      impersonatingUserId,
    );
  } else if (ownerUserId) {
    params = { userId: ownerUserId };
    console.log("[getUsers] Filtrando usuários do owner:", ownerUserId);
  }

  const traccarUsers = await api.get<any[]>("/users", params);
  return traccarUsers.map(mapTraccarToUser);
}

export async function getUserById(id: number): Promise<User> {
  const traccarUser = await api.get<any>(`/users/${id}`);
  return mapTraccarToUser(traccarUser);
}

export async function createUser(
  data: Omit<User, "id" | "createdAt" | "updatedAt">,
): Promise<User> {
  console.log(
    "[API] createUser - Dados originais:",
    JSON.stringify(data, null, 2),
  );

  // Transformar para formato Traccar
  const traccarData = mapUserToTraccar(data);
  console.log(
    "[API] createUser - Dados transformados para Traccar:",
    JSON.stringify(traccarData, null, 2),
  );

  try {
    const result = await api.post<any>("/users", traccarData);
    console.log("[API] Usuário criado com sucesso:", result);
    return mapTraccarToUser(result);
  } catch (error) {
    console.error("[API] Erro ao criar usuário:", error);
    throw error;
  }
}

export async function updateUser(
  id: number,
  data: Partial<User>,
): Promise<User> {
  const traccarData = mapUserToTraccar(data);
  const result = await api.put<any>(`/users/${id}`, { ...traccarData, id });
  return mapTraccarToUser(result);
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete<void>(`/users/${id}`);
}

// Drivers API (Traccar /drivers endpoint)
export async function getDrivers(): Promise<import("@/types").Driver[]> {
  const impersonatingUserId = getImpersonatingUserId();
  const params = impersonatingUserId
    ? { userId: impersonatingUserId }
    : undefined;
  if (impersonatingUserId) {
    console.log(
      "[getDrivers] Impersonação ativa — filtrando por userId:",
      impersonatingUserId,
    );
  }
  try {
    const traccarDrivers = await api.get<any[]>("/drivers", params);
    return (traccarDrivers || []).map((d) => ({
      id: d.id,
      name: d.name,
      uniqueId: d.uniqueId,
      document: d.attributes?.document || "",
      licenseNumber: d.attributes?.licenseNumber || "",
      licenseCategory: d.attributes?.licenseCategory || "B",
      licenseExpiry: d.attributes?.licenseExpiry || "",
      phone: d.attributes?.phone || "",
      email: d.attributes?.email || "",
      photo: d.attributes?.photo || "",
      status: d.attributes?.status || "active",
      clientId: d.attributes?.clientId,
      currentDeviceId: d.attributes?.currentDeviceId,
      createdAt: d.attributes?.createdAt || new Date().toISOString(),
      updatedAt: d.attributes?.updatedAt || new Date().toISOString(),
    }));
  } catch (error) {
    console.error("[getDrivers] Erro ao buscar motoristas:", error);
    return [];
  }
}

export async function createDriver(
  data: Partial<import("@/types").Driver>,
): Promise<import("@/types").Driver> {
  const payload = {
    name: data.name || "",
    uniqueId: data.document || `drv-${Date.now()}`,
    attributes: {
      document: data.document || "",
      licenseNumber: data.licenseNumber || "",
      licenseCategory: data.licenseCategory || "B",
      licenseExpiry: data.licenseExpiry || "",
      phone: data.phone || "",
      email: data.email || "",
      photo: data.photo || "",
      status: data.status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
  const result = await api.post<any>("/drivers", payload);
  return {
    ...data,
    id: result.id,
    createdAt: result.attributes?.createdAt || new Date().toISOString(),
    updatedAt: result.attributes?.updatedAt || new Date().toISOString(),
  } as import("@/types").Driver;
}

export async function updateDriver(
  id: number,
  data: Partial<import("@/types").Driver>,
): Promise<import("@/types").Driver> {
  let currentAttributes: Record<string, any> = {};
  try {
    const current = await api.get<any>(`/drivers/${id}`);
    currentAttributes = current?.attributes || {};
  } catch {}
  const payload = {
    id,
    name: data.name,
    uniqueId: data.document || currentAttributes.document || `drv-${id}`,
    attributes: {
      ...currentAttributes,
      ...(data.document !== undefined ? { document: data.document } : {}),
      ...(data.licenseNumber !== undefined
        ? { licenseNumber: data.licenseNumber }
        : {}),
      ...(data.licenseCategory !== undefined
        ? { licenseCategory: data.licenseCategory }
        : {}),
      ...(data.licenseExpiry !== undefined
        ? { licenseExpiry: data.licenseExpiry }
        : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date().toISOString(),
    },
  };
  const result = await api.put<any>(`/drivers/${id}`, payload);
  return {
    ...data,
    id: result.id,
    updatedAt: new Date().toISOString(),
  } as import("@/types").Driver;
}

export async function deleteDriver(id: number): Promise<void> {
  await api.delete<void>(`/drivers/${id}`);
}

// Maintenances API — delegado para módulo dedicado
export {
  getMaintenances,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
} from "./maintenance";

// User Permissions API (gerenciar dispositivos do usuário - Traccar)
export async function getUserDevices(userId: number): Promise<Device[]> {
  console.log(
    `[API] getUserDevices - Buscando dispositivos para userId: ${userId}`,
  );
  try {
    // No Traccar, buscamos os devices diretamente com o parâmetro userId
    // GET /devices?userId={userId} retorna apenas os devices que o usuário tem permissão
    const devices = await api.get<any[]>("/devices", { userId });
    console.log(
      `[API] Total de dispositivos retornados para userId ${userId}:`,
      devices.length,
    );

    if (devices.length === 0) {
      console.log(`[API] Nenhum dispositivo encontrado para userId ${userId}`);
      return [];
    }

    // Os devices do Traccar já estão no formato correto (Device[])
    console.log(
      `[API] Dispositivos do usuário ${userId}:`,
      devices.map((d) => ({ id: d.id, name: d.name })),
    );
    return devices;
  } catch (error: any) {
    console.error(`[API] ERRO em getUserDevices para userId ${userId}:`, error);
    console.error(`[API] Detalhes do erro:`, {
      message: error?.message,
      status: error?.status,
      details: error?.details,
    });
    // Se o erro for porque o usuário não tem permissões, retornar array vazio
    if (error?.status === 400 || error?.status === 404) {
      console.log(
        `[API] Assumindo que usuário ${userId} não tem dispositivos, retornando array vazio`,
      );
      return [];
    }
    throw error;
  }
}

export async function addDeviceToUser(
  userId: number,
  deviceId: number,
): Promise<void> {
  console.log(
    `[API] addDeviceToUser - Adicionando permissão: userId=${userId}, deviceId=${deviceId}`,
  );
  // Adiciona permissão no Traccar
  const result = await api.post<void>("/permissions", {
    userId,
    deviceId,
  });
  console.log(`[API] Permissão adicionada com sucesso:`, result);
}

export async function removeDeviceFromUser(
  userId: number,
  deviceId: number,
): Promise<void> {
  console.log(
    `[API] removeDeviceFromUser - Removendo permissão: userId=${userId}, deviceId=${deviceId}`,
  );
  // Remove permissão no Traccar usando body JSON (conforme documentação)
  const result = await api.delete<void>(
    "/permissions",
    {
      userId: userId,
      deviceId: deviceId,
    },
    true,
  ); // useBody = true
  console.log(`[API] Permissão removida com sucesso:`, result);
}

export async function setUserDevices(
  userId: number,
  deviceIds: number[],
): Promise<void> {
  console.log(
    `[API] setUserDevices - userId: ${userId}, deviceIds:`,
    deviceIds,
  );

  // Remove todas as permissões atuais
  console.log("[API] Buscando dispositivos atuais do usuário...");
  const currentDevices = await getUserDevices(userId);
  console.log(
    `[API] Usuário possui ${currentDevices.length} dispositivos atuais:`,
    currentDevices.map((d) => d.id),
  );

  for (const device of currentDevices) {
    console.log(`[API] Removendo permissão do dispositivo ${device.id}...`);
    await removeDeviceFromUser(userId, device.id);
  }
  console.log("[API] Permissões antigas removidas");

  // Adiciona as novas permissões
  console.log(`[API] Adicionando ${deviceIds.length} novas permissões...`);
  for (const deviceId of deviceIds) {
    console.log(`[API] Adicionando permissão do dispositivo ${deviceId}...`);
    await addDeviceToUser(userId, deviceId);
  }
  console.log("[API] Todas as novas permissões adicionadas com sucesso!");
}

// User Password Management
export async function updateUserPassword(
  userId: number,
  newPassword: string,
): Promise<void> {
  console.log(`[API] updateUserPassword - userId: ${userId}`);
  // Traccar exige que enviemos todos os dados do usuário ao atualizar
  // Buscar dados originais do Traccar (não mapeados)
  const traccarUser = await api.get<any>(`/users/${userId}`);
  console.log("[API] Dados do usuário obtidos do Traccar:", {
    id: traccarUser.id,
    name: traccarUser.name,
    email: traccarUser.email,
  });

  const updateData = {
    ...traccarUser,
    id: userId,
    password: newPassword,
  };
  console.log("[API] Enviando atualização com senha...");

  await api.put<void>(`/users/${userId}`, updateData);
  console.log("[API] Senha atualizada com sucesso!");
}

// Dashboard Stats API
// deviceIds opcional: quando informado (ex.: cliente vendo só seus veículos), filtra dispositivos e eventos
export async function getDashboardStats(options?: {
  deviceIds?: number[];
}): Promise<DashboardStats> {
  const [devices, positions] = await Promise.all([
    getDevices(),
    api.get<any[]>("/positions").catch(() => [] as any[]),
  ]);
  const deviceIds = options?.deviceIds;
  const filteredDevices = deviceIds?.length
    ? devices.filter((d) => deviceIds.includes(d.id))
    : devices;

  const posMap = new Map((positions as any[]).map((p: any) => [p.deviceId, p]));

  const deviceStats: DeviceStatistics = {
    total: filteredDevices.length,
    online: 0,
    offline: 0,
    moving: 0,
    stopped: 0,
    blocked: 0,
  };
  for (const d of filteredDevices) {
    const s = deriveDeviceStatus(d.status, posMap.get(d.id));
    if (s === "moving") deviceStats.moving++;
    else if (s === "stopped") deviceStats.stopped++;
    else if (s === "blocked") deviceStats.blocked++;
    else if (s === "offline") deviceStats.offline++;
    else deviceStats.online++;
    if (s !== "offline" && s !== "blocked")
      deviceStats.online =
        deviceStats.moving +
        deviceStats.stopped +
        (deviceStats.online - deviceStats.moving - deviceStats.stopped);
  }
  // recalculate online as total minus offline/blocked
  deviceStats.online =
    filteredDevices.length - deviceStats.offline - deviceStats.blocked;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromISO = thirtyDaysAgo.toISOString();
  const toISO = now.toISOString();

  const events = await getEvents({
    from: fromISO,
    to: toISO,
    deviceIds: filteredDevices.map((d) => d.id),
  });
  const activeAlerts = events.filter(
    (e: any) => !e.attributes?.resolved,
  ).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventsToday = events.filter(
    (e) => new Date(e.serverTime) >= today,
  ).length;

  const groups = await api.get<any[]>("/groups");

  return {
    devices: deviceStats,
    activeAlerts,
    eventsToday,
    clients: groups.length,
  };
}

// Trip/Route History (usando Traccar Reports)
export async function getDeviceRoute(
  deviceId: number,
  from: string,
  to: string,
): Promise<Position[]> {
  return api.get<Position[]>("/reports/route", {
    deviceId,
    from,
    to,
  });
}
