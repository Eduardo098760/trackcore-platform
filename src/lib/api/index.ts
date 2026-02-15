import { Device, Position, Event, Command, Client, User, DashboardStats, DeviceStatistics } from '@/types';
import { api } from './client';

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
  return api.get<User[]>('/users');
}

export async function getUserById(id: number): Promise<User> {
  return api.get<User>(`/users/${id}`);
}

export async function createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  return api.post<User>('/users', data);
}

export async function updateUser(id: number, data: Partial<User>): Promise<User> {
  return api.put<User>(`/users/${id}`, { ...data, id });
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete<void>(`/users/${id}`);
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
