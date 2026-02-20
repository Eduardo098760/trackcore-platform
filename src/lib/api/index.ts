import { Device, Position, Event, Command, Client, User, DashboardStats, DeviceStatistics } from '@/types';
import { api } from './client';

/**
 * Transformação entre modelo interno (com role) e modelo Traccar (com administrator)
 */
function mapUserToTraccar(user: Partial<User>): any {
  const { role, createdAt, updatedAt, avatar, clientId, organizationId, ...traccarUser } = user as any;
  
  // Mapear role para administrator
  if (role) {
    traccarUser.administrator = role === 'admin' || role === 'superadmin';
  }
  
  // Remover campos que não existem no Traccar
  return traccarUser;
}

function mapTraccarToUser(traccarUser: any): User {
  // Mapear administrator para role
  const role = traccarUser.administrator ? 'admin' : 'operator';
  
  return {
    ...traccarUser,
    role,
    createdAt: traccarUser.createdAt || new Date().toISOString(),
    updatedAt: traccarUser.updatedAt || new Date().toISOString(),
  } as User;
}

// Devices API (usando Traccar)
export async function getDevices(): Promise<Device[]> {
  return api.get<Device[]>('/devices');
}

export async function getDeviceById(id: number): Promise<Device> {
  return api.get<Device>(`/devices/${id}`);
}

// Positions API (usando Traccar)
export async function getPositions(params?: { deviceId?: number; from?: string; to?: string }): Promise<Position[]> {
  return api.get<Position[]>('/positions', params);
}

export async function getPositionByDevice(deviceId: number): Promise<Position> {
  const positions = await api.get<Position[]>('/positions', { deviceId });
  if (!positions || positions.length === 0) {
    throw new Error('Position not found');
  }
  return positions[0];
}

// Events API (usando Traccar - Reports endpoint)
// O Traccar exige deviceId(s) ou groupId; sem isso retorna [].
export async function getEvents(params?: { 
  deviceId?: number; 
  deviceIds?: number[];
  from?: string; 
  to?: string;
  type?: string;
}): Promise<Event[]> {
  const requestParams: Record<string, unknown> = {};
  if (params?.from) requestParams.from = params.from;
  if (params?.to) requestParams.to = params.to;
  if (params?.type) requestParams.type = params.type;
  if (params?.deviceIds?.length) {
    requestParams.deviceId = params.deviceIds;
  } else if (params?.deviceId != null) {
    requestParams.deviceId = params.deviceId;
  }
  return api.get<Event[]>('/reports/events', requestParams);
}

export async function markEventAsResolved(eventId: number): Promise<Event> {
  // Traccar não tem endpoint específico para resolver eventos
  // Você pode adicionar um atributo customizado
  return api.put<Event>(`/events/${eventId}`, { 
    attributes: { resolved: true } 
  });
}

// Commands API (usando Traccar)
export async function sendCommand(deviceId: number, type: string, attributes?: any): Promise<Command> {
  const command = {
    deviceId,
    type,
    attributes: attributes || {}
  };
  
  return api.post<Command>('/commands/send', command);
}

export async function getCommands(deviceId?: number): Promise<Command[]> {
  return api.get<Command[]>('/commands', deviceId ? { deviceId } : undefined);
}

// Clients API (Traccar não tem "clients", mas podemos usar Groups)
export async function getClients(): Promise<Client[]> {
  // No Traccar, isso seria mapeado para Groups ou Users dependendo da necessidade
  const groups = await api.get<any[]>('/groups');
  return groups.map(g => ({
    id: g.id,
    name: g.name,
    email: '',
    phone: '',
    address: '',
    createdAt: '',
    devicesCount: 0,
    active: true
  }));
}

export async function getClientById(id: number): Promise<Client> {
  const group = await api.get<any>(`/groups/${id}`);
  return {
    id: group.id,
    name: group.name,
    email: '',
    phone: '',
    address: '',
    createdAt: '',
    devicesCount: 0,
    active: true
  };
}

export async function createClient(data: Omit<Client, 'id' | 'createdAt' | 'devicesCount'>): Promise<Client> {
  const group = await api.post<any>('/groups', { name: data.name });
  return {
    ...data,
    id: group.id,
    createdAt: new Date().toISOString(),
    devicesCount: 0
  };
}

export async function updateClient(id: number, data: Partial<Client>): Promise<Client> {
  const group = await api.put<any>(`/groups/${id}`, { name: data.name, id });
  return {
    ...data as Client,
    id: group.id
  };
}

export async function deleteClient(id: number): Promise<void> {
  await api.delete<void>(`/groups/${id}`);
}

// Users API (usando Traccar)
export async function getUsers(): Promise<User[]> {
  const traccarUsers = await api.get<any[]>('/users');
  return traccarUsers.map(mapTraccarToUser);
}

export async function getUserById(id: number): Promise<User> {
  const traccarUser = await api.get<any>(`/users/${id}`);
  return mapTraccarToUser(traccarUser);
}

export async function createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  console.log('[API] createUser - Dados originais:', JSON.stringify(data, null, 2));
  
  // Transformar para formato Traccar
  const traccarData = mapUserToTraccar(data);
  console.log('[API] createUser - Dados transformados para Traccar:', JSON.stringify(traccarData, null, 2));
  
  try {
    const result = await api.post<any>('/users', traccarData);
    console.log('[API] Usuário criado com sucesso:', result);
    return mapTraccarToUser(result);
  } catch (error) {
    console.error('[API] Erro ao criar usuário:', error);
    throw error;
  }
}

export async function updateUser(id: number, data: Partial<User>): Promise<User> {
  const traccarData = mapUserToTraccar(data);
  const result = await api.put<any>(`/users/${id}`, { ...traccarData, id });
  return mapTraccarToUser(result);
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete<void>(`/users/${id}`);
}

// User Permissions API (gerenciar dispositivos do usuário - Traccar)
export async function getUserDevices(userId: number): Promise<Device[]> {
  console.log(`[API] getUserDevices - Buscando dispositivos para userId: ${userId}`);
  try {
    // No Traccar, buscamos os devices diretamente com o parâmetro userId
    // GET /devices?userId={userId} retorna apenas os devices que o usuário tem permissão
    const devices = await api.get<any[]>('/devices', { userId });
    console.log(`[API] Total de dispositivos retornados para userId ${userId}:`, devices.length);
    
    if (devices.length === 0) {
      console.log(`[API] Nenhum dispositivo encontrado para userId ${userId}`);
      return [];
    }
    
    // Os devices do Traccar já estão no formato correto (Device[])
    console.log(`[API] Dispositivos do usuário ${userId}:`, devices.map(d => ({ id: d.id, name: d.name })));
    return devices;
  } catch (error: any) {
    console.error(`[API] ERRO em getUserDevices para userId ${userId}:`, error);
    console.error(`[API] Detalhes do erro:`, {
      message: error?.message,
      status: error?.status,
      details: error?.details
    });
    // Se o erro for porque o usuário não tem permissões, retornar array vazio
    if (error?.status === 400 || error?.status === 404) {
      console.log(`[API] Assumindo que usuário ${userId} não tem dispositivos, retornando array vazio`);
      return [];
    }
    throw error;
  }
}

export async function addDeviceToUser(userId: number, deviceId: number): Promise<void> {
  console.log(`[API] addDeviceToUser - Adicionando permissão: userId=${userId}, deviceId=${deviceId}`);
  // Adiciona permissão no Traccar
  const result = await api.post<void>('/permissions', {
    userId,
    deviceId
  });
  console.log(`[API] Permissão adicionada com sucesso:`, result);
}

export async function removeDeviceFromUser(userId: number, deviceId: number): Promise<void> {
  console.log(`[API] removeDeviceFromUser - Removendo permissão: userId=${userId}, deviceId=${deviceId}`);
  // Remove permissão no Traccar usando body JSON (conforme documentação)
  const result = await api.delete<void>('/permissions', {
    userId: userId,
    deviceId: deviceId
  }, true); // useBody = true
  console.log(`[API] Permissão removida com sucesso:`, result);
}

export async function setUserDevices(userId: number, deviceIds: number[]): Promise<void> {
  console.log(`[API] setUserDevices - userId: ${userId}, deviceIds:`, deviceIds);
  
  // Remove todas as permissões atuais
  console.log('[API] Buscando dispositivos atuais do usuário...');
  const currentDevices = await getUserDevices(userId);
  console.log(`[API] Usuário possui ${currentDevices.length} dispositivos atuais:`, currentDevices.map(d => d.id));
  
  for (const device of currentDevices) {
    console.log(`[API] Removendo permissão do dispositivo ${device.id}...`);
    await removeDeviceFromUser(userId, device.id);
  }
  console.log('[API] Permissões antigas removidas');
  
  // Adiciona as novas permissões
  console.log(`[API] Adicionando ${deviceIds.length} novas permissões...`);
  for (const deviceId of deviceIds) {
    console.log(`[API] Adicionando permissão do dispositivo ${deviceId}...`);
    await addDeviceToUser(userId, deviceId);
  }
  console.log('[API] Todas as novas permissões adicionadas com sucesso!');
}

// User Password Management
export async function updateUserPassword(userId: number, newPassword: string): Promise<void> {
  console.log(`[API] updateUserPassword - userId: ${userId}`);
  // Traccar exige que enviemos todos os dados do usuário ao atualizar
  // Buscar dados originais do Traccar (não mapeados)
  const traccarUser = await api.get<any>(`/users/${userId}`);
  console.log('[API] Dados do usuário obtidos do Traccar:', { id: traccarUser.id, name: traccarUser.name, email: traccarUser.email });
  
  const updateData = {
    ...traccarUser,
    id: userId,
    password: newPassword
  };
  console.log('[API] Enviando atualização com senha...');
  
  await api.put<void>(`/users/${userId}`, updateData);
  console.log('[API] Senha atualizada com sucesso!');
}

// Dashboard Stats API
// deviceIds opcional: quando informado (ex.: cliente vendo só seus veículos), filtra dispositivos e eventos
export async function getDashboardStats(options?: { deviceIds?: number[] }): Promise<DashboardStats> {
  const devices = await getDevices();
  const deviceIds = options?.deviceIds;
  const filteredDevices = deviceIds?.length
    ? devices.filter((d) => deviceIds.includes(d.id))
    : devices;

  const deviceStats: DeviceStatistics = {
    total: filteredDevices.length,
    online: filteredDevices.filter(d => d.status === 'online' || d.status === 'moving').length,
    offline: filteredDevices.filter(d => d.status === 'offline').length,
    moving: filteredDevices.filter(d => d.status === 'moving').length,
    stopped: filteredDevices.filter(d => d.status === 'stopped').length,
    blocked: filteredDevices.filter(d => d.status === 'blocked').length
  };

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromISO = thirtyDaysAgo.toISOString();
  const toISO = now.toISOString();

  const events = await getEvents({
    from: fromISO,
    to: toISO,
    deviceIds: filteredDevices.map((d) => d.id)
  });
  const activeAlerts = events.filter((e: any) => !e.attributes?.resolved).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventsToday = events.filter(e =>
    new Date(e.serverTime) >= today
  ).length;

  const groups = await api.get<any[]>('/groups');

  return {
    devices: deviceStats,
    activeAlerts,
    eventsToday,
    clients: groups.length
  };
}

// Trip/Route History (usando Traccar Reports)
export async function getDeviceRoute(deviceId: number, from: string, to: string): Promise<Position[]> {
  return api.get<Position[]>('/reports/route', {
    deviceId,
    from,
    to
  });
}
